import { useEffect, useLayoutEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_OWNER_EMAIL,
  getAdminEmail,
  getEffectiveAdminUser,
  isAdminOwnerEmail,
  persistAdminSession,
  pickUserWithEmail,
  readAdminSession,
  type AdminSessionPayload,
} from "@/lib/adminSession";
import { syncAdminSessionToSupabaseStorage } from "@/lib/adminSupabase";

const ADMIN_EMAIL = ADMIN_OWNER_EMAIL;

function readStoredSession(): Session | null {
  return readAdminSession() as Session | null;
}

async function syncSupabaseSession(session: AdminSessionPayload) {
  if (import.meta.env.DEV) return;
  try {
    await Promise.race([
      supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("auth sync timeout")), 2000)),
    ]);
  } catch {
    // Ignore network/SSL errors in local dev.
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(() => readStoredSession());
  const [loading, setLoading] = useState(() => import.meta.env.DEV ? false : true);
  const [isAdmin, setIsAdmin] = useState(() => {
    const cached = readAdminSession();
    return isAdminOwnerEmail(getAdminEmail(cached));
  });

  useLayoutEffect(() => {
    syncAdminSessionToSupabaseStorage();
    const cached = readAdminSession();
    const effective = getEffectiveAdminUser();
    if (effective) {
      const nextSession = (cached ?? readAdminSession()) as Session | null;
      if (nextSession) setSession(nextSession);
    }
    if (isAdminOwnerEmail(getAdminEmail(cached))) {
      setIsAdmin(true);
      if (import.meta.env.DEV) setLoading(false);
    }
    if (cached && !import.meta.env.DEV) {
      void syncSupabaseSession(cached);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const cached = readAdminSession();

    if (cached) {
      setSession(cached as Session);
      if (!import.meta.env.DEV) void syncSupabaseSession(cached);
    }

    if (import.meta.env.DEV) {
      if (cached && isAdminOwnerEmail(getAdminEmail(cached))) {
        setIsAdmin(true);
      }
      setLoading(false);
      return;
    }

    setLoading(true);

    const finishLoading = () => {
      if (mounted) setLoading(false);
    };

    const timeoutId = window.setTimeout(finishLoading, 5_000);

    let subscription: { unsubscribe: () => void } | undefined;

    try {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        finishLoading();
      });
      subscription = data.subscription;
    } catch (error) {
      console.error("[useAuth] onAuthStateChange failed:", error);
      if (cached) setSession(cached as Session);
      finishLoading();
    }

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[useAuth] getSession:", error);
          if (cached) setSession(cached as Session);
        } else {
          setSession(data.session ?? (cached as Session | null));
        }
        finishLoading();
      })
      .catch((error) => {
        console.error("[useAuth] getSession failed:", error);
        if (cached) setSession(cached as Session);
        finishLoading();
      });

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      const cachedEmail = getAdminEmail(readAdminSession());
      if (isAdminOwnerEmail(cachedEmail)) {
        setIsAdmin(true);
      } else if (!import.meta.env.DEV) {
        setIsAdmin(false);
      }
      return;
    }

    let cancelled = false;

    const cachedEmail = getAdminEmail(readAdminSession());
    const emailIsOwner =
      isAdminOwnerEmail(getAdminEmail(session as AdminSessionPayload)) ||
      isAdminOwnerEmail(cachedEmail);

    const checkAdmin = () => {
      if (emailIsOwner) {
        if (!cancelled) setIsAdmin(true);
        return;
      }

      void supabase
        .rpc("is_admin")
        .then(({ data, error }) => {
          if (error) console.error("[useAuth] is_admin:", error);
          if (!cancelled) setIsAdmin(!!data || emailIsOwner);
        })
        .catch((error) => {
          console.error("[useAuth] is_admin failed:", error);
          if (!cancelled) setIsAdmin(emailIsOwner);
        });
    };

    if (emailIsOwner) {
      setIsAdmin(true);
    }

    checkAdmin();
    const retryId = window.setTimeout(checkAdmin, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(retryId);
    };
  }, [session?.user?.id, session?.user?.email]);

  const user: User | null = pickUserWithEmail(
    session?.user ?? null,
    getEffectiveAdminUser() as User | null,
  );

  return { session, user, isAdmin, loading };
}

export {
  ADMIN_EMAIL,
  readStoredSession,
  persistAdminSession,
  getAdminEmail,
  readAdminSession,
};
