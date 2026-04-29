/**
 * Tiny zero-dep user-agent classifier. Returns a short human label
 * like "Chrome on macOS" / "Safari on iOS" / "Firefox on Linux" so
 * the visitor-logs table doesn't have to ship a full UA-parser
 * library to the server. Designed for a presentation dashboard,
 * not for analytics-grade fingerprinting.
 *
 * The detection order matters: Edge spoofs Chrome/Safari, Brave
 * spoofs Chrome, etc. We check the more specific tokens first
 * (Edg/, OPR/, Brave/) before falling back to Chrome/Safari.
 */

export type ParsedUserAgent = {
  browser: string;
  os: string;
  /** "Chrome on macOS" — pre-joined for cheap rendering. */
  display: string;
};

const FALLBACK: ParsedUserAgent = {
  browser: "Unknown",
  os: "Unknown",
  display: "Unknown device",
};

export function parseUserAgent(uaRaw: string | null | undefined): ParsedUserAgent {
  if (!uaRaw || typeof uaRaw !== "string") return FALLBACK;
  const ua = uaRaw;

  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const display = browser === "Unknown" && os === "Unknown"
    ? FALLBACK.display
    : `${browser} on ${os}`;
  return { browser, os, display };
}

function detectBrowser(ua: string): string {
  // Order matters: more-specific tokens before generic ones.
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera\//i.test(ua)) return "Opera";
  if (/SamsungBrowser\//i.test(ua)) return "Samsung Internet";
  if (/Brave\//i.test(ua)) return "Brave";
  if (/Vivaldi\//i.test(ua)) return "Vivaldi";
  if (/DuckDuckGo\//i.test(ua)) return "DuckDuckGo";
  if (/FxiOS\//i.test(ua)) return "Firefox";
  if (/CriOS\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return "Safari";
  if (/MSIE |Trident\//i.test(ua)) return "Internet Explorer";
  return "Unknown";
}

function detectOS(ua: string): string {
  if (/Windows NT 10/i.test(ua)) return "Windows 10/11";
  if (/Windows NT 6\.3/i.test(ua)) return "Windows 8.1";
  if (/Windows NT 6\.2/i.test(ua)) return "Windows 8";
  if (/Windows NT 6\.1/i.test(ua)) return "Windows 7";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  // iPad / iPhone / iPod must precede the generic Mac check below
  // because iPadOS 13+ identifies as Macintosh in desktop mode.
  if (/iPad|iPhone|iPod/i.test(ua)) return "iOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Ubuntu/i.test(ua)) return "Ubuntu";
  if (/Fedora/i.test(ua)) return "Fedora";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}
