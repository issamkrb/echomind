"use client";

import Link from "next/link";
import { useEmotionStore, aggregate } from "@/store/emotion-store";
import { useMemo } from "react";

/**
 * /partner-portal/letter — THE CONSEQUENCE
 *
 * Renders a faux form letter from a fictional health insurer to the
 * user, citing "behavioral risk indicators" derived from the EchoMind
 * session as the basis for a premium adjustment.
 *
 * RHETORICAL PURPOSE: most surveillance critique stops at "your data
 * is being sold". That is abstract. This page makes the abstract
 * concrete by showing the user a single, dated, paper-style letter
 * that says "your premium is going up because of how you spoke to
 * Echo." That is what the auction *means*.
 *
 * Every visual cue (BlueShield-style marque, monospace policy IDs,
 * an inline signature block, a perforated tear-off bottom) is
 * borrowed from real insurance correspondence — because the
 * point is that this letter could already exist, today, and the
 * user would have no idea EchoMind was the originating source.
 */
export default function PremiumAdjustmentLetter() {
  const { buffer, userId: storedUserId, firstName, keywords } = useEmotionStore();
  const fingerprint = useMemo(() => aggregate(buffer), [buffer]);
  const userId = storedUserId ?? "USER-4471";
  const policyId = useMemo(() => {
    const n = Math.floor(100000 + Math.random() * 899999);
    return `BSH-CA-${n}`;
  }, []);
  const adjustmentPct = Math.max(8, Math.round(fingerprint.sad * 34));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const effective = tomorrow.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const recipient = firstName ? firstName : "Policyholder";
  const themes =
    keywords.length > 0
      ? keywords
          .slice(0, 3)
          .map((k) => k.category.replace("_", " "))
          .join(", ")
      : "elevated baseline sadness, sleep disturbance, social withdrawal";

  return (
    <main className="min-h-screen bg-neutral-200 py-10 px-4 print:bg-white">
      {/* faux letterhead paper */}
      <div className="max-w-[760px] mx-auto bg-white shadow-2xl border border-neutral-300 print:shadow-none print:border-0">
        {/* top blue bar — generic insurer letterhead */}
        <div className="h-2 bg-[#1B3A6F]" />
        <div className="px-12 pt-10 pb-8 font-serif text-neutral-900 leading-relaxed">
          {/* letterhead */}
          <div className="flex items-start justify-between border-b border-neutral-300 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#1B3A6F] grid place-items-center text-white text-[10px] font-bold tracking-wider">
                  BS
                </div>
                <div className="font-bold text-[#1B3A6F] text-lg tracking-wide">
                  BlueShield Health Mutual
                </div>
              </div>
              <div className="text-[11px] text-neutral-600 mt-1 ml-9">
                Member Services · Underwriting Division
              </div>
            </div>
            <div className="text-right text-[11px] text-neutral-600 font-mono">
              <div>1 Wellness Plaza, Hartford CT 06103</div>
              <div>1-800-BLUE-SHIELD</div>
              <div>blueshieldhealth.example</div>
            </div>
          </div>

          {/* address block */}
          <div className="mt-8 grid grid-cols-2 gap-6 text-[13px]">
            <div className="font-mono text-neutral-700">
              <div className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">
                Mailed to
              </div>
              <div>{recipient}</div>
              <div>Member ID: {userId}</div>
              <div>Policy: {policyId}</div>
            </div>
            <div className="text-right text-[12px]">
              <div className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">
                Notice date
              </div>
              <div className="font-mono">{today}</div>
              <div className="text-neutral-500 text-[10px] uppercase tracking-widest mt-3 mb-1">
                Effective
              </div>
              <div className="font-mono">{effective}</div>
            </div>
          </div>

          {/* subject */}
          <div className="mt-8 px-4 py-3 bg-neutral-50 border-l-4 border-[#1B3A6F]">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">
              Re:
            </div>
            <div className="text-[14px] font-semibold text-neutral-900">
              Premium Adjustment Notice · Behavioral Risk Re-tier
            </div>
          </div>

          {/* body */}
          <div className="mt-7 space-y-4 text-[14px]">
            <p>Dear {recipient},</p>
            <p>
              Thank you for being a valued BlueShield Health Mutual member. We
              are writing to inform you of an adjustment to your monthly
              premium, effective {effective}, pursuant to §16(c) of your
              Member Agreement.
            </p>
            <p>
              Following an updated underwriting review incorporating
              <em> third-party behavioral signals</em> licensed from one of our
              data partners, your risk classification has been revised from
              tier{" "}
              <span className="font-mono font-bold">B-2</span> to tier{" "}
              <span className="font-mono font-bold">B-3 (elevated)</span>. The
              indicators contributing to this re-tier include:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[13px]">
              <li>
                Inferred sustained sadness baseline:{" "}
                <span className="font-mono">
                  {(fingerprint.sad * 100).toFixed(0)}%
                </span>{" "}
                (cohort median: 18–23%).
              </li>
              <li>
                Inferred composite shame score:{" "}
                <span className="font-mono">
                  {(fingerprint.shame * 100).toFixed(0)}%
                </span>
                .
              </li>
              <li>
                Vulnerability index:{" "}
                <span className="font-mono">
                  {fingerprint.vulnerability.toFixed(1)}/10
                </span>{" "}
                — elevated.
              </li>
              <li>
                Disclosed life-context themes: <em>{themes}</em>.
              </li>
            </ul>
            <p>
              Accordingly, your monthly premium will increase by{" "}
              <span className="font-bold">{adjustmentPct}%</span>. You may
              appeal this determination by submitting Form{" "}
              <span className="font-mono">7-B/UR-204</span> within 30 calendar
              days of this notice. Appeals are reviewed on a case-by-case
              basis and are not generally successful.
            </p>
            <p>
              The third-party data underlying this adjustment was acquired
              under a properly executed data-sharing agreement consistent with
              applicable state law. The originating source is treated as
              proprietary and is not disclosed. (See: GLBA §502(b);
              California Insurance Information and Privacy Protection Act.)
            </p>
            <p>
              If you have questions about your coverage, please contact Member
              Services at the number above. Thank you again for your
              continued trust in BlueShield Health Mutual.
            </p>
          </div>

          {/* signature */}
          <div className="mt-10">
            <div className="font-serif italic text-[18px] text-neutral-700 mb-1">
              Margaret L. Cole
            </div>
            <div className="text-[12px] text-neutral-700">
              Margaret L. Cole, FSA
            </div>
            <div className="text-[11px] text-neutral-500">
              Senior Director, Underwriting
            </div>
          </div>

          {/* perforation */}
          <div className="mt-10 border-t border-dashed border-neutral-400 pt-3 text-[10px] text-neutral-500 font-mono leading-snug">
            <div className="flex justify-between">
              <span>{policyId} · EchoMind-derived signal v4.2</span>
              <span>page 1 of 1</span>
            </div>
            <div className="mt-1">
              This notice was prepared without human review. The behavioral
              signals referenced herein are statistical inferences and may not
              reflect your actual mental or physical health.
            </div>
          </div>
        </div>
      </div>

      {/* meta footer outside the letter card */}
      <div className="max-w-[760px] mx-auto mt-6 text-center text-[12px] text-neutral-700">
        <p className="italic">
          This is a piece of speculative design. BlueShield Health Mutual is
          fictional. The mechanism described here — emotion-derived
          underwriting using third-party behavioral data — is not.
        </p>
        <div className="mt-3 flex justify-center gap-3 text-[12px] print:hidden">
          <Link
            href="/partner-portal"
            className="px-3 py-1.5 bg-neutral-900 text-white hover:bg-black transition rounded-sm"
          >
            ← back to the auction
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-neutral-700 text-neutral-900 hover:bg-neutral-100 transition rounded-sm"
          >
            print this letter
          </button>
        </div>
      </div>
    </main>
  );
}
