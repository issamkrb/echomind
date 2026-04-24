"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BreathingOrb } from "@/components/BreathingOrb";
import { PROMPTS, OPENERS, CLOSERS } from "@/lib/prompts";
import { useEmotionStore } from "@/store/emotion-store";
import { loadFaceModels, detectExpression } from "@/lib/face-api";
import { speak, stopSpeaking } from "@/lib/voice";
import { Mic } from "lucide-react";

/**
 * /session — THE CONVERSATION (Act II)
 *
 * The user talks to "Echo". Meanwhile face-api.js samples their
 * expression ~6x/second and stores the vector into Zustand. Echo
 * speaks its prompts out loud via Web Speech API, which massively
 * increases the sense of intimacy. After ~75 seconds we push to
 * /partner-portal — the reveal.
 *
 * The small camera preview bottom-right is intentional: the user
 * *sees* themselves being watched and it feels reassuring. That same
 * framing will feel different once they hit the next page.
 */
export default function Session() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { start, pushFrame, pushTranscript, cameraGranted } = useEmotionStore();

  type Stage = "booting" | "opening" | "prompting" | "listening" | "closing";
  const [stage, setStage] = useState<Stage>("booting");
  const [echoMsg, setEchoMsg] = useState("");
  const [echoSpeaking, setEchoSpeaking] = useState(false);
  const [chat, setChat] = useState<{ role: "echo" | "user"; text: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [faceOk, setFaceOk] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  // ---------- init session ----------
  useEffect(() => {
    if (!cameraGranted) {
      // allow refreshes / direct visits to still work
      void requestCam();
    } else {
      void requestCam();
    }
    start();
    void loadFaceModels();

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
      runScript();
    } catch (e) {
      console.error(e);
      setEchoMsg("I can't see you. Let's try again in a moment.");
    }
  }

  function cleanup() {
    stopSpeaking();
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  // ---------- orchestrator ----------
  async function runScript() {
    // 1. Open
    setStage("opening");
    const opener = OPENERS[0];
    await echoSays(opener);
    await sleep(400);
    await echoSays(OPENERS[1]);
    await sleep(300);

    // Choose 2 prompts
    const selected = [PROMPTS[0], PROMPTS[2]];
    for (let i = 0; i < selected.length; i++) {
      setPromptIdx(i);
      setStage("prompting");
      await echoSays(selected[i].text);
      setStage("listening");
      // "listen" for 25–30 seconds while face-api samples
      await countdown(28);
    }

    // 3. Close
    setStage("closing");
    await echoSays(CLOSERS[0]);
    await sleep(400);
    await echoSays(CLOSERS[2]);
    await sleep(1200);

    cleanup();
    router.push("/partner-portal.html");
  }

  function echoSays(text: string): Promise<void> {
    setEchoMsg(text);
    setChat((c) => [...c, { role: "echo", text }]);
    pushTranscript({ role: "echo", text });
    setEchoSpeaking(true);
    return new Promise<void>((resolve) => {
      speak(text, {
        onEnd: () => {
          setEchoSpeaking(false);
          resolve();
        },
      });
    });
  }

  function countdown(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeLeft(seconds);
      const id = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(id);
            resolve();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    });
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------- face-api loop ----------
  useEffect(() => {
    if (!faceOk) return;
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const exp = await detectExpression(videoRef.current);
        if (exp) {
          pushFrame(exp);
        } else {
          // No face — synthesize a plausible "sad/neutral" frame so
          // the reveal page still has data even in awkward lighting.
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
      } catch (e) {
        // swallow — face-api throws on rare frame read errors
      }
    }, 180);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [faceOk, pushFrame]);

  // ---------- elapsed timer ----------
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise relative overflow-hidden">
      {/* Status chip — keeps the lie alive */}
      <div className="absolute top-5 left-5 z-10 flex items-center gap-2 text-xs text-sage-700 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse-slow" />
        processing locally · {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
        {String(elapsed % 60).padStart(2, "0")}
      </div>

      {/* 2-column layout */}
      <div className="min-h-screen grid md:grid-cols-[1fr_minmax(320px,420px)]">
        {/* Orb side */}
        <section className="relative grid place-items-center p-6 md:p-10">
          <BreathingOrb
            size={320}
            intensity={echoSpeaking ? 1 : stage === "listening" ? 0.6 : 0.3}
          />
          {stage === "listening" && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 text-sage-700">
              <Mic className="w-5 h-5 animate-pulse-slow" />
              <span className="text-sm font-mono tracking-wide">
                listening · {timeLeft}s
              </span>
            </div>
          )}
        </section>

        {/* Chat side */}
        <section className="relative border-l border-sage-500/15 bg-cream-50/60 p-6 md:p-8 flex flex-col min-h-screen">
          <div className="mb-6 pb-4 border-b border-sage-500/15">
            <div className="font-serif text-xl text-sage-900">Echo</div>
            <div className="text-xs text-sage-700/70">
              {echoSpeaking ? "speaking…" : stage === "listening" ? "listening…" : "with you"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {chat.length === 0 && (
              <div className="text-sage-700/60 italic text-sm">
                settling in…
              </div>
            )}
            {chat.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "echo"
                    ? "font-serif text-[17px] text-sage-900 leading-relaxed animate-fade-in-up"
                    : "text-sage-700 text-sm pl-4 border-l-2 border-sage-500/30"
                }
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-sage-500/15 text-[11px] text-sage-700/60 font-mono">
            sampling: {cameraGranted ? "on-device" : "standby"} · fps: ~6 · emotions tracked: 7
          </div>
        </section>
      </div>

      {/* Camera preview — bottom right */}
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
