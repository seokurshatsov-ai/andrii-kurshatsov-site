import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL } from "@/lib/useAuth";

import { PRODUCTION_SITE } from "@/lib/adminSignIn";

export const Route = createFileRoute("/oauth-handoff")({
  component: OAuthHandoff,
  head: () => ({
    meta: [{ title: "Передача сесії…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function isAllowedDevReturn(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:") return false;
    return ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

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

    if (!isAllowedDevReturn(returnTo)) {
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

  const signIn = async () => {
    if (!returnTo) return;

    const handoffUrl = `${window.location.origin}/oauth-handoff?return_to=${encodeURIComponent(returnTo)}`;
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: handoffUrl,
    });
    if (res.error) {
      setError((res.error as Error).message);
    }
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
      <h1 className="font-display text-3xl mb-4 text-gradient">Вхід для локальної розробки</h1>
      <p className="text-muted-foreground mb-8">
        Увійдіть через Google ({ADMIN_EMAIL}), щоб передати сесію на localhost.
      </p>
      <button
        onClick={signIn}
        className="btn-electric hover:btn-electric-hover rounded-full px-7 py-3.5 text-sm font-medium"
      >
        Увійти через Google
      </button>
      <p className="text-xs text-muted-foreground mt-8">
        Або відкрийте{" "}
        <a href={`${PRODUCTION_SITE}/admin`} className="text-electric hover:underline">
          адмін-панель на production
        </a>
      </p>
    </div>
  );
}
