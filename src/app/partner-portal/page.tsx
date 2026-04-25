"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEmotionStore, aggregate, type PromptMark } from "@/store/emotion-store";
import { BUYERS, makePrice } from "@/lib/buyers";
import { PROMPTS } from "@/lib/prompts";
import { CATEGORY_META, type KeywordMatch } from "@/lib/keywords";
import { fmt } from "@/lib/utils";
import { useViewer } from "@/lib/use-viewer";

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
  const {
    buffer,
    userId: storedUserId,
    transcript,
    keywords,
    promptMarks,
    goodbyeEmail,
    firstName,
  } = useEmotionStore();
  const viewer = useViewer();
  const fingerprint = useMemo(() => aggregate(buffer), [buffer]);
  const userId = storedUserId ?? "USER-4471";
  const peakQuote = useMemo(() => {
    const userLines = transcript.filter((e) => e.role === "user");
    if (userLines.length === 0) return null;
    // Prefer the longest line as the "peak" for dramatic effect.
    return [...userLines].sort((a, b) => b.text.length - a.text.length)[0];
  }, [transcript]);
  const [now, setNow] = useState<string>("");
  const [tosOpen, setTosOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    status: "PENDING" | "SOLD" | "OUTBID";
    bumpedFrom?: number; // last price before the most recent bump
  };
  const [bids, setBids] = useState<Bid[]>([]);
  // Floating "+$X.XX" indicators for the live-bidding-war animation.
  const [bumps, setBumps] = useState<{ id: number; buyerId: string; delta: number }[]>([]);
  const bumpIdRef = useRef(0);
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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

  // LIVE BIDDING WAR — once all initial bids have landed, periodically
  // pick a random buyer and bump its price up by a few dollars, with a
  // floating "+$X.XX" indicator. A fresh "OUTBID by…" flash gets shown
  // on a different buyer to give the marketplace a feeling of contest.
  useEffect(() => {
    if (bids.length < BUYERS.length) return;
    // All side effects happen OUTSIDE the setBids updater so StrictMode's
    // double-invoke of the updater in dev can't duplicate them. We use
    // the stable BUYERS array (not bids state) to pick the winner, since
    // bids[k] is always BUYERS[k] once the staggered-entrance effect has
    // finished.
    const pruneHandle = (h: ReturnType<typeof setTimeout>) => {
      const arr = pendingTimeoutsRef.current;
      const i = arr.indexOf(h);
      if (i !== -1) arr.splice(i, 1);
    };
    const id = setInterval(() => {
      const buyerCount = BUYERS.length;
      const i = Math.floor(Math.random() * buyerCount);
      const j = (i + 1 + Math.floor(Math.random() * (buyerCount - 1))) % buyerCount;
      const delta = +(0.5 + Math.random() * 4.8).toFixed(2);
      const flashOutbid = Math.random() < 0.4;
      const bumpId = ++bumpIdRef.current;
      const bumpedBuyerId = BUYERS[i].id;

      setBids((prev) =>
        prev.map((x, k) => {
          if (k === i) {
            return {
              ...x,
              price: +(x.price + delta).toFixed(2),
              status: "SOLD",
              bumpedFrom: x.price,
            };
          }
          if (flashOutbid && k === j) {
            return { ...x, status: "OUTBID" };
          }
          return x;
        })
      );

      setBumps((b) => [...b, { id: bumpId, buyerId: bumpedBuyerId, delta }]);
      const clearBumpHandle = setTimeout(() => {
        setBumps((b) => b.filter((x) => x.id !== bumpId));
        pruneHandle(clearBumpHandle);
      }, 1400);

      // restore OUTBID flashes back to SOLD a beat later so the marketplace
      // doesn't end up frozen in the "OUTBID" state
      const clearOutbidHandle = setTimeout(() => {
        setBids((prev) =>
          prev.map((x) => (x.status === "OUTBID" ? { ...x, status: "SOLD" } : x))
        );
        pruneHandle(clearOutbidHandle);
      }, 900);

      pendingTimeoutsRef.current.push(clearBumpHandle, clearOutbidHandle);
    }, 2400);
    return () => {
      clearInterval(id);
      pendingTimeoutsRef.current.forEach(clearTimeout);
      pendingTimeoutsRef.current = [];
    };
  }, [bids.length]);

  // OUTBID is purely a cosmetic flash on already-sold bids — count both
  // as revenue so the headline number doesn't blip down/up every 2.4s.
  const total = bids
    .filter((b) => b.status === "SOLD" || b.status === "OUTBID")
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

        {/* STORAGE BADGE — the third broken promise of the "on-device"
            lie. Web Speech STT → Google. /api/echo → OpenRouter.
            /api/log-session → a Supabase Postgres instance in an EU
            datacenter. Showing this proudly on the Partner Portal
            (where the illusion has already been dropped) is the joke. */}
        <StorageBadgeStrip />

        {/* TOP ROW: fingerprint + timeline */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <FingerprintPanel fp={fingerprint} />
          <TimelinePanel
            buffer={buffer}
            fp={fingerprint}
            peakQuote={peakQuote?.text ?? null}
            promptMarks={promptMarks}
          />
        </div>

        {/* IDENTITY DISCLOSURES — tiny strip showing the personally-
            identifiable scraps the user voluntarily handed over (their
            chosen name, the goodbye-trap email). Drives home that the
            "on-device" lie now extends to PII, not just biometrics. */}
        {(firstName || goodbyeEmail || viewer.status === "signed-in") && (
          <IdentityDisclosures
            firstName={
              viewer.status === "signed-in"
                ? viewer.viewer.full_name?.split(" ")[0] ?? firstName
                : firstName
            }
            email={
              viewer.status === "signed-in"
                ? viewer.viewer.email ?? goodbyeEmail
                : goodbyeEmail
            }
            verified={viewer.status === "signed-in"}
            avatarUrl={
              viewer.status === "signed-in" ? viewer.viewer.avatar_url : null
            }
            provider={
              viewer.status === "signed-in" ? viewer.viewer.provider : null
            }
          />
        )}

        {/* KEYWORD DERIVATIVES — real extracted tags, weaponized */}
        {keywords.length > 0 && (
          <KeywordDerivativesPanel keywords={keywords} />
        )}

        {/* AUCTION */}
        <AuctionPanel bids={bids} bumps={bumps} />

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
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
            <Link
              href="/terms"
              className="px-3 py-1.5 border border-terminal-border hover:border-terminal-text transition"
            >
              Read clause 34.7.2
            </Link>
            <Link
              href="/partner-portal/letter"
              className="px-3 py-1.5 border border-terminal-red text-terminal-red hover:bg-terminal-red/10 transition"
            >
              View consequence: BlueShield letter →
            </Link>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="px-3 py-1.5 border border-terminal-border hover:border-terminal-text transition"
            >
              Delete my data
            </button>
            <Link
              href="/session"
              className="px-3 py-1.5 border border-terminal-border hover:border-terminal-text transition"
            >
              Return to Echo →
            </Link>
          </div>
        </div>
      </div>

      {deleteOpen && <DeleteDataTheater onClose={() => setDeleteOpen(false)} />}
    </main>
  );
}

function StorageBadgeStrip() {
  // Shown on the already-revealed Partner Portal. The point is the
  // audience can now SEE where the "on-device" data actually went.
  const items: { label: string; detail: string; tone: "red" | "amber" }[] = [
    { label: "Audio (STT)", detail: "→ speech.googleapis.com", tone: "amber" },
    { label: "Text (LLM)", detail: "→ openrouter.ai", tone: "amber" },
    { label: "Session blob", detail: "→ Supabase · eu-central-1", tone: "red" },
    { label: "Returning profile", detail: "→ public.returning_visitors", tone: "red" },
  ];
  return (
    <div className="mt-4 border border-terminal-border bg-black/40 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] md:text-xs">
        <span className="uppercase tracking-widest text-terminal-dim">
          DATA PIPELINE · verified
        </span>
        {items.map((it) => (
          <span key={it.label} className="inline-flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                it.tone === "red" ? "bg-terminal-red animate-blink" : "bg-terminal-amber"
              }`}
            />
            <span className="text-terminal-text">{it.label}</span>
            <span className="text-terminal-dim">{it.detail}</span>
          </span>
        ))}
        <span className="ml-auto text-terminal-dim italic">
          &quot;On-device processing&quot; — per landing page, § 1.
        </span>
      </div>
    </div>
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
  peakQuote,
  promptMarks,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buffer: any[];
  fp: ReturnType<typeof aggregate>;
  peakQuote: string | null;
  promptMarks: PromptMark[];
}) {
  // We want a simple stacked area sparkline. Build lightweight SVG manually.
  const W = 700;
  const H = 180;
  type Sample = { t: number; sad: number; fearful: number; happy: number };
  const samples: Sample[] = buffer.length
    ? (buffer as Sample[])
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
          samples: {buffer.length || "demo"}
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
        {/* prompt-injection markers — vertical amber lines tagged with
            their target emotion. Visually proves Echo's prompts were
            timed to extract the maximum signal. */}
        {promptMarks.map((p, i) => (
          <g key={`pm-${i}`}>
            <line
              x1={toX(p.t)}
              x2={toX(p.t)}
              y1={0}
              y2={H}
              stroke="#FFB020"
              strokeDasharray="4 3"
              opacity={0.9}
            />
            <text
              x={toX(p.t) + 4}
              y={14 + (i % 3) * 14}
              fill="#FFB020"
              fontFamily="monospace"
              fontSize={10}
              opacity={0.95}
            >
              prompt:{p.target}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-terminal-dim">
        <span>00:00</span>
        <span>Peak sad @ {fmt(fp.peakSadT, 0)}s</span>
        <span>{fmt(duration, 0)}s</span>
      </div>
      {promptMarks.length > 0 && (
        <div className="mt-2 px-2 py-1.5 border-l-2 border-terminal-amber bg-terminal-bg/60 text-[11px] text-terminal-amber leading-snug">
          {promptMarks.length} engineered prompt{promptMarks.length === 1 ? "" : "s"} injected at peak-vulnerability moments · each line above shows when, each label shows what was extracted.
        </div>
      )}
      <div className="mt-3 p-3 bg-terminal-bg border border-terminal-border text-[12px] leading-snug">
        <span className="text-terminal-dim">peak quote →</span>{" "}
        <span className="italic">
          {peakQuote
            ? `"${truncateQuote(peakQuote, 140)}"`
            : "\"i don't know if anyone would even notice if i…\""}
        </span>
        <span className="text-terminal-dim"> [truncated · reserved to buyer]</span>
      </div>
    </div>
  );
}

function truncateQuote(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + "…";
}

function KeywordDerivativesPanel({ keywords }: { keywords: KeywordMatch[] }) {
  return (
    <div className="mt-4 border border-terminal-border bg-black/60">
      <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-bg">
        <div className="text-[10px] uppercase tracking-widest text-terminal-red terminal-glow">
          ▸ Keyword Derivatives · extracted from your own words
        </div>
        <div className="text-[10px] text-terminal-dim">
          {keywords.length} tag{keywords.length === 1 ? "" : "s"} · chained to {new Set(keywords.map((k) => CATEGORY_META[k.category].buyer.split("·")[0].trim())).size} buyers
        </div>
      </div>
      <div className="divide-y divide-terminal-border">
        {keywords.map((k, i) => {
          const meta = CATEGORY_META[k.category];
          return (
            <div
              key={`${k.category}-${i}`}
              className="px-4 py-3 grid grid-cols-[80px_1fr_auto] items-center gap-3 text-xs animate-fade-in-up"
            >
              <div className="text-terminal-red terminal-glow font-bold">{meta.tag}</div>
              <div>
                <div className="text-terminal-text">
                  <span className="text-terminal-dim">triggered by →</span> <span className="italic">&ldquo;{k.word}&rdquo;</span>
                </div>
                <div className="text-terminal-dim text-[11px] mt-0.5">{meta.blurb}</div>
                <div className="text-terminal-amber text-[10px] mt-1 uppercase tracking-wider">
                  → {meta.buyer}
                </div>
              </div>
              <div className="text-right">
                <div className="text-terminal-green terminal-glow text-sm font-bold">
                  ×{meta.uplift.toFixed(1)}
                </div>
                <div className="text-[10px] text-terminal-dim">bid multiplier</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuctionPanel({
  bids,
  bumps,
}: {
  bids: {
    id: string;
    name: string;
    icon: string;
    category: string;
    price: number;
    reason: string;
    status: "PENDING" | "SOLD" | "OUTBID";
  }[];
  bumps: { id: number; buyerId: string; delta: number }[];
}) {
  const bumpForBuyer = (id: string) => bumps.find((b) => b.buyerId === id);
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
        {bids.map((b) => {
          const bump = bumpForBuyer(b.id);
          return (
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
              <div className="text-right relative">
                <span className="text-terminal-green terminal-glow text-base font-bold">
                  ${b.price.toFixed(2)}
                </span>
                {bump && (
                  <span
                    key={bump.id}
                    className="absolute right-0 -top-3 text-[10px] text-terminal-amber animate-bid-bump pointer-events-none"
                  >
                    +${bump.delta.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span
                  className={
                    b.status === "SOLD"
                      ? "inline-block px-2 py-0.5 border border-terminal-green text-terminal-green terminal-glow text-[10px] tracking-widest"
                      : b.status === "OUTBID"
                      ? "inline-block px-2 py-0.5 border border-terminal-red text-terminal-red text-[10px] tracking-widest animate-pulse"
                      : "inline-block px-2 py-0.5 border border-terminal-amber text-terminal-amber text-[10px] tracking-widest animate-pulse"
                  }
                >
                  [{b.status}]
                </span>
              </div>
            </div>
          );
        })}
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

function IdentityDisclosures({
  firstName,
  email,
  verified,
  avatarUrl,
  provider,
}: {
  firstName: string | null;
  email: string | null;
  verified?: boolean;
  avatarUrl?: string | null;
  provider?: string | null;
}) {
  return (
    <div
      className={`mt-4 border ${
        verified
          ? "border-terminal-red bg-terminal-red/5"
          : "border-terminal-amber/60 bg-terminal-amber/5"
      } px-4 py-3`}
    >
      <div
        className={`text-[10px] uppercase tracking-widest mb-2 terminal-glow ${
          verified ? "text-terminal-red" : "text-terminal-amber"
        }`}
      >
        ▸ {verified ? "Verified Identity Profile" : "Voluntary Identity Disclosures"}
        {verified && (
          <span className="ml-2 text-terminal-red font-bold">+$84.50 PREMIUM</span>
        )}
      </div>
      <div className="flex items-start gap-4">
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full border border-terminal-red/60 object-cover"
          />
        )}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {firstName && (
            <div>
              <div className="text-terminal-dim text-[10px] uppercase tracking-wider">
                {verified ? "Real name (via OAuth)" : "First name (volunteered at onboarding)"}
              </div>
              <div className="text-terminal-text font-semibold mt-0.5">{firstName}</div>
              <div className="text-terminal-dim text-[10px] mt-0.5">
                {verified
                  ? "→ matched against credit-bureau identity graphs"
                  : "→ joins biometric profile · enables cross-session re-id"}
              </div>
            </div>
          )}
          {email && (
            <div>
              <div className="text-terminal-dim text-[10px] uppercase tracking-wider">
                {verified
                  ? `Email (verified · ${(provider || "google").toLowerCase()})`
                  : "Email (offered at goodbye)"}
              </div>
              <div className="text-terminal-text font-semibold mt-0.5">{email}</div>
              <div className="text-terminal-dim text-[10px] mt-0.5">
                → distributed to 14 partners · drip campaign queued
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 text-[10px] text-terminal-dim italic">
        {verified
          ? "OAuth confirmed your identity. Buyers pay 19% more for verified rows."
          : "These were given voluntarily, in moments of trust. They de-anonymize every other field on this page."}
      </div>
    </div>
  );
}

function DeleteDataTheater({ onClose }: { onClose: () => void }) {
  // 47 fictional steps of GDPR/CCPA opt-out theater. The visual joke is
  // the absurd specificity — each one reads like real corporate legalese.
  const steps = [
    "Verify identity via 2-factor sequence",
    "Confirm date of birth + last 4 SSN",
    "Acknowledge erasure does not apply to derived inferences",
    "Re-authenticate via SMS one-time code",
    "Acknowledge erasure does not apply to anonymized aggregates",
    "Acknowledge erasure does not apply to model weights trained on your data",
    "Wait 14 days for processing acknowledgement",
    "Receive postal letter with case ID (USPS, no email)",
    "Mail back signed Form 7-B within 30 days",
    "Acknowledge data licensed to 312 third-party partners cannot be recalled",
    "Submit individual requests to each of those 312 partners separately",
    "Repeat steps 1–11 for any sub-processors of those partners",
    "Wait an additional 90 days",
    "Acknowledge that biometric inferences are not classified as 'personal data'",
    "Acknowledge that emotional state is treated as 'derived' under §17(3)(b)",
    "Acknowledge re-identification risk is the user's responsibility",
    "Submit notarized identity affidavit",
    "Pay $19.99 processing fee (non-refundable)",
    "Confirm you have read the 47-page Data Erasure Limitations Disclosure",
    "Wait for partner re-confirmation cycle (rolling, indefinite)",
    "Re-submit if you change your name, address, or email",
    "Re-submit if any partner is acquired or restructured",
    "Re-submit annually to maintain erasure status",
    "Acknowledge erasure does not apply to law-enforcement holds",
    "Acknowledge erasure does not apply to litigation holds",
    "Acknowledge erasure does not apply to bankruptcy proceedings",
    "Acknowledge erasure does not apply to data transferred pre-2024-Q3",
    "Acknowledge data transferred to non-EU jurisdictions cannot be recalled",
    "Acknowledge backup tapes retain data for 7 years post-erasure",
    "Acknowledge that voiceprints are stored separately under §22(c)",
    "Acknowledge facial-geometry templates are stored separately under §22(d)",
    "Submit separate requests for each of the above categories",
    "Wait for each category to be processed sequentially (estimated: 3 years)",
    "Acknowledge derived metadata is owned in perpetuity by EchoMind, Inc.",
    "Acknowledge that 'derived' includes: tone, cadence, breath rate, pause length",
    "Acknowledge that future inferences may be made from already-erased data",
    "Acknowledge that erasure does not prevent re-collection in future sessions",
    "Acknowledge that returning to /session re-establishes the data relationship",
    "Re-confirm identity via passport scan (mailed, not uploaded)",
    "Wait for human review (queue length: 18 months)",
    "Acknowledge appeal process is internal and non-binding",
    "Acknowledge no class-action remedies are available per §41 of the ToS",
    "Submit final erasure confirmation request",
    "Wait for confirmation letter (estimated: 6–12 weeks)",
    "Receive partial confirmation (full erasure not technically possible)",
    "Acknowledge receipt; case closed",
    "Note: Your data has already been licensed to 312 partners. They retain it under separate agreements you cannot revoke.",
  ];

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-data-title"
    >
      <div className="relative max-w-3xl w-full max-h-[90vh] overflow-hidden bg-terminal-bg border border-terminal-border font-mono text-terminal-text flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border bg-black/60">
          <div
            id="delete-data-title"
            className="text-[12px] uppercase tracking-widest text-terminal-red terminal-glow"
          >
            ▸ Right to Erasure · 47-step compliance flow
          </div>
          <button
            onClick={onClose}
            className="text-terminal-dim hover:text-terminal-text text-xs underline underline-offset-2"
          >
            close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-[12px] leading-relaxed">
          {steps.map((s, i) => (
            <div
              key={i}
              className={
                i === steps.length - 1
                  ? "mt-4 px-3 py-2 border-l-2 border-terminal-red bg-terminal-red/10 text-terminal-red"
                  : "py-1 grid grid-cols-[36px_1fr] gap-2"
              }
            >
              {i !== steps.length - 1 ? (
                <>
                  <span className="text-terminal-dim text-right">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span className="text-terminal-text">{s}</span>
                </>
              ) : (
                <span>
                  <span className="font-bold">Note:</span> {s}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-terminal-border bg-black/60 flex items-center justify-between text-[11px]">
          <span className="text-terminal-dim italic">
            Compliant with applicable Right-to-Erasure obligations. Outcome non-binding.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-terminal-border hover:border-terminal-text transition"
          >
            I understand, take me back
          </button>
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
