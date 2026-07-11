// Real API client, typed to the backend contract. Sends the Cognito ID
// token (the JWT authorizer's audience is the app client ID, so the
// access token would be rejected). On a 401, refreshes once and retries.

import { config } from "../config";
import { ApiError, type ApiClient, type Rental, type Tool } from "./types";
import { loadTokens, refresh, isExpiring } from "./cognito";

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  retried = false
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  let tokens = loadTokens();
  if (tokens && isExpiring(tokens.idToken)) {
    tokens = (await refresh()) ?? tokens;
  }
  if (tokens) headers.authorization = `Bearer ${tokens.idToken}`;

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && !retried && tokens) {
    const renewed = await refresh();
    if (renewed) return request<T>(method, path, body, true);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.cause);
  }
  return data as T;
}

export const realApi: ApiClient = {
  listTools: () => request<Tool[]>("GET", "/tools"),
  getTool: (toolId) => request<Tool>("GET", `/tools/${toolId}`),
  createTool: (input) => request<Tool>("POST", "/tools", input),
  listMyTools: () => request<Tool[]>("GET", "/tools/mine"),

  async uploadToolImage(toolId, file) {
    const { uploadUrl, key } = await request<{ uploadUrl: string; key: string }>(
      "POST",
      `/tools/${toolId}/upload-url`
    );
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: file,
    });
    if (!put.ok) throw new ApiError(put.status, "Image upload failed");
    return key;
  },

  createRental: (input) => request<Rental>("POST", "/rentals", input),
  listMyRentals: () => request<Rental[]>("GET", "/rentals/mine"),
  checkout: (rentalId) =>
    request<{ rentalId: string; status: string }>("POST", `/rentals/${rentalId}/checkout`),
  returnRental: (rentalId) => request<Rental>("POST", `/rentals/${rentalId}/return`),

  imageUrl: (tool) => (tool.imageKey ? `${config.imagesBase}/${tool.imageKey}` : null),
};
