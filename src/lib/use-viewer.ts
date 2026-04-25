"use client";

import { useEffect, useState } from "react";

export type Viewer = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  provider: string;
};

export type ViewerState =
  | { status: "loading"; viewer: null }
  | { status: "anonymous"; viewer: null }
  | { status: "signed-in"; viewer: Viewer };

/**
 * Lightweight hook that asks /api/me whether the current request is
 * signed in. Cached on the window so multiple components don't fan
 * out duplicate fetches.
 */
declare global {
  // eslint-disable-next-line no-var
  var __echomindViewer: Promise<ViewerState> | undefined;
}

async function fetchViewerOnce(): Promise<ViewerState> {
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    const body = await res.json();
    if (body?.signedIn && body.user) {
      return { status: "signed-in", viewer: body.user as Viewer };
    }
    return { status: "anonymous", viewer: null };
  } catch {
    return { status: "anonymous", viewer: null };
  }
}

export function useViewer(): ViewerState {
  const [state, setState] = useState<ViewerState>({
    status: "loading",
    viewer: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.__echomindViewer) {
      window.__echomindViewer = fetchViewerOnce();
    }
    let alive = true;
    window.__echomindViewer.then((v) => {
      if (alive) setState(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
