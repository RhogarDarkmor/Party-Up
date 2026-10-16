"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "./actions";

type AuthFormProps = {
  action: (
    previousState: AuthFormState,
    formData: FormData,
  ) => Promise<AuthFormState>;
  mode: "sign-in" | "sign-up";
};

const initialState: AuthFormState = {};

export function AuthForm({ action, mode }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignUp = mode === "sign-up";

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block text-sm font-medium text-zinc-200" htmlFor="email">
        E-mail
        <input
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400"
          id="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-200" htmlFor="password">
        Senha
        <input
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400"
          id="password"
          minLength={isSignUp ? 10 : undefined}
          name="password"
          required
          type="password"
        />
        {isSignUp ? (
          <span className="mt-2 block text-xs text-zinc-500">
            Use pelo menos 10 caracteres.
          </span>
        ) : null}
      </label>

      {state.error ? (
        <p aria-live="polite" className="text-sm text-rose-300" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p aria-live="polite" className="text-sm text-emerald-300" role="status">
          {state.success}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-violet-500 px-5 py-3.5 font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Aguarde..."
          : isSignUp
            ? "Criar conta"
            : "Entrar"}
      </button>

      <p className="text-center text-sm text-zinc-400">
        {isSignUp ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
        <Link
          className="font-medium text-violet-300 hover:text-violet-200"
          href={isSignUp ? "/entrar" : "/cadastro"}
        >
          {isSignUp ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </form>
  );
}
