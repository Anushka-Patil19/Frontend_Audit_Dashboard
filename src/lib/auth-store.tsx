import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "audit-intelligence-session";

const ADMIN = {
  email: "admin@acmecapital.com",
  password: "Admin@2026",
  name: "Priya Rao",
  role: "Compliance admin",
};

export type Session = { email: string; name: string; role: string };

type AuthValue = {
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => { ok: boolean; error?: string };
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      /* ignore unreadable session */
    }
    setReady(true);
  }, []);

  const signIn = (email: string, password: string) => {
    if (email.trim().toLowerCase() !== ADMIN.email || password !== ADMIN.password) {
      return { ok: false, error: "Those credentials don't match an active administrator." };
    }
    const next: Session = { email: ADMIN.email, name: ADMIN.name, role: ADMIN.role };
    setSession(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ok: true };
  };

  const signOut = () => {
    setSession(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ session, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const adminHint = ADMIN;
