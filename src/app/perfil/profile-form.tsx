"use client";

import { useState, type ChangeEvent } from "react";
import { useActionState } from "react";
import Image from "next/image";
import { saveProfile, saveProfileGames } from "@/app/auth/actions";
import type { AuthFormState } from "@/app/auth/actions";
import { createBrowserClient } from "@/lib/supabase/browser";

type GamerProfile = {
  display_name: string;
  bio: string | null;
  timezone: string;
  preferred_language: string;
  play_style: string | null;
  communication_preference: string | null;
  avatar_path: string | null;
  show_in_discovery: boolean;
  privacy_settings: { show_bio?: boolean };
};

type GameOption = {
  slug: string;
  name: string;
  genre: string;
};

type PlatformOption = {
  slug: string;
  name: string;
  badge: string;
};

const initialState: AuthFormState = {};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-violet-400";

export function ProfileForm({
  profile,
  games,
  selectedGameSlugs,
  platforms,
  selectedPlatformSlugs,
  avatarUrl,
}: {
  profile: GamerProfile | null;
  games: GameOption[];
  selectedGameSlugs: string[];
  platforms: PlatformOption[];
  selectedPlatformSlugs: string[];
  avatarUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const [gamesState, gamesFormAction, gamesPending] = useActionState(
    saveProfileGames,
    initialState,
  );
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_path ?? "");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [avatarError, setAvatarError] = useState("");
  const [avatarPending, setAvatarPending] = useState(false);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setAvatarError("");
    if (!file) {
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setAvatarError("Escolha uma foto JPG, PNG ou WebP de até 5 MB.");
      return;
    }

    const supabase = createBrowserClient();
    if (!supabase) {
      setAvatarError("O armazenamento de fotos ainda não está configurado.");
      return;
    }

    setAvatarPending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        console.error("PartyUp avatar session lookup failed:", userError.code ?? "unknown");
        setAvatarError("Sua sessão expirou. Entre novamente para enviar a foto.");
        return;
      }
      if (!user) {
        setAvatarError("Entre novamente para enviar a foto.");
        return;
      }

      const path = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("partyup-avatars")
        .upload(path, file, {
          cacheControl: "60",
          contentType: file.type,
          upsert: true,
        });
      if (uploadError) {
        console.error("PartyUp avatar upload failed:", uploadError.name);
        setAvatarError("Não foi possível enviar a foto. Tente novamente.");
        return;
      }

      const { data, error: urlError } = await supabase.storage
        .from("partyup-avatars")
        .createSignedUrl(path, 60);
      if (urlError) {
        console.error("PartyUp avatar preview failed:", urlError.name);
        setAvatarError("A foto foi enviada, mas não foi possível carregá-la.");
        return;
      }

      setAvatarPath(path);
      setCurrentAvatarUrl(data.signedUrl);
    } catch (error) {
      console.error("PartyUp avatar upload request failed:", error);
      setAvatarError("Não foi possível enviar a foto. Verifique sua conexão e tente novamente.");
    } finally {
      setAvatarPending(false);
    }
  }

  return (
    <>
      <form action={formAction} className="mt-8 space-y-5">
        <input name="avatarPath" type="hidden" value={avatarPath} />

        <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-400/10 text-3xl font-bold text-violet-200">
            {currentAvatarUrl ? (
              <Image
                alt="Foto atual do perfil"
                className="h-full w-full object-cover"
                height={96}
                unoptimized
                src={currentAvatarUrl}
                width={96}
              />
            ) : (
              <span aria-hidden="true">P</span>
            )}
          </div>
          <div>
            <label
              className="inline-flex cursor-pointer rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/5"
              htmlFor="avatar"
            >
              {avatarPending ? "Enviando..." : "Escolher foto"}
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={avatarPending}
                id="avatar"
                onChange={uploadAvatar}
                type="file"
              />
            </label>
            <p className="mt-2 text-xs text-zinc-500">JPG, PNG ou WebP; até 5 MB.</p>
            {avatarError ? (
              <p aria-live="polite" className="mt-2 text-sm text-rose-300" role="alert">
                {avatarError}
              </p>
            ) : null}
          </div>
        </div>

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

        <fieldset>
          <legend className="text-sm font-medium text-zinc-200">
            Plataformas em que você joga
          </legend>
          <p className="mt-2 text-xs text-zinc-500">Escolha até 5 plataformas.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {platforms.map((platform) => (
              <label
                key={platform.slug}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 transition hover:border-violet-400/40"
              >
                <input
                  className="accent-violet-400"
                  defaultChecked={selectedPlatformSlugs.includes(platform.slug)}
                  name="platforms"
                  type="checkbox"
                  value={platform.slug}
                />
                <span
                  aria-hidden="true"
                  className="flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-400/15 px-1 text-[10px] font-bold text-violet-200"
                >
                  {platform.badge}
                </span>
                {platform.name}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
          <input
            className="mt-1 accent-emerald-400"
            defaultChecked={profile?.show_in_discovery ?? false}
            name="showInDiscovery"
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-semibold text-zinc-100">
              Quero aparecer na descoberta de jogadores
            </span>
            <span className="mt-1 block text-xs leading-5 text-zinc-400">
              Seu nome gamer, foto, plataformas, jogos e gráfico de participação
              em parties serão mostrados a outros jogadores conectados. Você pode
              desativar isso quando quiser.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <input
            className="mt-1 accent-violet-400"
            defaultChecked={profile?.privacy_settings?.show_bio ?? false}
            name="showBioInDiscovery"
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-semibold text-zinc-100">
              Compartilhar minha bio na descoberta
            </span>
            <span className="mt-1 block text-xs leading-5 text-zinc-400">
              Sua bio só é exibida se você também habilitar sua participação na
              descoberta. Esta opção começa desativada.
            </span>
          </span>
        </label>

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
