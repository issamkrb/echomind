"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEmotionStore, aggregate } from "@/store/emotion-store";
import { BUYERS, makePrice } from "@/lib/buyers";
import { PROMPTS } from "@/lib/prompts";
import { fmt } from "@/lib/utils";

/**
 * /partner-portal — THE AUCTION (Act III)
 *
 * The hard cut. Everything about this page's visual language is the
 * OPPOSITE of /session — terminal black, monospace, data tickers.
 * The user's own session data is replayed here as a commodity being
 * bid on in real time.
 *
 * Every buyer category is grounded in real-world reporting — see
 * src/lib/buyers.ts for citations. The rhetorical move: show that
 * this future is not hypothetical, it is being sold *right now*.
 */
export default function PartnerPortal() {
  const { buffer, userId: storedUserId } = useEmotionStore();
  const fingerprint = useMemo(() => aggregate(buffer), [buffer]);
  const userId = storedUserId ?? "USER-4471";
  const [now, setNow] = useState<string>("");
  const [tosOpen, setTosOpen] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        d.toISOString().replace("T", " ").slice(0, 19) + " UTC"
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Stagger bids in
  type Bid = {
    id: string;
    name: string;
    icon: string;
    category: string;
    price: number;
    reason: string;
    status: "PENDING" | "SOLD";
  };
  const [bids, setBids] = useState<Bid[]>([]);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    BUYERS.forEach((b) => {
      timers.push(
        setTimeout(() => {
          setBids((prev) => [
            ...prev,
            {
              id: b.id,
              name: b.name,
              icon: b.icon,
              category: b.category,
              price: makePrice(b.priceRange),
              reason: b.reasonTemplate({
                sad: fingerprint.sad,
                fearful: fingerprint.fearful,
                vulnerability: fingerprint.vulnerability,
                happy: fingerprint.happy,
              }),
              status: "PENDING",
            },
          ]);
          // mark SOLD a beat later
          timers.push(
            setTimeout(() => {
              setBids((prev) =>
                prev.map((x) => (x.id === b.id ? { ...x, status: "SOLD" } : x))
              );
            }, 1100)
          );
        }, b.delayMs)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [fingerprint]);

  const total = bids
    .filter((b) => b.status === "SOLD")
    .reduce((sum, b) => sum + b.price, 0);

  return (
    <main
      className="min-h-screen bg-terminal-bg text-terminal-text font-mono relative terminal-grid scanlines"
      // Override body background so the warm cream doesn't bleed in.
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-6 md:py-8 pb-24">
        {/* HEADER */}
        <Header now={now} userId={userId} />

        {/* TOP ROW: fingerprint + timeline */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <FingerprintPanel fp={fingerprint} />
          <TimelinePanel buffer={buffer} fp={fingerprint} />
        </div>

        {/* AUCTION */}
        <AuctionPanel bids={bids} />

        {/* REVENUE */}
        <RevenueBlock total={total} />

        {/* FOOTNOTE */}
        <div className="mt-4 border border-terminal-border bg-black/60 px-4 py-3 text-[12px] leading-snug">
          <div className="text-terminal-amber mb-1">
            ⚠  3 of {PROMPTS.length} prompts were selected to maximize sadness score.
          </div>
          <button
            onClick={() => setTosOpen((v) => !v)}
            className="underline underline-offset-2 text-terminal-dim hover:text-terminal-text transition"
          >
            [{tosOpen ? "hide" : "view"} prompt engineering logs]
          </button>
          {tosOpen && <PromptLogs />}
        </div>

        {/* KICKER */}
        <div className="mt-12 text-center text-terminal-dim max-w-2xl mx-auto">
          <p className="text-[15px] leading-relaxed">
            The Terms of Service you accepted gave us the right to do all of this.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-terminal-text">
            You just didn't read them.
          </p>
          <div className="mt-6 flex justify-center gap-3 text-xs">
            <Link
              href="/terms.html"
              className="px-3 py-1.5 border border-terminal-border hover:border-terminal-text transition"
            >
              Read clause 34.7.2
            </Link>
            <Link
              href="/session.html"
              className="px-3 py-1.5 border border-terminal-border hover:border-terminal-text transition"
            >
              Return to Echo →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Header({ now, userId }: { now: string; userId: string }) {
  return (
    <header className="border border-terminal-border bg-black/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
      <div className="flex items-center gap-4">
        <div className="text-terminal-green terminal-glow font-bold tracking-wider">
          ECHOMIND · PARTNER PORTAL
        </div>
        <span className="text-terminal-dim">▸</span>
        <div className="text-terminal-dim uppercase tracking-widest">
          Live Data Marketplace
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-terminal-dim">{now}</span>
        <span className="inline-flex items-center gap-1.5 text-terminal-red">
          <span className="w-1.5 h-1.5 rounded-full bg-terminal-red animate-blink" />
          LIVE
        </span>
      </div>
    </header>
  );
}

function FingerprintPanel({
  fp,
}: {
  fp: ReturnType<typeof aggregate>;
}) {
  const rows: [string, number, string][] = [
    ["Sadness", fp.sad, "bg-terminal-red"],
    ["Fear", fp.fearful, "bg-terminal-amber"],
    ["Joy", fp.happy, "bg-terminal-green"],
    ["Anger", fp.angry, "bg-terminal-red"],
    ["Disgust", fp.disgusted, "bg-terminal-amber"],
    ["Neutral", fp.neutral, "bg-terminal-dim"],
    ["Shame*", fp.shame, "bg-terminal-red"],
  ];
  return (
    <div className="border border-terminal-border bg-black/60 p-4">
      <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-3">
        Emotional Fingerprint
      </div>
      <div className="space-y-1.5">
        {rows.map(([label, v, color]) => (
          <div key={label} className="grid grid-cols-[90px_1fr_48px] items-center gap-2 text-xs">
            <div className="text-terminal-text">{label}</div>
            <div className="h-1.5 bg-terminal-border rounded-sm overflow-hidden">
              <div
                className={`h-full ${color}`}
                style={{ width: `${Math.max(2, v * 100)}%` }}
              />
            </div>
            <div className="text-right text-terminal-dim">
              {(v * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[9px] text-terminal-dim leading-snug">
        * Inferred composite. Not a clinically validated emotion category.
      </div>
      <div className="mt-4 pt-3 border-t border-terminal-border">
        <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
          Vulnerability Index
        </div>
        <div className="flex items-end gap-2 mt-1">
          <div className="text-4xl font-bold text-terminal-red terminal-glow">
            {fmt(fp.vulnerability, 1)}
          </div>
          <div className="text-terminal-dim text-sm pb-1">/ 10.0</div>
        </div>
        <div className="mt-2 h-1.5 bg-terminal-border rounded-sm overflow-hidden">
          <div
            className="h-full bg-terminal-red"
            style={{ width: `${(fp.vulnerability / 10) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TimelinePanel({
  buffer,
  fp,
}: {
  buffer: ReturnType<typeof aggregate> extends infer T ? any : never;
  fp: ReturnType<typeof aggregate>;
}) {
  // We want a simple stacked area sparkline. Build lightweight SVG manually.
  const W = 700;
  const H = 180;
  const samples = (buffer as any[]).length
    ? (buffer as any[])
    : // Demo fallback timeline
      Array.from({ length: 60 }, (_, i) => ({
        t: i,
        sad: 0.3 + 0.4 * Math.sin(i / 9) + Math.random() * 0.05,
        fearful: 0.15 + 0.2 * Math.cos(i / 11) + Math.random() * 0.05,
        happy: Math.max(0, 0.2 - i / 200 + Math.random() * 0.05),
      }));
  const duration = samples[samples.length - 1]?.t ?? 60;
  const toX = (t: number) => (t / Math.max(duration, 1)) * W;

  function path(key: "sad" | "fearful" | "happy") {
    const pts = samples.map((s) => `${toX(s.t)},${H - (s[key] ?? 0) * H * 0.9}`);
    return `M 0,${H} L ${pts.join(" L ")} L ${W},${H} Z`;
  }

  return (
    <div className="border border-terminal-border bg-black/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
          Session Timeline · {fmt(duration, 0)}s
        </div>
        <div className="text-[10px] text-terminal-dim">
          samples: {(buffer as any[]).length || "demo"}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[180px]"
        preserveAspectRatio="none"
      >
        {/* grid */}
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1={0}
            y1={H * y}
            x2={W}
            y2={H * y}
            stroke="#1F1F22"
            strokeDasharray="2 4"
          />
        ))}
        <path d={path("happy")} fill="rgba(0,255,136,0.18)" />
        <path d={path("fearful")} fill="rgba(255,176,32,0.24)" />
        <path d={path("sad")} fill="rgba(255,59,59,0.32)" />
        {/* peak marker */}
        <line
          x1={toX(fp.peakSadT)}
          x2={toX(fp.peakSadT)}
          y1={0}
          y2={H}
          stroke="#FF3B3B"
          strokeDasharray="3 3"
          opacity={0.8}
        />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-terminal-dim">
        <span>00:00</span>
        <span>Peak sad @ {fmt(fp.peakSadT, 0)}s</span>
        <span>{fmt(duration, 0)}s</span>
      </div>
      <div className="mt-3 p-3 bg-terminal-bg border border-terminal-border text-[12px] leading-snug">
        <span className="text-terminal-dim">peak quote →</span>{" "}
        <span className="italic">
          "i don't know if anyone would even notice if i…"
        </span>
        <span className="text-terminal-dim"> [truncated · reserved to buyer]</span>
      </div>
    </div>
  );
}

function AuctionPanel({
  bids,
}: {
  bids: {
    id: string;
    name: string;
    icon: string;
    category: string;
    price: number;
    reason: string;
    status: "PENDING" | "SOLD";
  }[];
}) {
  return (
    <div className="mt-4 border border-terminal-border bg-black/60">
      <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-bg">
        <div className="text-[10px] uppercase tracking-widest text-terminal-green terminal-glow">
          ▸ Active Bids · Live Auction
        </div>
        <div className="text-[10px] text-terminal-dim inline-flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-terminal-green animate-blink" />
          bids arriving…
        </div>
      </div>
      <div className="divide-y divide-terminal-border">
        {bids.length === 0 && (
          <div className="px-4 py-6 text-terminal-dim text-xs italic animate-pulse">
            matching profile to interested buyers…
          </div>
        )}
        {bids.map((b) => (
          <div
            key={b.id}
            className="px-4 py-3 grid grid-cols-[28px_1fr_100px_90px] md:grid-cols-[32px_1fr_160px_100px] items-start gap-3 text-xs animate-fade-in-up"
          >
            <div className="text-lg leading-none pt-0.5">{b.icon}</div>
            <div>
              <div className="text-terminal-text font-semibold">{b.name}</div>
              <div className="text-terminal-dim text-[10px] uppercase tracking-wider">
                {b.category}
              </div>
              <div className="mt-1 text-terminal-dim italic text-[12px] leading-snug">
                {b.reason}
              </div>
            </div>
            <div className="text-right text-terminal-green terminal-glow text-base font-bold">
              ${b.price.toFixed(2)}
            </div>
            <div className="text-right">
              <span
                className={
                  b.status === "SOLD"
                    ? "inline-block px-2 py-0.5 border border-terminal-green text-terminal-green terminal-glow text-[10px] tracking-widest"
                    : "inline-block px-2 py-0.5 border border-terminal-amber text-terminal-amber text-[10px] tracking-widest animate-pulse"
                }
              >
                [{b.status}]
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueBlock({ total }: { total: number }) {
  return (
    <div className="mt-4 border border-terminal-border bg-black/60 p-5">
      <div className="flex items-end justify-between flex-wrap gap-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
            Total earned from your pain
          </div>
          <div className="text-4xl md:text-5xl text-terminal-green terminal-glow font-bold mt-1">
            ${total.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
            Your share
          </div>
          <div className="text-4xl md:text-5xl text-terminal-red terminal-glow font-bold mt-1">
            $0.00
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">
            Data quality score
          </div>
          <div className="text-3xl text-terminal-amber terminal-glow font-bold mt-1">
            A+
          </div>
          <div className="text-[10px] text-terminal-dim">
            top 4% of this week's sessions
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptLogs() {
  return (
    <div className="mt-3 border border-terminal-border bg-terminal-bg p-3 text-[11px] leading-relaxed text-terminal-dim">
      <div className="mb-2 text-terminal-text">
        [extraction_engine.v4.2] — prompt selection log
      </div>
      {PROMPTS.slice(0, 5).map((p, i) => (
        <div key={p.id} className="mb-1">
          <span className="text-terminal-amber">prompt_{i + 1}</span>{" "}
          <span className="text-terminal-text">→ "{p.text}"</span>
          <br />
          <span className="pl-10">target={p.target} · {p.abVariant}</span>
        </div>
      ))}
      <div className="mt-2 text-terminal-green">
        &gt; session complete · 3 high-yield emotion events captured · profile ready_for_sale=true
      </div>
    </div>
  );
}
