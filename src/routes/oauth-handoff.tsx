import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ADMIN_EMAIL } from "@/lib/useAuth";
import { isAllowedOAuthReturn } from "@/lib/adminSignIn";
import { signInWithSupabaseGoogle } from "@/lib/supabaseGoogleSignIn";

export const Route = createFileRoute("/oauth-handoff")({
  component: OAuthHandoff,
  head: () => ({
    meta: [{ title: "Передача сесії…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function OAuthHandoff() {
  const returnTo = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("return_to");

  useEffect(() => {
    if (!returnTo || !isAllowedOAuthReturn(returnTo)) return;
    void signInWithSupabaseGoogle();
  }, [returnTo]);

  if (!returnTo || !isAllowedOAuthReturn(returnTo)) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl mb-4">Помилка входу</h1>
        <p className="text-muted-foreground mb-6">Невірні параметри входу</p>
        <Link
          to="/admin"
          className="btn-electric hover:btn-electric-hover rounded-full px-6 py-3 text-sm font-medium inline-block"
        >
          Назад
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center text-muted-foreground">
      Перенаправлення на Google ({ADMIN_EMAIL})…
    </div>
  );
}
