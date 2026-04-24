/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the artifact is trivially deployable anywhere
  // (Vercel, Netlify, a zip file on a USB stick, whatever).
  output: "export",
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
