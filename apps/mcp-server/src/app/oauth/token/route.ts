import { consumeAuthCode } from "@/lib/oauth-store";

async function sha256Base64Url(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Buffer.from(hash).toString("base64url");
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await req.json().catch(() => ({}))) as Record<string, string>)
    : Object.fromEntries(new URLSearchParams(await req.text()));

  const code = body.code;
  if (!code) {
    return Response.json(
      { error: "invalid_request", error_description: "Missing code" },
      { status: 400 }
    );
  }

  const entry = consumeAuthCode(code);
  if (!entry) {
    return Response.json(
      { error: "invalid_grant", error_description: "Code expired or invalid" },
      { status: 400 }
    );
  }

  if (entry.codeChallenge) {
    const codeVerifier = body.code_verifier;
    if (!codeVerifier) {
      return Response.json(
        { error: "invalid_request", error_description: "Missing code_verifier" },
        { status: 400 }
      );
    }
    const expected = await sha256Base64Url(codeVerifier);
    if (expected !== entry.codeChallenge) {
      return Response.json(
        { error: "invalid_grant", error_description: "PKCE verification failed" },
        { status: 400 }
      );
    }
  }

  return Response.json({
    access_token: entry.token,
    token_type: "bearer",
    expires_in: 315360000,
  });
}
