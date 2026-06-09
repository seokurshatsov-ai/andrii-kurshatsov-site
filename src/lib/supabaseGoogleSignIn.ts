import { supabase } from "@/integrations/supabase/client";
import { resolveSupabasePublicConfig } from "@/lib/supabaseEnv";

export const SUPABASE_PROJECT_URL = "https://tftlfzeytiwpmiyvimla.supabase.co";

export function resolveOAuthCallbackUrl(origin: string): string {
  return `${origin}/iframe-oauth/callback`;
}

/** Server-side redirect to Supabase Google OAuth (PKCE → /iframe-oauth/callback). */
export function buildSupabaseGoogleSignInUrl(origin: string): string {
  const { url: supabaseUrl } = resolveSupabasePublicConfig();
  const redirectTo = resolveOAuthCallbackUrl(origin);
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirectTo,
  });
  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}

/** Client-side redirect via Supabase JS SDK. */
export async function signInWithSupabaseGoogle(): Promise<{ error?: Error; redirected?: boolean }> {
  const redirectTo = resolveOAuthCallbackUrl(window.location.origin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) {
    return { error };
  }

  if (data?.url) {
    window.location.href = data.url;
    return { redirected: true };
  }

  return { error: new Error("Не вдалося розпочати вхід через Google") };
}

export function formatSupabaseOAuthSetupError(message: string): string {
  if (
    message.includes("OAuth secret") ||
    message.includes("Unsupported provider") ||
    message.includes("validation_failed")
  ) {
    return [
      "Google OAuth ще не налаштовано в Supabase.",
      "Увімкніть Google в Authentication → Providers, додайте Client ID і Secret з Google Cloud Console,",
      `і додайте ${SUPABASE_PROJECT_URL}/auth/v1/callback до Authorized redirect URIs.`,
      "Також додайте ваш Vercel URL до Supabase → Authentication → URL Configuration → Redirect URLs.",
    ].join(" ");
  }
  return message;
}
