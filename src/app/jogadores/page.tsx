import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Encontrar jogadores",
  robots: { index: false, follow: false },
};

export const instant = false;

const languages = [
  { value: "pt-BR", label: "Português" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
];

const playStyles = [
  { value: "casual", label: "Casual" },
  { value: "competitive", label: "Competitivo" },
  { value: "cooperative", label: "Cooperativo" },
  { value: "social", label: "Social" },
];

type DiscoveryPlayer = {
  player_id: string;
  display_name: string;
  bio: string | null;
  timezone: string;
  preferred_language: string;
  play_style: string | null;
  communication_preference: string | null;
  avatar_path: string | null;
  platform_slugs: string[];
  game_names: string[];
};

function getSingleSearchParam(
  params: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = params[name];
  return typeof value === "string" ? value : "";
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const gameSlug = getSingleSearchParam(params, "game");
  const platformSlug = getSingleSearchParam(params, "platform");
  const language = getSingleSearchParam(params, "language");
  const playStyle = getSingleSearchParam(params, "style");

  if (!getSupabaseConfig()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b10] px-6 py-12 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111118] p-8">
          <h1 className="text-2xl font-bold">Busca indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Configure o Supabase para procurar jogadores.
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
    if (userError.name === "AuthSessionMissingError") {
      redirect("/entrar");
    }
    throw userError;
  }
  if (!user) {
    redirect("/entrar");
  }

  const [
    { data: games, error: gamesError },
    { data: platforms, error: platformsError },
  ] = await Promise.all([
    supabase
      .from("game_catalog")
      .select("slug, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("platform_catalog")
      .select("slug, name, badge")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (gamesError) {
    throw gamesError;
  }
  if (platformsError) {
    throw platformsError;
  }

  const validLanguage = languages.some((option) => option.value === language);
  const validPlayStyle = playStyles.some((option) => option.value === playStyle);
  const hasSearchFilter = Boolean(gameSlug || platformSlug);
  const validGame = (games ?? []).some((game) => game.slug === gameSlug);
  const validPlatform = (platforms ?? []).some(
    (platform) => platform.slug === platformSlug,
  );
  const invalidSearch =
    (gameSlug && !validGame) ||
    (platformSlug && !validPlatform) ||
    (language && !validLanguage) ||
    (playStyle && !validPlayStyle);

  let players: DiscoveryPlayer[] = [];
  let searchError = "";
  if (invalidSearch) {
    searchError = "Algum filtro enviado não é válido. Revise as opções e tente novamente.";
  } else if (!hasSearchFilter) {
    searchError = "Escolha ao menos um jogo ou plataforma para iniciar a busca.";
  } else {
    const { data, error } = await supabase.rpc("discover_gamers", {
      p_game_slug: gameSlug || null,
      p_platform_slug: platformSlug || null,
      p_preferred_language: language || null,
      p_play_style: playStyle || null,
      p_limit: 30,
    });

    if (error) {
      console.error("PartyUp player discovery failed:", error.code ?? "unknown");
      throw error;
    }
    players = data ?? [];
  }

  const playersWithAvatar = await Promise.all(
    players.map(async (player) => {
      if (!player.avatar_path) {
        return { ...player, avatarUrl: null };
      }

      const { data, error } = await supabase.storage
        .from("partyup-avatars")
        .createSignedUrl(player.avatar_path, 60);
      if (error) {
        throw error;
      }

      return { ...player, avatarUrl: data.signedUrl };
    }),
  );

  const platformsBySlug = new Map(
    (platforms ?? []).map((platform) => [platform.slug, platform]),
  );

  return (
    <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link className="text-sm font-semibold text-violet-300" href="/">
              PartyUp
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Encontrar jogadores
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Encontre pessoas por jogo e plataforma. Só aparecem perfis que
              escolheram participar da descoberta.
            </p>
          </div>
          <Link
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            href="/perfil"
          >
            Meu perfil
          </Link>
        </header>

        <form
          action="/jogadores"
          className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-[#111118] p-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-sm font-medium text-zinc-200" htmlFor="game">
            Jogo
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3 text-white outline-none focus:border-violet-400"
              defaultValue={gameSlug}
              id="game"
              name="game"
            >
              <option value="">Qualquer jogo</option>
              {(games ?? []).map((game) => (
                <option key={game.slug} value={game.slug}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-200" htmlFor="platform">
            Plataforma
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3 text-white outline-none focus:border-violet-400"
              defaultValue={platformSlug}
              id="platform"
              name="platform"
            >
              <option value="">Qualquer plataforma</option>
              {(platforms ?? []).map((platform) => (
                <option key={platform.slug} value={platform.slug}>
                  {platform.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-200" htmlFor="language">
            Idioma
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3 text-white outline-none focus:border-violet-400"
              defaultValue={language}
              id="language"
              name="language"
            >
              <option value="">Qualquer idioma</option>
              {languages.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-200" htmlFor="style">
            Estilo
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3 text-white outline-none focus:border-violet-400"
              defaultValue={playStyle}
              id="style"
              name="style"
            >
              <option value="">Qualquer estilo</option>
              {playStyles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-xl bg-violet-500 px-5 py-3.5 font-semibold text-white transition hover:bg-violet-400 sm:col-span-2 lg:col-span-4"
            type="submit"
          >
            Buscar jogadores
          </button>
        </form>

        {searchError ? (
          <p
            aria-live="polite"
            className={`mt-5 rounded-xl border p-4 text-sm ${
              invalidSearch
                ? "border-rose-300/20 bg-rose-300/5 text-rose-200"
                : "border-white/10 bg-white/[0.03] text-zinc-300"
            }`}
            role={invalidSearch ? "alert" : "status"}
          >
            {searchError}
          </p>
        ) : null}

        {hasSearchFilter && !invalidSearch ? (
          playersWithAvatar.length > 0 ? (
            <section
              aria-label="Jogadores encontrados"
              className="mt-8 grid gap-4 md:grid-cols-2"
            >
              {playersWithAvatar.map((player) => (
                <article
                  className="rounded-3xl border border-white/10 bg-[#111118] p-6"
                  key={player.player_id}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-400/10 text-xl font-bold text-violet-200">
                      {player.avatarUrl ? (
                        <Image
                          alt={`Foto de ${player.display_name}`}
                          className="h-full w-full object-cover"
                          height={64}
                          unoptimized
                          src={player.avatarUrl}
                          width={64}
                        />
                      ) : (
                        <span aria-hidden="true">
                          {player.display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {player.display_name}
                      </h2>
                      <p className="mt-1 text-xs text-zinc-400">
                        {player.preferred_language} ·{" "}
                        {player.play_style ?? "Estilo não informado"}
                      </p>
                    </div>
                  </div>

                  {player.bio ? (
                    <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                      {player.bio}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {player.platform_slugs.map((slug) => {
                      const platform = platformsBySlug.get(slug);
                      if (!platform) {
                        return null;
                      }
                      return (
                        <span
                          className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3 py-1.5 text-xs text-violet-100"
                          key={slug}
                        >
                          <span
                            aria-hidden="true"
                            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-400/15 px-1 text-[9px] font-bold"
                          >
                            {platform.badge}
                          </span>
                          {platform.name}
                        </span>
                      );
                    })}
                  </div>

                  {player.game_names.length > 0 ? (
                    <p className="mt-4 text-xs leading-5 text-zinc-400">
                      Joga: {player.game_names.join(", ")}
                    </p>
                  ) : null}
                </article>
              ))}
            </section>
          ) : (
            <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-300">
              Ainda não encontramos jogadores com esses filtros. Novos perfis
              aparecerão aqui quando as pessoas optarem por participar da descoberta.
            </p>
          )
        ) : null}
      </div>
    </main>
  );
}
