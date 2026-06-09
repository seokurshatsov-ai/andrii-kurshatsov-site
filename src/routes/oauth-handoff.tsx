import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ADMIN_EMAIL } from "@/lib/useAuth";
import { isAllowedOAuthReturn } from "@/lib/adminSignIn";
import { signInWithGooglePopup } from "@/lib/lovableOAuthPopup";

export const Route = createFileRoute("/oauth-handoff")({
  component: OAuthHandoff,
  head: () => ({
    meta: [{ title: "Передача сесії…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function OAuthHandoff() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const returnTo = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("return_to");

  const signIn = async () => {
    if (!returnTo || !isAllowedOAuthReturn(returnTo)) {
      setError("Невірна адреса повернення");
      return;
    }

    setError(null);
    setSigningIn(true);

    const result = await signInWithGooglePopup();
    if ("error" in result) {
      setSigningIn(false);
      setError(result.error.message);
      return;
    }

    const hash = new URLSearchParams({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      token_type: "bearer",
    }).toString();
    window.location.replace(`${returnTo}#${hash}`);
  };

  if (!returnTo) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl mb-4">Помилка входу</h1>
        <p className="text-muted-foreground mb-6">Відсутній параметр return_to</p>
        <Link
          to="/admin"
          className="btn-electric hover:btn-electric-hover rounded-full px-6 py-3 text-sm font-medium inline-block"
        >
          Назад
        </Link>
      </div>
    );
  }

  if (!isAllowedOAuthReturn(returnTo)) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl mb-4">Помилка входу</h1>
        <p className="text-muted-foreground mb-6">Недозволена адреса повернення</p>
        <Link
          to="/admin"
          className="btn-electric hover:btn-electric-hover rounded-full px-6 py-3 text-sm font-medium inline-block"
        >
          Назад
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl mb-4">Помилка входу</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button
          onClick={() => void signIn()}
          className="btn-electric hover:btn-electric-hover rounded-full px-6 py-3 text-sm font-medium inline-block mr-3"
        >
          Спробувати знову
        </button>
        <Link
          to="/admin"
          className="rounded-full px-6 py-3 text-sm font-medium inline-block border border-border"
        >
          Назад
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center">
      <h1 className="font-display text-3xl mb-4 text-gradient">Вхід в адмін-панель</h1>
      <p className="text-muted-foreground mb-8">
        Увійдіть через Google ({ADMIN_EMAIL}). Відкриється вікно входу — після підтвердження вас
        поверне на цей сайт.
      </p>
      <button
        onClick={() => void signIn()}
        disabled={signingIn}
        className="btn-electric hover:btn-electric-hover rounded-full px-7 py-3.5 text-sm font-medium disabled:opacity-60"
      >
        {signingIn ? "Очікуємо Google…" : "Увійти через Google"}
      </button>
    </div>
  );
}
