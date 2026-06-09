(function () {
  var STORAGE_KEY = "admin-local-session-v1";
  var SUPABASE_KEY = "sb-tftlfzeytiwpmiyvimla-auth-token";
  var COOKIE_NAME = "admin-dev-auth";

  if (!location.pathname.startsWith("/admin")) return;
  if (location.pathname === "/admin/sign-in" || location.pathname === "/admin/session") return;

  function decodeJwt(token) {
    var part = token.split(".")[1];
    if (!part) throw new Error("bad token");
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  }

  function normalizeSession(parsed) {
    if (!parsed || !parsed.access_token || !parsed.refresh_token) return null;
    var expiresAt = parsed.expires_at;
    if (typeof expiresAt !== "number") {
      try {
        expiresAt = decodeJwt(parsed.access_token).exp;
      } catch (e) {
        return null;
      }
    }
    if (expiresAt <= Date.now() / 1000) return null;
    if (!parsed.user || !parsed.user.id) {
      try {
        var payload = decodeJwt(parsed.access_token);
        parsed.user = {
          id: payload.sub,
          aud: payload.aud,
          role: payload.role,
          email: payload.email || (payload.user_metadata && payload.user_metadata.email),
          app_metadata: payload.app_metadata || {},
          user_metadata: payload.user_metadata || {},
        };
      } catch (e) {
        return null;
      }
    }
    parsed.expires_at = expiresAt;
    return parsed;
  }

  function readCookieSession() {
    var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"));
    if (!match || !match[1]) return null;
    try {
      return normalizeSession(JSON.parse(decodeURIComponent(match[1])));
    } catch (e) {}
    return null;
  }

  function readStoredSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeSession(JSON.parse(raw));
    } catch (e) {}
    return null;
  }

  function persistSession(session) {
    var json = JSON.stringify(session);
    localStorage.setItem(STORAGE_KEY, json);
    try { localStorage.setItem(SUPABASE_KEY, json); } catch (e) {}
    try {
      var minimal = encodeURIComponent(JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      }));
      document.cookie = COOKIE_NAME + "=" + minimal + "; Path=/; Max-Age=604800; SameSite=Lax";
    } catch (e) {}
  }

  function redirectToSession(accessToken, refreshToken) {
    var next = new URL("/admin/session", location.origin);
    next.searchParams.set("access_token", accessToken);
    next.searchParams.set("refresh_token", refreshToken);
    location.replace(next.toString());
  }

  var hash = location.hash.charAt(0) === "#" ? location.hash.slice(1) : location.hash;
  var hashParams = new URLSearchParams(hash);
  var queryParams = new URLSearchParams(location.search);
  var accessToken =
    hashParams.get("access_token") ||
    queryParams.get("access_token") ||
    hashParams.get("token") ||
    queryParams.get("token");
  var refreshToken =
    hashParams.get("refresh_token") || queryParams.get("refresh_token");

  function decodeOAuthReturnState(state) {
    if (!state) return null;
    try {
      var padded = state + "====".slice((state.length % 4) || 4);
      var json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
      var parsed = JSON.parse(json);
      return typeof parsed.return_to === "string" ? parsed.return_to : null;
    } catch (e) {
      return null;
    }
  }

  function isAllowedOAuthReturn(url) {
    try {
      var parsed = new URL(url);
      if (!parsed.pathname.endsWith("/iframe-oauth/callback")) return false;
      var allowed = [
        "https://andrii-kurshatsov-site.vercel.app",
        "https://andrii-kurshatsov.lovable.app",
      ];
      if (allowed.indexOf(parsed.origin) !== -1) return true;
      if (
        parsed.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].indexOf(parsed.hostname) !== -1
      ) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  if (accessToken && refreshToken) {
    var returnTo =
      decodeOAuthReturnState(queryParams.get("state")) ||
      (isAllowedOAuthReturn(queryParams.get("return_to") || "")
        ? queryParams.get("return_to")
        : null);
    if (returnTo) {
      var nextHash = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
      }).toString();
      location.replace(returnTo + "#" + nextHash);
      return;
    }
    redirectToSession(accessToken, refreshToken);
    return;
  }

  var session = readStoredSession() || readCookieSession();
  if (session) {
    persistSession(session);
    window.__ADMIN_SESSION__ = session;
  }
})();
