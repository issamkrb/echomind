import { NextRequest } from "next/server";
import { getServerAuthSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { loadAdminLogs } from "@/lib/admin-logs-fetch";

/**
 * GET /api/admin/logs/stream?token=<ADMIN_TOKEN>
 *
 * SSE feed of the visitor-logs admin listing. Same shape as
 * /api/admin/sessions/stream \u2014 a fresh full-snapshot push every
 * second, with a heartbeat comment to keep intermediaries from
 * reaping idle streams. Closes itself slightly before Vercel's
 * serverless cap so the EventSource reconnects cleanly.
 *
 * Auth: same two-factor gate as /api/admin/logs.
 */

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ENCODER = new TextEncoder();
const SNAPSHOT_INTERVAL_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
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

  let lastHash = "";
  let closed = false;
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            ENCODER.encode(
              `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`
            )
          );
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

      controller.enqueue(ENCODER.encode("retry: 2000\n\n"));
      sendComment("connected");

      const pushSnapshot = async (force: boolean) => {
        const { rows, error } = await loadAdminLogs();
        if (error) {
          send("error", { detail: error });
          return;
        }
        const hash = JSON.stringify(rows);
        if (!force && hash === lastHash) return;
        lastHash = hash;
        send("snapshot", { logs: rows, ts: Date.now() });
      };

      await pushSnapshot(true);

      const snapshotTimer = setInterval(() => {
        if (closed) return;
        if (Date.now() - startedAt > STREAM_BUDGET_MS) {
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
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", () => closeAll());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
