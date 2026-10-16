import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = {
  title: "Acesso restrito",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b10] px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] p-8 shadow-2xl shadow-black/40 sm:p-10">
        <Link
          className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-300 transition hover:text-white"
          href="/"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 text-base font-black text-white">
            P
          </span>
          PartyUp
        </Link>
        <p className="mt-9 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
          Área privada
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Painel do projeto
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Entre com as credenciais administrativas para acompanhar o avanço do
          PartyUp.
        </p>
        <AdminLoginForm />
        <p className="mt-6 text-center text-xs text-zinc-600">
          Acesso monitorado e restrito a administradores.
        </p>
      </section>
    </main>
  );
}
