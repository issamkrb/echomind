/**
 * Account-scoped client state.
 *
 * The problem we're fixing:
 *   Before this module, every piece of device state (the anon
 *   browser id, the cached returning-visitor profile, the voice
 *   persona, the observer-mode toggles, the language pick) lived
 *   under a single set of localStorage keys — `echomind:anon_id`,
 *   `echomind:profile`, `echomind:voice_persona`, etc. Those keys
 *   survived sign-in, sign-out, and account switches, which meant
 *   two people sharing a laptop saw each other's state. Sign in as
 *   A → Echo calls you "A" and remembers A's peak quote. Sign out,
 *   sign in as B → Echo STILL calls you "A" because the anon id
 *   and profile cache never rotated.
 *
 *   In the critique-layer of the artifact this is worse than it
 *   sounds: the `returning_visitors` Supabase row is keyed on the
 *   anon id, so B's very first "session" actually resurrects A's
 *   emotional history on the operator side.
 *
 * The fix:
 *   Every echomind:* localStorage key is now prefixed by a scope —
 *   either `guest` (signed out) or `u_<first-8-of-authUserId>`
 *   (signed in). Each (browser, account) pair gets its own anon id,
 *   its own profile cache, its own preferences. No cross-leak.
 *
 *   The scope is resolved server-side in the root layout (from the
 *   Supabase auth cookie) and injected into the HTML as a <script>
 *   that sets `window.__echomindScope` BEFORE React hydrates. This
 *   eliminates the race where an early-mounting component could
 *   read localStorage under the wrong scope during the brief window
 *   while `/api/me` is in flight.
 *
 *   On scope transitions (sign-in, sign-out, account switch) we
 *   wipe the `guest` bucket so two different people sharing the
 *   same laptop as guests don't inherit each other's state either.
 */

export const SCOPE_GUEST = "guest";
export const CURRENT_SCOPE_KEY = "echomind:current_scope";

/** Compute the scope for a given auth user id (null = anonymous).
 *  We truncate the uuid to 8 hex chars because the full one is
 *  36 characters and we don't want that inside every localStorage
 *  key. Collisions on the first 8 chars of a uuid v4 are
 *  astronomically unlikely in any realistic per-device population. */
export function computeScope(authUserId: string | null | undefined): string {
  if (!authUserId) return SCOPE_GUEST;
  const safe = authUserId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return safe ? `u_${safe}` : SCOPE_GUEST;
}

/** Return the currently-active scope.
 *
 *  Read from `window.__echomindScope` (set by the server-injected
 *  script in the root layout) so that even the very first
 *  synchronous read on the page sees the correct value. Falls back
 *  to sessionStorage, then to guest, for SSR + edge cases.
 */
export function getCurrentScope(): string {
  if (typeof window === "undefined") return SCOPE_GUEST;
  const w = window as unknown as { __echomindScope?: string };
  if (typeof w.__echomindScope === "string" && w.__echomindScope.length > 0) {
    return w.__echomindScope;
  }
  try {
    const v = window.sessionStorage.getItem(CURRENT_SCOPE_KEY);
    if (v) return v;
  } catch {
    /* sessionStorage disabled */
  }
  return SCOPE_GUEST;
}

/** Prepend the current scope to a base key, producing
 *  e.g. `echomind:u_abc12345:anon_id` or `echomind:guest:anon_id`. */
export function scopedKey(baseKey: string): string {
  const scope = getCurrentScope();
  return `echomind:${scope}:${baseKey}`;
}

/** One-shot helper: compute the scope, compare with the last-seen
 *  scope persisted in sessionStorage, and if it changed perform the
 *  side effects we want on every transition:
 *
 *    - update `window.__echomindScope` and sessionStorage
 *    - if the NEW scope is `guest`, wipe the guest bucket so a
 *      signed-out user never inherits the previous signed-out
 *      user's state on the same browser
 *
 *  We deliberately do NOT wipe the signed-in scope on transitions.
 *  That lets the user sign back in as A later and still find A's
 *  preferences — account state *should* persist for the account,
 *  just not for the device.
 *
 *  Returns true iff the scope actually changed (useful so callers
 *  can decide whether to re-hydrate their state).
 */
export function applyScope(nextAuthUserId: string | null | undefined): {
  scope: string;
  changed: boolean;
} {
  if (typeof window === "undefined")
    return { scope: SCOPE_GUEST, changed: false };
  const next = computeScope(nextAuthUserId);
  const w = window as unknown as { __echomindScope?: string };
  const prev = w.__echomindScope ?? null;
  w.__echomindScope = next;
  try {
    window.sessionStorage.setItem(CURRENT_SCOPE_KEY, next);
  } catch {
    /* ignore */
  }
  const changed = prev !== null && prev !== next;
  if (changed && next === SCOPE_GUEST) {
    clearGuestBucket();
  }
  return { scope: next, changed };
}

/** Remove every localStorage key that belongs to the `guest` bucket.
 *  Called on scope transitions *into* guest so two consecutive
 *  signed-out users on the same browser don't share state.
 *  Signed-in scopes are left alone — the account can sign back in
 *  and find its preferences intact. */
export function clearGuestBucket() {
  if (typeof window === "undefined") return;
  const prefix = `echomind:${SCOPE_GUEST}:`;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  // Legacy unscoped keys from before this module existed. Wipe them
  // too so a freshly-signed-out device never leaks pre-scope state
  // onto the next user.
  const legacy = [
    "echomind:anon_id",
    "echomind:profile",
    "echomind:voice_persona",
    "echomind:lang_mode",
    "echomind:observer_mode",
    "echomind:observer_sfx",
  ];
  try {
    for (const k of legacy) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Snippet rendered as an inline script in the server root layout
 *  so the scope is known BEFORE React hydrates. We pass the
 *  server-resolved auth user id (or null) in, produce the scope
 *  string, set window.__echomindScope, and — if the scope just
 *  transitioned — also mirror the guest-wipe behaviour of
 *  `applyScope` client-side.
 *
 *  Kept as a plain string-returning function rather than an inline
 *  `<script dangerouslySetInnerHTML>` expression so the layout
 *  stays readable and the logic is unit-testable. */
export function renderScopeBootScript(
  authUserId: string | null | undefined
): string {
  const scope = computeScope(authUserId);
  // IMPORTANT: keep this self-contained. No imports, no module
  // scope. It runs in the HTML head, before any React code.
  return `
(function(){
  try {
    var next = ${JSON.stringify(scope)};
    var prev = null;
    try { prev = window.sessionStorage.getItem(${JSON.stringify(
      CURRENT_SCOPE_KEY
    )}); } catch (e) {}
    window.__echomindScope = next;
    try { window.sessionStorage.setItem(${JSON.stringify(
      CURRENT_SCOPE_KEY
    )}, next); } catch (e) {}
    // Unscoped "legacy" keys from before account-scope existed. They
    // are never read by current code, but leaving them around means
    // that if we ever downgrade a deployment they'd be a leak vector
    // across accounts. Wipe on every boot.
    var legacy = ["echomind:anon_id","echomind:profile","echomind:voice_persona","echomind:lang_mode","echomind:observer_mode","echomind:observer_sfx"];
    for (var n = 0; n < legacy.length; n++) { try { window.localStorage.removeItem(legacy[n]); } catch (e) {} }
    // On scope transitions INTO guest (sign-out, or account-switch
    // where the destination is guest) wipe the guest bucket so two
    // different people who each sign out on the same browser don't
    // inherit each other's state.
    if (prev && prev !== next && next === ${JSON.stringify(SCOPE_GUEST)}) {
      var prefix = "echomind:" + ${JSON.stringify(SCOPE_GUEST)} + ":";
      var toRemove = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) toRemove.push(k);
      }
      for (var j = 0; j < toRemove.length; j++) window.localStorage.removeItem(toRemove[j]);
    }
    // On transitions OUT of guest into a signed-in scope, carry over
    // low-risk UI preferences the guest just set so the first
    // signed-in render doesn't flip back to a stale / default value.
    // Only copies when the target scope has NO value for that key —
    // the account's previously-saved preference always wins.
    //
    // Language pref is the one users complained about: they pick AR
    // on the home page as a guest, click Sign in, and the site
    // briefly rendered in English because the signed-in scope had
    // no lang_mode yet.
    if (prev && prev !== next && next !== ${JSON.stringify(SCOPE_GUEST)}) {
      var carry = ["lang_mode","voice_persona","voice_enabled","voice_id"];
      for (var cx = 0; cx < carry.length; cx++) {
        var base = carry[cx];
        var srcKey = "echomind:" + ${JSON.stringify(SCOPE_GUEST)} + ":" + base;
        var dstKey = "echomind:" + next + ":" + base;
        try {
          if (window.localStorage.getItem(dstKey) === null) {
            var v = window.localStorage.getItem(srcKey);
            if (v !== null) window.localStorage.setItem(dstKey, v);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
})();
  `.trim();
}
