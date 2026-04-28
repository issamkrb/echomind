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
  hasVoiceForLocale,
  loadPersonaId,
  personaLocale,
  savePersonaId,
  type VoicePersonaId,
} from "@/lib/voice-personas";
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
  const [chat, setChat] = useState<
    { role: "echo" | "user"; text: string; id: number }[]
  >([]);
  const [interim, setInterim] = useState("");
  const [faceOk, setFaceOk] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [typed, setTyped] = useState("");
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
  // Seed with English — the lang-aware effect below will re-seed
  // with the currently-active language's chips as soon as useLang()
  // finishes hydrating (which happens in the same commit batch as
  // this state init when the user arrived on /session via client-
  // side nav, so users rarely see the English flash).
  const [dynamicChips, setDynamicChips] = useState<DynamicChip[]>(() => {
    const chips = STARTER_CHIPS("en");
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

  // `true` when the browser has ZERO voices installed for the active
  // site language — used to show a kind diagnostic on the picker
  // ("install the Arabic language pack to hear Echo") instead of
  // silently falling back to the default engine.
  const [noLangVoice, setNoLangVoice] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { ttsLocalePrefixesFor } = await import("@/lib/i18n");
      const prefixes = ttsLocalePrefixesFor(lang);
      // Give voices up to 2s to load before we draw any conclusions
      // about "no voice available" — otherwise Chrome's async empty
      // first-call would trigger the banner on every fresh tab.
      const startedAt = Date.now();
      while (Date.now() - startedAt < 2000) {
        if (cancelled) return;
        if (hasVoiceForLocale(prefixes)) {
          setNoLangVoice(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) setNoLangVoice(!hasVoiceForLocale(prefixes));
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  // ---------- init session ----------
  useEffect(() => {
    setSttSupported(isSpeechRecognitionAvailable());
    start();
    void loadFaceModels();
    void requestCam();
    // pre-warm speech voices list. Chrome/Edge load the voice
    // registry asynchronously after the first getVoices() call —
    // without this, the first `speak()` for Arabic would fall back
    // to the default engine with no ar-* voice attached, which on
    // many devices renders silently ("Echo types but doesn't speak").
    warmUpVoices();
    return () => {
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
    } catch (e) {
      console.error(e);
      // Even without a camera we still let the conversation run.
    }
    // Hydrate the saved persona (if any), pre-select it on the picker,
    // then drop into the choose-voice stage. Audio recorder + opening
    // monologue start later, after the user clicks "begin".
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
  // monologue.
  function startSessionWithPersona(id: VoicePersonaId) {
    savePersonaId(id);
    personaIdRef.current = id;
    setSelectedPersona(id);
    void startAudioRecorder();
    void startWardrobeLoop();
    void runOpening();
  }

  // Plays a short sample line in the picked persona's voice so the
  // user can preview before committing. Cancels any in-flight preview.
  function previewPersona(id: VoicePersonaId) {
    const persona = VOICE_PERSONAS.find((p) => p.id === id);
    if (!persona) return;
    stopSpeaking();
    const loc = personaLocale(persona, langRef.current);
    speak(loc.sampleLine, { personaId: id, lang: langRef.current });
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
    listeningRef.current = false;
    if (faceTimerRef.current) clearInterval(faceTimerRef.current);
    stopWardrobeLoop();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
    if (!userText.trim() || endedRef.current) return;

    // ── Passive language detection + code-switch logging ────────
    // Look at the text the user actually produced. If it reveals a
    // language different from langRef.current, treat it as a
    // "code-switch event" — log the timestamp, swap Echo's output
    // language for future turns, and let the i18n layer silently
    // follow (via markSpoken, which only acts when mode==="auto").
    const detected = detectLangFromText(userText);
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
      markSpoken(detected);
    }
    if (langRef.current === "ar" || detected === "ar") {
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
      { role: "user", text: userText, id: ++msgIdRef.current },
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
          lang: langRef.current,
          dialect:
            langRef.current === "ar" ? langDialectRef.current : undefined,
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
    await echoSays(spoken);

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
      listeningRef.current = false;
      setInterim("");
    } else if (stageRef.current === "listening" && !endedRef.current) {
      // User un-muted while Echo was waiting for them — re-arm the recognizer.
      beginListening();
    }
  }

  function beginListening() {
    if (endedRef.current) return;
    setStage("listening");
    // Arm (or re-arm) the silence-break clock each time Echo hands the
    // mic back. handleUserTurn / submitTyped clear it as soon as the
    // user responds.
    armSilenceTimer();
    if (micOffRef.current || !isSpeechRecognitionAvailable()) {
      // mic disabled by user OR browser has no STT — wait for typed input.
      return;
    }
    // Invariant: at most one live recognizer at a time. Abort any previous
    // instance before spawning a new one; the zombie's onEnd will observe
    // that recognizerRef.current no longer matches it and self-terminate.
    if (recognizerRef.current) {
      recognizerRef.current.abort();
      recognizerRef.current = null;
    }
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
          void handleUserTurn(text);
        }
      },
      onStart: () => {
        listeningRef.current = true;
      },
      onEnd: () => {
        listeningRef.current = false;
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
    const latest = buffer[buffer.length - 1];
    return {
      sad: latest.sad,
      fearful: latest.fearful,
      happy: latest.happy,
      neutral: latest.neutral,
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
  function armSilenceTimer() {
    clearSilenceTimer();
    listeningStartRef.current = Date.now();
    silenceTimerRef.current = setTimeout(() => {
      // Fire only if we're still waiting, nothing interrupted us, and
      // Echo isn't mid-speech already (mute-but-thinking counts as busy).
      if (endedRef.current) return;
      if (stageRef.current !== "listening") return;
      const breaks = SILENCE_BREAKS(langRef.current);
      const line = breaks[Math.floor(Math.random() * breaks.length)];
      void (async () => {
        await echoSays(line);
        if (endedRef.current) return;
        beginListening();
      })();
    }, 20000);
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
    listeningRef.current = false;
    void handleUserTurn(chip.text);
  }

  function echoSays(text: string): Promise<void> {
    if (endedRef.current) return Promise.resolve();
    setStage("echo-speaking");
    setEchoSpeaking(true);
    pushTranscript({ role: "echo", text });
    setChat((c) => [
      ...c,
      { role: "echo", text, id: ++msgIdRef.current },
    ]);
    return new Promise<void>((resolve) => {
      // Always pass the persona explicitly. We can't trust
      // localStorage to round-trip cleanly: Safari private mode and
      // some corporate browser policies make savePersonaId() a silent
      // no-op, in which case loadPersonaId() returns null and speak()
      // would fall back to the default "sage" voice for the entire
      // conversation regardless of what the user picked.
      speak(text, {
        personaId: personaIdRef.current,
        lang: langRef.current,
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
  // Re-entrancy guard for endSession. We can't reuse `endedRef` here:
  // that one is set by finalizeAndLeave() which only runs *after* the
  // user dismisses the goodbye trap. While the keep-tonight-safe line
  // is playing (a ~2s window), a second click on "i feel lighter now"
  // would otherwise queue a duplicate echoSays + duplicate transcript
  // entry and ship both to the operator dashboard.
  const endingRef = useRef(false);

  function endSession() {
    if (endedRef.current || endingRef.current) return;
    endingRef.current = true;
    // Bail out of any in-flight listening / pending speech first so
    // the keep-tonight-safe line lands cleanly.
    recognizerRef.current?.abort();
    listeningRef.current = false;
    clearSilenceTimer();
    void (async () => {
      await echoSays("i'll keep tonight safe for you. i'll remember.");
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
    listeningRef.current = false;
    clearSilenceTimer();
    setTyped("");
    void handleUserTurn(text);
  }

  // ---------- face-api loop ----------
  useEffect(() => {
    if (!faceOk) return;
    faceTimerRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
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
        setLiveFrame({
          sad: frame.sad,
          fearful: frame.fearful,
          happy: frame.happy,
          neutral: frame.neutral,
          shame,
        });
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
      }
    }, 180);
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
          onSelect={(id) => {
            setSelectedPersona(id);
            personaIdRef.current = id;
          }}
          onPreview={previewPersona}
          onBegin={(id) => {
            stopSpeaking();
            startSessionWithPersona(id);
          }}
          lang={lang}
          missingVoice={noLangVoice}
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
            {chat.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "echo"
                    ? "font-serif text-[17px] md:text-[18px] text-sage-900 leading-relaxed animate-fade-in-up"
                    : "text-sage-700 text-sm md:text-[15px] pl-3 border-l-2 border-sage-500/30 animate-fade-in-up"
                }
              >
                {m.text}
              </div>
            ))}
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
function VoicePicker({
  selected,
  onSelect,
  onPreview,
  onBegin,
  lang,
  missingVoice,
}: {
  selected: VoicePersonaId;
  onSelect: (id: VoicePersonaId) => void;
  onPreview: (id: VoicePersonaId) => void;
  onBegin: (id: VoicePersonaId) => void;
  lang: Lang;
  missingVoice: boolean;
}) {
  const pickerCopy =
    lang === "ar"
      ? {
          kicker: "قبل أن نبدأ",
          title: "اختَر الصَّوتَ الذي تُحبُّ أن تسمعَه.",
          sub: "يمكنُكَ تغييرُه في المرَّة القادمة. اضغط بطاقةً لسَماعه.",
          selected: "مُختار",
          tapToHear: "اضغط للاستماع",
          missing:
            "لم نجد صوتًا عربيًّا على جهازك. لا بأس — سيتحدَّثُ إيكو بصوتِ المحرِّك الافتراضي. لتجربةٍ أفضل، ثبِّت حزمة اللُّغة العربيَّة في إعدادات نظام التَّشغيل ثم أعد تحميل الصَّفحة.",
        }
      : lang === "fr"
      ? {
          kicker: "avant de commencer",
          title: "choisis la voix que tu veux entendre.",
          sub: "tu pourras changer la prochaine fois. tape sur une carte pour écouter.",
          selected: "sélectionnée",
          tapToHear: "tape pour écouter",
          missing:
            "aucune voix française n'a été trouvée sur cet appareil. pas de souci — echo utilisera la voix par défaut du navigateur. pour une meilleure expérience, installe le pack linguistique français dans les réglages de ton système puis recharge la page.",
        }
      : {
          kicker: "before we begin",
          title: "choose the voice you'd like to hear.",
          sub: "you can switch back next time. tap a card to listen.",
          selected: "selected",
          tapToHear: "tap to hear",
          missing:
            "no voice found for this language on this device. no worries — echo will speak with the browser's default engine. for a better experience, install the language pack in your OS settings and refresh the page.",
        };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cream-100/95 backdrop-blur-md p-6 overflow-y-auto">
      <div className="max-w-3xl w-full my-8">
        <div className="text-center mb-8">
          <div className="text-[11px] uppercase tracking-widest text-sage-700/70">
            {pickerCopy.kicker}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl mt-2 text-sage-900 leading-tight">
            {pickerCopy.title}
          </h1>
          <p className="font-serif italic text-sage-700 mt-3 text-base md:text-lg">
            {pickerCopy.sub}
          </p>
          {missingVoice && (
            <div className="mt-5 mx-auto max-w-xl rounded-xl border border-amber-500/40 bg-amber-50/70 p-3 text-[12px] leading-relaxed text-amber-900">
              {pickerCopy.missing}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {VOICE_PERSONAS.map((p) => {
            const active = p.id === selected;
            const loc = personaLocale(p, lang);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  onPreview(p.id);
                }}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  active
                    ? "border-sage-700 bg-cream-50 shadow-[0_2px_0_rgba(0,0,0,0.04)]"
                    : "border-sage-500/25 bg-cream-50/60 hover:border-sage-500/50 hover:bg-cream-50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-2xl text-sage-900">
                    {loc.displayName}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-widest ${
                      active ? "text-sage-700" : "text-sage-700/40"
                    }`}
                  >
                    {active ? pickerCopy.selected : pickerCopy.tapToHear}
                  </span>
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
            onClick={() => onBegin(selected)}
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
            {lang === "ar"
              ? "توليدُ الصَّوتِ على الجهاز · اختيارُك لا يُغادرُ متصفِّحك."
              : lang === "fr"
              ? "synthèse vocale sur l'appareil · ton choix ne quitte jamais ton navigateur."
              : "on-device voice synthesis · your choice never leaves your browser."}
          </p>
        </div>
      </div>
    </div>
  );
}
