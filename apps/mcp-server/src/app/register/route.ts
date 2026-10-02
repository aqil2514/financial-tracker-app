import { registerClient } from "@/lib/oauth-store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { redirect_uris?: string[] };
  const redirectUris = body.redirect_uris ?? [];
  const clientId = registerClient(redirectUris);

  return Response.json(
    {
      client_id: clientId,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201 }
  );
}
