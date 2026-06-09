const PROJECT_REF = "tftlfzeytiwpmiyvimla";

export const ADMIN_OWNER_EMAIL = "andreswebit@gmail.com";

export function normalizeAdminEmail(
  email: string | null | undefined,
): string | undefined {
  if (!email) return undefined;
  const trimmed = email.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function isAdminOwnerEmail(email: string | null | undefined): boolean {
  return normalizeAdminEmail(email) === ADMIN_OWNER_EMAIL;
}

export function resolveUserEmail(
  user:
    | {
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      }
    | null
    | undefined,
): string | undefined {
  if (!user) return undefined;
  const meta = user.user_metadata as { email?: string } | undefined;
  return normalizeAdminEmail(user.email || meta?.email);
}

export function pickUserWithEmail<T extends { email?: string | null; user_metadata?: Record<string, unknown> }>(
  ...candidates: (T | null | undefined)[]
): T | null {
  for (const candidate of candidates) {
    if (candidate && resolveUserEmail(candidate)) return candidate;
  }
  return candidates.find((candidate): candidate is T => !!candidate) ?? null;
}

/** Separate from Supabase's key so the client cannot wipe our dev session. */
export const ADMIN_LOCAL_STORAGE_KEY = "admin-local-session-v1";
export const ADMIN_SESSION_STORAGE_KEY = ADMIN_LOCAL_STORAGE_KEY;
export const ADMIN_SESSION_COOKIE = "admin-dev-auth";
export const SUPABASE_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

export type AdminSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: "bearer";
  user: {
    id: string;
    aud: string;
    role?: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
};

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) throw new Error("Invalid access_token");
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as Record<string, unknown>;
}

export function getEmailFromPayload(payload: Record<string, unknown>): string | undefined {
  if (payload.email) return String(payload.email);
  const meta = payload.user_metadata as { email?: string } | undefined;
  return meta?.email;
}

export function buildAdminSession(
  accessToken: string,
  refreshToken: string,
  user?: AdminSessionPayload["user"] | null,
): AdminSessionPayload {
  const payload = decodeJwtPayload(accessToken);
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : now + 3600;
  const email = getEmailFromPayload(payload);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: exp,
    expires_in: Math.max(exp - now, 0),
    token_type: "bearer",
    user: user ?? {
      id: String(payload.sub ?? ""),
      aud: String(payload.aud ?? "authenticated"),
      role: payload.role ? String(payload.role) : undefined,
      email,
      app_metadata: (payload.app_metadata as Record<string, unknown>) ?? {},
      user_metadata: (payload.user_metadata as Record<string, unknown>) ?? {},
    },
  };
}

export function normalizeStoredSession(
  raw: unknown,
): AdminSessionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<AdminSessionPayload>;
  if (!parsed.access_token || !parsed.refresh_token) return null;

  try {
    if (
      typeof parsed.expires_at === "number" &&
      parsed.expires_at > Date.now() / 1000 &&
      parsed.user?.id
    ) {
      return parsed as AdminSessionPayload;
    }
    return buildAdminSession(parsed.access_token, parsed.refresh_token, parsed.user ?? null);
  } catch {
    return null;
  }
}

export function readTokensFromUrl(url: URL): {
  error?: string | null;
  errorDescription?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
} {
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const params = url.searchParams;

  return {
    error: params.get("error") || hashParams.get("error"),
    errorDescription:
      params.get("error_description") || hashParams.get("error_description"),
    accessToken:
      params.get("access_token") ||
      hashParams.get("access_token") ||
      params.get("token") ||
      hashParams.get("token"),
    refreshToken:
      params.get("refresh_token") || hashParams.get("refresh_token"),
  };
}

export function sessionCookieHeader(session: AdminSessionPayload): string {
  const minimal = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
  const value = encodeURIComponent(JSON.stringify(minimal));
  return `${ADMIN_SESSION_COOKIE}=${value}; Path=/; Max-Age=604800; SameSite=Lax`;
}

export function readSessionFromCookie(
  cookieHeader: string | null | undefined,
): AdminSessionPayload | null {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_SESSION_COOKIE}=([^;]+)`),
  );
  if (!match?.[1]) return null;

  try {
    return normalizeStoredSession(JSON.parse(decodeURIComponent(match[1])));
  } catch {
    return null;
  }
}

export function clearSessionCookieHeader(): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_LOCAL_STORAGE_KEY);
  try {
    localStorage.removeItem(SUPABASE_STORAGE_KEY);
  } catch {
    // ignore
  }
  document.cookie = clearSessionCookieHeader();
}

export function persistAdminSession(session: AdminSessionPayload): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(session);
  localStorage.setItem(ADMIN_LOCAL_STORAGE_KEY, json);
  try {
    localStorage.setItem(SUPABASE_STORAGE_KEY, json);
  } catch {
    // ignore quota errors
  }
  document.cookie = sessionCookieHeader(session);
}

export function readAdminSession(): AdminSessionPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(ADMIN_LOCAL_STORAGE_KEY);
    if (raw) {
      const session = normalizeStoredSession(JSON.parse(raw));
      if (session) return session;
    }
  } catch {
    // ignore malformed storage
  }

  if (typeof document !== "undefined") {
    const fromCookie = readSessionFromCookie(document.cookie);
    if (fromCookie) {
      persistAdminSession(fromCookie);
      return fromCookie;
    }
  }

  return null;
}

export function getEffectiveAdminUser(): AdminSessionPayload["user"] | null {
  if (typeof window === "undefined") return null;

  const win = window as Window & { __ADMIN_SESSION__?: AdminSessionPayload };
  let session = win.__ADMIN_SESSION__ ?? readAdminSession();

  if (!session?.access_token) return null;

  if (!session.user?.id) {
    try {
      session = buildAdminSession(session.access_token, session.refresh_token, session.user ?? null);
      persistAdminSession(session);
      win.__ADMIN_SESSION__ = session;
    } catch {
      return null;
    }
  }

  if (session.expires_at <= Math.floor(Date.now() / 1000)) {
    clearAdminSession();
    return null;
  }

  return session.user;
}

export function getAdminEmail(session: AdminSessionPayload | null): string | undefined {
  if (!session?.user) return undefined;
  return resolveUserEmail(session.user);
}
