/**
 * Initials-on-color avatar bubble. The "color" here is deterministic
 * from the name string so a given testimonial always renders the
 * same hue across paints — same trick BetterHelp / Calm use on the
 * "real reviews" carousel.
 */
const PALETTE = [
  ["#E8D9C2", "#5C4A2D"], // peach / cocoa
  ["#C8DCC5", "#2F4F2C"], // sage / forest
  ["#F2C8B7", "#7A3A29"], // soft coral / rust
  ["#D9D5EC", "#3A2F66"], // lilac / aubergine
  ["#FAE3A2", "#6E5314"], // amber / olive
  ["#BFD8E6", "#1F4658"], // dawn blue / deep teal
];

function hashInitials(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % PALETTE.length;
}

function initialsOf(name: string): string {
  const parts = name
    .replace(/[^A-Za-zÀ-ÿ\s'-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const [bg, fg] = PALETTE[hashInitials(name)]!;
  const initials = initialsOf(name);
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full font-semibold tracking-tight select-none"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials}
    </span>
  );
}
