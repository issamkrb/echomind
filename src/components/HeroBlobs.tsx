/**
 * Three soft drifting blobs behind the hero — sage green, peach,
 * and a warm cream highlight. Each blurred to ~80px so they read
 * as ambient backlighting rather than shapes. Pointer-events:none
 * so they never intercept clicks on the breathing orb / CTAs above.
 */
export function HeroBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        className="hero-blob-a absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full opacity-70 blur-[80px]"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(186, 209, 184, 0.85), rgba(186, 209, 184, 0) 70%)",
        }}
      />
      <div
        className="hero-blob-b absolute top-10 -right-24 w-[480px] h-[480px] rounded-full opacity-70 blur-[90px]"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, rgba(248, 207, 178, 0.75), rgba(248, 207, 178, 0) 72%)",
        }}
      />
      <div
        className="hero-blob-c absolute -bottom-32 left-1/3 w-[520px] h-[520px] rounded-full opacity-50 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(216, 230, 213, 0.9), rgba(216, 230, 213, 0) 70%)",
        }}
      />
    </div>
  );
}
