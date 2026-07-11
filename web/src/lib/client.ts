import { config } from "../config";
import { mockApi } from "./mock";
import { realApi } from "./api";
import type { ApiClient } from "./types";

export const api: ApiClient = config.mock ? mockApi : realApi;
