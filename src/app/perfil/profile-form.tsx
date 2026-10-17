"use client";

import { useActionState } from "react";
import { saveProfile, saveProfileGames } from "@/app/auth/actions";
import type { AuthFormState } from "@/app/auth/actions";

type GamerProfile = {
  display_name: string;
  bio: string | null;
  timezone: string;
  preferred_language: string;
  play_style: string | null;
  communication_preference: string | null;
};

type GameOption = {
  slug: string;
  name: string;
  genre: string;
};

const initialState: AuthFormState = {};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-violet-400";

export function ProfileForm({
  profile,
  games,
  selectedGameSlugs,
}: {
  profile: GamerProfile | null;
  games: GameOption[];
  selectedGameSlugs: string[];
}) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const [gamesState, gamesFormAction, gamesPending] = useActionState(
    saveProfileGames,
    initialState,
  );

  return (
    <>
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

      <form action={gamesFormAction} className="mt-10 space-y-5 border-t border-white/10 pt-8">
        <fieldset>
          <legend className="text-lg font-semibold text-white">Jogos que você curte</legend>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Selecione até 20 jogos. Essa lista fica visível somente para você por enquanto.
          </p>
          {!profile ? (
            <p className="mt-2 text-sm text-amber-200">
              Salve primeiro os dados básicos do perfil para registrar seus jogos.
            </p>
          ) : null}
          {games.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {games.map((game) => (
                <label
                  key={game.slug}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-violet-400/40"
                >
                  <input
                    className="mt-1 accent-violet-400"
                    defaultChecked={selectedGameSlugs.includes(game.slug)}
                    name="games"
                    type="checkbox"
                    value={game.slug}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-zinc-100">
                      {game.name}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">{game.genre}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              O catálogo está vazio no momento.
            </p>
          )}
        </fieldset>

        {gamesState.error ? (
          <p aria-live="polite" className="text-sm text-rose-300" role="alert">
            {gamesState.error}
          </p>
        ) : null}

        <button
          className="w-full rounded-xl border border-violet-400/30 bg-violet-400/10 px-5 py-3.5 font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-wait disabled:opacity-60"
          disabled={gamesPending || !profile}
          type="submit"
        >
          {gamesPending ? "Salvando..." : "Salvar meus jogos"}
        </button>
      </form>
    </>
  );
}
