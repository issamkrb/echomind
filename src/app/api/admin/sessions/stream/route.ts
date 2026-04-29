import { NextRequest } from "next/server";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { loadAdminSessions } from "@/lib/admin-sessions-fetch";

/**
 * GET /api/admin/sessions/stream?token=<ADMIN_TOKEN>
 *
 * Server-Sent Events feed of the admin sessions listing. The dashboard
 * subscribes once via `EventSource` and gets a fresh snapshot pushed
 * every ~3 seconds for the lifetime of the HTTP connection. When the
 * connection times out (Vercel kills serverless responses around 60s),
 * the browser's EventSource automatically reconnects and the loop
 * starts over — net effect for the operator is a dashboard that
 * updates without a page refresh.
 *
 * We deliberately push a full snapshot rather than a diff. The list
 * is capped at 100 rows; full snapshots are simpler, idempotent, and
 * survive any client-side state drift across reconnects.
 *
 * Auth: same two-factor gate as `/api/admin/sessions` — the
 * `?token=` must equal `ADMIN_TOKEN`, AND the session cookie must
 * belong to a whitelisted admin email. We re-verify on every connect
 * so a leaked token URL still requires an admin login.
 *
 * Heartbeat: an SSE comment (`: ping`) every 10s so the connection
 * isn't reaped by intermediaries that close idle HTTP streams.
 */

export const runtime = "nodejs";
// Keep the stream open longer than Vercel's default. Vercel hobby caps
// node functions at 60s; that's fine — EventSource auto-reconnects.
export const maxDuration = 60;
// Don't cache an SSE response anywhere (CDNs would buffer and break it).
export const dynamic = "force-dynamic";

const ENCODER = new TextEncoder();
// Push a fresh snapshot once per second. The dashboard wants to
// reflect tab-close events (LIVE -> ENDED) and brand-new sessions
// within ~1s, which dominates the operator-perceived latency. The
// extra DB load is bounded: each push is a SELECT capped at 100
// rows + a tiny stale-finish UPDATE.
const SNAPSHOT_INTERVAL_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
// Close the stream slightly before Vercel's hard cap so the browser
// reconnects cleanly instead of seeing a 504-style abort.
const STREAM_BUDGET_MS = 55_000;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return new Response("admin-disabled", { status: 403 });
  }
  if (!token || token !== expected) {
    return new Response("bad-token", { status: 401 });
  }

  const authClient = getServerAuthSupabase();
  if (!authClient) {
    return new Response("auth-not-configured", { status: 503 });
  }
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return new Response("not-admin", { status: 401 });
  }

  // The hash of the last snapshot we pushed. We only emit a
  // `data:` event when something actually changed, but the
  // heartbeat keeps the connection alive in the meantime. This
  // keeps the dashboard quiet when nothing is happening.
  let lastHash = "";
  let closed = false;
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          const payload =
            `event: ${event}\n` +
            `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(ENCODER.encode(payload));
        } catch {
          closed = true;
        }
      };
      const sendComment = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(ENCODER.encode(`: ${text}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Tell the client to keep its EventSource reconnect short.
      controller.enqueue(ENCODER.encode("retry: 2000\n\n"));
      sendComment("connected");

      const pushSnapshot = async (force: boolean) => {
        const { rows, error } = await loadAdminSessions();
        if (error) {
          send("error", { detail: error });
          return;
        }
        // Cheap deterministic fingerprint — Object.keys order is
        // stable across loadAdminSessions calls because the same
        // mapping is used for every row.
        const hash = JSON.stringify(rows);
        if (!force && hash === lastHash) return;
        lastHash = hash;
        send("snapshot", { sessions: rows, ts: Date.now() });
      };

      // Initial snapshot ASAP so the client renders immediately.
      await pushSnapshot(true);

      const snapshotTimer = setInterval(() => {
        if (closed) return;
        if (Date.now() - startedAt > STREAM_BUDGET_MS) {
          // Wind down before Vercel kills the function.
          send("bye", { reconnect: true });
          closeAll();
          return;
        }
        void pushSnapshot(false);
      }, SNAPSHOT_INTERVAL_MS);

      const heartbeatTimer = setInterval(() => {
        if (closed) return;
        sendComment("ping " + Date.now());
      }, HEARTBEAT_INTERVAL_MS);

      const closeAll = () => {
        if (closed) return;
        closed = true;
        clearInterval(snapshotTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          /* swallow */
        }
      };

      // Browser-side disconnect (tab closed, navigation, etc.).
      req.signal.addEventListener("abort", closeAll);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // No buffering anywhere on the path.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Vercel-specific: disable response buffering so chunks
      // flush immediately to the browser.
      "X-Accel-Buffering": "no",
    },
  });
}
