(function () {
  var PRODUCTION_SITE = "https://andrii-kurshatsov-site.vercel.app";
  var LOVABLE_SITE = "https://andrii-kurshatsov.lovable.app";

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
      if (parsed.origin === PRODUCTION_SITE || parsed.origin === LOVABLE_SITE) return true;
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

  function readTokens() {
    var query = new URLSearchParams(location.search);
    var hash = location.hash.charAt(0) === "#" ? location.hash.slice(1) : location.hash;
    var hashParams = new URLSearchParams(hash);
    return {
      accessToken:
        hashParams.get("access_token") ||
        query.get("access_token") ||
        hashParams.get("token") ||
        query.get("token"),
      refreshToken: hashParams.get("refresh_token") || query.get("refresh_token"),
      returnTo:
        decodeOAuthReturnState(query.get("state")) ||
        (isAllowedOAuthReturn(query.get("return_to") || "") ? query.get("return_to") : null),
    };
  }

  var tokens = readTokens();
  if (!tokens.accessToken || !tokens.refreshToken || !tokens.returnTo) return;

  var nextHash = new URLSearchParams({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: "bearer",
  }).toString();
  location.replace(tokens.returnTo + "#" + nextHash);
})();
