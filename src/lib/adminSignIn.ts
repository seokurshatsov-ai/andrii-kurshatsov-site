import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "@/integrations/supabase/client";

const LOVABLE_SITE = "https://andrii-kurshatsov.lovable.app";
const PRODUCTION_SITE =
  import.meta.env.VITE_SITE_URL ?? "https://andrii-kurshatsov-site.vercel.app";
const PRODUCTION_OAUTH_BROKER = `${LOVABLE_SITE}/~oauth/initiate`;
const PORT80_CALLBACK = "http://127.0.0.1/iframe-oauth/callback";

export function isLocalPort80Origin(origin: string): boolean {
  try {
    const { protocol, hostname, port } = new URL(origin);
    return protocol === "http:" && hostname === "127.0.0.1" && (port === "" || port === "80");
  } catch {
    return false;
  }
}

/** OAuth callback for the current host (localhost:80 vs production). */
export function resolveOAuthCallbackUri(origin: string): string {
  if (isLocalPort80Origin(origin)) return PORT80_CALLBACK;
  return `${origin}/iframe-oauth/callback`;
}

/** Lovable OAuth only allowlists lovable.app callbacks — hand off tokens to Vercel after sign-in. */
export function buildOAuthHandoffUrl(returnToOrigin: string): string {
  const returnTo = resolveOAuthCallbackUri(returnToOrigin);
  return `${LOVABLE_SITE}/oauth-handoff?return_to=${encodeURIComponent(returnTo)}`;
}

export function isAllowedOAuthReturn(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith("/iframe-oauth/callback")) return false;
    if (parsed.origin === PRODUCTION_SITE || parsed.origin === LOVABLE_SITE) return true;
    if (parsed.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
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

function productionHandoffUrl(): string {
  return buildOAuthHandoffUrl(window.location.origin);
}

export function isPort80DevServer(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname, port } = window.location;
  return protocol === "http:" && hostname === "127.0.0.1" && (port === "" || port === "80");
}

async function signInWithSupabaseGoogle(redirectTo: string): Promise<{ error?: Error }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) return { error };
  if (data?.url) {
    window.location.href = data.url;
    return {};
  }
  return { error: new Error("Не вдалося розпочати OAuth") };
}

export async function signInWithGoogle(): Promise<{ error?: Error }> {
  if (import.meta.env.DEV && isPort80DevServer()) {
    const result = await localDevAuth.signInWithOAuth("google", {
      redirect_uri: PORT80_CALLBACK,
    });
    return finishOAuth(result);
  }

  if (import.meta.env.DEV) {
    window.location.href = productionHandoffUrl();
    return {};
  }

  return signInWithSupabaseGoogle(`${window.location.origin}/admin`);
}

export function getSupabaseOAuthRedirectUrl(origin: string): string {
  return `${origin}/admin`;
}

export {
  LOVABLE_SITE,
  PRODUCTION_SITE,
  PRODUCTION_OAUTH_BROKER,
  productionHandoffUrl,
  PORT80_CALLBACK,
};
