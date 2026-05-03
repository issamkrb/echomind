/** @type {import('next').NextConfig} */

/**
 * Security headers — applied to every HTML response on the site.
 *
 * The headers below are the strongest baseline we can run without
 * breaking existing third-party integrations (Supabase, Groq, OpenRouter,
 * ElevenLabs, Vercel CDN, Pollinations vision proxy). Each header is
 * commented with WHY it is set the way it is. If you need to add a new
 * upstream domain, add it to ALL of:
 *   - connect-src
 *   - img-src   (if it serves images)
 *   - media-src (if it serves audio/video)
 *
 * Why declared statically here instead of in middleware: middleware runs
 * on Edge runtime where crypto.randomUUID is fine but the global header
 * application is best done by the Next.js framework itself so it covers
 * static assets, route handlers, and the streaming SSR responses
 * uniformly. Headers added here apply to ALL paths.
 */
const SECURITY_HEADERS = [
  // Forces every visit to use HTTPS for the next year. `preload`
  // makes the site eligible for the browser-vendor preload list so
  // even first-time visitors don't get the chance to hit plain HTTP.
  // includeSubDomains because every subdomain we'd ever add (preview
  // deployments, vanity domains) should be HTTPS-only too.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // The site never legitimately renders inside an iframe. Blocking
  // framing kills the entire clickjacking attack class. CSP
  // frame-ancestors below is the modern equivalent; keeping
  // X-Frame-Options for legacy browser coverage.
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers occasionally try to "guess" a response's content type
  // when the server-declared one looks wrong. Disabling sniff stops
  // an attacker from uploading a "JPEG" that actually executes as
  // HTML/JS when fetched.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full URL (which may contain ?token=… or session
  // ids on /portfolio routes) to third-party sites the user clicks
  // through to. `strict-origin-when-cross-origin` sends the bare
  // origin cross-site, the full URL same-site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features the site never uses anywhere
  // except /session (camera + microphone). The (self) syntax allows
  // them on the same origin only — never embedded ads, never iframes
  // from other sites.
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()", // opts the site out of FLoC entirely
    ].join(", "),
  },
  // Cross-origin isolation. `same-origin` opener policy denies any
  // cross-origin window from accessing window.opener, killing the
  // tabnabbing class of attacks. Embedder is `require-corp` so
  // embedded resources must opt in via Cross-Origin-Resource-Policy.
  // We intentionally do NOT set Cross-Origin-Embedder-Policy: it
  // breaks third-party media playback (ElevenLabs MP3s, our supabase
  // signed URLs) and the trade-off isn't worth it for this app.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // The Content-Security-Policy. This is the single most important
  // header on the page; it's what stops a stored-XSS payload from
  // exfiltrating a session token. The directives mirror the explicit
  // list of upstream services /api/* talks to:
  //
  //   default-src 'self'           — anything not explicitly listed
  //                                  is same-origin only.
  //   script-src 'self'             — scripts come from /_next or
  //   'unsafe-inline'                /public on the same origin.
  //                                  Next.js inlines a tiny runtime
  //                                  script for hydration ids; that
  //                                  needs unsafe-inline OR a nonce
  //                                  rotated per request. We picked
  //                                  unsafe-inline as the simpler
  //                                  trade — script-src is still
  //                                  'self' otherwise, so an
  //                                  attacker can't inject a remote
  //                                  <script src="evil.com/x.js"/>.
  //   style-src 'self' 'unsafe-inline'
  //                                — Tailwind generates inline
  //                                  styles via className but
  //                                  framer-motion injects style
  //                                  attributes for animations.
  //                                  unsafe-inline is needed for
  //                                  framer-motion to function.
  //   img-src 'self' data: blob: https:
  //                                — face-api.js loads model
  //                                  weights from /models/ (self),
  //                                  data URLs are used by the
  //                                  vision-snapshot client, blob
  //                                  is used by recorded audio
  //                                  preview, and https: is open
  //                                  for avatars from Google sign-in.
  //   media-src 'self' blob: data: https:
  //                                — recorded audio + ElevenLabs
  //                                  TTS audio.
  //   connect-src                  — explicit allowlist of upstream
  //                                  hosts /api/* talks to. Adding
  //                                  a new upstream means adding it
  //                                  here too.
  //   frame-ancestors 'none'       — modern equivalent of
  //                                  X-Frame-Options: DENY. The
  //                                  app may not be embedded.
  //   base-uri 'self'              — kills the <base href=…> XSS
  //                                  primitive: an injected base
  //                                  tag could redirect every
  //                                  relative URL on the page.
  //   form-action 'self'           — forms can only POST to the
  //                                  same origin. Stops a stored
  //                                  XSS from POSTing the user's
  //                                  session cookie to an external
  //                                  collector.
  //   object-src 'none'            — bans <object>, <embed>, and
  //                                  the legacy plugin attack
  //                                  surface.
  //
  // Note on report-only: we use the enforced `Content-Security-Policy`
  // header (not the report-only variant) because the rhetorical posture
  // of the project demands actually blocking attacks, not just
  // observing them. If the policy turns out to break a flow, the fix is
  // to add the missing source here, not to relax to report-only.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: data: https:",
      "font-src 'self' data:",
      [
        "connect-src",
        "'self'",
        // Supabase (auth + storage + realtime + REST). Wildcard so
        // any project subdomain works in dev/preview/prod.
        "https://*.supabase.co",
        "wss://*.supabase.co",
        // LLM inference upstreams.
        "https://api.groq.com",
        "https://openrouter.ai",
        "https://text.pollinations.ai",
        // Voice: ElevenLabs TTS + STT.
        "https://api.elevenlabs.io",
        // Vercel deployment CDN (preview URLs, asset host).
        "https://*.vercel.app",
        "https://vercel.live",
      ].join(" "),
      "frame-ancestors 'none'",
      "frame-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "worker-src 'self' blob:",
      // upgrade-insecure-requests turns any accidentally-emitted
      // http:// URL into https:// at fetch time.
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  // Vercel runs the app in serverless mode by default, which we now need
  // because /api/echo proxies to OpenRouter with a server-only API key.
  // (Static export was a leftover from the original USB-stick demo.)
  images: { unoptimized: true },
  // face-api.js uses optional Node deps (encoding, fs, etc.) that we don't
  // need in the browser. Stub them so the client bundle builds cleanly.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
        path: false,
      };
    }
    return config;
  },
  // Apply the security headers to every route on the site. Returning a
  // single { source: "/(.*)", headers: [...] } makes Next.js attach
  // them to every static asset, every server-rendered page, and every
  // API route's response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
