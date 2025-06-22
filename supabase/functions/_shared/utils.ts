// functions/_shared/utils.ts

export function jsonResponse(body: any, status = 200): Response {
  return new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,x-extension-auth",
      },
    }
  );
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,x-extension-auth",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse("Method Not Allowed", 405);
  }

  return null;
}

export function isAuthorized(req: Request, expectedSecret: string): boolean {
  const incoming = req.headers.get('x-extension-auth');
  return incoming === expectedSecret;
}