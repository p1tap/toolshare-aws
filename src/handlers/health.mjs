import { json } from "../lib/response.mjs";

export const handler = async () => {
  return json(200, { status: "ok", stage: process.env.STAGE });
};
