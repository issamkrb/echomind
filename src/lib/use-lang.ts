"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyHtmlDir,
  detectLangFromBrowser,
  langStorageKey,
  loadLangMode,
  resolveLang,
  saveLangMode,
  type Lang,
  type LangMode,
} from "./i18n";

/**
 * useLang — React hook that tracks the user's language in a
 * localStorage-backed + auto-detection-aware way.
 *
 * Returns:
 *   lang     — the concrete resolved Lang (en | fr | ar)
 *   mode     — the user's saved preference (auto | en | fr | ar)
 *   setMode  — change the preference; applies immediately
 *   markSpoken — called by the session page when passive detection
 *                on actual user speech shifts the language. If the
 *                user has mode="auto" we follow silently; otherwise
 *                their explicit pick wins and we no-op.
 *
 * Side effect: keeps <html lang> and <html dir> in sync on every
 * change. This is why the app re-renders correctly for RTL layouts
 * without any per-component dir props.
 */
export function useLang(): {
  lang: Lang;
  mode: LangMode;
  setMode: (m: LangMode) => void;
  markSpoken: (detected: Lang) => void;
} {
  const [mode, setModeState] = useState<LangMode>("auto");
  const [lang, setLang] = useState<Lang>("en");

  // On mount, pull from localStorage + navigator, set <html dir>.
  useEffect(() => {
    const m = loadLangMode();
    setModeState(m);
    const resolved = resolveLang(m);
    setLang(resolved);
    applyHtmlDir(resolved);
    // Listen for changes triggered from other tabs.
    const myKey = langStorageKey();
    function onStorage(e: StorageEvent) {
      if (e.key !== myKey) return;
      const nm = loadLangMode();
      setModeState(nm);
      const nl = resolveLang(nm);
      setLang(nl);
      applyHtmlDir(nl);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((m: LangMode) => {
    saveLangMode(m);
    setModeState(m);
    const nl = resolveLang(m);
    setLang(nl);
    applyHtmlDir(nl);
    // Broadcast to other components in the same tab via a custom
    // storage event — `storage` only fires across tabs.
    try {
      window.dispatchEvent(
        new StorageEvent("storage", { key: langStorageKey() })
      );
    } catch {
      /* ignore */
    }
  }, []);

  const markSpoken = useCallback(
    (detected: Lang) => {
      // Only follow user speech if they're on auto mode.
      if (mode !== "auto") return;
      if (detected === lang) return;
      setLang(detected);
      applyHtmlDir(detected);
    },
    [mode, lang]
  );

  // Re-resolve when navigator.language changes (rare but possible).
  useEffect(() => {
    if (mode !== "auto") return;
    setLang(detectLangFromBrowser());
  }, [mode]);

  return { lang, mode, setMode, markSpoken };
}
