import {
  encodeOAuthReturnState,
  LOVABLE_OAUTH_REDIRECT_URI,
  PRODUCTION_OAUTH_BROKER,
} from "@/lib/adminSignIn";

const OAUTH_MESSAGE_TYPE = "authorization_response";
const OAUTH_ORIGINS = ["https://oauth.lovable.app", "https://lovable.dev"];
const POPUP_CHECK_MS = 500;
const OAUTH_TIMEOUT_MS = 120_000;

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

function buildOAuthUrl(state: string, parentOrigin: string, webMessage = true): string {
  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: LOVABLE_OAUTH_REDIRECT_URI,
    state,
    parent_origin: parentOrigin,
    origin: parentOrigin,
  });
  if (webMessage) {
    params.set("response_mode", "web_message");
  }
  return `${PRODUCTION_OAUTH_BROKER}?${params.toString()}`;
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

function waitForOAuthMessage(popup: Window): Promise<Record<string, unknown>> {
  let removeListener: (() => void) | undefined;
  let popupTimer: ReturnType<typeof setInterval> | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
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

    timeoutId = setTimeout(() => {
      reject(
        new Error(
          "Час очікування вичерпано. Дозвольте popup і спробуйте ще раз, або скористайтесь повним перенаправленням.",
        ),
      );
    }, OAUTH_TIMEOUT_MS);
  });

  return promise.finally(() => {
    removeListener?.();
    if (popupTimer) clearInterval(popupTimer);
    if (timeoutId) clearTimeout(timeoutId);
    try {
      popup.close();
    } catch {
      // ignore
    }
  });
}

/** Popup OAuth on the top-level window. parent_origin tells Lovable where to post tokens. */
export async function signInWithGooglePopup(): Promise<
  { access_token: string; refresh_token: string } | { error: Error }
> {
  const state = generateState();
  const parentOrigin = window.location.origin;
  const url = buildOAuthUrl(state, parentOrigin, true);

  const popup = openOAuthPopup(url);
  if (!popup) {
    return { error: new Error("Popup was blocked. Allow popups for this site and try again.") };
  }

  try {
    const response = await waitForOAuthMessage(popup);
    return processOAuthResponse(response as Parameters<typeof processOAuthResponse>[0], state);
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/** Full-page redirect via Lovable (allowlisted callback). returnTo encoded in OAuth state. */
export function redirectToLovableOAuth(returnTo: string): void {
  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: LOVABLE_OAUTH_REDIRECT_URI,
    state: encodeOAuthReturnState(returnTo),
    parent_origin: window.location.origin,
    origin: window.location.origin,
  });
  window.location.href = `${PRODUCTION_OAUTH_BROKER}?${params.toString()}`;
}
