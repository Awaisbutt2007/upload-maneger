// Platform credentials from environment variables, shared by the local server and the Vercel function.
export function providersFromEnv(env) {
  return {
    tiktok: { clientId: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET, redirectUri: env.TIKTOK_REDIRECT_URI },
    meta: { clientId: env.META_APP_ID, clientSecret: env.META_APP_SECRET, redirectUri: env.META_REDIRECT_URI, graphVersion: env.META_GRAPH_VERSION },
    youtube: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: env.GOOGLE_REDIRECT_URI },
    linkedin: { clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET, redirectUri: env.LINKEDIN_REDIRECT_URI, apiVersion: env.LINKEDIN_API_VERSION },
    x: { clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET, redirectUri: env.X_REDIRECT_URI },
  }
}

export function maxUploadBytesFromEnv(env) {
  return Number(env.MAX_UPLOAD_MB) > 0 ? Number(env.MAX_UPLOAD_MB) * 1024 * 1024 : undefined
}
