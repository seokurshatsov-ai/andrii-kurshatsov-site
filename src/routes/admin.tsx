import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LOVABLE_SITE, PRODUCTION_SITE } from "@/lib/adminSignIn";
import { getAdminSessionUser } from "@/lib/admin.functions";
import { useAuth, ADMIN_EMAIL } from "@/lib/useAuth";
import {
  clearAdminSession,
  getEffectiveAdminUser,
} from "@/lib/adminSession";
import { LogOut, LayoutGrid, FileText, Share2, User as UserIcon, Sparkles, Star, HelpCircle, Search, Route as RouteIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type AdminLoaderData = {
  sessionUser: User | null;
};

const LOADER_TIMEOUT_MS = 4_000;
const BOOT_TIMEOUT_MS = 4_000;

export const Route = createFileRoute("/admin")({
  loader: async (): Promise<AdminLoaderData> => {
    if (typeof window !== "undefined") {
      return { sessionUser: (getEffectiveAdminUser() as User) ?? null };
    }

    try {
      const sessionUser = await Promise.race([
        getAdminSessionUser(),
        new Promise<User | null>((resolve) => setTimeout(() => resolve(null), LOADER_TIMEOUT_MS)),
      ]);
      return { sessionUser };
    } catch {
      return { sessionUser: null };
    }
  },
  component: AdminLayout,
  head: () => ({
    meta: [{ title: "Адмін — Andrii Kurshatsov" }, { name: "robots", content: "noindex,nofollow" }],
    scripts: [{ src: "/admin-auth.js?v=9" }],
  }),
});

function AdminBootScreen() {
  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center text-muted-foreground">
      Завантаження адмін-панелі…
    </div>
  );
}

function isOwnerEmail(user: User | null): boolean {
  if (!user) return false;
  const email = user.email ?? (user.user_metadata as { email?: string } | undefined)?.email;
  return email === ADMIN_EMAIL;
}

declare global {
  interface Window {
    __ADMIN_SESSION__?: { user?: User };
  }
}

function AdminLayout() {
  const { sessionUser: loaderUser } = Route.useLoaderData();
  const { user, isAdmin, loading } = useAuth();
  const [storedUser, setStoredUser] = useState<User | null>(
    () => (getEffectiveAdminUser() as User) ?? loaderUser ?? null,
  );
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pagesTab = useRouterState({
    select: (s) => (s.location.search as { page?: string } | undefined)?.page,
  });

  useLayoutEffect(() => {
    setStoredUser((getEffectiveAdminUser() as User) ?? loaderUser ?? null);
  }, [loaderUser]);

  useEffect(() => {
    setStoredUser((getEffectiveAdminUser() as User) ?? null);
  }, [user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setBootTimedOut(true), BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const code = params.get("code");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (!code && !accessToken) return;

    const finish = () => window.history.replaceState({}, "", "/admin");

    const applySession = async () => {
      if (accessToken && refreshToken) {
        if (import.meta.env.DEV) {
          const next = new URL("/admin/session", window.location.origin);
          next.searchParams.set("access_token", accessToken);
          next.searchParams.set("refresh_token", refreshToken);
          window.location.replace(next.toString());
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) console.error(error);
        finish();
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error(error);
        finish();
        return;
      }

      finish();
    };

    void applySession();
  }, []);

  const effectiveUser =
    user ?? storedUser ?? loaderUser ?? (getEffectiveAdminUser() as User) ?? null;

  const ownerOk = isOwnerEmail(effectiveUser);

  const signOut = async () => {
    clearAdminSession();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore local dev auth errors
    }
    window.location.href = "/admin";
  };

  if (!effectiveUser) {
    if (!bootTimedOut) {
      return <AdminBootScreen />;
    }
    return <Login checking={false} />;
  }

  if (!isAdmin && !ownerOk) {
    return (
      <div className="pt-32 container-px mx-auto max-w-md text-center">
        <h1 className="font-display text-3xl mb-4">Доступ заборонено</h1>
        <p className="text-muted-foreground mb-6">
          Тільки {ADMIN_EMAIL} може керувати цим сайтом. Ви увійшли як {effectiveUser.email}.
        </p>
        <button
          onClick={() => void signOut()}
          className="rounded-full px-5 py-2.5 text-sm bg-foreground text-background"
        >
          Вийти
        </button>
      </div>
    );
  }

  const tabs = [
    { key: "portfolio", to: "/admin", label: "Портфоліо", icon: LayoutGrid, exact: true },
    { key: "pages", to: "/admin/pages", label: "Сторінки", icon: FileText, pagesTab: "default" as const },
    { key: "process", to: "/admin/pages", label: "Процес", icon: RouteIcon, search: { page: "process" }, pagesTab: "process" as const },
    { key: "seo", to: "/admin/seo", label: "SEO", icon: Search },
    { key: "services", to: "/admin/services", label: "Послуги", icon: Sparkles },
    { key: "testimonials", to: "/admin/testimonials", label: "Відгуки", icon: Star },
    { key: "faq", to: "/admin/faq", label: "FAQ", icon: HelpCircle },
    { key: "socials", to: "/admin/socials", label: "Соцмережі", icon: Share2 },
    { key: "about", to: "/admin/about", label: "Про мене", icon: UserIcon },
  ];

  return (
    <div className="pt-28 pb-20 container-px mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Адмін-панель</div>
          <h1 className="font-display text-3xl mt-1">{effectiveUser.email}</h1>
        </div>
        <button
          onClick={() => void signOut()}
          className="glass inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm hover:text-electric transition self-start"
        >
          <LogOut className="h-4 w-4" /> Вийти
        </button>
      </div>

      <nav className="glass rounded-full p-1.5 inline-flex flex-wrap gap-1 mb-10">
        {tabs.map((t) => {
          const active = t.pagesTab
            ? pathname === t.to && (t.pagesTab === "process" ? pagesTab === "process" : pagesTab !== "process")
            : t.exact
              ? pathname === t.to
              : pathname.startsWith(t.to);
          return (
            <Link
              key={t.key}
              to={t.to}
              search={t.search}
              className={`px-5 py-2.5 rounded-full text-sm inline-flex items-center gap-2 transition ${
                active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}

function Login({ checking = false }: { checking?: boolean }) {
  return (
    <div className="pt-32 container-px mx-auto max-w-md text-center" data-admin-login>
      <h1 className="font-display text-4xl mb-4 text-gradient">Адмін-панель</h1>
      <p className="text-muted-foreground mb-8">Увійдіть через Google акаунт {ADMIN_EMAIL}</p>
      <a
        href="/admin/sign-in"
        className="btn-electric hover:btn-electric-hover rounded-full px-7 py-3.5 text-sm font-medium inline-block"
      >
        {checking ? "Перевірка сесії…" : "Увійти через Google"}
      </a>

      {!import.meta.env.DEV && (
        <p className="text-xs text-muted-foreground mt-6 max-w-sm mx-auto leading-relaxed">
          Вхід проходить через Lovable OAuth і повертає вас на цей сайт. Якщо не спрацює — відкрийте{" "}
          <a href={`${LOVABLE_SITE}/admin`} className="text-electric hover:underline">
            адмін-панель на Lovable
          </a>
          .
        </p>
      )}

      {import.meta.env.DEV && (
        <div className="mt-10 rounded-2xl border border-border/60 bg-muted/20 p-5 text-left text-sm text-muted-foreground space-y-3">
          <p className="font-medium text-foreground">Локальний вхід не працює?</p>
          <p>
            Використовуйте{" "}
            <a href={`${PRODUCTION_SITE}/admin`} className="text-electric hover:underline" target="_blank" rel="noreferrer">
              production admin
            </a>
            {" "}— там OAuth працює одразу.
          </p>
          <p className="text-xs">
            Потрібен <code className="text-xs">npm run dev:auth</code> і{" "}
            <code className="text-xs">http://127.0.0.1/admin</code>
          </p>
        </div>
      )}
    </div>
  );
}
