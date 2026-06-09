import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseOAuthRedirectUrl,
  isLocalPort80Origin,
  PRODUCTION_OAUTH_BROKER,
  PORT80_CALLBACK,
} from "@/lib/adminSignIn";
import { resolveSupabasePublicConfig } from "@/lib/supabaseEnv";

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

        if (isLocalPort80Origin(origin)) {
          const params = new URLSearchParams({
            provider: "google",
            redirect_uri: PORT80_CALLBACK,
            state: generateState(),
          });

          return new Response(null, {
            status: 302,
            headers: {
              Location: `${PRODUCTION_OAUTH_BROKER}?${params.toString()}`,
              "Cache-Control": "no-store",
            },
          });
        }

        const { url, key } = resolveSupabasePublicConfig();
        const supabase = createClient(url, key);
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: getSupabaseOAuthRedirectUrl(origin),
          },
        });

        if (error || !data.url) {
          return new Response(error?.message ?? "OAuth failed", { status: 500 });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: data.url,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
