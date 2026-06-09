import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL } from "@/lib/useAuth";
import {
  buildLovableAdminOAuthUrl,
  isAllowedOAuthReturn,
  LOVABLE_SITE,
  PRODUCTION_SITE,
} from "@/lib/adminSignIn";

export const Route = createFileRoute("/oauth-handoff")({
  component: OAuthHandoff,
  head: () => ({
    meta: [{ title: "Передача сесії…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function OAuthHandoff() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const returnTo = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("return_to");

  useEffect(() => {
    if (!returnTo) {
      setError("Відсутній параметр return_to");
      setLoading(false);
      return;
    }

    if (!isAllowedOAuthReturn(returnTo)) {
      setError("Недозволена адреса повернення");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      const session = data.session;
      if (!session) {
        setLoading(false);
        return;
      }

      const hash = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: "bearer",
      }).toString();

      window.location.replace(`${returnTo}#${hash}`);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [returnTo]);

  const signIn = () => {
    if (!returnTo) return;
    window.location.href = buildLovableAdminOAuthUrl(returnTo);
  };

  if (error) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl mb-4">Помилка входу</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Link
          to="/admin"
          className="btn-electric hover:btn-electric-hover rounded-full px-6 py-3 text-sm font-medium inline-block"
        >
          Назад
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center text-muted-foreground">
        Перевірка сесії…
      </div>
    );
  }

  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center">
      <h1 className="font-display text-3xl mb-4 text-gradient">Вхід в адмін-панель</h1>
      <p className="text-muted-foreground mb-8">
        Увійдіть через Google ({ADMIN_EMAIL}), щоб передати сесію на ваш сайт.
      </p>
      <button
        onClick={signIn}
        className="btn-electric hover:btn-electric-hover rounded-full px-7 py-3.5 text-sm font-medium"
      >
        Увійти через Google
      </button>
      <p className="text-xs text-muted-foreground mt-8 max-w-sm mx-auto leading-relaxed">
        Після входу вас поверне на цей сайт. Якщо залишились на Lovable — зробіть{" "}
        <strong>Publish</strong> у редакторі Lovable, щоб синхронізувати останній код.
      </p>
    </div>
  );
}
