// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  nitro: {
    preset: process.env.VERCEL ? "vercel" : process.env.NITRO_PRESET || "cloudflare-module",
    output: process.env.VERCEL
      ? {
          dir: ".vercel/output",
          serverDir: ".vercel/output/functions/__server.func",
          publicDir: ".vercel/output/static",
        }
      : undefined,
  },
  vite: {
    server: {
      port: Number(process.env.DEV_PORT) || 8080,
      host: process.env.DEV_HOST || "::",
      strictPort: !!process.env.DEV_PORT,
    },
  },
});
