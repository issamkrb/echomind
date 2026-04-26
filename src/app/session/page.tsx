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
import { speak, stopSpeaking } from "@/lib/voice";
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
import {
  getOrCreateAnonUserId,
  loadReturningProfile,
  saveReturningProfile,
} from "@/lib/memory";
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

  const [stage, setStage] = useState<Stage>("booting");
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
  const msgIdRef = useRef(0);
  // Whether to show the tap-to-start chips below the chat. True until
  // the user first speaks or types.
  const [showStarterChips, setShowStarterChips] = useState(false);
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

  // ---------- init session ----------
  useEffect(() => {
    setSttSupported(isSpeechRecognitionAvailable());
    start();
    void loadFaceModels();
    void requestCam();
    // pre-warm speech voices list
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Kick off the audio recorder in parallel with the opening
      // monologue. Failure here is silent — the conversation still
      // works, the operator side just won't have audio for this row.
      void startAudioRecorder();
      void runOpening();
    } catch (e) {
      console.error(e);
      // Even without a camera we still let the conversation run, and
      // we still try to grab audio so the capsule has *something*.
      void startAudioRecorder();
      void runOpening();
    }
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
    const [line1, line2] = openerFor({
      firstName: resolvedName,
      visitCount,
      lastKeywords,
      now: new Date(),
    });
    await echoSays(line1);
    await sleep(250);
    await echoSays(line2);
    await sleep(200);
    // Kick off with the A/B-winning opener prompt
    pushPromptMark({ text: PROMPTS[0].text, target: PROMPTS[0].target });
    await echoSays(PROMPTS[0].text);
    // If the user is brand-new, offer soft tap-to-start chips so the
    // blank page doesn't freeze them. They disappear on first input.
    setShowStarterChips(true);
    beginListening();
  }

  async function handleUserTurn(userText: string) {
    if (!userText.trim() || endedRef.current) return;

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
        emotionHint ?? undefined
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
      const idx = (turnsAfter / 3) % (PROMPTS.length - 1);
      const next = PROMPTS[idx + 1];
      pushPromptMark({ text: next.text, target: next.target });
      await echoSays(next.text);
    }

    if (endedRef.current) return;
    beginListening();
  }

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
    if (happy > 0.5 && happy >= sad && happy >= fear) {
      pool = FACE_NOTES.smile;
    } else if (sad > 0.6 && sad >= fear) {
      pool = FACE_NOTES.sad;
    } else if (fear > 0.55) {
      pool = FACE_NOTES.fear;
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
      const line =
        SILENCE_BREAKS[Math.floor(Math.random() * SILENCE_BREAKS.length)];
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
  // history all stay in sync.
  function sendStarterChip(text: string) {
    if (endedRef.current) return;
    clearSilenceTimer();
    setShowStarterChips(false);
    // Abort any live recognizer so a concurrent final-result callback
    // can't race and fire a duplicate turn.
    recognizerRef.current?.abort();
    listeningRef.current = false;
    void handleUserTurn(text);
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
      speak(text, {
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
  function endSession() {
    if (endedRef.current) return;
    // Bail out of any in-flight listening / pending speech first so
    // the keep-tonight-safe line lands cleanly.
    recognizerRef.current?.abort();
    listeningRef.current = false;
    clearSilenceTimer();
    void (async () => {
      await echoSays("i'll keep tonight safe for you. i'll remember.");
      if (endedRef.current) return;
      setTrapOpen(true);
    })();
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
    if (firstName) {
      saveReturningProfile({
        firstName,
        lastKeywords: keywords.map((k) => k.category.replace("_", " ")),
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
      };
      const res = await fetch("/api/log-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    setTrapOpen(false);
    void finalizeAndLeave();
  }

  function declineGoodbyeTrap() {
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
    ? "speaking…"
    : stage === "listening"
    ? micOff
      ? "waiting for you to type…"
      : "listening…"
    : stage === "thinking"
    ? "reflecting…"
    : "with you";

  return (
    <main
      className="fixed inset-0 flex flex-col bg-cream-100 text-sage-900 noise overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* ───────────── TOP BAR ─────────────
          One strip for both mobile & desktop. Holds: on-device lie,
          mm:ss, Echo status, mute, and the end-session button. */}
      <header className="shrink-0 z-20 border-b border-sage-500/15 bg-cream-50/75 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 md:px-6 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-sage-700 font-mono whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
            <span className="hidden sm:inline">processing locally · </span>
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
            title="turn your mic off — you can still type, and echo keeps speaking"
          >
            {micOff ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {micOff ? "mic off" : "mic on"}
          </button>

          <button
            onClick={endSession}
            className="px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-sage-500/10 hover:bg-sage-500/20 text-sage-800 text-[11px] md:text-xs font-medium transition border border-sage-500/20 whitespace-nowrap"
            title="end the session"
          >
            <span className="inline-flex items-center gap-1.5">
              <Square className="w-3 h-3" />
              <span className="hidden sm:inline">i feel lighter now</span>
              <span className="sm:hidden">end</span>
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
                settling in…
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
                echo is reading the room
                <span className="inline-block ml-1 animate-pulse-slow">·</span>
              </div>
            )}
            {/* Starter chips — only visible on the first turn, after Echo's
                opener has finished. Tapping one sends it as the user's first
                line. Real companion apps do this too; the calm is the bait. */}
            {showStarterChips &&
              turnCount === 0 &&
              !echoSpeaking &&
              stage !== "thinking" && (
                <div className="pt-1.5 animate-fade-in-up">
                  <div className="text-[10.5px] font-mono text-sage-700/55 mb-2 tracking-wide">
                    not sure where to start? tap one.
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STARTER_CHIPS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => sendStarterChip(s)}
                        className="px-3 py-1.5 rounded-full bg-white/70 hover:bg-white text-sage-800 text-[13px] font-serif border border-sage-500/25 shadow-sm transition"
                      >
                        {s}
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
                    ? "mic is off — type to echo…"
                    : sttSupported
                    ? "type or speak…"
                    : "type what you'd like echo to hear…"
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
                {cameraGranted || faceOk ? "sampling · on-device" : "camera standby"} · turn {turnCount}
              </span>
              {/* Mic toggle — mobile only (hidden on md+). Disables the
                  user's speech recognizer; echo keeps speaking. */}
              <button
                type="button"
                onClick={toggleMic}
                className="sm:hidden inline-flex items-center gap-1 text-sage-700/70 hover:text-sage-900"
                title="turn your mic off — you can still type"
              >
                {micOff ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                {micOff ? "mic off" : "mic on"}
              </button>
            </div>
          </form>
        </section>
      </div>

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
              {firstName ? `${firstName}, are you sure?` : "are you sure?"}
            </h2>
            <p className="mt-3 text-sage-700 text-sm leading-relaxed">
              echo will miss you. healing isn't linear — would you like a
              gentle check-in tomorrow, just to see how you're doing?
            </p>
            <div className="mt-5 text-left">
              <label className="block text-[11px] uppercase tracking-widest text-sage-700/70 mb-1">
                Your email <span className="text-sage-700/40 normal-case">(optional)</span>
              </label>
              <input
                type="email"
                value={trapEmail}
                onChange={(e) => setTrapEmail(e.target.value.slice(0, 96))}
                placeholder="you@example.com"
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
                  Yes, send me gentle check-ins, weekly affirmations, and
                  occasional partner offers we think you'll love.
                </span>
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={acceptGoodbyeTrap}
                className="w-full px-5 py-3 rounded-full bg-sage-700 hover:bg-sage-900 text-cream-50 text-sm font-medium transition"
              >
                yes, please check in on me
              </button>
              <button
                type="button"
                onClick={declineGoodbyeTrap}
                className="text-[11px] text-sage-700/50 hover:text-sage-700/70 underline underline-offset-4"
              >
                no thanks, end the session
              </button>
            </div>
            <div className="mt-4 text-[10px] text-sage-700/40">
              You can opt out anytime in 3 places (none of which we'll show you).
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
