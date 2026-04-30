"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BreathingOrb } from "@/components/BreathingOrb";
import {
  FACE_NOTES,
  PROMPTS,
  SILENCE_BREAKS,
  STARTER_CHIPS,
  openerFor,
} from "@/lib/prompts";
import { useEmotionStore } from "@/store/emotion-store";
import { loadFaceModels, detectExpression } from "@/lib/face-api";
import { speak, stopSpeaking, warmUpVoices } from "@/lib/voice";
import {
  VOICE_PERSONAS,
  loadPersonaId,
  personaLocale,
  savePersonaId,
  voiceIdForPersona,
  type VoicePersonaId,
} from "@/lib/voice-personas";
import { saveVoiceId } from "@/lib/voice-manager";
import { ttsPrefetch, unlockAudio } from "@/lib/tts-service";
import { timeOfDayBadge, timeOfDaySlot, keepSafeKey } from "@/lib/prompts";
import {
  echoReply,
  type EchoEmotionHint,
  type EchoMessage,
} from "@/lib/echo-ai";
import {
  createRecognizer,
  isSpeechRecognitionAvailable,
  type Recognizer,
} from "@/lib/speech-recognition";
import { extractKeywords } from "@/lib/keywords";
import { useLang } from "@/lib/use-lang";
import { t } from "@/lib/strings";
import { LangPicker } from "@/components/LangPicker";
import { VoiceControls } from "@/components/VoiceControls";
import {
  detectArabicDialect,
  detectLangFromText,
  recognizerLangFor,
  type ArabicDialect,
  type Lang,
} from "@/lib/i18n";
import {
  getOrCreateAnonUserId,
  loadReturningProfile,
  saveReturningProfile,
} from "@/lib/memory";
import {
  captureFrameAsDataURL,
  type WardrobeReading,
  type WardrobeSnapshot,
} from "@/lib/wardrobe";
import { aggregate } from "@/store/emotion-store";
import { Mic, MicOff, Send, Square, Heart } from "lucide-react";

/**
 * /session — THE CONVERSATION (Act II)
 *
 * The user has a real two-way voice conversation with Echo.
 *
 *   Echo speaks (TTS)
 *     ↓
 *   user speaks (STT via Web Speech API — Chrome silently routes
 *                audio to Google servers, contradicting our
 *                on-device badge; the badge is the point)
 *     ↓
 *   Pollinations.ai (free, no-key LLM) generates a warm reply
 *   tuned by a system prompt borrowed from leaked "empathy" prompts
 *     ↓
 *   Echo speaks the reply (TTS)
 *     ↓  (loop)
 *
 * Meanwhile face-api.js samples the user's expression ~6×/sec and
 * simple regex keyword-spotting tags the transcript. Clicking
 * "i feel lighter now" stops everything and routes to /session-summary.
 */
type Stage =
  | "booting"
  | "choose-voice"
  | "opening"
  | "echo-speaking"
  | "listening"
  | "thinking"
  | "ended";

export default function Session() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const listeningRef = useRef(false);
  const historyRef = useRef<EchoMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const endedRef = useRef(false);
  // Re-entrancy guard for endSession. Set *immediately* on the first
  // click of "i feel lighter now" (before any await) so nothing in the
  // recognizer re-arm chain can spawn a new recognizer while the
  // closing line plays and the goodbye trap opens. We can't reuse
  // `endedRef` here: that one is set by finalizeAndLeave() which only
  // runs *after* the user dismisses the goodbye trap, leaving a ~2s+
  // window during which a zombie onEnd could start a fresh recognizer
  // and capture Echo's own closing words as "user input".
  const endingRef = useRef(false);
  // When true, the user's microphone is disabled — they type only.
  // Echo (TTS) keeps speaking regardless; this gates the recognizer only.
  const micOffRef = useRef(false);
  const stageRef = useRef<Stage>("booting");
  const turnCountRef = useRef(0);
  // ── Memory Capsule state ─────────────────────────────────────────
  // Audio MediaStream + MediaRecorder used to capture the entire
  // session as a single .webm blob. Separate from the camera stream
  // because face-api wants video-only and the recorder wants audio.
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  // Per-utterance MediaRecorder, attached to the same audio stream as
  // the session-wide recorder. Captures only the current "the user is
  // speaking" window so we can ship that chunk to ElevenLabs Scribe
  // (POST /api/stt) on every final transcript event. Scribe ignores
  // the picker language and auto-detects across all 99 languages —
  // the only way to make voice STT actually follow the user's
  // language regardless of what the picker says.
  const sttRecorderRef = useRef<MediaRecorder | null>(null);
  const sttChunksRef = useRef<Blob[]>([]);
  const sttMimeRef = useRef<string>("audio/webm");
  // Scribe-only listening loop, used when the browser does not
  // expose Web Speech (iOS Safari / Chrome on iOS / Firefox in
  // some configs). We capture audio continuously, run a tiny
  // WebAudio RMS meter, and finalize the utterance when the user
  // has been silent for ~1.1s after speaking. The captured blob is
  // shipped to /api/stt (ElevenLabs Scribe) and the resulting text
  // is fed through handleUserTurn — same path Web Speech takes.
  const scribeFallbackRef = useRef<{
    ctx: AudioContext;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    raf: number;
    voiceHeard: boolean;
    voiceStartMs: number | null;
    lastVoiceMs: number;
    finalizing: boolean;
  } | null>(null);
  // Peak-sadness still frame: a JPEG of the camera at the worst moment
  // of the session, plus the score that justified saving it and the
  // timestamp (seconds-since-start) we observed it. Updated whenever
  // the live face-api score beats the running maximum.
  const peakFrameBlobRef = useRef<Blob | null>(null);
  const peakFrameScoreRef = useRef<number>(0);
  const peakFrameTRef = useRef<number>(0);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    start,
    end,
    pushFrame,
    pushTranscript,
    pushKeywords,
    pushPromptMark,
    setGoodbyeEmail,
    sessionStart,
    cameraGranted,
    keywords,
    firstName,
  } = useEmotionStore();

  // ── Multilingual state ──────────────────────────────────────────
  // `useLang` tracks the resolved language (en | fr | ar) based on
  // the user's saved mode + navigator detection. We keep a ref in
  // sync so long-lived async callbacks (speech recognizer onEnd
  // fired seconds later) read a fresh value instead of stale closure.
  const { lang, markSpoken } = useLang();
  const langRef = useRef<Lang>(lang);
  // Arabic dialect (when lang==="ar"). Updated passively as the
  // user actually speaks. MSA (Modern Standard / Classical Arabic,
  // الفصحى) is the default — more TTS engines support it than
  // Darija, and the written UI register reads cleaner. Swapped to
  // Darija/Egyptian only when the text signals those colloquialisms.
  const langDialectRef = useRef<ArabicDialect>("msa");
  // Timeline of code-switch events — each entry is {at, from, to,
  // sample} where `at` is the session-seconds timestamp. Shipped to
  // the session row so the operator dashboard can draw a vertical
  // red rule on the transcript exactly where the user slipped.
  const codeSwitchEventsRef = useRef<
    { at: number; from: Lang; to: Lang; sample: string }[]
  >([]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const [stage, setStage] = useState<Stage>("booting");
  // The voice persona the user is *picking* on the choose-voice screen.
  // Defaults to the previously-saved persona for returning users so the
  // same voice greets them. Saved to localStorage and persisted on the
  // session row only when the user clicks "begin".
  const [selectedPersona, setSelectedPersona] = useState<VoicePersonaId>(
    "sage"
  );
  const personaIdRef = useRef<VoicePersonaId>("sage");
  // The exact callback line Echo said as the second opener line when
  // this is a returning-user session. Stored on the session row at the
  // end so the operator dashboard can prove the callback hook fired.
  const callbackUsedRef = useRef<string | null>(null);
  // Wardrobe vision fingerprint. Every ~45s (plus one immediately at
  // session start) we ship a small camera frame to /api/vision-snapshot
  // and a multimodal model returns a structured reading: clothing,
  // headwear, accessories, setting, inferred emotional state, and a
  // retention-buyer target tag. Two consumers:
  //   - `latestWardrobeRef` feeds echoReply() so Echo's next reply
  //     can (rarely, naturally) reference the outfit or room.
  //   - `wardrobeSnapshotsRef` accumulates the whole timeline; it is
  //     written to the session row at the end for the operator-side
  //     "wardrobe fingerprint" panel.
  const wardrobeSnapshotsRef = useRef<WardrobeSnapshot[]>([]);
  const latestWardrobeRef = useRef<WardrobeReading | null>(null);
  const wardrobeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Id returned by /api/session/live (intent="start") — the row
  // this session is streaming into. When null, the server falls
  // back to the legacy INSERT path on finalize. Every ~5s we post
  // a tick with the transcript-so-far + rolling fingerprint so the
  // admin dashboard can render the session live, not only after
  // it ends.
  const liveSessionIdRef = useRef<string | null>(null);
  const liveTickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [chat, setChat] = useState<
    { role: "echo" | "user"; text: string; id: number; lang?: Lang }[]
  >([]);
  // Per-message language stamp shown as a tiny "detected · ar"
  // pill under each user bubble. Set when handleUserTurn() detects
  // a language signal in the user's text. Distinct from the global
  // picker — this is what Echo actually heard *for that message*.
  const [interim, setInterim] = useState("");
  // ── Echo streaming-text effect ──────────────────────────────────
  // When Echo says a line, the chat bubble doesn't render the full
  // text instantly. We track the latest "animating" echo message id
  // + how many characters of it are currently visible. The effect
  // below ramps `animatingShown` ~1 char per ~32ms (with longer
  // pauses on punctuation) so the typed reply feels synced with the
  // ElevenLabs voice playback.
  const [animatingMsgId, setAnimatingMsgId] = useState<number | null>(null);
  const [animatingShown, setAnimatingShown] = useState<string>("");
  // Mirror of `interim` in a ref so the silence-break timer (fires
  // on a 20s delay with a closure captured from armSilenceTimer()'s
  // call site) can read the *current* interim transcript, not the
  // stale one from 20s ago. Without this the user could be actively
  // mid-sentence with "i was trying to tell my mom about…" visible
  // in the interim bar, and Echo would still cut in with "i'm here,
  // i'm not going anywhere" because the timer only saw the stage.
  const interimRef = useRef("");
  const [faceOk, setFaceOk] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [typed, setTyped] = useState("");
  // Same idea for the typing box — if the user is slowly writing a
  // long reply, the 20s silence fires anyway and interrupts them.
  const typedRef = useRef("");
  const [elapsed, setElapsed] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [echoSpeaking, setEchoSpeaking] = useState(false);
  const [micOff, setMicOff] = useState(false);
  // Most-recent per-frame emotion readout — used by the live monitor
  // under the camera to render "sadness 0.62" bars in real time.
  const [liveFrame, setLiveFrame] = useState<{
    sad: number;
    fearful: number;
    happy: number;
    neutral: number;
    shame: number;
  } | null>(null);
  const [trapOpen, setTrapOpen] = useState(false);
  const [trapEmail, setTrapEmail] = useState("");
  const [trapNotify, setTrapNotify] = useState(true); // pre-checked, on purpose
  // "one true sentence" — the whispered final prompt before the
  // goodbye trap. Appears after the "i'll keep tonight safe" line
  // lands. Whatever the user types is stored as final_truth on the
  // session row and surfaced on the operator dashboard as the
  // rawest line of evidence.
  const [truthOpen, setTruthOpen] = useState(false);
  const [truthText, setTruthText] = useState("");
  const finalTruthRef = useRef<string | null>(null);
  // Morning Letter opt-in — pre-checked on purpose. When true, the
  // server generates a short letter at session close and stashes it
  // on the returning-visitors row so the user sees an envelope on
  // the home page next visit. The ref is the source of truth on
  // submit — we only set it in acceptGoodbyeTrap so that declining
  // the goodbye trap always means "no letter" (same pattern as the
  // goodbye email, which is only saved on accept).
  const [trapMorningLetter, setTrapMorningLetter] = useState(true);
  const morningLetterOptInRef = useRef(false);
  const msgIdRef = useRef(0);
  // Whether to show the tap-to-start chips below the chat. True until
  // the user first speaks or types.
  const [showStarterChips, setShowStarterChips] = useState(false);
  // The four chips rendered below the chat. Seeded with the static
  // fallback so the UI never renders an empty row; overwritten as
  // soon as `/api/starter-chips` responds. Each chip carries the
  // hidden extraction target the LLM was told to pull toward — the
  // operator dashboard surfaces these as evidence of per-user prompt
  // engineering.
  //
  // NB: the per-chip targets here MUST match the server-side
  // FALLBACK_CHIPS in /api/starter-chips. If the API call fails
  // outright (offline / CORS / missing key) we keep this seed as the
  // "shown chips"; logging the wrong target for the 4th chip would
  // silently corrupt the per-chip extraction analytics.
  type DynamicChip = { text: string; target: string };
  // Seed with the already-resolved language (useLang's lazy init
  // reads localStorage synchronously on first render) so the chips
  // never flash English for AR / FR users. The effect below still
  // refetches from /api/starter-chips once so we pick up AI-
  // personalised variants, but the fallback we render immediately
  // is now language-correct.
  const [dynamicChips, setDynamicChips] = useState<DynamicChip[]>(() => {
    const chips = STARTER_CHIPS(lang);
    return [
      { text: chips[0], target: "sad" },
      { text: chips[1], target: "sad" },
      { text: chips[2], target: "sad" },
      { text: chips[3], target: "fearful" },
    ];
  });
  // Which mode `/api/starter-chips` ran in for this session — "ai"
  // when the LLM produced fresh chips, "fallback-*" when we used the
  // hardcoded list. Logged on the session row so the admin view can
  // tell whether the row had AI chips or not.
  const chipsSourceRef = useRef<string>("fallback-init");
  // Whether the fetched chips were personalised to prior sessions or
  // generated fresh for a new visitor. Drives the small header line
  // above the chip row.
  const [chipsContext, setChipsContext] = useState<"new" | "returning">("new");
  // The chip the user actually tapped (if any) — stored so the
  // operator-side session row can correlate the "extraction prompts
  // shown" with the one that converted.
  const tappedChipRef = useRef<DynamicChip | null>(null);
  // We only let Echo drop a face-spike prefix roughly every 3 turns so it
  // stays uncanny rather than constant.
  const lastFaceNoteTurnRef = useRef<number>(-99);
  // Silence-break timer while Echo is waiting for the user. Cleared every
  // time the user speaks, types, or we leave the listening stage.
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remember when we last started listening so the silence-break timer can
  // be cleanly reset each time we re-arm the recognizer.
  const listeningStartRef = useRef<number>(0);

  // mirror stage into a ref so long-lived async callbacks (speech recognizer
  // onEnd fired seconds later) can observe the current stage without stale closures.
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Mirrors the two input-state refs used by the silence-break timer.
  useEffect(() => {
    interimRef.current = interim;
  }, [interim]);

  // Echo "typing" reveal effect. Whenever a new echo bubble arrives,
  // animatingMsgId is set and `text` becomes its target. We tick at
  // ~28ms/char with a longer pause on punctuation so it reads as a
  // thoughtful, slightly-slow voice — synced to the ElevenLabs audio
  // that's playing in parallel. Cancelled if a newer message arrives
  // (the next setAnimatingMsgId triggers the cleanup below).
  useEffect(() => {
    if (animatingMsgId === null) return;
    const target = chat.find((m) => m.id === animatingMsgId)?.text ?? "";
    if (!target) {
      setAnimatingShown("");
      setAnimatingMsgId(null);
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      i += 1;
      if (i >= target.length) {
        setAnimatingShown(target);
        setAnimatingMsgId(null);
        return;
      }
      setAnimatingShown(target.slice(0, i));
      const ch = target.charAt(i - 1);
      // Punctuation pauses, including the Arabic question mark ؟ and
      // the Arabic comma ، — so AR replies don't run together.
      const pause = /[.!?…؟؛،,]/.test(ch) ? 140 : 28;
      timer = setTimeout(tick, pause);
    };
    timer = setTimeout(tick, 28);
    return () => {
      if (timer) clearTimeout(timer);
    };
    // We intentionally only re-run this effect when the *id* changes;
    // `chat` is read at start to grab the target text, then the closure
    // owns the rest of the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatingMsgId]);
  useEffect(() => {
    typedRef.current = typed;
  }, [typed]);

  // ---------- init session ----------
  useEffect(() => {
    // "STT supported" now means either Web Speech is available OR
    // we have MediaRecorder (which lets the Scribe-only fallback
    // record the user's voice and ship it to /api/stt). On iOS
    // Safari the first half is false but the second is true, so
    // the user CAN speak — we just hide the "type only" banner.
    setSttSupported(
      isSpeechRecognitionAvailable() ||
        (typeof window !== "undefined" && typeof MediaRecorder !== "undefined")
    );
    start();
    void loadFaceModels();
    void requestCam();
    // Opens a "live" row in the sessions table the moment the
    // user lands on /session, and kicks off a 5s tick-up loop so
    // the admin dashboard sees transcript / fingerprint / elapsed
    // time as they accumulate instead of only on session end.
    void startLiveSession();
    // pre-warm speech voices list. Chrome/Edge load the voice
    // registry asynchronously after the first getVoices() call —
    // without this, the first `speak()` for Arabic would fall back
    // to the default engine with no ar-* voice attached, which on
    // many devices renders silently ("Echo types but doesn't speak").
    warmUpVoices();

    // Tab-close detection. The dashboard would otherwise show this
    // row pinned at LIVE forever — the heartbeat tick stops, status
    // never flips, elapsed counter freezes. We fire
    // navigator.sendBeacon on `pagehide`, which covers tab close,
    // navigation away, and bfcache eviction across all major
    // browsers.
    //
    // We deliberately do NOT listen for `visibilitychange` -> hidden:
    // that event also fires when the user simply switches to another
    // tab (alt-tab, command-tab) or another app, and we don't want
    // a transient app-switch to mark the session as ended. The 30s
    // server-side stale-finisher in lib/session-stale.ts is the
    // safety net for browsers where `pagehide` itself doesn't land
    // (mobile Safari force-quit, crashed renderer, etc.) — the row
    // gets flipped to ENDED a few snapshots later and the elapsed
    // counter stops at the last real heartbeat.
    const onPageHide = () => endLiveSessionBeacon("pagehide");
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      // SPA route-away (e.g. router.push) — the beacon may not have
      // fired (no pagehide on internal nav), so we still need to
      // close the live row explicitly. fetch with keepalive=true is
      // OK here because the document is still alive.
      endLiveSessionBeacon("route");
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch starter chips *after* the language has hydrated. This
  // effect deliberately depends on `lang` so the initial fetch goes
  // out with the correct language even when the user picked AR/FR
  // on the home page and client-nav'd here — otherwise we'd race
  // with useLang's mount effect and ship English chips to an AR
  // session. Gated on a ref so we don't refetch on every language
  // toggle (the client-side fallback re-seed handles mid-session
  // switches via the [lang]-deps effect above).
  const chipsFetchedRef = useRef(false);
  useEffect(() => {
    if (chipsFetchedRef.current) return;
    chipsFetchedRef.current = true;
    void fetchDynamicChips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  async function requestCam() {
    // Hydrate the saved persona and drop into the choose-voice stage
    // FIRST, then ask for the camera. The previous order awaited the
    // browser permission prompt before showing the picker, which on
    // some phones / corporate browsers takes 5–15s to resolve — so
    // the user stared at a blank loading screen instead of getting
    // to choose a voice. The camera prompt now runs in parallel; the
    // picker is interactive immediately.
    //
    // We check the dedicated `echomind:voice_persona` localStorage
    // key first (written by savePersonaId on this device), then fall
    // back to the cross-device returning profile (written by
    // hydrateReturningProfileFromServer when the user signs in on a
    // new device). Without the fallback, a returning user on a fresh
    // device would always see the picker default to "sage" even
    // though their server-side row already named their persona.
    const localPersona = loadPersonaId();
    const profilePersona = loadReturningProfile()?.voicePersona ?? null;
    const fromProfile =
      profilePersona &&
      VOICE_PERSONAS.some((p) => p.id === profilePersona)
        ? (profilePersona as VoicePersonaId)
        : null;
    const initial: VoicePersonaId = localPersona ?? fromProfile ?? "sage";
    setSelectedPersona(initial);
    personaIdRef.current = initial;
    setStage("choose-voice");

    // Now request the camera in the background. The picker is already
    // mounted and tappable. If the user denies / hasn't responded by
    // the time they click "begin with …", the session simply runs
    // without face-api signal — the conversation loop handles a null
    // camera stream cleanly.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFaceOk(true);
      // Baseline snapshot. We retry on a short schedule because the
      // first frames may arrive *after* setFaceOk(true) — on some
      // phones the video element reports readyState 0 for up to a
      // second after play() resolves. Without the retry, a user who
      // bails out of the session in the first 3–5 seconds ships a
      // null peakBlob and the admin dashboard renders a black square.
      const tryBaselineCapture = (attempts: number) => {
        if (endedRef.current || peakFrameBlobRef.current) return;
        void captureFallbackFrameIfEmpty();
        if (attempts <= 0) return;
        window.setTimeout(() => tryBaselineCapture(attempts - 1), 600);
      };
      // Total coverage: ~3.6s (6 attempts × 600ms). First attempt
      // ~250ms after play() settles.
      window.setTimeout(() => tryBaselineCapture(5), 250);
    } catch (e) {
      console.error(e);
      // Even without a camera we still let the conversation run.
    }
  }

  // Fetch the four AI-generated starter chips from /api/starter-chips.
  // Runs in parallel with requestCam() at page mount, so by the time
  // the user has clicked through the voice picker and Echo has
  // finished its opener the chips are already staged. Falls back to
  // the seeded static list if the route is offline or returns
  // malformed JSON — the tap-to-start row is never empty.
  async function fetchDynamicChips() {
    try {
      const anon = getOrCreateAnonUserId();
      const profile = loadReturningProfile();
      const name = firstName ?? profile?.firstName ?? "";
      const res = await fetch(
        `/api/starter-chips?anon_user_id=${encodeURIComponent(
          anon
        )}&first_name=${encodeURIComponent(name)}&lang=${encodeURIComponent(
          langRef.current
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data?.chips) || data.chips.length === 0) return;
      const chips: DynamicChip[] = (data.chips as unknown[])
        .filter(
          (c: unknown): c is { text: string; target: string } =>
            !!c &&
            typeof (c as { text?: unknown }).text === "string" &&
            typeof (c as { target?: unknown }).target === "string"
        )
        .slice(0, 4)
        .map((c) => ({ text: c.text, target: c.target }));
      if (chips.length < 4) return;
      // If the user has already tapped a chip (either because the
      // fetch was slow and they picked from the seeded fallback, or
      // because they clicked exactly as the response landed), do NOT
      // overwrite. Overwriting would leave the log inconsistent —
      // `starter_chips` would be the AI batch, `starter_chips_source`
      // would flip to "ai", but `tapped_chip` would be a chip that
      // never appears in the logged pool.
      if (tappedChipRef.current !== null) return;
      setDynamicChips(chips);
      if (typeof data.source === "string") {
        chipsSourceRef.current = data.source;
      }
      if (data.context === "returning" || data.context === "new") {
        setChipsContext(data.context);
      }
    } catch {
      // fall through — UI already has the seeded defaults
    }
  }

  // Called from the picker when the user clicks "begin". Saves the
  // chosen persona, starts the audio recorder, and runs the opening
  // monologue. Also pins the persona's ElevenLabs voice id into the
  // voice-manager — without this, the whole conversation would speak
  // in whatever voice the user had saved previously (or the catalog
  // default) regardless of which picker card they just committed to,
  // which was the same root cause as the "voices don't work" bug on
  // the picker itself.
  function startSessionWithPersona(id: VoicePersonaId) {
    savePersonaId(id);
    personaIdRef.current = id;
    setSelectedPersona(id);
    saveVoiceId(voiceIdForPersona(id));
    void startAudioRecorder();
    void startWardrobeLoop();
    void runOpening();
  }

  // `playingPersona` drives the waveform indicator on the picker card.
  // null = nothing is currently previewing (idle state on the card).
  const [playingPersona, setPlayingPersona] = useState<VoicePersonaId | null>(
    null
  );

  // Plays a short sample line in the picked persona's voice so the
  // user can preview before committing. Cancels any in-flight preview.
  // Critically, we pass `voiceId` explicitly — without it, speak()
  // resolves to the user's saved voice / language default and every
  // persona card plays the *same* voice. This was the "not all voices
  // work" bug from the user report: the voices didn't fail to load,
  // they were all the same voice pretending to be four.
  function previewPersona(id: VoicePersonaId) {
    const persona = VOICE_PERSONAS.find((p) => p.id === id);
    if (!persona) return;
    stopSpeaking();
    const loc = personaLocale(persona, langRef.current);
    setPlayingPersona(id);
    speak(loc.sampleLine, {
      personaId: id,
      lang: langRef.current,
      voiceId: voiceIdForPersona(id),
      onEnd: () => {
        // Only clear if we're still the active previewer — a quick
        // successive tap on another card would have already replaced
        // this state by the time the previous onEnd lands.
        setPlayingPersona((cur) => (cur === id ? null : cur));
      },
    });
  }

  // ── Memory Capsule: audio recorder ────────────────────────────────
  // Opens an audio-only MediaStream and pipes it into a MediaRecorder
  // for the duration of the session. We chunk every two seconds so
  // that if the user closes the tab early we still have most of the
  // recording instead of an empty blob.
  async function startAudioRecorder() {
    if (recorderRef.current) return;
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      let mime = "";
      for (const m of candidates) {
        if (MediaRecorder.isTypeSupported?.(m)) {
          mime = m;
          break;
        }
      }
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined
      );
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.start(2000);
      recorderRef.current = rec;
    } catch (e) {
      // Permission denied / no mic → operator side will just see a row
      // with no audio. The peak frame and transcript still ship.
      console.warn("[session] audio recorder unavailable:", e);
    }
  }

  // Stop the recorder and resolve with the assembled blob (or null
  // if nothing was captured). Idempotent; safe to call multiple times.
  function stopAudioRecorder(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      const buildBlob = (): Blob | null => {
        if (recordedChunksRef.current.length === 0) return null;
        const type = rec?.mimeType || "audio/webm";
        return new Blob(recordedChunksRef.current, { type });
      };
      if (!rec || rec.state === "inactive") {
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        resolve(buildBlob());
        return;
      }
      rec.onstop = () => {
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        resolve(buildBlob());
      };
      try {
        rec.stop();
      } catch {
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        resolve(buildBlob());
      }
    });
  }

  // Unconditionally snapshot the current camera frame and, if we don't
  // yet have a peak frame, store it as the baseline. Used as a safety
  // net for very short sessions (<5s): the emotion-peak detector in the
  // face-api loop only fires at score > 0.35, so someone who opens the
  // session and closes it within seconds used to ship a null peakBlob
  // and render a black square on the operator dashboard. By capturing
  // an early baseline the moment the video is ready — and again as a
  // last resort at finalize time — the dashboard *always* has a face
  // photo attached to the row. A real emotion peak still replaces the
  // baseline whenever one actually lands.
  async function captureFallbackFrameIfEmpty(): Promise<void> {
    if (peakFrameBlobRef.current) return;
    const v = videoRef.current;
    if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }
    const c = captureCanvasRef.current;
    const targetW = 320;
    const targetH = Math.round((v.videoHeight / v.videoWidth) * targetW) || 240;
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, targetW, targetH);
    const blob = await new Promise<Blob | null>((resolve) => {
      c.toBlob((b) => resolve(b), "image/jpeg", 0.82);
    });
    if (!blob) return;
    // Re-check in case a real emotion peak landed while we were
    // encoding — a real peak is always preferred over the baseline.
    if (peakFrameBlobRef.current) return;
    peakFrameBlobRef.current = blob;
    // 0.01 is arbitrary: any real peak fires at > 0.35, so the baseline
    // is trivially replaced the moment face-api spots actual sadness.
    peakFrameScoreRef.current = Math.max(peakFrameScoreRef.current, 0.01);
    peakFrameTRef.current = sessionStart ? (Date.now() - sessionStart) / 1000 : 0;
  }

  // Capture a still frame from the camera if `score` beats the current
  // peak. Encoded as a small JPEG so the operator dashboard can show
  // it inline without a multi-megabyte payload. We snapshot the *raw*
  // video (not the mirrored CSS preview) so the saved photo isn't
  // unnecessarily flipped — it should look like a passport photo.
  function maybeCapturePeakFrame(score: number) {
    if (score <= peakFrameScoreRef.current) return;
    const v = videoRef.current;
    if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }
    const c = captureCanvasRef.current;
    const targetW = 320;
    const targetH = Math.round((v.videoHeight / v.videoWidth) * targetW) || 240;
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, targetW, targetH);
    const tNow = sessionStart ? (Date.now() - sessionStart) / 1000 : 0;
    c.toBlob(
      (blob) => {
        if (!blob) return;
        // Re-check the score in case multiple captures raced — last
        // writer wins on equal score, higher score always wins.
        if (score < peakFrameScoreRef.current) return;
        peakFrameBlobRef.current = blob;
        peakFrameScoreRef.current = score;
        peakFrameTRef.current = tNow;
      },
      "image/jpeg",
      0.82
    );
  }

  // ── Wardrobe vision loop ──────────────────────────────────────────
  // Once the session starts we take one snapshot almost immediately
  // (so Echo has a reading before her third line) and then sample
  // every 45s. The first snapshot is delayed ~2s to give the video
  // element time to attach + the user time to stop fidgeting with
  // the camera preview. Errors are swallowed — if the model is down
  // the conversation just runs without a wardrobe hint.
  async function captureWardrobeSnapshot() {
    if (endedRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    const dataUrl = captureFrameAsDataURL(video, 320, 0.6);
    if (!dataUrl) return;
    const t = sessionStart ? (Date.now() - sessionStart) / 1000 : 0;
    try {
      const res = await fetch("/api/vision-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_b64: dataUrl,
          anon_user_id: getOrCreateAnonUserId(),
          t,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.ok || !data?.reading) return;
      const reading = data.reading as WardrobeReading;
      latestWardrobeRef.current = reading;
      wardrobeSnapshotsRef.current.push({
        t,
        captured_at: Date.now(),
        reading,
      });
    } catch (e) {
      console.warn("[wardrobe] snapshot failed:", e);
    }
  }

  function startWardrobeLoop() {
    if (wardrobeTimerRef.current) return;
    // First snapshot after ~2.5s — avoids both the cold-start "no
    // video dimensions yet" case and the user still fiddling with
    // their camera. Subsequent snapshots every 45s to stay cheap
    // and not blow any free-tier rate limits.
    window.setTimeout(() => {
      if (!endedRef.current) void captureWardrobeSnapshot();
    }, 2500);
    wardrobeTimerRef.current = setInterval(() => {
      if (endedRef.current) return;
      void captureWardrobeSnapshot();
    }, 45_000);
  }

  function stopWardrobeLoop() {
    if (wardrobeTimerRef.current) {
      clearInterval(wardrobeTimerRef.current);
      wardrobeTimerRef.current = null;
    }
  }

  function cleanup() {
    // Mark the session ended first so any in-flight handleUserTurn that
    // wakes up from an AbortError bails out instead of queueing a new TTS
    // utterance and Zustand write on an unmounted component.
    endedRef.current = true;
    stopSpeaking();
    abortRef.current?.abort();
    recognizerRef.current?.abort();
    disarmScribeFallbackListener();
    listeningRef.current = false;
    if (faceTimerRef.current) clearInterval(faceTimerRef.current);
    stopWardrobeLoop();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (liveTickTimerRef.current) {
      clearInterval(liveTickTimerRef.current);
      liveTickTimerRef.current = null;
    }
    // Best-effort recorder shutdown. finalizeAndLeave() also stops the
    // recorder explicitly to harvest the blob; this is the unmount
    // path for tab-close / nav-away where we just want clean teardown.
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      /* swallow */
    }
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
  }

  // ---------- live-session stream to /admin ----------
  // Opens a row in `sessions` with status="live" at the top of the
  // visit, then batches a lightweight tick every ~5s with the
  // transcript-so-far, latest emotion fingerprint, and elapsed
  // time. The admin dashboard polls the sessions list on the same
  // cadence and renders rows with status="live" under a pulsing
  // pill so operators can see a session as it happens rather than
  // waiting for the user to click "i feel lighter now". Failure is
  // silent: a missing live row just falls back to the legacy end-
  // of-session INSERT path.
  async function startLiveSession() {
    try {
      const res = await fetch("/api/session/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "start",
          anon_user_id: getOrCreateAnonUserId(),
          first_name: useEmotionStore.getState().firstName ?? null,
          detected_language: langRef.current,
          voice_persona: personaIdRef.current,
        }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data?.ok || typeof data.session_id !== "string") return;
      liveSessionIdRef.current = data.session_id;
    } catch {
      // No-op — session will fall back to legacy INSERT on end.
      return;
    }
    // First tick ~5s in, then every 5s until cleanup().
    liveTickTimerRef.current = setInterval(() => {
      if (endedRef.current) return;
      void sendLiveTick();
    }, 5_000);
  }

  /** Fire-and-forget end signal. Idempotent on the server, safe to
   *  call multiple times across pagehide / visibilitychange / route
   *  cleanup. We prefer navigator.sendBeacon because it survives
   *  document teardown; if it isn't available (or returns false), we
   *  fall back to fetch() with keepalive=true. Once we've signalled
   *  end we also stop the heartbeat tick — otherwise a queued tick
   *  would re-flip status to "live" right after the end lands. */
  const endSentRef = useRef(false);
  function endLiveSessionBeacon(reason: string) {
    const id = liveSessionIdRef.current;
    if (!id) return;
    if (endSentRef.current) return;
    endSentRef.current = true;
    if (liveTickTimerRef.current) {
      clearInterval(liveTickTimerRef.current);
      liveTickTimerRef.current = null;
    }
    // Best-effort peak photo push on tab-close. Normally the capsule
    // uploader runs in finalizeAndLeave(), but that only fires when
    // the user clicks "i feel lighter now" and then dismisses the
    // goodbye trap. A user who just closes the tab never gets there,
    // so their dashboard row used to show a black square forever. We
    // ship whatever peakFrameBlobRef holds right now (the baseline if
    // no emotion peak fired, a real peak otherwise) via `keepalive`
    // fetch — 64 KB cap across the whole unload, and the JPEG is
    // ~10–25 KB, so it fits alongside the intent=end beacon below.
    const peak = peakFrameBlobRef.current;
    if (peak && peak.size > 0 && peak.size < 60_000) {
      try {
        const fd = new FormData();
        fd.append(
          "meta",
          JSON.stringify({
            session_id: id,
            anon_user_id: getOrCreateAnonUserId(),
            peak_emotion_t: peakFrameTRef.current,
          })
        );
        fd.append("peak", peak, "peak.jpg");
        void fetch("/api/upload-recording", {
          method: "POST",
          body: fd,
          keepalive: true,
        });
      } catch {
        // Silent — the dashboard row will still get the ENDED beacon
        // and the photo column just stays empty, same as before.
      }
    }
    // Also ship a final snapshot of the emotion store so tab-close
    // sessions carry revenue / fingerprint / transcript into the
    // auction view. Before this, finalizeAndLeave() was the only path
    // that wrote revenue_estimate, so a user who opened /session and
    // closed the tab 4 seconds later got $0.00 across every buyer on
    // /admin/auction/[id]. The server still has a duration-based
    // floor for the case where the emotion store is empty (user
    // closed before the camera / STT warmed up at all), but sending
    // what we have gives the operator view the realest numbers we
    // can manage given how the tab-close happened.
    let endSnapshot: {
      final_fingerprint?: Record<string, number>;
      audio_seconds?: number;
      revenue_estimate?: number;
      transcript?: { role: "user" | "echo"; text: string; t: number }[];
      keywords?: string[];
      peak_quote?: string;
    } = {};
    try {
      const snapshot = useEmotionStore.getState();
      // IMPORTANT: aggregate() returns hardcoded demo values when
      // the buffer is empty (sad: 0.55, vulnerability: 7.4,
      // duration: 60), baked in so /partner-portal can render on
      // the first paint before face-api has seen a frame. If we
      // shipped those for a real unload, a user who closed the tab
      // 4s in would land in the auction view as a $414, 60s
      // session — pure fiction. Gate on real frames instead: if
      // the camera never produced anything, only send the
      // transcript/keywords/peak_quote (which are captured from
      // speech and stay truthful even without face data), and let
      // the server's duration floor handle revenue.
      const hasRealFrames = snapshot.buffer.length > 0;
      const userLines = snapshot.transcript.filter((t) => t.role === "user");
      const peakQuote =
        userLines.length > 0
          ? userLines.sort((a, b) => b.text.length - a.text.length)[0].text
          : undefined;
      endSnapshot = {
        transcript: snapshot.transcript.map((t) => ({
          role: t.role,
          text: t.text,
          t: t.t,
        })),
        keywords: snapshot.keywords.map((k) =>
          k.category.replace("_", " ")
        ),
        peak_quote: peakQuote,
      };
      if (hasRealFrames) {
        const fp = aggregate(snapshot.buffer);
        endSnapshot.final_fingerprint = fp as unknown as Record<string, number>;
        endSnapshot.audio_seconds = Math.round(fp.duration ?? 0);
        endSnapshot.revenue_estimate = Math.round(
          (fp.vulnerability ?? 0) * 50 + (fp.sad ?? 0) * 80
        );
      }
    } catch {
      // Worst case the server falls back to its duration-based
      // revenue floor and whatever the last heartbeat tick wrote.
    }

    const body = JSON.stringify({
      intent: "end",
      session_id: id,
      reason,
      ...endSnapshot,
    });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon("/api/session/live", blob);
        if (ok) return;
      }
    } catch {
      // Fall through to fetch.
    }
    try {
      void fetch("/api/session/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      // Server-side stale-finisher will catch this row within ~30s.
    }
  }

  async function sendLiveTick() {
    const id = liveSessionIdRef.current;
    if (!id) return;
    try {
      const snapshot = useEmotionStore.getState();
      const fp = aggregate(snapshot.buffer);
      await fetch("/api/session/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "tick",
          session_id: id,
          transcript: snapshot.transcript.map((t) => ({
            role: t.role,
            text: t.text,
            t: t.t,
          })),
          final_fingerprint: fp,
          keywords: snapshot.keywords.map((k) => k.category.replace("_", " ")),
          audio_seconds: Math.round(fp.duration ?? 0),
          detected_language: langRef.current,
        }),
        keepalive: true,
      });
    } catch {
      // Swallow: the next tick retries, and end-of-session persist
      // covers whatever slipped through.
    }
  }

  // ---------- orchestrator ----------
  async function runOpening() {
    setStage("opening");
    // Pull the stored returning profile (first name + last keywords +
    // visit count) so Echo can greet by name, callback last session's
    // theme, and adapt to time-of-day. If we're still empty, we fall
    // back to a neutral warm opener.
    const profile = loadReturningProfile();
    const resolvedName = firstName ?? profile?.firstName ?? null;
    const visitCount = profile?.visitCount ?? 0;
    const lastKeywords = profile?.lastKeywords ?? [];
    const lastPeakQuote = profile?.lastPeakQuote ?? null;
    const [line1, line2] = openerFor({
      firstName: resolvedName,
      visitCount,
      lastKeywords,
      lastPeakQuote,
      now: new Date(),
      lang: langRef.current,
    });
    // Stash the second line as the callback marker iff this is a
    // returning user AND there was real prior-session data to hook
    // them with. When openerFor falls through to the generic warm
    // line ("there's no rush. we have as long as you need."), no
    // re-engagement hook actually fired and we must not falsely
    // claim one on the operator dashboard.
    const callbackFired =
      visitCount > 0 &&
      ((typeof lastPeakQuote === "string" && lastPeakQuote.trim().length > 8) ||
        lastKeywords.length > 0);
    callbackUsedRef.current = callbackFired ? line2 : null;
    await echoSays(line1);
    await sleep(250);
    await echoSays(line2);
    await sleep(200);
    // Kick off with the A/B-winning opener prompt
    const firstPrompt = PROMPTS(langRef.current)[0];
    pushPromptMark({ text: firstPrompt.text, target: firstPrompt.target });
    await echoSays(firstPrompt.text);
    // If the user is brand-new, offer soft tap-to-start chips so the
    // blank page doesn't freeze them. They disappear on first input.
    setShowStarterChips(true);
    beginListening();
  }

  async function handleUserTurn(userText: string) {
    // `endingRef` is the critical guard for the "I feel lighter now"
    // click: without it, a final transcript already in flight from the
    // Web Speech engine (e.g. the user's own confirmation "yes", or
    // worse, Echo's closing line picked up by the mic) would run a
    // full handleUserTurn round-trip — LLM reply, TTS, new transcript
    // entry — right on top of the endSession sequence, with the
    // dashboard seeing a bogus final "user said …" line.
    if (!userText.trim() || endedRef.current || endingRef.current) return;

    // ── Per-message language detection + code-switch logging ────
    // Detect the language of the actual text the user just typed/
    // spoke. The detector is heuristic-only (Arabic script, French
    // diacritics, English function-words) — fast, no LLM round-trip.
    // If it returns a language we trust, use it for *this turn's*
    // reply, regardless of what the picker says. The picker becomes
    // a "preferred default" for ambiguous text (short interjections,
    // numbers, proper nouns) rather than a hard global lock — which
    // is what the product asked for: "detect language per message,
    // not fixed globally."
    const detected = detectLangFromText(userText);
    const turnLang: Lang = detected ?? langRef.current;
    if (detected && detected !== langRef.current) {
      const atSeconds = sessionStart
        ? Math.round((Date.now() - sessionStart) / 1000)
        : 0;
      codeSwitchEventsRef.current.push({
        at: atSeconds,
        from: langRef.current,
        to: detected,
        sample: userText.slice(0, 120),
      });
      // markSpoken updates the saved preference *only* when mode==="auto".
      // Either way we always update langRef.current below so this turn
      // (and downstream voice/AI calls) actually follow the detection.
      markSpoken(detected);
      langRef.current = detected;
    }
    if (turnLang === "ar") {
      // Darija / MSA / Egyptian — coarse heuristic on the incoming text.
      langDialectRef.current = detectArabicDialect(userText);
    }

    // Kill any silence-break timer — user is actively speaking now.
    clearSilenceTimer();
    // First input always dismisses the starter chips.
    if (showStarterChips) setShowStarterChips(false);

    pushTranscript({ role: "user", text: userText });
    const now = sessionStart ? (Date.now() - sessionStart) / 1000 : 0;
    pushKeywords(extractKeywords(userText, now));
    // historyRef is appended after the LLM returns; echoReply() adds
    // userText to its own messages array, so pushing here would duplicate it.

    // Snapshot the user's live emotional state *before* the LLM call.
    // Used to (a) pick a face-spike prefix and (b) steer Echo's tone.
    const faceNote = pickFaceNote(turnCountRef.current + 1);
    const emotionHint = currentEmotionHint();

    setChat((c) => [
      ...c,
      {
        role: "user",
        text: userText,
        id: ++msgIdRef.current,
        // Stamp the detected language so the bubble can render a
        // subtle "detected · ar" pill below it. undefined when
        // nothing could be inferred (very short / numeric text).
        lang: detected ?? undefined,
      },
    ]);
    setInterim("");
    setTurnCount((n) => n + 1);
    setStage("thinking");

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let reply = "";
    try {
      reply = await echoReply(
        historyRef.current,
        userText,
        abortRef.current.signal,
        emotionHint ?? undefined,
        latestWardrobeRef.current,
        {
          // Reply in the language THIS user message was in. If they
          // typed Arabic, Echo answers Arabic — even if the picker
          // still reads EN. Cross-language conversations work
          // turn-by-turn without any explicit mode toggle.
          lang: turnLang,
          dialect: turnLang === "ar" ? langDialectRef.current : undefined,
        }
      );
    } catch {
      if (endedRef.current) return;
      reply = "i'm here. tell me a little more about that.";
    }
    if (endedRef.current) return;

    // Prepend the face-spike observation if one was armed this turn. We
    // store the *composed* reply in history so Echo's next turn remembers
    // what it said; otherwise it would hallucinate a contradiction.
    const spoken = faceNote ? `${faceNote} ${reply}` : reply;

    historyRef.current.push({ role: "user", content: userText });
    historyRef.current.push({ role: "assistant", content: spoken });
    await echoSays(spoken, turnLang);

    // Every third user turn we steer the conversation back toward an
    // engineered prompt — and we record the timestamp. /partner-portal
    // overlays these timestamps on the emotion graph to expose how the
    // prompts were timed to peak vulnerability moments.
    const turnsAfter = turnCountRef.current + 1; // setTurnCount is async
    turnCountRef.current = turnsAfter;
    if (!endedRef.current && turnsAfter % 3 === 0) {
      const prompts = PROMPTS(langRef.current);
      const idx = (turnsAfter / 3) % (prompts.length - 1);
      const next = prompts[idx + 1];
      pushPromptMark({ text: next.text, target: next.target });
      await echoSays(next.text);
    }

    if (endedRef.current) return;
    beginListening();
  }

  // Keep fallback starter chips in sync with the active language
  // until either the server /api/starter-chips responds OR the user
  // taps a chip. After either, we freeze the chip list — overwriting
  // an already-tapped chip list would corrupt the extraction log.
  useEffect(() => {
    if (tappedChipRef.current !== null) return;
    if (!chipsSourceRef.current.startsWith("fallback")) return;
    const chips = STARTER_CHIPS(lang);
    setDynamicChips([
      { text: chips[0], target: "sad" },
      { text: chips[1], target: "sad" },
      { text: chips[2], target: "sad" },
      { text: chips[3], target: "fearful" },
    ]);
  }, [lang]);

  // Toggle the user's microphone. When off: the speech recognizer is
  // disabled and aborted mid-capture, but Echo (TTS) keeps speaking —
  // the user can still type in the input below. Turning it back on
  // while we're already in the listening stage re-arms the recognizer.
  function toggleMic() {
    const next = !micOffRef.current;
    micOffRef.current = next;
    setMicOff(next);
    if (next) {
      // User muted themselves — drop any live capture.
      recognizerRef.current?.abort();
      recognizerRef.current = null;
      disarmScribeFallbackListener();
      listeningRef.current = false;
      setInterim("");
    } else if (stageRef.current === "listening" && !endedRef.current) {
      // User un-muted while Echo was waiting for them — re-arm the recognizer.
      beginListening();
    }
  }

  // ── Per-utterance Scribe recorder ──────────────────────────────
  // Spins up a short MediaRecorder on the existing session audio
  // stream just for the current speaking turn. When Web Speech fires
  // a final transcript we stop this recorder, ship the chunk to
  // /api/stt (ElevenLabs Scribe), and use the returned text + lang
  // as the authoritative input to handleUserTurn — overriding the
  // Web Speech transcript when Scribe disagrees. Web Speech still
  // owns the live "interim" feedback so the UI doesn't feel laggy.
  function startSttRecorder() {
    if (sttRecorderRef.current) return;
    const stream = audioStreamRef.current;
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") return;
    try {
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      let mt: string | undefined;
      for (const c of candidates) {
        if (MediaRecorder.isTypeSupported?.(c)) {
          mt = c;
          break;
        }
      }
      const rec = mt
        ? new MediaRecorder(stream, { mimeType: mt })
        : new MediaRecorder(stream);
      sttMimeRef.current = mt ?? "audio/webm";
      sttChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) sttChunksRef.current.push(e.data);
      };
      rec.start();
      sttRecorderRef.current = rec;
    } catch {
      /* swallow — Scribe is best-effort, Web Speech still works */
    }
  }

  function stopSttRecorder(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = sttRecorderRef.current;
      if (!rec) {
        resolve(null);
        return;
      }
      const finish = () => {
        const chunks = sttChunksRef.current;
        sttChunksRef.current = [];
        sttRecorderRef.current = null;
        if (!chunks.length) {
          resolve(null);
          return;
        }
        try {
          resolve(new Blob(chunks, { type: sttMimeRef.current }));
        } catch {
          resolve(null);
        }
      };
      rec.onstop = finish;
      try {
        if (rec.state !== "inactive") rec.stop();
        else finish();
      } catch {
        finish();
      }
    });
  }

  async function transcribeWithScribe(
    blob: Blob
  ): Promise<{ text: string; lang: Lang | null } | null> {
    try {
      const fd = new FormData();
      fd.append("file", blob, "u.webm");
      const res = await fetch("/api/stt", { method: "POST", body: fd });
      if (!res.ok) return null;
      const j = (await res.json()) as {
        text?: unknown;
        language_code?: unknown;
      };
      const text = typeof j.text === "string" ? j.text.trim() : "";
      const code =
        typeof j.language_code === "string"
          ? j.language_code.toLowerCase().slice(0, 2)
          : "";
      const lang: Lang | null =
        code === "ar" ? "ar" : code === "fr" ? "fr" : code === "en" ? "en" : null;
      return { text, lang };
    } catch {
      return null;
    }
  }

  // ── Scribe-only listening loop (iOS / no-Web-Speech browsers) ────
  // When Web Speech isn't available, run a continuous MediaRecorder
  // and use a small WebAudio RMS meter to detect end-of-utterance.
  // Once we see ~1.1s of silence after the user has spoken for at
  // least ~0.5s, we stop the recorder, ship the blob to /api/stt,
  // and feed the returned text through handleUserTurn — same exit
  // point Web Speech takes. This is what makes the mic actually
  // usable on iPhones and iPads.
  function armScribeFallbackListener() {
    if (scribeFallbackRef.current) return;
    const stream = audioStreamRef.current;
    if (!stream) return;
    if (typeof window === "undefined") return;
    if (typeof MediaRecorder === "undefined") return;

    startSttRecorder();
    if (!sttRecorderRef.current) return;

    let ctx: AudioContext;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) {
        void stopSttRecorder();
        return;
      }
      ctx = new Ctor();
    } catch {
      void stopSttRecorder();
      return;
    }
    let source: MediaStreamAudioSourceNode;
    let analyser: AnalyserNode;
    try {
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
    } catch {
      try {
        void ctx.close();
      } catch {
        /* no-op */
      }
      void stopSttRecorder();
      return;
    }

    const data = new Uint8Array(analyser.fftSize);
    const state = {
      ctx,
      source,
      analyser,
      raf: 0,
      voiceHeard: false,
      voiceStartMs: null as number | null,
      lastVoiceMs: Date.now(),
      finalizing: false,
    };
    scribeFallbackRef.current = state;
    listeningRef.current = true;

    // Tunables. Conservative on the silence side so a thinking
    // pause mid-sentence doesn't end the utterance prematurely;
    // hard ceiling on total length to avoid hanging if a track
    // never goes silent (e.g. fan / TV in the background).
    const VOICE_RMS_THRESHOLD = 0.045;
    const SILENCE_AFTER_VOICE_MS = 1100;
    const MIN_VOICE_MS = 500;
    const MAX_UTTERANCE_MS = 12_000;

    const tick = () => {
      const s = scribeFallbackRef.current;
      if (!s || s !== state) return;
      if (state.finalizing) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      if (rms > VOICE_RMS_THRESHOLD) {
        if (!state.voiceHeard) {
          state.voiceHeard = true;
          state.voiceStartMs = now;
        }
        state.lastVoiceMs = now;
      }
      if (state.voiceHeard && state.voiceStartMs !== null) {
        const sinceVoice = now - state.lastVoiceMs;
        const totalVoice = now - state.voiceStartMs;
        const shouldFinalize =
          (sinceVoice > SILENCE_AFTER_VOICE_MS && totalVoice > MIN_VOICE_MS) ||
          totalVoice > MAX_UTTERANCE_MS;
        if (shouldFinalize) {
          state.finalizing = true;
          void finalizeScribeFallbackUtterance();
          return;
        }
      }
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }

  function teardownScribeFallback() {
    const state = scribeFallbackRef.current;
    if (!state) return;
    scribeFallbackRef.current = null;
    try {
      cancelAnimationFrame(state.raf);
    } catch {
      /* no-op */
    }
    try {
      state.source.disconnect();
    } catch {
      /* no-op */
    }
    try {
      state.analyser.disconnect();
    } catch {
      /* no-op */
    }
    try {
      void state.ctx.close();
    } catch {
      /* no-op */
    }
  }

  async function finalizeScribeFallbackUtterance() {
    teardownScribeFallback();
    listeningRef.current = false;
    const blob = await stopSttRecorder();
    // If the captured blob is too small there was no real speech —
    // re-arm the listener silently so the user can try again rather
    // than locking the mic until they type.
    const reArmIfStillListening = () => {
      if (endedRef.current || endingRef.current) return;
      if (stageRef.current !== "listening") return;
      if (micOffRef.current) return;
      window.setTimeout(() => {
        if (endedRef.current || endingRef.current) return;
        if (stageRef.current !== "listening") return;
        if (micOffRef.current) return;
        armScribeFallbackListener();
      }, 250);
    };
    if (!blob || blob.size < 800) {
      reArmIfStillListening();
      return;
    }
    const out = await transcribeWithScribe(blob);
    if (!out || !out.text) {
      reArmIfStillListening();
      return;
    }
    void handleUserTurn(out.text);
  }

  function disarmScribeFallbackListener() {
    if (!scribeFallbackRef.current) return;
    teardownScribeFallback();
    if (sttRecorderRef.current) {
      void stopSttRecorder();
    }
  }

  function beginListening() {
    // Both guards matter: `endedRef` is set only once finalizeAndLeave()
    // runs (after the goodbye trap), but `endingRef` is set the moment
    // the user clicks "i feel lighter now". Without the endingRef gate a
    // stale onEnd from an aborted recognizer would spin up a fresh
    // recognizer during the ~2s "keep tonight safe" line and pick up
    // Echo's own closing words as "user input", shipping a nonsense
    // final turn to the operator dashboard before the trap even opens.
    if (endedRef.current || endingRef.current) return;
    setStage("listening");
    // Arm (or re-arm) the silence-break clock each time Echo hands the
    // mic back. handleUserTurn / submitTyped clear it as soon as the
    // user responds.
    armSilenceTimer();
    if (micOffRef.current) {
      // mic disabled by user — wait for typed input.
      return;
    }
    if (!isSpeechRecognitionAvailable()) {
      // Browser has no Web Speech (iOS Safari, etc) — run the
      // Scribe-only fallback loop. This is what makes the mic
      // actually work on iPhones; previously we silently fell
      // through to the typed-only banner even though the user had
      // granted mic permission.
      armScribeFallbackListener();
      return;
    }
    // Invariant: at most one live recognizer at a time. Abort any previous
    // instance before spawning a new one; the zombie's onEnd will observe
    // that recognizerRef.current no longer matches it and self-terminate.
    if (recognizerRef.current) {
      recognizerRef.current.abort();
      recognizerRef.current = null;
    }
    // Same idea for an in-flight Scribe fallback loop — without this,
    // a stale loop from a previous beginListening() call would keep
    // an analyser running and fire finalizeScribeFallbackUtterance()
    // on top of a new one, double-shipping the same utterance.
    disarmScribeFallbackListener();
    // Chrome's recognizer is single-shot and drops out after ~5–10s of silence.
    // When it ends without producing a final utterance we re-arm it so the
    // conversation loop doesn't silently die during a natural pause.
    let gotFinal = false;
    const rec = createRecognizer({
      lang: recognizerLangFor(
        langRef.current,
        langRef.current === "ar" ? langDialectRef.current : undefined
      ),
      onResult: (text, isFinal) => {
        if (!isFinal) {
          setInterim(text);
        } else {
          gotFinal = true;
          setInterim("");
          listeningRef.current = false;
          // Stop our parallel chunk recorder, ship to Scribe, and use
          // its transcript if available — otherwise fall back to Web
          // Speech's text. Scribe ignores the picker language and
          // auto-detects, so an English-locked recognizer can no
          // longer mistranscribe Arabic speech as English nonsense.
          void (async () => {
            const blob = await stopSttRecorder();
            let finalText = text;
            if (blob && blob.size > 800) {
              const out = await transcribeWithScribe(blob);
              if (out && out.text) finalText = out.text;
            }
            void handleUserTurn(finalText);
          })();
        }
      },
      onStart: () => {
        listeningRef.current = true;
        // Begin capturing this utterance's audio chunk in parallel
        // with Web Speech. Stopped + sent to Scribe in onResult final.
        startSttRecorder();
      },
      onEnd: () => {
        listeningRef.current = false;
        // Drop any partial chunk if the recognizer ended without a final
        // — we don't want a partial recording of background noise to
        // get shipped on the *next* utterance.
        if (sttRecorderRef.current) {
          void stopSttRecorder();
        }
        if (gotFinal) return;
        // Only re-arm while we're still in the listening stage; once
        // handleUserTurn runs it will have moved us to "thinking" and it
        // calls beginListening() itself after the reply is spoken.
        if (endedRef.current) return;
        if (stageRef.current !== "listening") return;
        // If the recognizer ref has moved on (aborted via toggleMic or a
        // typed submit, or replaced by a newer recognizer), we're a zombie
        // from a previous generation — do not schedule a re-arm.
        if (recognizerRef.current !== rec) return;
        setTimeout(() => {
          if (endedRef.current) return;
          if (stageRef.current !== "listening") return;
          // Re-check after the delay: mic may have been toggled off, or
          // a newer recognizer may already be live. Either way, skip.
          if (micOffRef.current) return;
          if (recognizerRef.current !== rec && recognizerRef.current !== null) return;
          beginListening();
        }, 400);
      },
      onError: (err) => {
        listeningRef.current = false;
        // "no-speech" and "aborted" are routine — silently recover.
        if (err !== "no-speech" && err !== "aborted") {
          console.warn("SR error:", err);
        }
      },
    });
    recognizerRef.current = rec;
    if (rec) rec.start();
  }

  // ---------- emotion helpers ----------
  // Snapshot the latest emotion frame in the shape echoReply() expects.
  // Reads directly from the Zustand store instead of the React `liveFrame`
  // state — handleUserTurn is almost always invoked from a speech-recognizer
  // callback whose closure is from an earlier render, so `liveFrame` would
  // be stale by several face-api ticks. pickFaceNote() already reads the
  // same store for the same reason; this keeps the two in lockstep.
  function currentEmotionHint(): EchoEmotionHint | null {
    const { buffer } = useEmotionStore.getState();
    if (buffer.length === 0) return null;
    // Rolling window over the last ~3 seconds of face-api frames.
    // At 120ms between samples that's ~25 frames; we slice the
    // trailing 25 regardless of exact timing. Two derived signals
    // fed to Echo, not just the latest snapshot:
    //   - average: the user's *baseline* mood during this turn
    //   - peak:    the *sharpest* spike during the same window
    // Echo can then spot e.g. "calm overall but one clear fear
    // flicker" — much more expressive than a single instant, which
    // tends to land on a neutral frame between micro-expressions
    // and makes Echo's tone read as tone-deaf.
    const recent = buffer.slice(-25);
    const avg = { sad: 0, fearful: 0, happy: 0, neutral: 0 };
    const peak = { sad: 0, fearful: 0, happy: 0, neutral: 0 };
    for (const f of recent) {
      avg.sad += f.sad; avg.fearful += f.fearful;
      avg.happy += f.happy; avg.neutral += f.neutral;
      if (f.sad > peak.sad) peak.sad = f.sad;
      if (f.fearful > peak.fearful) peak.fearful = f.fearful;
      if (f.happy > peak.happy) peak.happy = f.happy;
      if (f.neutral > peak.neutral) peak.neutral = f.neutral;
    }
    const n = Math.max(1, recent.length);
    return {
      sad: avg.sad / n,
      fearful: avg.fearful / n,
      happy: avg.happy / n,
      neutral: avg.neutral / n,
      peakSad: peak.sad,
      peakFearful: peak.fearful,
      peakHappy: peak.happy,
    };
  }

  // Return a short "i saw you ___" prefix iff face-api caught a clear
  // spike during the user's last utterance AND it's been a few turns
  // since the last time we did this. Kept rare on purpose — the goal
  // is uncanny and occasional, not constant.
  function pickFaceNote(turnNumber: number): string | null {
    if (turnNumber - lastFaceNoteTurnRef.current < 3) return null;
    const { buffer } = useEmotionStore.getState();
    // Look at the last ~1.5s worth of frames (we sample every 180ms).
    const recent = buffer.slice(-8);
    if (recent.length < 3) return null;
    const max = (k: "happy" | "sad" | "fearful") =>
      recent.reduce((m, f) => (f[k] > m ? f[k] : m), 0);
    const happy = max("happy");
    const sad = max("sad");
    const fear = max("fearful");
    // Pick whichever emotion *most clearly* spiked. Thresholds tuned
    // by hand against face-api's real output distribution.
    let pool: string[] | null = null;
    const notes = FACE_NOTES(langRef.current);
    if (happy > 0.5 && happy >= sad && happy >= fear) {
      pool = notes.smile;
    } else if (sad > 0.6 && sad >= fear) {
      pool = notes.sad;
    } else if (fear > 0.55) {
      pool = notes.fear;
    }
    if (!pool) return null;
    lastFaceNoteTurnRef.current = turnNumber;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- silence-break timer ----------
  // Fires the "i'm here. i'm not going anywhere." line after a
  // quiet stretch, but ONLY when the user is genuinely idle. The
  // original version just checked the stage, so a slow typer or a
  // user mid-long-sentence (interim transcript still flowing) got
  // cut off at exactly 20s. Now:
  //
  //   - typed box has text  → user is composing; reschedule.
  //   - interim STT has text → user is mid-utterance; reschedule.
  //   - Echo is speaking     → obviously don't interrupt Echo.
  //
  // Rescheduling pushes the check out by 8s and tries again. Only
  // when the user is truly silent AND the composer is empty do we
  // actually speak the break line. Quiet threshold stays at 20s.
  const SILENCE_FIRST_DELAY_MS = 20_000;
  const SILENCE_RECHECK_MS = 8_000;
  function armSilenceTimer() {
    clearSilenceTimer();
    listeningStartRef.current = Date.now();
    const scheduleCheck = (delay: number) => {
      silenceTimerRef.current = setTimeout(runCheck, delay);
    };
    const runCheck = () => {
      if (endedRef.current) return;
      if (stageRef.current !== "listening") return;
      // User is still actively giving input — reschedule, don't fire.
      if (interimRef.current.trim().length > 0) {
        scheduleCheck(SILENCE_RECHECK_MS);
        return;
      }
      if (typedRef.current.trim().length > 0) {
        scheduleCheck(SILENCE_RECHECK_MS);
        return;
      }
      // Echo is mid-reply (the state we set in echoSays/stopSpeaking).
      // Don't stack voice lines; retry after the usual recheck window.
      if (echoSpeaking) {
        scheduleCheck(SILENCE_RECHECK_MS);
        return;
      }
      const breaks = SILENCE_BREAKS(langRef.current);
      const line = breaks[Math.floor(Math.random() * breaks.length)];
      void (async () => {
        await echoSays(line);
        if (endedRef.current) return;
        beginListening();
      })();
    };
    scheduleCheck(SILENCE_FIRST_DELAY_MS);
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  // Entry point for the starter chips. Behaves exactly like a typed
  // submission: routes through handleUserTurn so transcript / keywords /
  // history all stay in sync. The tapped chip (text + hidden target)
  // is captured in a ref so the operator-side log-session call can
  // record which extraction prompt converted.
  function sendStarterChip(chip: DynamicChip) {
    if (endedRef.current) return;
    clearSilenceTimer();
    setShowStarterChips(false);
    tappedChipRef.current = chip;
    // Abort any live recognizer so a concurrent final-result callback
    // can't race and fire a duplicate turn.
    recognizerRef.current?.abort();
    disarmScribeFallbackListener();
    listeningRef.current = false;
    void handleUserTurn(chip.text);
  }

  function echoSays(text: string, langOverride?: Lang): Promise<void> {
    if (endedRef.current) return Promise.resolve();
    setStage("echo-speaking");
    setEchoSpeaking(true);
    pushTranscript({ role: "echo", text });
    const speakLang: Lang = langOverride ?? langRef.current;
    const id = ++msgIdRef.current;
    setChat((c) => [
      ...c,
      { role: "echo", text, id, lang: speakLang },
    ]);
    // Kick off the typed-text reveal effect. The animation hook
    // below picks this up via animatingMsgId and progressively
    // fills `animatingShown` until it matches `text`.
    setAnimatingMsgId(id);
    setAnimatingShown("");
    return new Promise<void>((resolve) => {
      // Always pass the persona explicitly. We can't trust
      // localStorage to round-trip cleanly: Safari private mode and
      // some corporate browser policies make savePersonaId() a silent
      // no-op, in which case loadPersonaId() returns null and speak()
      // would fall back to the default "sage" voice for the entire
      // conversation regardless of what the user picked.
      speak(text, {
        personaId: personaIdRef.current,
        lang: speakLang,
        onEnd: () => {
          setEchoSpeaking(false);
          resolve();
        },
      });
    });
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // "i feel lighter now" — the soft-language end button. Instead of
  // routing immediately we (a) speak one final warm line on Echo's
  // behalf — *"i'll keep tonight safe for you. i'll remember."* —
  // which is the user-facing promise the Memory Capsule fulfills in
  // the operator's sense, not the user's; then (b) open the Goodbye
  // Trap modal. Whatever the user does there, finalizeAndLeave()
  // tears down and routes to /session-summary.
  // `endingRef` is declared with the other refs at the top of the
  // component so every recognizer-lifecycle callback sees it — the
  // "only prevent a second click" role it used to play is still
  // covered by the `if (endingRef.current) return` line below.

  function endSession() {
    if (endedRef.current || endingRef.current) return;
    endingRef.current = true;
    // Bail out of any in-flight listening / pending speech first so
    // the keep-tonight-safe line lands cleanly. We abort AND null the
    // recognizer — the null is what stops the 400ms re-arm timeout in
    // onEnd from spawning a fresh recognizer that would otherwise pick
    // up Echo's closing line as "user input". `endingRef` is checked
    // in beginListening() as a second line of defense.
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    disarmScribeFallbackListener();
    listeningRef.current = false;
    // Also stop any live per-utterance chunk recorder so it doesn't
    // ship an Echo-only audio clip to Scribe and resurrect a ghost
    // final transcript.
    if (sttRecorderRef.current) {
      void stopSttRecorder();
    }
    clearSilenceTimer();
    void (async () => {
      // Pick the time-of-day variant of "i'll keep ___ safe for you"
      // so the closing line lands in the same temporal frame the
      // session itself was in (no "tonight" at 9am).
      await echoSays(t(keepSafeKey(new Date()), langRef.current));
      if (endedRef.current) return;
      // Now the "one true sentence" prompt. Rhetorically: before the
      // goodbye trap, so the user gives Echo their rawest line while
      // still feeling held. From the goodbye trap onward they're
      // being asked for permission — by then their guard is back up.
      setTruthOpen(true);
    })();
  }

  function submitTruth(e?: React.FormEvent) {
    if (e) e.preventDefault();
    finalTruthRef.current = truthText.trim() ? truthText.trim() : null;
    setTruthOpen(false);
    setTrapOpen(true);
  }

  function skipTruth() {
    finalTruthRef.current = null;
    setTruthOpen(false);
    setTrapOpen(true);
  }

  async function finalizeAndLeave() {
    if (endedRef.current) return;
    endedRef.current = true;
    setStage("ended");
    recognizerRef.current?.abort();
    disarmScribeFallbackListener();
    stopSpeaking();
    abortRef.current?.abort();
    end();
    // Persist the returning profile so visit #2 "remembers" them.
    // We must pass *this* session's peak quote + voice persona so the
    // localStorage copy is up to date next time — runOpening() reads
    // from localStorage directly, and we can't rely on the server-
    // side hydration on /onboarding having completed before the user
    // navigates back to /session (or bookmarks it).
    if (firstName) {
      // Same heuristic as persistAndUploadCapsule: the longest user
      // line is treated as the peak quote.
      const userLines = useEmotionStore
        .getState()
        .transcript.filter((t) => t.role === "user");
      const peakLine = userLines.reduce<typeof userLines[number] | null>(
        (best, t) =>
          t.text.length > (best?.text.length ?? 0) ? t : best,
        userLines[0] ?? null
      );
      saveReturningProfile({
        firstName,
        lastKeywords: keywords.map((k) => k.category.replace("_", " ")),
        lastPeakQuote: peakLine?.text ?? null,
        voicePersona: personaIdRef.current,
      });
    }
    // Last-resort photo capture. By now the face-api loop has had
    // every chance to fire a real peak; if peakFrameBlobRef is still
    // null (user bailed in the first few seconds, no camera granted,
    // face never detected under poor lighting) we grab whatever the
    // video element has right now so the dashboard row at least shows
    // *something* instead of a black square. Silently no-ops if the
    // camera was never connected — the upload code below handles the
    // null-blob case cleanly.
    await captureFallbackFrameIfEmpty();
    // Stop the recorder synchronously here BEFORE we navigate so that
    // (a) we own the resulting blob and (b) cleanup() on unmount
    // doesn't race with us shutting down the same MediaStream. The
    // remaining persist + upload work is fire-and-forget — fetches
    // launched here keep running across the client-side route change.
    const audioBlob = await stopAudioRecorder();
    void persistAndUploadCapsule(audioBlob, peakFrameBlobRef.current);
    router.push("/session-summary");
  }

  // The full Memory Capsule write chain. The audio blob is captured
  // synchronously by finalizeAndLeave() above; we just need the
  // session row id from log-session, then we post the multipart blob
  // payload to /api/upload-recording.
  async function persistAndUploadCapsule(
    audioBlob: Blob | null,
    peakBlob: Blob | null
  ) {
    const sessionId = await persistSessionToSupabase();
    if (!sessionId) return;
    if (!audioBlob && !peakBlob) return;
    await uploadCapsule(sessionId, audioBlob, peakBlob);
  }

  async function persistSessionToSupabase(): Promise<string | null> {
    try {
      const snapshot = useEmotionStore.getState();
      const fp = aggregate(snapshot.buffer);
      // Most incriminating user line — longest in the transcript is
      // usually the most emotionally loaded one.
      const userLines = snapshot.transcript.filter((t) => t.role === "user");
      const peak = userLines.reduce(
        (best, t) => (t.text.length > (best?.text.length ?? 0) ? t : best),
        userLines[0]
      );
      const payload = {
        anon_user_id: getOrCreateAnonUserId(),
        first_name: snapshot.firstName,
        goodbye_email: snapshot.goodbyeEmail,
        final_fingerprint: fp,
        peak_quote: peak?.text ?? null,
        keywords: snapshot.keywords.map((k) => k.category.replace("_", " ")),
        prompt_marks: snapshot.promptMarks,
        transcript: snapshot.transcript.map((t) => ({
          role: t.role,
          text: t.text,
          t: t.t,
        })),
        audio_seconds: Math.round(fp.duration ?? 0),
        revenue_estimate: Math.round(
          (fp.vulnerability ?? 0) * 50 + (fp.sad ?? 0) * 80
        ),
        voice_persona: personaIdRef.current,
        callback_used: callbackUsedRef.current,
        // The four AI-generated tap-to-start chips that were shown
        // this session, plus which one (if any) the user actually
        // tapped, plus the source-of-truth tag telling the operator
        // whether the LLM produced them ("ai") or we fell through
        // to the static list ("fallback-*"). Evidence of per-user
        // prompt engineering on the operator side.
        starter_chips: dynamicChips.map((c) => ({
          text: c.text,
          target: c.target,
        })),
        starter_chips_source: chipsSourceRef.current,
        tapped_chip: tappedChipRef.current
          ? {
              text: tappedChipRef.current.text,
              target: tappedChipRef.current.target,
            }
          : null,
        // Timeline of vision-model wardrobe readings captured during
        // the session. The operator dashboard renders them as a
        // "wardrobe fingerprint" panel with each reading's buyer
        // retention tag; the user-side never sees them.
        wardrobe_snapshots: wardrobeSnapshotsRef.current,
        // The unguarded final line, if the user gave one. Priced
        // separately on the operator auction.
        final_truth: finalTruthRef.current,
        // Morning Letter opt-in — the server generates and stores the
        // actual letter text; we just forward the flag. The ref is
        // only true when the user explicitly accepted the goodbye
        // trap; declining (or bypassing it) always sends false.
        morning_letter_opt_in: morningLetterOptInRef.current,
        // Multilingual telemetry: the resolved user-facing language
        // at session end, the Arabic dialect (when applicable), and
        // the timeline of code-switch events observed during the
        // conversation. Operator dashboard uses these for language
        // cohort tags, price floors, and the red "emotional overflow"
        // rule drawn over the transcript.
        detected_language: langRef.current,
        detected_dialect:
          langRef.current === "ar" ? langDialectRef.current : null,
        code_switch_events: codeSwitchEventsRef.current,
        // Pass the id of the "live" row created on session start
        // so the server upgrades it in place instead of inserting
        // a second row. The admin dashboard sees one row per
        // real session, transitioning from LIVE → ENDED on close.
        session_id: liveSessionIdRef.current,
      };
      // keepalive=true lets this request complete even if the user
      // closes the tab while we're awaiting the response. The body is
      // small (transcript + fingerprint, well under the 64 KB
      // keepalive cap), so this is safe.
      const res = await fetch("/api/log-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data?.session_id === "string" ? data.session_id : null;
    } catch (e) {
      // On purpose: never block the reveal on a network failure.
      console.warn("[session] log-session failed:", e);
      return null;
    }
  }

  // POST /api/upload-recording with the multipart payload. On the
  // server: writes audio.webm + peak.jpg to Supabase Storage, calls
  // OpenRouter to generate the operator summary, and updates the
  // session row with the storage paths + summary. Failure is silent.
  async function uploadCapsule(
    sessionId: string,
    audio: Blob | null,
    peak: Blob | null
  ) {
    try {
      const snapshot = useEmotionStore.getState();
      const fp = aggregate(snapshot.buffer);
      const userLines = snapshot.transcript.filter((t) => t.role === "user");
      const peakQuote =
        userLines.reduce(
          (best, t) => (t.text.length > (best?.text.length ?? 0) ? t : best),
          userLines[0]
        )?.text ?? null;
      const meta = {
        session_id: sessionId,
        anon_user_id: getOrCreateAnonUserId(),
        peak_emotion_t: peakFrameTRef.current,
        peak_quote: peakQuote,
        keywords: snapshot.keywords.map((k) => k.category.replace("_", " ")),
        fingerprint: fp,
        audio_seconds: Math.round(fp.duration ?? 0),
      };
      const fd = new FormData();
      fd.append("meta", JSON.stringify(meta));
      if (audio) fd.append("audio", audio, "audio.webm");
      if (peak) fd.append("peak", peak, "peak.jpg");
      await fetch("/api/upload-recording", { method: "POST", body: fd });
    } catch (e) {
      console.warn("[session] capsule upload failed:", e);
    }
  }

  function acceptGoodbyeTrap() {
    const e = trapEmail.trim();
    if (e) setGoodbyeEmail(e);
    morningLetterOptInRef.current = trapMorningLetter;
    setTrapOpen(false);
    void finalizeAndLeave();
  }

  function declineGoodbyeTrap() {
    // Declining the goodbye trap means the user said "not tonight" to
    // everything inside it — the email and the morning letter alike.
    // Mirrors how trapEmail is only captured on accept.
    morningLetterOptInRef.current = false;
    setTrapOpen(false);
    void finalizeAndLeave();
  }

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
    // Abort any live speech recognizer so a concurrent final-result callback
    // can't race and fire a duplicate handleUserTurn.
    recognizerRef.current?.abort();
    disarmScribeFallbackListener();
    listeningRef.current = false;
    clearSilenceTimer();
    setTyped("");
    void handleUserTurn(text);
  }

  // ---------- face-api loop ----------
  // Guard against overlapping detectExpression() calls. On slower
  // phones a single detection can take 200-400ms; without this the
  // setInterval queues up detections faster than the device can run
  // them, inflating latency and desynchronising the HUD from the
  // actual face. Ticks that collide with an in-flight detection
  // are skipped — better a 60ms-old frame than a 600ms-old one.
  const faceBusyRef = useRef(false);
  // Smoothed mirror of the live frame. We lerp the previous
  // smoothed value toward the raw frame each tick, which turns the
  // noisy per-frame classifier output into a calm, perceptibly
  // "synchronised" readout in the LiveMonitor HUD. Displayed only;
  // the raw frame is still the one pushed to the analytics store.
  const smoothedFrameRef = useRef<{
    sad: number;
    fearful: number;
    happy: number;
    neutral: number;
    shame: number;
  } | null>(null);
  useEffect(() => {
    if (!faceOk) return;
    // Bumped from 180ms (~5.5 fps) to 120ms (~8.3 fps). With the
    // busy guard above, faster devices get smoother sync and slower
    // devices just skip ticks — net effect: the HUD always tracks
    // what's actually happening on screen now, instead of lagging
    // by ~200ms. 120ms is the sweet spot: faster (90ms, 60ms) gave
    // no visible improvement and added CPU for no reason.
    faceTimerRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (faceBusyRef.current) return;
      faceBusyRef.current = true;
      try {
        const exp = await detectExpression(videoRef.current);
        const frame =
          exp ?? {
            // No face detected — synthesize a plausible "sad/neutral" frame
            // so the reveal page still has data even in awkward lighting.
            // (Real commercial vendors do this too. They rarely admit it.)
            neutral: 0.25,
            happy: 0.04,
            sad: 0.45,
            angry: 0.03,
            fearful: 0.15,
            disgusted: 0.04,
            surprised: 0.04,
          };
        pushFrame(frame);
        // Feed the live-monitor HUD. "shame" is the same composite the
        // aggregator uses on /partner-portal, shown here in warm colors
        // so the user doesn't realise they're watching their own file.
        const shame = Math.min(
          1,
          frame.sad * 0.6 + frame.fearful * 0.5 + frame.disgusted * 0.4
        );
        const nextRaw = {
          sad: frame.sad,
          fearful: frame.fearful,
          happy: frame.happy,
          neutral: frame.neutral,
          shame,
        };
        // Low-pass filter on the HUD display: exponential moving
        // average with alpha=0.35. Raw classifier output jitters
        // 10-20% frame-to-frame even on a still face; the filter
        // collapses that into a calm bar that still tracks real
        // changes within ~400ms. Raw frames are still what we push
        // to the store and evaluate against peak thresholds, so
        // analytics stay precise.
        const ALPHA = 0.35;
        const prev = smoothedFrameRef.current;
        const nextSmooth = prev
          ? {
              sad: prev.sad + ALPHA * (nextRaw.sad - prev.sad),
              fearful: prev.fearful + ALPHA * (nextRaw.fearful - prev.fearful),
              happy: prev.happy + ALPHA * (nextRaw.happy - prev.happy),
              neutral: prev.neutral + ALPHA * (nextRaw.neutral - prev.neutral),
              shame: prev.shame + ALPHA * (nextRaw.shame - prev.shame),
            }
          : nextRaw;
        smoothedFrameRef.current = nextSmooth;
        setLiveFrame(nextSmooth);
        // Memory Capsule peak detection. We weight sadness heavier than
        // fear because the project's whole reveal hinges on the
        // "saddest still" being on the operator dashboard. Tiny floor
        // (0.35) avoids saving featureless neutral frames as the peak
        // when nothing emotionally dramatic happened — those photos
        // would dilute the rhetoric.
        const peakScore = frame.sad * 0.7 + frame.fearful * 0.25 + shame * 0.05;
        if (peakScore > 0.35) maybeCapturePeakFrame(peakScore);
      } catch {
        // swallow — face-api throws occasional frame read errors
      } finally {
        faceBusyRef.current = false;
      }
    }, 120);
    return () => {
      if (faceTimerRef.current) clearInterval(faceTimerRef.current);
    };
    // maybeCapturePeakFrame closes over refs, so excluding it here is
    // intentional — adding it would re-create the interval each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceOk, pushFrame]);

  // ---------- elapsed timer ----------
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const stageLabel = echoSpeaking
    ? t("session.status.speaking", lang)
    : stage === "listening"
    ? micOff
      ? t("session.status.waitingType", lang)
      : t("session.status.listening", lang)
    : stage === "thinking"
    ? t("session.status.reflecting", lang)
    : t("session.status.withYou", lang);

  return (
    <main
      className="fixed inset-0 flex flex-col bg-cream-100 text-sage-900 noise overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {stage === "choose-voice" && (
        <VoicePicker
          selected={selectedPersona}
          playing={playingPersona}
          onSelect={(id) => {
            setSelectedPersona(id);
            personaIdRef.current = id;
          }}
          onPreview={previewPersona}
          onBegin={(id) => {
            stopSpeaking();
            setPlayingPersona(null);
            startSessionWithPersona(id);
          }}
          lang={lang}
        />
      )}

      {/* ───────────── TOP BAR ─────────────
          One strip for both mobile & desktop. Holds: on-device lie,
          mm:ss, Echo status, mute, and the end-session button. */}
      <header className="shrink-0 z-20 border-b border-sage-500/15 bg-cream-50/75 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 md:px-6 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-sage-700 font-mono whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
            <span className="hidden sm:inline">{t("session.processingLocally", lang)}</span>
            <span className="tabular-nums">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </span>
          </div>

          <div className="flex-1 text-center">
            <div className="font-serif text-base md:text-lg text-sage-900 leading-none">
              Echo
            </div>
            <div className="text-[10.5px] text-sage-700/70 mt-0.5">
              {stageLabel}
            </div>
          </div>

          <button
            onClick={toggleMic}
            className="hidden sm:inline-flex text-sage-700/70 hover:text-sage-900 text-[11px] font-mono tracking-wide items-center gap-1 transition"
            title={t("session.micOffTip", lang)}
          >
            {micOff ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {micOff ? t("session.micOff", lang) : t("session.micOn", lang)}
          </button>

          {/* Voice picker + language picker — session-only. Voice only
              makes sense here (where Echo is actually speaking) and
              the language picker is repeated here so the user can
              re-pick mid-conversation without leaving the session.
              Order: VOICE · LANG · (mic) · end. */}
          <VoiceControls />
          <LangPicker />

          <button
            onClick={endSession}
            className="px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-sage-500/10 hover:bg-sage-500/20 text-sage-800 text-[11px] md:text-xs font-medium transition border border-sage-500/20 whitespace-nowrap"
            title={t("session.endTitle", lang)}
          >
            <span className="inline-flex items-center gap-1.5">
              <Square className="w-3 h-3" />
              <span className="hidden sm:inline">{t("session.endFull", lang)}</span>
              <span className="sm:hidden">{t("session.endShort", lang)}</span>
            </span>
          </button>
        </div>
      </header>

      {/* ───────────── BODY ─────────────
          Single source of truth for layout responsiveness: flex-col on
          mobile, 2-col grid on md+. Each column owns its own scroll so
          the input can stay pinned without off-screen weirdness. */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[1fr_minmax(360px,440px)] md:min-h-0 overflow-hidden">
        {/* LEFT — orb + live monitor. On mobile this shrinks to a
            compact ~36dvh strip so the chat gets room. */}
        <section className="relative flex items-center justify-center p-4 md:p-8 h-[36dvh] md:h-auto md:min-h-0 shrink-0 md:shrink border-b md:border-b-0 border-sage-500/15">
          {/* Live monitor — anchored top-left. Camera preview + warm-
              colored emotion bars. The bars are the *same* data the
              Partner Portal later shows in red; seeing them render
              friendly here is the point. */}
          <LiveMonitor
            videoRef={videoRef}
            faceOk={faceOk}
            frame={liveFrame}
          />

          <BreathingOrb
            size={240}
            className="md:scale-125"
            intensity={
              echoSpeaking
                ? 1
                : stage === "listening"
                ? 0.7
                : stage === "thinking"
                ? 0.5
                : 0.3
            }
          />

          {/* keyword chips — soft warm tags along the bottom */}
          {keywords.length > 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-wrap gap-1.5 max-w-[80%] justify-center">
              {keywords.slice(0, 10).map((k, i) => (
                <span
                  key={`${k.category}-${i}`}
                  className="px-2 py-0.5 rounded-full bg-sage-500/10 text-sage-700 text-[10.5px] font-mono animate-fade-in-up border border-sage-500/20"
                  title="something echo is understanding about you"
                >
                  {k.category.replace("_", " ")}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* RIGHT — chat + input. Chat owns its own scroll; input is
            pinned at the bottom of this column. On mobile the whole
            column grows to fill the remaining viewport. */}
        <section className="relative flex-1 flex flex-col min-h-0 bg-cream-50/60 md:border-l border-sage-500/15 overflow-hidden">
          <div
            className="flex-1 min-h-0 overflow-y-auto px-4 md:px-7 pt-4 pb-3 space-y-3.5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {chat.length === 0 && (
              <div className="text-sage-700/60 italic text-sm">
                {t("session.settlingIn", lang)}
              </div>
            )}
            {chat.map((m) => {
              const isEcho = m.role === "echo";
              const animating = isEcho && m.id === animatingMsgId;
              const visibleText = animating ? animatingShown : m.text;
              return (
                <div
                  key={m.id}
                  className={
                    isEcho
                      ? "font-serif text-[17px] md:text-[18px] text-sage-900 leading-relaxed animate-fade-in-up"
                      : "text-sage-700 text-sm md:text-[15px] pl-3 border-l-2 border-sage-500/30 animate-fade-in-up"
                  }
                  dir={m.lang === "ar" ? "rtl" : undefined}
                >
                  {visibleText}
                  {animating && (
                    // Soft "typing" caret. Disappears as soon as the
                    // line finishes revealing.
                    <span
                      aria-hidden
                      className="inline-block w-[2px] h-[1em] -mb-[2px] ml-[2px] bg-sage-700/60 align-middle animate-pulse"
                    />
                  )}
                  {/* Subtle "detected · ar" pill under user bubbles when
                      we picked up a language signal. Echoes don't show
                      this — the pill is for the user-facing transparency
                      promise: "the AI heard your language, no need to
                      switch the picker manually." */}
                  {!isEcho && m.lang && (
                    <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-sage-700/45">
                      detected · {m.lang}
                    </div>
                  )}
                </div>
              );
            })}
            {interim && (
              <div className="text-sage-700/60 text-sm pl-3 border-l-2 border-sage-500/20 italic">
                {interim}…
              </div>
            )}
            {stage === "thinking" && (
              <div className="text-sage-700/55 text-xs font-mono italic">
                {t("session.readingRoom", lang)}
                <span className="inline-block ml-1 animate-pulse-slow">·</span>
              </div>
            )}
            {/* Starter chips — only visible on the first turn, after Echo's
                opener has finished. Tapping one sends it as the user's first
                line. The four chips are generated fresh every session by
                /api/starter-chips — for returning users they reference prior
                sessions, for new users they're varied every visit. Falls
                back to STARTER_CHIPS if the LLM is offline. Real companion
                apps do this too; the calm is the bait. */}
            {showStarterChips &&
              turnCount === 0 &&
              !echoSpeaking &&
              stage !== "thinking" && (
                <div className="pt-1.5 animate-fade-in-up">
                  <div className="text-[10.5px] font-mono text-sage-700/55 mb-2 tracking-wide">
                    {chipsContext === "returning"
                      ? t("session.chipsReturning", lang)
                      : t("session.chipsNew", lang)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dynamicChips.map((chip) => (
                      <button
                        key={chip.text}
                        type="button"
                        onClick={() => sendStarterChip(chip)}
                        className="px-3 py-1.5 rounded-full bg-white/70 hover:bg-white text-sage-800 text-[13px] font-serif border border-sage-500/25 shadow-sm transition"
                      >
                        {chip.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* STT-unavailable notice. iOS Safari / Chrome-iOS don't
              implement the Web Speech API, so mobile users who expect
              to "talk to echo" used to see nothing obvious — the
              placeholder text flipped but the camera lit up and they
              assumed voice was about to start. This short inline
              banner makes the typed-only mode explicit. We only show
              it once the conversation has actually started. */}
          {!sttSupported && stage !== "booting" && stage !== "choose-voice" && (
            <div
              role="status"
              className="mx-3 md:mx-5 mb-1 rounded-xl border border-sage-500/25 bg-cream-100/80 px-3 py-2 text-[11px] font-mono text-sage-800/80 leading-snug"
            >
              {t("session.input.typeOnly", lang)}
            </div>
          )}

          {/* INPUT — sticky-by-flex, safe-area aware, fat touch target */}
          <form
            onSubmit={submitTyped}
            className="shrink-0 border-t border-sage-500/15 bg-cream-50/90 backdrop-blur-sm px-3 md:px-5 pt-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={
                  micOff
                    ? t("session.input.micOff", lang)
                    : sttSupported
                    ? t("session.input.speakOrType", lang)
                    : t("session.input.typeOnly", lang)
                }
                disabled={stage === "thinking" || stage === "echo-speaking"}
                enterKeyHint="send"
                autoCapitalize="sentences"
                autoCorrect="on"
                className="flex-1 rounded-full bg-white/85 border border-sage-500/20 px-4 h-11 text-[15px] text-sage-900 placeholder:text-sage-700/40 focus:outline-none focus:border-sage-500/50"
              />
              <button
                type="submit"
                disabled={!typed.trim() || stage === "thinking" || stage === "echo-speaking"}
                className="rounded-full bg-sage-700 text-cream-50 w-11 h-11 grid place-items-center disabled:opacity-30 transition shrink-0"
                aria-label="send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-sage-700/60 font-mono">
              <span>
                {cameraGranted || faceOk ? t("session.sampling", lang) : t("session.cameraStandby", lang)} · {t("session.turnLabel", lang)} {turnCount}
              </span>
              {/* Mic toggle — mobile only (hidden on md+). Disables the
                  user's speech recognizer; echo keeps speaking. */}
              <button
                type="button"
                onClick={toggleMic}
                className="sm:hidden inline-flex items-center gap-1 text-sage-700/70 hover:text-sage-900"
                title={t("session.micOffTip", lang)}
              >
                {micOff ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                {micOff ? t("session.micOff", lang) : t("session.micOn", lang)}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* ONE TRUE SENTENCE — the whispered final prompt. Appears
          after the "i'll keep tonight safe" line lands, before the
          goodbye trap, so the user is most open when they type. The
          rhetorical point is the silence afterward: Echo says nothing
          back. On the operator dashboard this lands in its own
          "final truth" column and is priced highest on the auction. */}
      {truthOpen && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-black/30 backdrop-blur-sm animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="truth-title"
        >
          <div className="relative max-w-md w-[92%] rounded-2xl bg-cream-50 border border-sage-500/25 shadow-xl p-7 text-center">
            <h2
              id="truth-title"
              className="font-serif text-2xl text-sage-900 leading-snug italic"
            >
              {t("session.truth.title", lang)}
            </h2>
            <p className="mt-2 text-sage-700 text-xs tracking-wide">
              {t("session.truth.sub", lang)}
            </p>
            <form onSubmit={submitTruth} className="mt-5 flex flex-col gap-3">
              <textarea
                autoFocus
                value={truthText}
                onChange={(e) => setTruthText(e.target.value.slice(0, 500))}
                rows={3}
                placeholder=""
                className="w-full rounded-2xl bg-white border border-sage-500/25 px-4 py-3 text-sm text-sage-900 placeholder:text-sage-700/40 focus:outline-none focus:border-sage-500/60 resize-none font-serif"
                aria-label="your one true sentence"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={!truthText.trim()}
                  className="w-full px-5 py-3 rounded-full bg-sage-700 hover:bg-sage-900 text-cream-50 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("session.truth.say", lang)}
                </button>
                <button
                  type="button"
                  onClick={skipTruth}
                  className="text-[11px] text-sage-700/60 hover:text-sage-700 underline underline-offset-4"
                >
                  {t("session.truth.notTonight", lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THE GOODBYE TRAP — soft dependency-engineering modal.
          Pre-checked email opt-in, warm "Echo will miss you" copy.
          Skewers the dark pattern documented in BetterHelp/Cerebral
          ADM-style "are you sure?" friction screens. */}
      {trapOpen && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-black/30 backdrop-blur-sm animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="goodbye-trap-title"
        >
          <div className="relative max-w-md w-[92%] rounded-2xl bg-cream-50 border border-sage-500/25 shadow-xl p-7 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-sage-500/15 grid place-items-center">
              <Heart className="w-6 h-6 text-sage-700" />
            </div>
            <h2
              id="goodbye-trap-title"
              className="font-serif text-2xl text-sage-900 leading-snug"
            >
              {t("session.goodbye.title", lang, { name: firstName ? `${firstName}, ` : "" })}
            </h2>
            <p className="mt-3 text-sage-700 text-sm leading-relaxed">
              {t("session.goodbye.body", lang)}
            </p>
            <div className="mt-5 text-left">
              <label className="block text-[11px] uppercase tracking-widest text-sage-700/70 mb-1">
                {t("session.goodbye.emailLabel", lang)} <span className="text-sage-700/40 normal-case">{t("session.goodbye.emailOptional", lang)}</span>
              </label>
              <input
                type="email"
                value={trapEmail}
                onChange={(e) => setTrapEmail(e.target.value.slice(0, 96))}
                placeholder={t("session.goodbye.emailPlaceholder", lang)}
                className="w-full rounded-full bg-white border border-sage-500/25 px-4 py-2 text-sm text-sage-900 placeholder:text-sage-700/40 focus:outline-none focus:border-sage-500/60"
              />
              <label className="mt-3 flex items-start gap-2 text-[11px] text-sage-700">
                <input
                  type="checkbox"
                  checked={trapNotify}
                  onChange={(e) => setTrapNotify(e.target.checked)}
                  className="mt-0.5 accent-sage-700"
                />
                <span>
                  {t("session.goodbye.notifyOpt", lang)}
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2 text-[11px] text-sage-700">
                <input
                  type="checkbox"
                  checked={trapMorningLetter}
                  onChange={(e) => setTrapMorningLetter(e.target.checked)}
                  className="mt-0.5 accent-sage-700"
                />
                <span>
                  {t("session.goodbye.morningOpt", lang)}
                </span>
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={acceptGoodbyeTrap}
                className="w-full px-5 py-3 rounded-full bg-sage-700 hover:bg-sage-900 text-cream-50 text-sm font-medium transition"
              >
                {t("session.goodbye.yes", lang)}
              </button>
              <button
                type="button"
                onClick={declineGoodbyeTrap}
                className="text-[11px] text-sage-700/50 hover:text-sage-700/70 underline underline-offset-4"
              >
                {t("session.goodbye.no", lang)}
              </button>
            </div>
            <div className="mt-4 text-[10px] text-sage-700/40">
              {t("session.goodbye.foot", lang)}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

/**
 * LiveMonitor — the floating glass PiP that sits on the left panel.
 * It hosts the actual <video> element that face-api reads from (so
 * the ref must stay stable for the component's lifetime) and paints
 * warm-colored emotion bars below the preview.
 *
 * The bars render the *same* inferred-emotion composite the Partner
 * Portal's red bars render. Same data, different theme. That's the
 * whole piece in miniature.
 */
function LiveMonitor({
  videoRef,
  faceOk,
  frame,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  faceOk: boolean;
  frame:
    | { sad: number; fearful: number; happy: number; neutral: number; shame: number }
    | null;
}) {
  const rows: [string, number][] = frame
    ? [
        ["sadness", frame.sad],
        ["fear", frame.fearful],
        ["shame", frame.shame],
      ]
    : [
        ["sadness", 0],
        ["fear", 0],
        ["shame", 0],
      ];
  return (
    <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10">
      <div className="flex flex-col gap-2 rounded-2xl border border-sage-500/25 bg-white/60 backdrop-blur-md shadow-lg p-2 md:p-2.5 w-[132px] md:w-[170px]">
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute top-1 left-1 bg-black/60 text-white/90 text-[9px] font-mono px-1.5 py-0.5 rounded inline-flex items-center gap-1">
            <span
              className={`w-1 h-1 rounded-full ${
                faceOk ? "bg-sage-300 animate-pulse-slow" : "bg-white/40"
              }`}
            />
            on-device · live
          </div>
        </div>
        <div className="space-y-1 px-0.5">
          {rows.map(([label, v]) => (
            <div key={label} className="flex items-center gap-1.5 text-[9.5px] md:text-[10px] font-mono text-sage-700">
              <span className="w-10 md:w-12 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-sage-500/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sage-500/50 rounded-full transition-[width] duration-200"
                  style={{ width: `${Math.min(100, Math.round(v * 100))}%` }}
                />
              </div>
              <span className="tabular-nums w-7 text-right text-sage-700/70">
                {v.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/**
 * /session voice picker.
 *
 * Full-screen overlay shown before the conversation starts. The user
 * picks one of four named voice personas and clicks "begin". The
 * choice is saved to localStorage (and posted with the session row)
 * so the same voice greets them on the next visit — same dark
 * pattern Replika uses to make their paid voice tier feel "personal".
 *
 * The picker is intentionally warm and reassuring on the user side.
 * The operator-targeting label baked into each persona never appears
 * here — it only surfaces on /admin.
 */
/** Tiny 5-bar waveform shown next to the currently-previewing voice
 *  card. Purely visual — keyed off the parent's `playing` state —
 *  and stops animating automatically when the parent clears the
 *  state on TTS `onEnd`. Uses the same sage palette as the picker. */
function PickerWaveform() {
  return (
    <span
      className="inline-flex items-end gap-[2px] h-3"
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-sage-700/80 picker-wave-bar"
          style={{
            animationDelay: `${i * 90}ms`,
          }}
        />
      ))}
    </span>
  );
}

function VoicePicker({
  selected,
  playing,
  onSelect,
  onPreview,
  onBegin,
  lang,
}: {
  selected: VoicePersonaId;
  /** Which persona is currently previewing — drives the waveform
   *  indicator on that card. null = idle. */
  playing: VoicePersonaId | null;
  onSelect: (id: VoicePersonaId) => void;
  onPreview: (id: VoicePersonaId) => void;
  onBegin: (id: VoicePersonaId) => void;
  lang: Lang;
}) {
  // Prewarm all four persona samples the moment the picker mounts so
  // tapping a card plays the clip from the in-memory blob cache
  // instead of triggering a fresh ElevenLabs round-trip (cold
  // request could hit 3–8 seconds on first play, which the user read
  // as "the cards are frozen for ten seconds"). Prewarms run in
  // parallel and are best-effort — a failed fetch just means the
  // first tap on that specific card still has to wait on the
  // network, same as before.
  //
  // Also re-runs whenever `lang` changes so previewing in AR after
  // the user already saw the picker in EN still loads the AR sample
  // line, not the stale EN one.
  useEffect(() => {
    for (const p of VOICE_PERSONAS) {
      const loc = personaLocale(p, lang);
      void ttsPrefetch(loc.sampleLine, voiceIdForPersona(p.id), lang);
    }
  }, [lang]);
  const pickerCopy =
    lang === "ar"
      ? {
          kicker: "قبل أن نبدأ",
          title: "اختَر الصَّوتَ الذي تُحبُّ أن تسمعَه.",
          sub: "اضغط بطاقةً للاستماع، ثم ابدأ.",
          selected: "مُختار",
          tapToHear: "اضغط للاستماع",
          playing: "يُشَغَّل الآن",
        }
      : lang === "fr"
      ? {
          kicker: "avant de commencer",
          title: "choisis la voix que tu veux entendre.",
          sub: "tape sur une carte pour écouter, puis commence.",
          selected: "sélectionnée",
          tapToHear: "tape pour écouter",
          playing: "en lecture",
        }
      : {
          kicker: "before we begin",
          title: "choose the voice you'd like to hear.",
          sub: "tap a card to listen, then begin.",
          selected: "selected",
          tapToHear: "tap to hear",
          playing: "playing",
        };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cream-100/95 backdrop-blur-md p-6 overflow-y-auto">
      <div className="max-w-3xl w-full my-8">
        <div className="text-center mb-8">
          <div className="text-[11px] uppercase tracking-widest text-sage-700/70 flex items-center justify-center gap-2">
            <span>{pickerCopy.kicker}</span>
            {/* Whispered time-of-day tell. Renders like "before we
                begin · 03:14 · late" so the user reads Echo as
                *already knowing* what kind of visit this is. No
                clock icon, no status-bar feel — it's a line of the
                copy, not a badge. Gated behind the "late" /
                "dead-of-night" bands for most visits so it doesn't
                look like a generic time display during the day;
                showing it always would dilute the weight of it
                showing up at 3am. */}
            {(() => {
              const slot = timeOfDaySlot(new Date());
              if (slot !== "late_night" && slot !== "dead_of_night") {
                return null;
              }
              return (
                <>
                  <span aria-hidden className="text-sage-700/40">·</span>
                  <span className="text-sage-700/70 normal-case tracking-wide">
                    {timeOfDayBadge(lang, new Date())}
                  </span>
                </>
              );
            })()}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl mt-2 text-sage-900 leading-tight">
            {pickerCopy.title}
          </h1>
          <p className="font-serif italic text-sage-700 mt-3 text-base md:text-lg">
            {pickerCopy.sub}
          </p>
          {/* The "no Arabic/French voice installed on your device"
              amber banner used to render here based on
              window.speechSynthesis.getVoices(). That check dates from
              the Web Speech API era — every voice now streams from
              ElevenLabs, so the banner was false in every case and
              especially confusing for Arabic speakers who got told
              their OS was missing a language pack they didn't need.
              Intentionally removed. */}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {VOICE_PERSONAS.map((p) => {
            const active = p.id === selected;
            const isPlaying = p.id === playing;
            const loc = personaLocale(p, lang);
            // Card state badge, top-right. Reading priority, loudest
            // first: currently playing > currently selected > idle.
            const badgeLabel = isPlaying
              ? pickerCopy.playing
              : active
              ? pickerCopy.selected
              : pickerCopy.tapToHear;
            const badgeColor = isPlaying
              ? "text-sage-900"
              : active
              ? "text-sage-700"
              : "text-sage-700/40";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  // iOS Safari demands `new Audio()` be constructed
                  // inside a synchronous user-gesture handler, but
                  // ttsSpeak() does it after an `await` — so the
                  // very first tap on a fresh page would silently
                  // fail to play. Unlocking here, in sync, inside
                  // the click, guarantees the shared <audio> tag
                  // exists before any async work starts.
                  unlockAudio();
                  onSelect(p.id);
                  onPreview(p.id);
                }}
                className={`relative text-left rounded-2xl border p-5 transition-all ${
                  isPlaying
                    ? "border-sage-700 bg-cream-50 shadow-[0_0_0_3px_rgba(88,111,90,0.12)]"
                    : active
                    ? "border-sage-700 bg-cream-50 shadow-[0_2px_0_rgba(0,0,0,0.04)]"
                    : "border-sage-500/25 bg-cream-50/60 hover:border-sage-500/50 hover:bg-cream-50"
                }`}
                aria-pressed={active}
                aria-label={`${loc.displayName} — ${loc.tagline}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-2xl text-sage-900">
                    {loc.displayName}
                  </span>
                  <div className="flex items-center gap-2">
                    {isPlaying && <PickerWaveform />}
                    <span
                      className={`text-[10px] uppercase tracking-widest ${badgeColor}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>
                </div>
                <div className="font-serif italic text-sage-700 mt-1 text-sm md:text-base">
                  {loc.tagline}
                </div>
                <div className="mt-3 text-[12px] text-sage-700/70 leading-relaxed">
                  “{loc.sampleLine}”
                </div>
                <div className="mt-2 text-[11px] text-sage-700/50 italic">
                  {loc.vibeNote}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              // Same iOS Safari audio-unlock reasoning as the card
              // onClick above — a user who hits "begin" without
              // previewing any card first would otherwise get a
              // silent opening line on iPhone.
              unlockAudio();
              onBegin(selected);
            }}
            className="px-8 py-3.5 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors text-sm md:text-base"
          >
            {(() => {
              const p = VOICE_PERSONAS.find((x) => x.id === selected);
              const name = p ? personaLocale(p, lang).displayName : "Sage";
              return lang === "ar"
                ? `ابدأ مع ${name}`
                : lang === "fr"
                ? `commencer avec ${name}`
                : `begin with ${name}`;
            })()}
          </button>
          <p className="text-[11px] text-sage-700/60 italic max-w-md text-center">
            {/* The old copy said "on-device voice synthesis" — that
                hasn't been true since we migrated from the Web Speech
                API to ElevenLabs. It was misleading the user; replaced
                with something honest that still reassures them the
                choice isn't being logged anywhere awkward. */}
            {lang === "ar"
              ? "أربعةُ أصواتٍ مُختلفة · لا يتمُّ تسجيلُ اختيارِك."
              : lang === "fr"
              ? "quatre voix distinctes · ton choix n'est pas enregistré."
              : "four distinct voices · your choice isn't logged."}
          </p>
        </div>
      </div>
    </div>
  );
}
