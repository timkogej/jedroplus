"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        // Handle invalid refresh token error by clearing the session
        if (error) {
          console.warn("Session error, clearing invalid session:", error.message);
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(data.session?.user ?? null);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.warn("Failed to get session:", err);
        // Attempt to clear any corrupted session data
        await supabase.auth.signOut().catch(() => {});
        setUser(null);
        setLoading(false);
      }
    };

    initSession();

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        // Token refresh failed, clear session
        await supabase.auth.signOut().catch(() => {});
        setUser(null);
      } else {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return error ? error.message : null;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return error ? error.message : null;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
