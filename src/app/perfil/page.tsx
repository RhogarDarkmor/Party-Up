import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signOut } from "@/app/auth/actions";
import { ProfileForm } from "./profile-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Meu perfil",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { salvo } = await searchParams;
  if (!getSupabaseConfig()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b10] px-6 py-12 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111118] p-8">
          <h1 className="text-2xl font-bold">Perfil ainda indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Configure o Supabase no servidor para criar e salvar perfis de jogadores.
          </p>
          <Link className="mt-6 inline-block text-sm font-semibold text-violet-300" href="/">
            Voltar ao início
          </Link>
        </section>
      </main>
    );
  }

  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    redirect("/entrar");
  }

  const { data: profile, error: profileError } = await supabase
    .from("gamer_profiles")
    .select(
      "display_name, bio, timezone, preferred_language, play_style, communication_preference",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return (
    <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link className="text-sm font-semibold text-violet-300" href="/">
              PartyUp
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Seu perfil gamer</h1>
          </div>
          <form action={signOut}>
            <button
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              type="submit"
            >
              Sair
            </button>
          </form>
        </header>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#111118] p-6 sm:p-8">
          <p className="text-sm leading-6 text-zinc-400">
            Conte como você gosta de jogar. Você poderá editar essas informações depois.
          </p>
          {salvo === "1" ? (
            <p
              aria-live="polite"
              className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-200"
              role="status"
            >
              Perfil salvo.
            </p>
          ) : null}
          <ProfileForm profile={profile} />
        </section>
      </div>
    </main>
  );
}
