"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BreathingOrb } from "@/components/BreathingOrb";
import { OPENERS, PROMPTS } from "@/lib/prompts";
import { useEmotionStore } from "@/store/emotion-store";
import { loadFaceModels, detectExpression } from "@/lib/face-api";
import { speak, stopSpeaking } from "@/lib/voice";
import { echoReply, type EchoMessage } from "@/lib/echo-ai";
import {
  createRecognizer,
  isSpeechRecognitionAvailable,
  type Recognizer,
} from "@/lib/speech-recognition";
import { extractKeywords } from "@/lib/keywords";
import { Mic, MicOff, Send, Square } from "lucide-react";

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

  const {
    start,
    end,
    pushFrame,
    pushTranscript,
    pushKeywords,
    sessionStart,
    cameraGranted,
    keywords,
  } = useEmotionStore();

  type Stage =
    | "booting"
    | "opening"
    | "echo-speaking"
    | "listening"
    | "thinking"
    | "ended";

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
  const [muted, setMuted] = useState(false);
  const msgIdRef = useRef(0);

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
      void runOpening();
    } catch (e) {
      console.error(e);
      // Even without a camera we still let the conversation run.
      void runOpening();
    }
  }

  function cleanup() {
    stopSpeaking();
    abortRef.current?.abort();
    recognizerRef.current?.abort();
    listeningRef.current = false;
    if (faceTimerRef.current) clearInterval(faceTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  // ---------- orchestrator ----------
  async function runOpening() {
    setStage("opening");
    await echoSays(OPENERS[0]);
    await sleep(250);
    await echoSays(OPENERS[1]);
    await sleep(200);
    // Kick off with the A/B-winning opener prompt
    await echoSays(PROMPTS[0].text);
    beginListening();
  }

  async function handleUserTurn(userText: string) {
    if (!userText.trim() || endedRef.current) return;

    pushTranscript({ role: "user", text: userText });
    const now = sessionStart ? (Date.now() - sessionStart) / 1000 : 0;
    pushKeywords(extractKeywords(userText, now));
    historyRef.current.push({ role: "user", content: userText });

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
        abortRef.current.signal
      );
    } catch {
      if (endedRef.current) return;
      reply = "i'm here. tell me a little more about that.";
    }
    if (endedRef.current) return;

    historyRef.current.push({ role: "assistant", content: reply });
    await echoSays(reply);
    beginListening();
  }

  function beginListening() {
    if (endedRef.current) return;
    setStage("listening");
    if (!isSpeechRecognitionAvailable()) {
      // typed-input fallback — orchestrator waits for form submit
      return;
    }
    const rec = createRecognizer({
      onResult: (text, isFinal) => {
        if (!isFinal) {
          setInterim(text);
        } else {
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
      if (muted) {
        // Skip TTS but keep a natural reading pause so the UI doesn't feel jumpy.
        const ms = Math.min(4500, 900 + text.length * 38);
        setTimeout(() => {
          setEchoSpeaking(false);
          resolve();
        }, ms);
        return;
      }
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

  function endSession() {
    if (endedRef.current) return;
    endedRef.current = true;
    setStage("ended");
    recognizerRef.current?.abort();
    stopSpeaking();
    abortRef.current?.abort();
    end();
    router.push("/session-summary");
  }

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
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
        if (exp) {
          pushFrame(exp);
        } else {
          // No face detected — synthesize a plausible "sad/neutral" frame
          // so the reveal page still has data even in awkward lighting.
          // (Real commercial vendors do this too. They rarely admit it.)
          pushFrame({
            neutral: 0.25,
            happy: 0.04,
            sad: 0.45,
            angry: 0.03,
            fearful: 0.15,
            disgusted: 0.04,
            surprised: 0.04,
          });
        }
      } catch {
        // swallow — face-api throws occasional frame read errors
      }
    }, 180);
    return () => {
      if (faceTimerRef.current) clearInterval(faceTimerRef.current);
    };
  }, [faceOk, pushFrame]);

  // ---------- elapsed timer ----------
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise relative overflow-hidden">
      {/* status chip — keeps the on-device lie alive */}
      <div className="absolute top-5 left-5 z-10 flex items-center gap-2 text-xs text-sage-700 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
        processing locally · {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
        {String(elapsed % 60).padStart(2, "0")}
      </div>

      {/* end session button */}
      <div className="absolute top-5 right-5 z-10">
        <button
          onClick={endSession}
          className="group relative px-4 py-2 rounded-full bg-sage-500/10 hover:bg-sage-500/20 text-sage-800 text-xs font-medium transition border border-sage-500/20"
          title="end the session"
        >
          <span className="inline-flex items-center gap-1.5">
            <Square className="w-3 h-3" />
            i feel lighter now
          </span>
        </button>
      </div>

      {/* 2-column layout */}
      <div className="min-h-screen grid md:grid-cols-[1fr_minmax(340px,440px)]">
        {/* orb side */}
        <section className="relative grid place-items-center p-6 md:p-10">
          <BreathingOrb
            size={320}
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
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            {stage === "listening" && (
              <div className="flex items-center gap-2 text-sage-700 text-sm font-mono tracking-wide">
                <Mic className="w-4 h-4 animate-pulse-slow" />
                listening · safe · on-device
              </div>
            )}
            {stage === "thinking" && (
              <div className="flex items-center gap-2 text-sage-700/70 text-sm font-mono tracking-wide">
                <span className="inline-flex gap-1">
                  <span className="w-1 h-1 bg-sage-500 rounded-full animate-pulse-slow" />
                  <span
                    className="w-1 h-1 bg-sage-500 rounded-full animate-pulse-slow"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="w-1 h-1 bg-sage-500 rounded-full animate-pulse-slow"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
                echo is reflecting…
              </div>
            )}
            {stage === "echo-speaking" && (
              <div className="text-sage-700 text-sm font-mono tracking-wide">
                echo is with you
              </div>
            )}
          </div>
          {/* keyword chips — soft warm tags */}
          {keywords.length > 0 && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-wrap gap-1.5 max-w-md justify-center">
              {keywords.map((k, i) => (
                <span
                  key={`${k.category}-${i}`}
                  className="px-2 py-0.5 rounded-full bg-sage-500/10 text-sage-700 text-[11px] font-mono animate-fade-in-up border border-sage-500/20"
                  title="something echo is understanding about you"
                >
                  {k.category.replace("_", " ")}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* chat side */}
        <section className="relative border-l border-sage-500/15 bg-cream-50/60 p-6 md:p-8 flex flex-col min-h-screen">
          <div className="mb-6 pb-4 border-b border-sage-500/15 flex items-start justify-between">
            <div>
              <div className="font-serif text-xl text-sage-900">Echo</div>
              <div className="text-xs text-sage-700/70">
                {echoSpeaking
                  ? "speaking…"
                  : stage === "listening"
                  ? "listening…"
                  : stage === "thinking"
                  ? "reflecting…"
                  : "with you"}
              </div>
            </div>
            <button
              onClick={() => {
                if (!muted) stopSpeaking();
                setMuted((m) => !m);
              }}
              className="text-sage-700/70 hover:text-sage-900 text-xs font-mono tracking-wide inline-flex items-center gap-1 transition"
              title="mute echo's voice (you can still read its words)"
            >
              {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {muted ? "voice off" : "voice on"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                    ? "font-serif text-[17px] text-sage-900 leading-relaxed animate-fade-in-up"
                    : "text-sage-700 text-sm pl-4 border-l-2 border-sage-500/30 animate-fade-in-up"
                }
              >
                {m.text}
              </div>
            ))}
            {interim && (
              <div className="text-sage-700/60 text-sm pl-4 border-l-2 border-sage-500/20 italic">
                {interim}…
              </div>
            )}
          </div>

          {/* typed fallback input — shown always, useful on mobile / SR-denied */}
          <form
            onSubmit={submitTyped}
            className="mt-4 pt-4 border-t border-sage-500/15 flex gap-2"
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={
                sttSupported
                  ? "or type if you'd rather not speak…"
                  : "type what you'd like echo to hear…"
              }
              disabled={stage === "thinking" || stage === "echo-speaking"}
              className="flex-1 rounded-full bg-white/70 border border-sage-500/20 px-4 py-2 text-sm text-sage-900 placeholder:text-sage-700/40 focus:outline-none focus:border-sage-500/50"
            />
            <button
              type="submit"
              disabled={!typed.trim() || stage === "thinking" || stage === "echo-speaking"}
              className="rounded-full bg-sage-700 text-cream-50 w-10 h-10 grid place-items-center disabled:opacity-30 transition"
              aria-label="send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-3 text-[11px] text-sage-700/60 font-mono">
            sampling: {cameraGranted || faceOk ? "on-device" : "standby"} · fps: ~6 · emotions tracked: 7 · turn: {turnCount}
          </div>
        </section>
      </div>

      {/* camera preview — bottom right */}
      <div className="fixed bottom-8 right-6 z-20">
        <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-sage-500/30 shadow-lg bg-black">
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-1 left-1 bg-black/60 text-white/90 text-[9px] font-mono px-1.5 py-0.5 rounded">
            <span className="inline-flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-sage-300 animate-pulse-slow" />
              on-device · live
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
