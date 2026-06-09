import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readTokensFromUrl } from "@/lib/adminSession";
import { formatSupabaseOAuthSetupError } from "@/lib/supabaseGoogleSignIn";

export const Route = createFileRoute("/iframe-oauth/callback")({
  ssr: false,
  component: OAuthCallbackPage,
  head: () => ({
    meta: [{ title: "Завершення входу…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function goAdminSession(accessToken: string, refreshToken: string) {
  const next = new URL("/admin/session", window.location.origin);
  next.searchParams.set("access_token", accessToken);
  next.searchParams.set("refresh_token", refreshToken);
  window.location.replace(next.toString());
}

function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const tokens = readTokensFromUrl(url);

      if (tokens.error) {
        setError(tokens.errorDescription || tokens.error);
        return;
      }

      if (tokens.accessToken && tokens.refreshToken) {
        goAdminSession(tokens.accessToken, tokens.refreshToken);
        return;
      }

      const code = url.searchParams.get("code");
      if (!code) {
        setError("Токени не знайдено після OAuth");
        return;
      }

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(formatSupabaseOAuthSetupError(exchangeError.message));
        return;
      }

      if (!data.session) {
        setError("Сесію не створено після OAuth");
        return;
      }

      goAdminSession(data.session.access_token, data.session.refresh_token);
    };

    void run();
  }, []);

  if (error) {
    return (
      <div className="pt-32 container-px mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl mb-4">Помилка входу</h1>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{error}</p>
        <Link
          to="/admin/sign-in"
          className="btn-electric hover:btn-electric-hover rounded-full px-6 py-3 text-sm font-medium inline-block"
        >
          Спробувати знову
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center text-muted-foreground">
      Завершення входу…
    </div>
  );
}
