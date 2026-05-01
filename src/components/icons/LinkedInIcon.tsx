/**
 * LinkedIn brand glyph as a tiny inline SVG. Currents `currentColor`
 * so it inherits whatever text color the surrounding link uses, the
 * same way lucide-react icons do — but without depending on a
 * lucide version that ships the brand mark (older lucide-react
 * builds, including the one pinned in this repo, don't).
 */
export function LinkedInIcon({
  className = "w-3.5 h-3.5",
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
