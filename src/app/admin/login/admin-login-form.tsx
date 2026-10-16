"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  message?: string;
};

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      });
      const result = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setErrorMessage(result.message ?? "Não foi possível entrar.");
        return;
      }

      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch {
      setErrorMessage("Falha de conexão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="mb-2 block text-sm font-medium text-zinc-300"
          htmlFor="admin-username"
        >
          Login administrativo
        </label>
        <input
          autoComplete="username"
          className="w-full rounded-xl border border-white/10 bg-[#0b0b10] px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
          id="admin-username"
          maxLength={120}
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium text-zinc-300"
          htmlFor="admin-password"
        >
          Senha
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-xl border border-white/10 bg-[#0b0b10] px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
          id="admin-password"
          maxLength={1_024}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      {errorMessage ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Verificando..." : "Entrar no painel"}
      </button>
    </form>
  );
}
