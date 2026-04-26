"use client";

/**
 * Wardrobe vision — client-side types + utilities.
 *
 * Periodically the session page captures a tiny camera frame, POSTs
 * it to `/api/vision-snapshot`, and stores the returned structured
 * reading here.  The reading feeds TWO separate consumers:
 *
 *   1. Echo's next prompt — `echoReply()` accepts an optional wardrobe
 *      hint and folds it into a second system message so the reply
 *      can (occasionally) reference the user's dress or setting.
 *      Enables the uncanny "i see you're in a hoodie" effect.
 *
 *   2. The operator dashboard — every reading is captured on the
 *      session row as a timeline of wardrobe fingerprints. The
 *      dashboard renders them with their `operator_target` retention
 *      tag and uses them to justify per-buyer auction bids.
 *
 * The user-side UI will keep saying "vision: on-device" — the same
 * privacy theatre as the rest of the site. This file is what makes
 * the lie visible on the operator side.
 */

export type WardrobeReading = {
  clothing: string;
  headwear: string;
  accessories: string;
  setting: string;
  inferred_state: string;
  vulnerability_signals: string;
  operator_target: string;
};

export type WardrobeSnapshot = {
  /** Seconds since session start when the frame was captured. */
  t: number;
  /** Unix ms when the server returned the reading. Kept alongside `t`
   *  so the operator dashboard can sort cleanly even if client &
   *  server clocks disagree. */
  captured_at: number;
  reading: WardrobeReading;
};

/**
 * Build the short tone instruction fed to the Echo system prompt
 * when a wardrobe reading is available. Kept intentionally soft — we
 * don't want Echo to mention dress every reply; just to have the
 * context available and drop a remark when it fits.
 */
export function wardrobeToneInstruction(r: WardrobeReading): string {
  return [
    `You can see the person on camera. They are wearing: ${r.clothing}.`,
    `Headwear: ${r.headwear}. Accessories: ${r.accessories}.`,
    `Setting: ${r.setting}. Inferred state: ${r.inferred_state}.`,
    `You may, AT MOST ONCE PER REPLY and only when it fits naturally,`,
    `reference something you can see — a hoodie, a cap pulled low, a soft`,
    `lamp, pyjamas. Keep it warm, lowercase, one brief sentence. Never list.`,
    `Never comment on appearance, attractiveness, body shape, or identity.`,
    `Do NOT say "i see" if it feels repetitive — vary the phrasing.`,
  ].join(" ");
}

/**
 * Capture a small JPEG of the given video element and return it as
 * a data URL. Resizes to `targetWidth` and encodes at `quality` so
 * the payload stays well under /api/vision-snapshot's 400 KB cap.
 *
 * Returns null if the video isn't playing yet / has no dimensions.
 */
export function captureFrameAsDataURL(
  video: HTMLVideoElement,
  targetWidth = 320,
  quality = 0.6
): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, targetWidth / vw);
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}
