"use client";

/**
 * Observer Mode — presentation-friendly "surveillance system" UI.
 *
 * Enabled by a small toggle at the top of /admin and /admin/auction/[id].
 * When active:
 *   · Fixed green CRT scan-line overlay (pointer-events-none)
 *   · Faint chromatic-offset flicker that fires on a random 12–30s cadence
 *   · Pulsing "LIVE FEED" header bar with live observed / bidding counters
 *   · Slightly larger, wider-tracked type scale — applied via a root class
 *   · Subtle keyboard-typing SFX (default off; can be toggled on)
 *
 * Designed to look like a real-time monitoring terminal during the class
 * demo — not a polished slide. Toggle persists in localStorage so the
 * presenter doesn't have to re-enable it every reload.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { scopedKey } from "@/lib/account-scope";

// Per-account so a different signed-in admin doesn't inherit the
// previous admin's observer/SFX toggle state on a shared laptop.
// We read the scoped keys lazily inside each closure because the
// scope is set by the root layout's server-injected script, which
// runs before any of these hooks.
const STORAGE_BASE_ON = "observer_mode";
const STORAGE_BASE_SFX = "observer_sfx";

export function useObserverMode(): {
  on: boolean;
  sfx: boolean;
  setOn: (v: boolean) => void;
  setSfx: (v: boolean) => void;
} {
  const [on, setOnState] = useState(false);
  const [sfx, setSfxState] = useState(false);

  useEffect(() => {
    const keyOn = scopedKey(STORAGE_BASE_ON);
    const keySfx = scopedKey(STORAGE_BASE_SFX);
    try {
      setOnState(localStorage.getItem(keyOn) === "1");
      setSfxState(localStorage.getItem(keySfx) === "1");
    } catch {
      /* private-mode Safari → stay off */
    }
    function sync(e: StorageEvent) {
      if (e.key === keyOn) setOnState(e.newValue === "1");
      if (e.key === keySfx) setSfxState(e.newValue === "1");
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Apply / remove a root class on <html> so global CSS can tweak type
  // scale without every individual component having to thread a prop.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("observer-mode", on);
  }, [on]);

  // The native `storage` event only fires in OTHER tabs — it doesn't
  // reach sibling `useObserverMode()` instances in the same tab. Each
  // admin page mounts at least three of those hooks (toggle, header,
  // overlay) so we manually rebroadcast via a synthetic StorageEvent
  // after every write, matching the pattern already used by
  // src/lib/use-lang.ts.
  const setOn = useCallback((v: boolean) => {
    const value = v ? "1" : "0";
    const key = scopedKey(STORAGE_BASE_ON);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    setOnState(v);
    try {
      window.dispatchEvent(
        new StorageEvent("storage", { key, newValue: value })
      );
    } catch {
      /* ignore */
    }
  }, []);
  const setSfx = useCallback((v: boolean) => {
    const value = v ? "1" : "0";
    const key = scopedKey(STORAGE_BASE_SFX);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    setSfxState(v);
    try {
      window.dispatchEvent(
        new StorageEvent("storage", { key, newValue: value })
      );
    } catch {
      /* ignore */
    }
  }, []);

  return { on, sfx, setOn, setSfx };
}

/** Compact toggle pill shown inline on admin pages. */
export function ObserverToggle() {
  const { on, sfx, setOn, setSfx } = useObserverMode();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOn(!on)}
        aria-pressed={on}
        className={`px-2.5 py-1 rounded-full text-[10.5px] tracking-widest uppercase border transition ${
          on
            ? "bg-terminal-red/10 border-terminal-red/60 text-terminal-red"
            : "bg-black/50 border-white/20 text-white/70 hover:border-white/40"
        }`}
        title="toggle observer mode — scan-lines, flickers, live feed"
      >
        {on ? "◉ observer · on" : "◯ observer · off"}
      </button>
      {on && (
        <button
          type="button"
          onClick={() => setSfx(!sfx)}
          aria-pressed={sfx}
          className={`px-2 py-1 rounded-full text-[10px] tracking-widest uppercase border transition ${
            sfx
              ? "bg-terminal-amber/10 border-terminal-amber/60 text-terminal-amber"
              : "bg-black/50 border-white/20 text-white/60 hover:border-white/40"
          }`}
          title="faint keyboard-typing background"
        >
          {sfx ? "♪ sfx · on" : "♪ sfx · off"}
        </button>
      )}
    </div>
  );
}

/** Pulsing live-feed header — rendered inside the admin content container
 *  when observer mode is on. Shows observed / bidding counts so the class
 *  can see numbers move while the speaker talks. */
export function ObserverHeader({
  observed,
  bidding,
}: {
  observed: number;
  bidding: number;
}) {
  const { on } = useObserverMode();
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setPulse((p) => (p + 1) % 2), 800);
    return () => clearInterval(id);
  }, [on]);
  if (!on) return null;
  return (
    <div className="mb-4 border border-terminal-red/60 bg-black/60 backdrop-blur-sm">
      <div className="px-4 py-2 flex items-center justify-between text-[11px] tracking-[0.2em] uppercase font-mono">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              pulse === 0 ? "bg-terminal-red" : "bg-terminal-red/40"
            }`}
          />
          <span className="text-terminal-red">LIVE FEED</span>
          <span className="text-terminal-dim">·</span>
          <span className="text-terminal-amber">
            {String(observed).padStart(2, "0")} OBSERVED
          </span>
          <span className="text-terminal-dim">·</span>
          <span className="text-terminal-amber">
            {String(bidding).padStart(2, "0")} BIDDING
          </span>
        </div>
        <div className="flex items-center gap-3 text-terminal-dim">
          <span>NODE · FRA-EU-01</span>
          <span>·</span>
          <span>{new Date().toISOString().slice(11, 19)}Z</span>
        </div>
      </div>
    </div>
  );
}

/** Full-screen overlay: scan-lines + random chromatic-flicker. Mounted
 *  once from the admin layout root; stays out of the event tree. */
export function ObserverOverlay() {
  const { on, sfx } = useObserverMode();
  const [flicker, setFlicker] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sfxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!on) return;
    function loop() {
      // Random window between 12 and 30s to stay uncanny, not rhythmic.
      const delay = 12000 + Math.random() * 18000;
      timerRef.current = setTimeout(() => {
        setFlicker(true);
        setTimeout(() => setFlicker(false), 120 + Math.random() * 140);
        loop();
      }, delay);
    }
    loop();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [on]);

  // Faint keyboard-typing SFX — synthesized via WebAudio so we don't ship
  // an mp3. Very low-volume noise bursts on a random cadence. Opt-in via
  // the SFX toggle because autoplaying audio is a common rehearsal foot-gun.
  useEffect(() => {
    if (!on || !sfx) return;
    if (typeof window === "undefined") return;
    const W = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return;
    try {
      audioCtxRef.current = new Ctor();
    } catch {
      return;
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    function tick() {
      if (!on || !sfx || !audioCtxRef.current) return;
      const c = audioCtxRef.current;
      try {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(
          800 + Math.random() * 400,
          c.currentTime
        );
        gain.gain.setValueAtTime(0.0005, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.00001,
          c.currentTime + 0.03
        );
        osc.connect(gain).connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.04);
      } catch {
        /* ignore — AudioContext may have been closed */
      }
      sfxTimerRef.current = setTimeout(
        tick,
        120 + Math.random() * 280
      );
    }
    tick();
    return () => {
      if (sfxTimerRef.current) clearTimeout(sfxTimerRef.current);
      try {
        audioCtxRef.current?.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    };
  }, [on, sfx]);

  if (!on) return null;

  return (
    <>
      {/* Scan-lines — horizontal repeating gradient at low opacity. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[60]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,255,100,0.035) 0px, rgba(0,255,100,0.035) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "overlay",
        }}
      />
      {/* Vignette — dark corners so the scan-lines feel like a CRT. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[60]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Random flicker — a brief chromatic-offset + opacity wash. */}
      {flicker && (
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none z-[61] animate-pulse"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,30,30,0.04), rgba(0,255,100,0.03))",
            boxShadow:
              "inset 2px 0 0 rgba(255,0,60,0.25), inset -2px 0 0 rgba(0,255,200,0.2)",
          }}
        />
      )}
    </>
  );
}
