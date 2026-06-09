import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ADMIN_EMAIL } from "@/lib/useAuth";
import { isAllowedOAuthReturn } from "@/lib/adminSignIn";

export const Route = createFileRoute("/oauth-handoff")({
  component: OAuthHandoff,
  head: () => ({
    meta: [{ title: "Передача сесії…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function OAuthHandoff() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const returnTo = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("return_to");

  const iframeSrc =
    returnTo && isAllowedOAuthReturn(returnTo)
      ? `/iframe-oauth/start?return_to=${encodeURIComponent(returnTo)}`
      : null;

  useEffect(() => {
    if (!returnTo) {
      setError("Відсутній параметр return_to");
      return;
    }
    if (!isAllowedOAuthReturn(returnTo)) {
      setError("Недозволена адреса повернення");
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        access_token?: string;
        refresh_token?: string;
        message?: string;
      };

      if (data.type === "admin-oauth-ready") return;

      if (data.type === "admin-oauth-error") {
        setSigningIn(false);
        setError(data.message ?? "Помилка входу");
        return;
      }

      if (data.type === "admin-oauth-tokens" && data.access_token && data.refresh_token) {
        const hash = new URLSearchParams({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_type: "bearer",
        }).toString();
        window.location.replace(`${returnTo}#${hash}`);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [returnTo]);

  const signIn = () => {
    if (!iframeSrc || !iframeRef.current?.contentWindow) return;
    setError(null);
    setSigningIn(true);
    iframeRef.current.contentWindow.postMessage(
      { type: "admin-oauth-start" },
      window.location.origin,
    );
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

  if (!iframeSrc) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center text-muted-foreground">
        Невірні параметри входу…
      </div>
    );
  }

  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center">
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="OAuth"
        className="hidden"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
      <h1 className="font-display text-3xl mb-4 text-gradient">Вхід в адмін-панель</h1>
      <p className="text-muted-foreground mb-8">
        Увійдіть через Google ({ADMIN_EMAIL}). Вхід відбувається на цьому сайті, без переходу на
        Lovable.
      </p>
      <button
        onClick={signIn}
        disabled={signingIn}
        className="btn-electric hover:btn-electric-hover rounded-full px-7 py-3.5 text-sm font-medium disabled:opacity-60"
      >
        {signingIn ? "Відкриваємо Google…" : "Увійти через Google"}
      </button>
    </div>
  );
}
