/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
