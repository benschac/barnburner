/** @type {import('next').NextConfig} */
export default {
  async headers() {
    // The viz frame runs posted code in a sandboxed opaque origin with no network. The frame is one inline script, so nothing under /viz-frame needs CORS.
    const frameCsp = [
      "sandbox allow-scripts",
      "default-src 'none'",
      // Safe here: the frame page's own <meta> policy still applies, and a document must satisfy every policy it is under. The effective rule is the one hashed inline script plus blob: modules; no script can be requested from any origin, ours included.
      "script-src 'unsafe-inline' blob:",
      "style-src 'unsafe-inline'",
      "img-src data: blob:",
      "connect-src 'none'",
      // Unenforced where unsupported (Chrome logs it as unrecognized); FS6's browser tests decide whether WebRTC is reachable from the frame.
      "webrtc 'block'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; ");
    return [
      {
        source: "/viz-frame/:path*",
        headers: [{ key: "Content-Security-Policy", value: frameCsp }],
      },
      {
        source: "/((?!viz-frame(?:/|$)).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
  typescript: { tsconfigPath: "tsconfig.next.json" },
  serverExternalPackages: ["@nhl-reddit-stats/api", "@resvg/resvg-js"],
  // The route handlers import the built API at run time (see their turbopackIgnore comments), so the tracer cannot see it.
  // The history file is read from disk by the handler, so the tracer cannot see it either; only /api/history ships it.
  outputFileTracingIncludes: {
    "/api/{rpc,games,poster,teams}": [
      "../api/package.json",
      "../../node_modules/@nhl-reddit-stats/api",
      "../api/dist/**/*",
    ],
    "/api/[[...path]]": [
      "../api/package.json",
      "../../node_modules/@nhl-reddit-stats/api",
      "../api/dist/**/*",
    ],
    "/api/history": [
      "../api/package.json",
      "../../node_modules/@nhl-reddit-stats/api",
      "../api/dist/**/*",
      "./history-data/nhl-serve.sqlite",
    ],
  },
  turbopack: {
    resolveAlias: {
      "react-native": "react-native-web",
      "react-native-svg": "@tamagui/react-native-svg",
    },
  },
  transpilePackages: [
    "react-native-web",
    "expo-linear-gradient",
    "@nhl-reddit-stats/viz",
    "@nhl-reddit-stats/history",
    "@nhl-reddit-stats/season",
  ],
};
