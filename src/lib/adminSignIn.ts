import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

const PRODUCTION_SITE =
  import.meta.env.VITE_SITE_URL ?? "https://andrii-kurshatsov-site.vercel.app";
const PRODUCTION_OAUTH_BROKER = "https://andrii-kurshatsov.lovable.app/~oauth/initiate";
const PORT80_CALLBACK = "http://127.0.0.1/iframe-oauth/callback";

/** OAuth callback for the current host (localhost:80 vs production). */
export function resolveOAuthCallbackUri(origin: string): string {
  try {
    const { protocol, hostname, port } = new URL(origin);
    if (protocol === "http:" && hostname === "127.0.0.1" && (port === "" || port === "80")) {
      return PORT80_CALLBACK;
    }
  } catch {
    // fall through
  }
  return `${origin}/iframe-oauth/callback`;
}

const localDevAuth = createLovableAuth({
  oauthBrokerUrl: PRODUCTION_OAUTH_BROKER,
});

type OAuthResult = Awaited<ReturnType<typeof localDevAuth.signInWithOAuth>>;

async function finishOAuth(result: OAuthResult): Promise<{ error?: Error }> {
  if (result.redirected) return {};
  if (result.error) return { error: result.error as Error };

  try {
    await supabase.auth.setSession(result.tokens);
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
  return {};
}

function localOAuthCallbackUri(): string {
  return resolveOAuthCallbackUri(window.location.origin);
}

function productionHandoffUrl(): string {
  const returnTo = `${window.location.origin}/iframe-oauth/callback`;
  return `${PRODUCTION_SITE}/oauth-handoff?return_to=${encodeURIComponent(returnTo)}`;
}

export function isPort80DevServer(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname, port } = window.location;
  return protocol === "http:" && hostname === "127.0.0.1" && (port === "" || port === "80");
}

export async function signInWithGoogle(): Promise<{ error?: Error }> {
  const redirectTo = `${window.location.origin}/admin`;

  if (import.meta.env.DEV) {
    if (isPort80DevServer()) {
      const result = await localDevAuth.signInWithOAuth("google", {
        redirect_uri: PORT80_CALLBACK,
      });
      return finishOAuth(result);
    }

    window.location.href = productionHandoffUrl();
    return {};
  }

  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: redirectTo,
  });
  if (result.error) {
    return { error: result.error as Error };
  }
  return {};
}

export { PRODUCTION_SITE, PRODUCTION_OAUTH_BROKER, productionHandoffUrl, PORT80_CALLBACK };
