// Identity comes from the API Gateway JWT authorizer's validated claims —
// never from the request body. The authorizer rejects unauthenticated
// requests before Lambda runs, so claims are always present on protected
// routes; the null-return path is defense in depth.
export function getIdentity(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) return null;
  const rawGroups = claims["cognito:groups"] ?? "";
  // HTTP API v2 serializes group claims as "[a b]"; normalize to an array.
  const groups = String(rawGroups)
    .replace(/^\[|\]$/g, "")
    .split(/[\s,]+/)
    .filter(Boolean);
  return { userId: claims.sub, email: claims.email, groups };
}
