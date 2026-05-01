"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Small "ambient tone" toggle — the kind of opt-in soft drone every
 * meditation app ships. Off by default. When on, plays a pair of
 * very low oscillators (Web Audio) at body-temperature volume,
 * panned softly. No external assets. Pauses on tab hide so it
 * never lingers in the background.
 *
 * Visually we mount it as a quiet pill in the corner — present
 * enough to find, never loud enough to feel like an ad.
 */
export function AmbientSoundToggle({
  label = "Ambient tone",
}: {
  label?: string;
}) {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    gain: GainNode;
  } | null>(null);

  useEffect(() => {
    return () => {
      stopTone();
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause the tone whenever the user leaves the tab, resume on return.
  useEffect(() => {
    function onVis() {
      if (document.hidden && on) {
        ctxRef.current?.suspend().catch(() => {});
      } else if (!document.hidden && on) {
        ctxRef.current?.resume().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [on]);

  function ensureCtx() {
    if (ctxRef.current) return ctxRef.current;
    const Ctx =
      typeof window !== "undefined"
        ? (window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext)
        : null;
    if (!Ctx) return null;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    return ctx;
  }

  function startTone() {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const gain = ctx.createGain();
    // Faded in over ~2s so it never starts with a click.
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(174, ctx.currentTime); // F3 — the "comfort" frequency some meditation apps cite
    osc1.connect(gain);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(261.63, ctx.currentTime); // C4 above — small consonant interval
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.6;
    osc2.connect(osc2Gain).connect(gain);

    osc1.start();
    osc2.start();
    nodesRef.current = { osc1, osc2, gain };
  }

  function stopTone() {
    const nodes = nodesRef.current;
    const ctx = ctxRef.current;
    if (!nodes || !ctx) return;
    try {
      nodes.gain.gain.cancelScheduledValues(ctx.currentTime);
      nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      nodes.osc1.stop(ctx.currentTime + 0.45);
      nodes.osc2.stop(ctx.currentTime + 0.45);
    } catch {
      /* node already stopped — no-op */
    }
    nodesRef.current = null;
  }

  function toggle() {
    if (on) {
      stopTone();
      setOn(false);
    } else {
      startTone();
      setOn(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
        on
          ? "bg-sage-500/15 border-sage-500/40 text-sage-900"
          : "bg-cream-50 border-sage-500/20 text-sage-700/70 hover:text-sage-900"
      }`}
    >
      {on ? (
        <Volume2 className="w-3.5 h-3.5" aria-hidden />
      ) : (
        <VolumeX className="w-3.5 h-3.5" aria-hidden />
      )}
      <span>
        {label} <span className="opacity-60">· {on ? "on" : "off"}</span>
      </span>
    </button>
  );
}
