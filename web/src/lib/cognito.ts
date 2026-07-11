// Zero-dependency Cognito client: plain fetch against the cognito-idp
// endpoint (the same wire protocol the official SDKs speak). No AWS SDK
// in the browser bundle. These unauthenticated operations are CORS-open
// by AWS design.

import { config } from "../config";

const ENDPOINT = `https://cognito-idp.${config.awsRegion}.amazonaws.com/`;

const STORAGE_KEY = "toolshare.auth";

export interface Tokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  groups: string[];
}

class CognitoError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(target: string, payload: unknown): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(body.__type ?? "UnknownError").split("#").pop() ?? "UnknownError";
    throw new CognitoError(code, humanMessage(code, body.message));
  }
  return body as T;
}

/** Map Cognito error codes to text a human can act on. */
export function humanMessage(code: string, fallback?: string): string {
  switch (code) {
    case "UserNotConfirmedException":
      return "Your email isn't verified yet — enter the code we sent you.";
    case "NotAuthorizedException":
      return "Wrong email or password.";
    case "UserNotFoundException":
      return "No account with that email — sign up first.";
    case "UsernameExistsException":
      return "An account with that email already exists — try logging in.";
    case "InvalidPasswordException":
      return "Password must be at least 8 characters with an uppercase letter, a lowercase letter, and a number.";
    case "CodeMismatchException":
      return "That verification code isn't right — check the email again.";
    case "ExpiredCodeException":
      return "That code expired — request a new one.";
    case "LimitExceededException":
      return "Too many attempts — wait a minute and try again.";
    default:
      return fallback || "Something went wrong — try again.";
  }
}

export function isUnconfirmed(err: unknown): boolean {
  return err instanceof CognitoError && err.code === "UserNotConfirmedException";
}

// ---- flows -----------------------------------------------------------------

export async function signUp(email: string, password: string): Promise<void> {
  await call("SignUp", {
    ClientId: config.clientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await call("ConfirmSignUp", {
    ClientId: config.clientId,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function resendCode(email: string): Promise<void> {
  await call("ResendConfirmationCode", { ClientId: config.clientId, Username: email });
}

interface AuthResult {
  AuthenticationResult?: {
    IdToken: string;
    AccessToken: string;
    RefreshToken?: string;
  };
}

export async function signIn(email: string, password: string): Promise<Tokens> {
  const res = await call<AuthResult>("InitiateAuth", {
    ClientId: config.clientId,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  const r = res.AuthenticationResult;
  if (!r?.IdToken || !r.AccessToken || !r.RefreshToken) {
    throw new CognitoError("UnknownError", "Unexpected sign-in response.");
  }
  const tokens = { idToken: r.IdToken, accessToken: r.AccessToken, refreshToken: r.RefreshToken };
  saveTokens(tokens);
  return tokens;
}

/** REFRESH_TOKEN_AUTH returns new id/access tokens (refresh token is reused). */
export async function refresh(): Promise<Tokens | null> {
  const current = loadTokens();
  if (!current) return null;
  try {
    const res = await call<AuthResult>("InitiateAuth", {
      ClientId: config.clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: current.refreshToken },
    });
    const r = res.AuthenticationResult;
    if (!r?.IdToken || !r.AccessToken) return null;
    const tokens = { ...current, idToken: r.IdToken, accessToken: r.AccessToken };
    saveTokens(tokens);
    return tokens;
  } catch {
    signOut();
    return null;
  }
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ---- token storage & decoding ----------------------------------------------
// localStorage is the standard SPA tradeoff (XSS-readable); documented in
// web/README. A cookie/BFF layer is out of scope for this deployment shape.

export function saveTokens(tokens: Tokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function userFromIdToken(idToken: string): AuthUser | null {
  const claims = decodeJwt(idToken);
  if (!claims?.sub) return null;
  const rawGroups = claims["cognito:groups"];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String)
    : typeof rawGroups === "string"
      ? rawGroups.replace(/^\[|\]$/g, "").split(/[\s,]+/).filter(Boolean)
      : [];
  return { sub: String(claims.sub), email: String(claims.email ?? ""), groups };
}

/** True when the token expires within the next 60 seconds. */
export function isExpiring(idToken: string): boolean {
  const claims = decodeJwt(idToken);
  const exp = typeof claims?.exp === "number" ? claims.exp : 0;
  return exp * 1000 < Date.now() + 60_000;
}
