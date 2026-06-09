import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { LOVABLE_OAUTH_REDIRECT_URI, PRODUCTION_OAUTH_BROKER } from "@/lib/adminSignIn";

const OAUTH_MESSAGE_TYPE = "authorization_response";
const OAUTH_ORIGINS = ["https://oauth.lovable.app", "https://lovable.dev"];
const POPUP_CHECK_MS = 500;

function generateState(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function processOAuthResponse(
  data: {
    state?: string;
    error?: string;
    error_description?: string;
    access_token?: string;
    refresh_token?: string;
  },
  expectedState: string,
): { access_token: string; refresh_token: string } | { error: Error } {
  if (data.state !== expectedState) {
    return { error: new Error("State is invalid") };
  }
  if (data.error) {
    return { error: new Error(data.error_description ?? data.error ?? "Sign in failed") };
  }
  if (!data.access_token || !data.refresh_token) {
    return { error: new Error("No tokens received") };
  }
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

function openOAuthPopup(url: string): Window | null {
  const width = Math.round(window.outerWidth * 0.5);
  const height = Math.round(window.outerHeight * 0.5);
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  return window.open(
    url,
    "lovable-oauth",
    `width=${width},height=${height},left=${left},top=${top}`,
  );
}

/** Popup OAuth on the top-level window (avoids sandboxed iframe breaking postMessage). */
export async function signInWithGooglePopup(): Promise<
  { access_token: string; refresh_token: string } | { error: Error }
> {
  const state = generateState();
  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: LOVABLE_OAUTH_REDIRECT_URI,
    state,
    response_mode: "web_message",
  });
  const url = `${PRODUCTION_OAUTH_BROKER}?${params.toString()}`;

  const popup = openOAuthPopup(url);
  if (!popup) {
    return { error: new Error("Popup was blocked. Allow popups for this site and try again.") };
  }

  let removeListener: (() => void) | undefined;
  let popupTimer: ReturnType<typeof setInterval> | undefined;

  try {
    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        if (!OAUTH_ORIGINS.includes(event.origin)) return;
        const data = event.data as { type?: string; response?: Record<string, unknown> };
        if (data?.type !== OAUTH_MESSAGE_TYPE || !data.response) return;
        resolve(data.response);
      };

      window.addEventListener("message", onMessage);
      removeListener = () => window.removeEventListener("message", onMessage);

      popupTimer = setInterval(() => {
        if (popup.closed) {
          reject(new Error("Sign in was cancelled"));
        }
      }, POPUP_CHECK_MS);
    });

    return processOAuthResponse(response as Parameters<typeof processOAuthResponse>[0], state);
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    removeListener?.();
    if (popupTimer) clearInterval(popupTimer);
    popup.close();
  }
}

/** Local dev on port 80 may use the SDK redirect flow instead. */
export async function signInWithGoogleForCurrentContext(): Promise<
  { access_token: string; refresh_token: string } | { error: Error } | { redirected: true }
> {
  const auth = createLovableAuth({ oauthBrokerUrl: PRODUCTION_OAUTH_BROKER });
  const result = await auth.signInWithOAuth("google", {
    redirect_uri: LOVABLE_OAUTH_REDIRECT_URI,
  });

  if (result.redirected) return { redirected: true };
  if (result.error) return { error: result.error };
  if (!result.tokens?.access_token || !result.tokens?.refresh_token) {
    return { error: new Error("No tokens received") };
  }
  return result.tokens;
}
