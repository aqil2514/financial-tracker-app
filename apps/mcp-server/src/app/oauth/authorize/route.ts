import { issueAuthCode } from "@/lib/oauth-store";
import { verifyWorkerToken } from "@/lib/worker-client";

function renderForm(params: {
  redirectUri: string;
  state: string;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hubungkan ke Financial App</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .card { background: white; border-radius: 12px; padding: 2rem; width: 100%; max-width: 400px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #666; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
    input { width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; font-family: monospace; outline: none; }
    input:focus { border-color: #111; box-shadow: 0 0 0 2px rgba(0,0,0,0.08); }
    button { width: 100%; margin-top: 1rem; padding: 0.625rem; background: #111; color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
    button:hover { background: #333; }
    .error { color: #dc2626; font-size: 0.8125rem; margin-top: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hubungkan ke Financial App</h1>
    <p>Masukkan token sinkronisasi (sama dengan yang dipakai di Settings aplikasi desktop) untuk melanjutkan.</p>
    <form method="GET" action="/oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${params.redirectUri}">
      <input type="hidden" name="state" value="${params.state}">
      <input type="hidden" name="client_id" value="${params.clientId}">
      <input type="hidden" name="code_challenge" value="${params.codeChallenge}">
      <input type="hidden" name="code_challenge_method" value="${params.codeChallengeMethod}">
      <label for="token">Token</label>
      <input type="password" id="token" name="token" placeholder="Tempel token di sini" required autofocus>
      <button type="submit">Hubungkan</button>
      ${params.error ? `<p class="error">${params.error}</p>` : ""}
    </form>
  </div>
</body>
</html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const clientId = url.searchParams.get("client_id") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      renderForm({ redirectUri, state, clientId, codeChallenge, codeChallengeMethod }),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const isValid = await verifyWorkerToken(token);
  if (!isValid) {
    return new Response(
      renderForm({
        redirectUri,
        state,
        clientId,
        codeChallenge,
        codeChallengeMethod,
        error: "Token tidak valid. Coba lagi.",
      }),
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  const code = issueAuthCode(token, codeChallenge);
  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);

  return Response.redirect(redirect.toString(), 302);
}
