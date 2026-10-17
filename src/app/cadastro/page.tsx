import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/app/auth/auth-form";
import { signUp } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b10] px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] p-7 shadow-2xl shadow-black/30 sm:p-9">
        <Link className="text-sm font-semibold text-violet-300" href="/">
          ← Voltar ao PartyUp
        </Link>
        <p className="mt-8 text-sm font-medium text-violet-300">Sua próxima equipe começa aqui</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Crie sua conta</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Cadastre-se para criar seu perfil gamer e encontrar jogadores compatíveis.
        </p>
        {erro === "provedor" ? (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200"
            role="alert"
          >
            Não foi possível criar a conta com essa rede. Verifique se o provedor
            está habilitado nas configurações de autenticação.
          </p>
        ) : null}
        <AuthForm action={signUp} mode="sign-up" />
      </section>
    </main>
  );
}
