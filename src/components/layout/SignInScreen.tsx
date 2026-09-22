import { useState } from "react";
import { ShieldHalf, Lock } from "lucide-react";
import { adminHint, useAuth } from "@/lib/auth-store";

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-7 shadow-panel">
        <div className="flex items-center gap-2">
          <ShieldHalf className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <span className="font-serif text-xl text-foreground">Audit Intelligence</span>
        </div>
        <h1 className="mt-6 font-serif text-2xl text-foreground">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Administrator access to the compliance command center.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const res = signIn(email, password);
            setError(res.ok ? null : (res.error ?? "Sign in failed."));
          }}
        >
          <label className="block">
            <span className="text-xs text-muted-foreground">Work email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acmecapital.com"
              className="mt-1.5 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-ring"
            />
          </label>

          {error && <p className="text-xs text-fail">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 flex items-start gap-2 rounded-md bg-primary-soft px-3 py-2.5">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-[11px] text-muted-foreground">
            Administrator credentials: <span className="font-mono">{adminHint.email}</span> /{" "}
            <span className="font-mono">{adminHint.password}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
