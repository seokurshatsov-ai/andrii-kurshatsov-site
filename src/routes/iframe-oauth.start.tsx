import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import {
  isPort80DevServer,
  LOVABLE_OAUTH_REDIRECT_URI,
  PORT80_CALLBACK,
  PRODUCTION_OAUTH_BROKER,
} from "@/lib/adminSignIn";

const localDevAuth = createLovableAuth({
  oauthBrokerUrl: PRODUCTION_OAUTH_BROKER,
});

export const Route = createFileRoute("/iframe-oauth/start")({
  ssr: false,
  component: OAuthStartFrame,
});

function resolveRedirectUri(): string {
  if (isPort80DevServer()) return PORT80_CALLBACK;
  return LOVABLE_OAUTH_REDIRECT_URI;
}

function OAuthStartFrame() {
  const [status, setStatus] = useState("Готово до OAuth…");
  const busy = useRef(false);
  const returnTo = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("return_to");

  useEffect(() => {
    const inIframe = window.self !== window.top;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "admin-oauth-start") return;
      void runOAuth(inIframe);
    };

    window.addEventListener("message", onMessage);

    if (inIframe) {
      window.parent.postMessage({ type: "admin-oauth-ready" }, window.location.origin);
    }

    return () => window.removeEventListener("message", onMessage);
  }, [returnTo]);

  const runOAuth = async (inIframe: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setStatus("Відкриваємо Google…");

    try {
      const redirectUri = resolveRedirectUri();
      const result = await localDevAuth.signInWithOAuth("google", {
        redirect_uri: redirectUri,
      });

      if (result.redirected) {
        setStatus("Перенаправлення…");
        return;
      }

      if (result.error) {
        setStatus(result.error.message);
        if (inIframe) {
          window.parent.postMessage(
            { type: "admin-oauth-error", message: result.error.message },
            window.location.origin,
          );
        }
        busy.current = false;
        return;
      }

      const tokens = result.tokens;
      if (!tokens?.access_token || !tokens?.refresh_token) {
        const message = "Токени не отримано";
        setStatus(message);
        if (inIframe) {
          window.parent.postMessage(
            { type: "admin-oauth-error", message },
            window.location.origin,
          );
        }
        busy.current = false;
        return;
      }

      if (inIframe) {
        window.parent.postMessage(
          {
            type: "admin-oauth-tokens",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          },
          window.location.origin,
        );
        setStatus("Сесію передано…");
        return;
      }

      const next = new URL("/admin/session", window.location.origin);
      next.searchParams.set("access_token", tokens.access_token);
      next.searchParams.set("refresh_token", tokens.refresh_token);
      window.location.replace(next.toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message);
      if (window.self !== window.top) {
        window.parent.postMessage(
          { type: "admin-oauth-error", message },
          window.location.origin,
        );
      }
      busy.current = false;
    }
  };

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, textAlign: "center" }}>
      {status}
    </div>
  );
}
