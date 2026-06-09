import { createFileRoute, Link } from "@tanstack/react-router";
import { LOVABLE_SITE } from "@/lib/adminSignIn";

export const Route = createFileRoute("/oauth-handoff")({
  component: OAuthHandoff,
  head: () => ({
    meta: [{ title: "Передача сесії…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function OAuthHandoff() {
  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center">
      <h1 className="font-display text-3xl mb-4 text-gradient">Вхід в адмін-панель</h1>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        Google OAuth для цього проєкту налаштований у Lovable Cloud, а не в Supabase Dashboard.
        Увійдіть через Lovable — це займе кілька секунд.
      </p>
      <a
        href={`${LOVABLE_SITE}/admin`}
        className="btn-electric hover:btn-electric-hover rounded-full px-7 py-3.5 text-sm font-medium inline-block"
      >
        Відкрити адмінку на Lovable
      </a>
      <p className="text-xs text-muted-foreground mt-8">
        <Link to="/admin" className="text-electric hover:underline">
          Назад
        </Link>
      </p>
    </div>
  );
}
