import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import {
  PRODUCTION_OAUTH_BROKER,
  resolveOAuthCallbackUri,
} from "@/lib/adminSignIn";

function generateState(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const Route = createFileRoute("/admin/sign-in")({
  server: {
    handlers: {
      GET: async () => {
        const request = getRequest();
        const origin = new URL(request.url).origin;
        const redirectUri = resolveOAuthCallbackUri(origin);

        const params = new URLSearchParams({
          provider: "google",
          redirect_uri: redirectUri,
          state: generateState(),
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: `${PRODUCTION_OAUTH_BROKER}?${params.toString()}`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
