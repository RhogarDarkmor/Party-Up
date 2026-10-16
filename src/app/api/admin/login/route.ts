import {
  adminSessionCookieName,
  createAdminSessionToken,
  getAdminConfiguration,
  getAdminSessionCookieOptions,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import {
  checkAdminLoginLimit,
  clearAdminLoginLimit,
} from "@/lib/admin-login-limit";
import { cookies } from "next/headers";

const MAX_REQUEST_BYTES = 4_096;

function getClientAddress(request: Request) {
  const trustedProxyAddress = request.headers.get("x-real-ip")?.trim();
  const forwardedAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .at(-1)
    ?.trim();
  return (
    trustedProxyAddress ||
    forwardedAddress ||
    "unknown-client"
  );
}

function jsonResponse(
  body: Record<string, string>,
  status: number,
  headers?: HeadersInit,
) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      ...headers,
    },
  });
}

export async function POST(request: Request) {
  const clientAddress = getClientAddress(request);
  const rateLimit = checkAdminLoginLimit(clientAddress);

  if (!rateLimit.allowed) {
    return jsonResponse(
      { message: "Muitas tentativas. Aguarde antes de tentar novamente." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ message: "Requisição inválida." }, 413);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) {
      return jsonResponse({ message: "Requisição inválida." }, 413);
    }
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ message: "Requisição inválida." }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("username" in body) ||
    typeof body.username !== "string" ||
    !("password" in body) ||
    typeof body.password !== "string" ||
    body.username.length === 0 ||
    body.username.length > 120 ||
    body.password.length === 0 ||
    body.password.length > 1_024
  ) {
    return jsonResponse({ message: "Informe o login e a senha." }, 400);
  }

  let config;
  try {
    config = getAdminConfiguration();
  } catch (error) {
    console.error("Admin authentication is not configured.", error);
    return jsonResponse(
      { message: "O acesso administrativo ainda não foi configurado." },
      503,
    );
  }

  let authenticated: boolean;
  try {
    authenticated = await verifyAdminCredentials(
      body.username,
      body.password,
      config,
    );
  } catch (error) {
    console.error("Admin credential verification failed.", error);
    return jsonResponse(
      { message: "Não foi possível validar as credenciais agora." },
      500,
    );
  }

  if (!authenticated) {
    return jsonResponse({ message: "Login ou senha inválidos." }, 401);
  }

  clearAdminLoginLimit(clientAddress);

  const cookieStore = await cookies();
  cookieStore.set(
    adminSessionCookieName,
    createAdminSessionToken(config),
    getAdminSessionCookieOptions(),
  );

  return jsonResponse({ message: "Acesso autorizado." }, 200);
}
