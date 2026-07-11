import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { config } from "../config";
import * as cognito from "../lib/cognito";
import { MOCK_USER, MOCK_VERIFY_CODE } from "../lib/mock";
import type { AuthUser } from "../lib/cognito";

interface AuthContextValue {
  user: AuthUser | null;
  /** email waiting on a verification code (post-signup) */
  pendingEmail: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  verify(code: string): Promise<void>;
  resend(): Promise<void>;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_KEY = "toolshare.mockUser";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (config.mock) {
      const email = localStorage.getItem(MOCK_KEY);
      return email ? { ...MOCK_USER, email } : null;
    }
    const tokens = cognito.loadTokens();
    return tokens ? cognito.userFromIdToken(tokens.idToken) : null;
  });
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // held in memory only, for auto-login right after email verification
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);

  // Refresh-on-load keeps a returning session alive without a login page hit.
  useEffect(() => {
    if (config.mock || !user) return;
    const tokens = cognito.loadTokens();
    if (tokens && cognito.isExpiring(tokens.idToken)) {
      cognito.refresh().then((renewed) => {
        setUser(renewed ? cognito.userFromIdToken(renewed.idToken) : null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (config.mock) {
      if (!email || !password) throw new Error("Enter an email and password.");
      localStorage.setItem(MOCK_KEY, email);
      setUser({ ...MOCK_USER, email });
      return;
    }
    try {
      const tokens = await cognito.signIn(email, password);
      setUser(cognito.userFromIdToken(tokens.idToken));
    } catch (err) {
      if (cognito.isUnconfirmed(err)) {
        setPendingEmail(email);
        setPendingPassword(password);
      }
      throw err;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (config.mock) {
      setPendingEmail(email);
      setPendingPassword(password);
      return;
    }
    await cognito.signUp(email, password);
    setPendingEmail(email);
    setPendingPassword(password);
  }, []);

  const verify = useCallback(
    async (code: string) => {
      if (!pendingEmail) throw new Error("Nothing to verify — sign up first.");
      if (config.mock) {
        if (code !== MOCK_VERIFY_CODE) throw new Error("That verification code isn't right (mock hint: 123456).");
        localStorage.setItem(MOCK_KEY, pendingEmail);
        setUser({ ...MOCK_USER, email: pendingEmail });
      } else {
        await cognito.confirmSignUp(pendingEmail, code);
        if (pendingPassword) {
          const tokens = await cognito.signIn(pendingEmail, pendingPassword);
          setUser(cognito.userFromIdToken(tokens.idToken));
        }
      }
      setPendingEmail(null);
      setPendingPassword(null);
    },
    [pendingEmail, pendingPassword]
  );

  const resend = useCallback(async () => {
    if (config.mock || !pendingEmail) return;
    await cognito.resendCode(pendingEmail);
  }, [pendingEmail]);

  const signOut = useCallback(() => {
    if (config.mock) localStorage.removeItem(MOCK_KEY);
    else cognito.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, pendingEmail, signIn, signUp, verify, resend, signOut }),
    [user, pendingEmail, signIn, signUp, verify, resend, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
