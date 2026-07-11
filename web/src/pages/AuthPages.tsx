import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/auth";
import { useToast } from "../context/toast";
import { config } from "../config";

const input =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-950";
const button =
  "w-full rounded-xl bg-amber-500 py-2.5 font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50";

function Shell({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-sm px-4 py-14">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {hint && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{hint}</p>}
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        {children}
      </div>
    </main>
  );
}

export function Login() {
  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate((location.state as { from?: string })?.from ?? "/");
    } catch (err) {
      const msg = (err as Error).message;
      toast.push("error", msg);
      if (msg.includes("isn't verified")) navigate("/verify");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Log in"
      hint={config.mock ? "Demo mode: any email + password works." : undefined}
    >
      <form onSubmit={submit} className="space-y-4">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className={input} autoComplete="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className={input} autoComplete="current-password" />
        <button type="submit" disabled={busy} className={button}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
        New here?{" "}
        <Link to="/signup" className="font-medium text-amber-600 hover:underline">
          Create an account
        </Link>
      </p>
    </Shell>
  );
}

export function Signup() {
  const { signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signUp(email.trim(), password);
      toast.push("info", config.mock ? "Demo: your code is 123456." : "Check your email for a verification code.");
      navigate("/verify");
    } catch (err) {
      toast.push("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Sign up" hint="At least 8 characters with an uppercase letter, a lowercase letter, and a number.">
      <form onSubmit={submit} className="space-y-4">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className={input} autoComplete="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className={input} autoComplete="new-password" />
        <button type="submit" disabled={busy} className={button}>
          {busy ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-amber-600 hover:underline">
          Log in
        </Link>
      </p>
    </Shell>
  );
}

export function Verify() {
  const { verify, resend, pendingEmail } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await verify(code.trim());
      toast.push("success", "Verified — welcome to ToolShare!");
      navigate("/");
    } catch (err) {
      toast.push("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Verify your email"
      hint={pendingEmail ? `We sent a code to ${pendingEmail}.` : "Sign up (or log in) first to get a code."}
    >
      <form onSubmit={submit} className="space-y-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="6-digit code"
          className={`${input} text-center text-lg tracking-[0.4em]`}
        />
        <button type="submit" disabled={busy || !pendingEmail} className={button}>
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>
      {!config.mock && pendingEmail && (
        <button
          onClick={() => resend().then(() => toast.push("info", "Code re-sent."))}
          className="mt-4 w-full text-center text-sm text-amber-600 hover:underline"
        >
          Re-send the code
        </button>
      )}
    </Shell>
  );
}
