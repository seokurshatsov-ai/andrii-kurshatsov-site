import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { readTokensFromUrl } from "@/lib/adminSession";

function oauthCallbackHtml(): string {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Завершення входу…</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; background: #f5f5f4; color: #444; }
    .box { text-align: center; max-width: 520px; padding: 2rem; }
    .err { color: #b91c1c; margin-top: 1rem; line-height: 1.5; word-break: break-word; font-size: 14px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="box">
    <p id="status">Завершення входу…</p>
    <p id="error" class="err" hidden></p>
  </div>
  <script src="/oauth-forward.js?v=1"></script>
  <script>
    (function () {
      function showError(msg) {
        document.getElementById("status").hidden = true;
        var el = document.getElementById("error");
        el.hidden = false;
        el.innerHTML = msg + "<br><br><a href=\\"/admin/sign-in\\">Спробувати знову</a>";
      }

      function readTokens() {
        var params = new URLSearchParams(location.search);
        var hash = new URLSearchParams(location.hash.charAt(0) === "#" ? location.hash.slice(1) : location.hash);
        return {
          error: params.get("error") || hash.get("error"),
          errorDescription: params.get("error_description") || hash.get("error_description"),
          accessToken:
            params.get("access_token") ||
            hash.get("access_token") ||
            params.get("token") ||
            hash.get("token"),
          refreshToken: params.get("refresh_token") || hash.get("refresh_token"),
        };
      }

      function goSession(accessToken, refreshToken) {
        var next = new URL("/admin/session", location.origin);
        next.searchParams.set("access_token", accessToken);
        next.searchParams.set("refresh_token", refreshToken);
        location.replace(next.toString());
      }

      var tokens = readTokens();
      if (tokens.error) {
        showError(tokens.errorDescription || tokens.error);
      } else if (tokens.accessToken && tokens.refreshToken) {
        goSession(tokens.accessToken, tokens.refreshToken);
      } else {
        showError("Токени не знайдено після OAuth.<br><br>URL:<br><code style=\\"word-break:break-all\\">" + location.href + "</code>");
      }
    })();
  </script>
</body>
</html>`;
}

export const Route = createFileRoute("/iframe-oauth/callback")({
  server: {
    handlers: {
      GET: async () => {
        const request = getRequest();
        const url = new URL(request.url);
        const tokens = readTokensFromUrl(url);

        if (tokens.accessToken && tokens.refreshToken) {
          const next = new URL("/admin/session", url.origin);
          next.searchParams.set("access_token", tokens.accessToken);
          next.searchParams.set("refresh_token", tokens.refreshToken);
          return new Response(null, {
            status: 302,
            headers: {
              Location: next.toString(),
              "Cache-Control": "no-store",
            },
          });
        }

        return new Response(oauthCallbackHtml(), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
