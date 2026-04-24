import Link from "next/link";

/**
 * Always-on disclosure bar. Required so the piece reads as critical
 * design fiction rather than a real product. Visually small so it
 * doesn't break the illusion on the "warm" pages, but ALWAYS present.
 */
export function EthicsFooter() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] text-[10px] leading-none font-mono px-3 py-1.5 bg-black/80 text-white/70 backdrop-blur-sm flex items-center justify-center gap-3 pointer-events-none">
      <span className="pointer-events-auto">
        EchoMind is a speculative design artifact. No data leaves your browser.
      </span>
      <Link
        href="/ethics.html"
        className="pointer-events-auto underline underline-offset-2 hover:text-white"
      >
        Learn more →
      </Link>
    </div>
  );
}
