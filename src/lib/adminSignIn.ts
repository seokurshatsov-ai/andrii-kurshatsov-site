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

/** Start OAuth on the same origin (Vercel/local), then return via lovable.app/admin callback. */
export function buildOAuthHandoffUrl(returnToOrigin: string): string {
  const returnTo = resolveOAuthCallbackUri(returnToOrigin);
  return `${returnToOrigin}/oauth-handoff?return_to=${encodeURIComponent(returnTo)}`;
}

export function encodeOAuthReturnState(returnTo: string): string {
  const json = JSON.stringify({ return_to: returnTo });
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeOAuthReturnState(state: string | null | undefined): string | null {
  if (!state) return null;
  try {
    const padded = state + "=".repeat((4 - (state.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/"))) as {
      return_to?: string;
    };
    return typeof parsed.return_to === "string" ? parsed.return_to : null;
  } catch {
    return null;
  }
}

/** Lovable OAuth allowlists lovable.app callbacks — encode Vercel return target in OAuth state. */
export function buildLovableAdminOAuthUrl(returnTo: string): string {
  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: `${LOVABLE_SITE}/admin`,
    state: encodeOAuthReturnState(returnTo),
  });
  return `${PRODUCTION_OAUTH_BROKER}?${params.toString()}`;
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

export async function signInWithGoogle(): Promise<{ error?: Error }> {
  if (import.meta.env.DEV && isPort80DevServer()) {
    const result = await localDevAuth.signInWithOAuth("google", {
      redirect_uri: PORT80_CALLBACK,
    });
    return finishOAuth(result);
  }

  window.location.href = productionHandoffUrl();
  return {};
}

export {
  LOVABLE_SITE,
  PRODUCTION_SITE,
  PRODUCTION_OAUTH_BROKER,
  productionHandoffUrl,
  PORT80_CALLBACK,
};
