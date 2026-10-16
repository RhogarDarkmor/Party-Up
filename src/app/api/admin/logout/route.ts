import {
  adminSessionCookieName,
  getAdminSessionCookieOptions,
} from "@/lib/admin-auth";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookieName, "", {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });

  return Response.json(
    { message: "Sessão encerrada." },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
