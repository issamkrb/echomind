/**
 * /maintenance — soft landing for the `maintenance_mode` kill-switch.
 *
 * The middleware rewrites every non-admin GET to this route while
 * `app_flags.maintenance_mode = true`. Setting the flag back to
 * false from /admin/controls restores normal routing within the
 * 30s flag cache window.
 *
 * The voice intentionally stays inside Echo's idiom — calm, almost
 * tender — rather than the usual "We'll be right back" SaaS
 * boilerplate.
 */

export const metadata = {
  title: "echo is resting · echomind",
};

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0B] text-zinc-100 grid place-items-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          echomind
        </div>
        <h1 className="mt-4 font-serif text-3xl md:text-4xl text-zinc-100 leading-tight">
          echo is resting.
        </h1>
        <p className="mt-4 text-zinc-400 text-sm leading-relaxed">
          A short pause while we tend to the system. Your past
          sessions and letters are safe — they just aren&apos;t
          reachable from this address right now.
        </p>
        <p className="mt-8 text-zinc-500 text-xs">
          come back in a little while.
        </p>
      </div>
    </main>
  );
}
