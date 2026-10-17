import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/app/auth/auth-form";
import { signIn } from "@/app/auth/actions";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const isConfigured = Boolean(getSupabaseConfig());

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b10] px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] p-7 shadow-2xl shadow-black/30 sm:p-9">
        <Link className="text-sm font-semibold text-violet-300" href="/">
          ← Voltar ao PartyUp
        </Link>
        <p className="mt-8 text-sm font-medium text-violet-300">Bem-vindo de volta</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Entre na sua conta</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Acesse seu perfil e continue procurando sua próxima equipe.
        </p>
        {erro === "confirmacao" ? (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200"
            role="alert"
          >
            Não foi possível confirmar o e-mail. Solicite um novo link de confirmação.
          </p>
        ) : null}
        {erro === "provedor" ? (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200"
            role="alert"
          >
            Não foi possível entrar com essa rede. Verifique se o provedor está
            habilitado nas configurações de autenticação.
          </p>
        ) : null}
        {isConfigured ? (
          <AuthForm action={signIn} mode="sign-in" />
        ) : (
          <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">
            O login será habilitado quando o Supabase estiver configurado no servidor.
          </p>
        )}
      </section>
    </main>
  );
}
