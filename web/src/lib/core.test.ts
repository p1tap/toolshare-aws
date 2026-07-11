// Offline unit tests for the client's decidable logic — no browser, no AWS.
import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, priceFor } from "./types";
import { humanMessage, decodeJwt, userFromIdToken, isExpiring } from "./cognito";

afterEach(() => vi.restoreAllMocks());

function fakeJwt(claims: Record<string, unknown>): string {
  // btoa is global in both browsers and Node 16+ (claims here are ASCII)
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64(claims)}.sig`;
}

describe("priceFor (must mirror the backend rule: ceil(days) * costPerDay)", () => {
  it("charges per started day", () => {
    expect(priceFor(100, "2026-07-01T00:00:00Z", "2026-07-03T00:00:00Z")).toBe(200);
    // 2.5 days -> 3 billed days
    expect(priceFor(100, "2026-07-01T00:00:00Z", "2026-07-03T12:00:00Z")).toBe(300);
  });

  it("rejects inverted or invalid ranges", () => {
    expect(priceFor(100, "2026-07-03", "2026-07-01")).toBeNull();
    expect(priceFor(100, "garbage", "2026-07-01")).toBeNull();
    expect(priceFor(100, "2026-07-01", "2026-07-01")).toBeNull(); // zero-length
  });
});

describe("cognito error mapping", () => {
  it("maps the flows a user actually hits", () => {
    expect(humanMessage("NotAuthorizedException")).toMatch(/wrong email or password/i);
    expect(humanMessage("UserNotConfirmedException")).toMatch(/verified/i);
    expect(humanMessage("UsernameExistsException")).toMatch(/already exists/i);
    expect(humanMessage("CodeMismatchException")).toMatch(/code/i);
  });

  it("falls back to the server message, then to a generic line", () => {
    expect(humanMessage("SomethingNew", "server says hi")).toBe("server says hi");
    expect(humanMessage("SomethingNew")).toMatch(/try again/i);
  });
});

describe("token decoding", () => {
  it("extracts sub/email/groups from an ID token", () => {
    const token = fakeJwt({ sub: "u1", email: "a@b.c", "cognito:groups": ["admin", "renter"] });
    expect(userFromIdToken(token)).toEqual({ sub: "u1", email: "a@b.c", groups: ["admin", "renter"] });
  });

  it("parses the HTTP-API-style stringified groups claim too", () => {
    const token = fakeJwt({ sub: "u1", email: "a@b.c", "cognito:groups": "[admin renter]" });
    expect(userFromIdToken(token)?.groups).toEqual(["admin", "renter"]);
  });

  it("returns null on garbage tokens instead of throwing", () => {
    expect(decodeJwt("not-a-jwt")).toBeNull();
    expect(userFromIdToken("still.not%%%.ajwt")).toBeNull();
  });

  it("flags tokens expiring within a minute", () => {
    const soon = fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 30 });
    const later = fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isExpiring(soon)).toBe(true);
    expect(isExpiring(later)).toBe(false);
  });
});

describe("ApiError", () => {
  it("carries status and saga cause for the 402 compensation path", () => {
    const e = new ApiError(402, "Payment failed; reservation released", "compensated");
    expect(e.status).toBe(402);
    expect(e.cause).toBe("compensated");
    expect(e).toBeInstanceOf(Error);
  });
});
