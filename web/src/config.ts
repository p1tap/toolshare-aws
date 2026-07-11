// Runtime configuration. Mock mode is the default whenever a real API
// isn't configured, so `npm run dev` works with zero setup and no AWS.

const env = import.meta.env;

export const config = {
  apiUrl: (env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "",
  userPoolId: (env.VITE_USER_POOL_ID as string | undefined) ?? "",
  clientId: (env.VITE_CLIENT_ID as string | undefined) ?? "",
  awsRegion: (env.VITE_AWS_REGION as string | undefined) ?? "ap-southeast-1",
  // Images are served by the same CloudFront distribution under /images/*;
  // override for odd setups (e.g. localhost dev against a real stage).
  imagesBase: (env.VITE_IMAGES_BASE as string | undefined) ?? "/images",
  mock: env.VITE_API_MODE !== "real" || !env.VITE_API_URL,
};
