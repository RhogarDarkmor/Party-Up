"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/auth/actions";
import type { AuthFormState } from "@/app/auth/actions";

type GamerProfile = {
  display_name: string;
  bio: string | null;
  timezone: string;
  preferred_language: string;
  play_style: string | null;
  communication_preference: string | null;
};

const initialState: AuthFormState = {};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-violet-400";

export function ProfileForm({ profile }: { profile: GamerProfile | null }) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block text-sm font-medium text-zinc-200" htmlFor="displayName">
        Nome de jogador
        <input
          className={inputClassName}
          defaultValue={profile?.display_name ?? ""}
          id="displayName"
          maxLength={40}
          minLength={2}
          name="displayName"
          required
        />
      </label>

      <label className="block text-sm font-medium text-zinc-200" htmlFor="bio">
        Sobre você <span className="font-normal text-zinc-500">(opcional)</span>
        <textarea
          className={`${inputClassName} min-h-28 resize-y`}
          defaultValue={profile?.bio ?? ""}
          id="bio"
          maxLength={280}
          name="bio"
          placeholder="Quais jogos e estilos você curte?"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-200" htmlFor="preferredLanguage">
          Idioma
          <select
            className={inputClassName}
            defaultValue={profile?.preferred_language ?? "pt-BR"}
            id="preferredLanguage"
            name="preferredLanguage"
          >
            <option value="pt-BR">Português</option>
            <option value="en">Inglês</option>
            <option value="es">Espanhol</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-zinc-200" htmlFor="timezone">
          Fuso horário
          <select
            className={inputClassName}
            defaultValue={profile?.timezone ?? "America/Sao_Paulo"}
            id="timezone"
            name="timezone"
          >
            <option value="America/Sao_Paulo">Brasília</option>
            <option value="America/Manaus">Manaus</option>
            <option value="America/Fortaleza">Fortaleza</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-200" htmlFor="playStyle">
          Estilo de jogo
          <select
            className={inputClassName}
            defaultValue={profile?.play_style ?? ""}
            id="playStyle"
            name="playStyle"
          >
            <option value="">Escolha depois</option>
            <option value="casual">Casual</option>
            <option value="competitive">Competitivo</option>
            <option value="cooperative">Cooperativo</option>
            <option value="social">Social</option>
          </select>
        </label>

        <label
          className="block text-sm font-medium text-zinc-200"
          htmlFor="communicationPreference"
        >
          Comunicação
          <select
            className={inputClassName}
            defaultValue={profile?.communication_preference ?? ""}
            id="communicationPreference"
            name="communicationPreference"
          >
            <option value="">Escolha depois</option>
            <option value="voice">Voz</option>
            <option value="text">Texto</option>
            <option value="any">Tanto faz</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p aria-live="polite" className="text-sm text-rose-300" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-violet-500 px-5 py-3.5 font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Salvando..." : "Salvar perfil"}
      </button>
    </form>
  );
}
