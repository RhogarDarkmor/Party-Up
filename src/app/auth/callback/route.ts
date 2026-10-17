import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/perfil";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(new URL("/entrar?erro=provedor", request.url));
  }
  if (!code || !getSupabaseConfig()) {
    return NextResponse.redirect(new URL("/entrar?erro=confirmacao", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("PartyUp auth callback failed:", error.code ?? "unknown");
    return NextResponse.redirect(new URL("/entrar?erro=confirmacao", request.url));
  }

  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(nextPath, request.url));
}
