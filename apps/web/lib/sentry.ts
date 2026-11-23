function parseSentryDsn(dsn: string) {
  const url = new URL(dsn);
  const publicKey = url.username;
  const projectId = url.pathname.replace(/\//g, "");
  const endpoint = `${url.protocol}//${url.host}/api/${projectId}/store/`;
  return { publicKey, endpoint };
}

export async function captureError(error: unknown, context?: Record<string, unknown>) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const { publicKey, endpoint } = parseSentryDsn(dsn);
    const message = error instanceof Error ? error.message : String(error);
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=remitchain-web/1.0`,
      },
      body: JSON.stringify({
        platform: "javascript",
        level: "error",
        message,
        extra: context,
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });
  } catch {}
}
