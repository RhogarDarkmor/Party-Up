import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  cancelParty,
  joinParty,
  leaveParty,
} from "@/app/parties/actions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Parties abertas",
  robots: { index: false, follow: false },
};

export const instant = false;

const languages = [
  { value: "pt-BR", label: "Português" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
];

const gameModes = [
  { value: "casual", label: "Casual" },
  { value: "competitive", label: "Competitivo" },
  { value: "cooperative", label: "Cooperativo" },
  { value: "ranked", label: "Ranqueado" },
];

const timeBands = [
  { value: "morning", label: "Manhã · 6h–12h" },
  { value: "afternoon", label: "Tarde · 12h–18h" },
  { value: "evening", label: "Noite · 18h–0h" },
  { value: "night", label: "Madrugada · 0h–6h" },
];

type PartyPost = {
  party_id: string;
  title: string;
  description: string | null;
  contact_info: string | null;
  game_slug: string;
  game_name: string;
  game_genre: string;
  game_mode: string;
  starts_at: string;
  language: string;
  max_players: number;
  active_players: number;
  available_spots: number;
  organizer_id: string;
  organizer_name: string;
  organizer_avatar_path: string | null;
  organizer_is_discoverable: boolean;
  viewer_is_member: boolean;
  organizer_avatar_url: string | null;
};
type PartyFeedRow = Omit<PartyPost, "organizer_avatar_url">;

function singleValue(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function noticeFor(
  params: Record<string, string | string[] | undefined>,
) {
  const notices: Record<string, { text: string; tone: "success" | "error" }> = {
    criada: { text: "Sua party foi publicada no feed.", tone: "success" },
    entrou: { text: "Você entrou na party.", tone: "success" },
    saiu: { text: "Você saiu da party.", tone: "success" },
    cancelada: { text: "A party foi cancelada.", tone: "success" },
  };
  const errors: Record<string, string> = {
    invalid: "Os filtros enviados não são válidos.",
    join: "Não foi possível entrar. A party pode estar cheia ou encerrada.",
    leave: "Não foi possível sair desta party.",
    cancel: "Não foi possível cancelar esta party.",
  };
  const success = Object.keys(notices).find((key) => singleValue(params, key) === "1");
  if (success) {
    return notices[success];
  }
  const error = singleValue(params, "erro");
  return error && errors[error]
    ? { text: errors[error], tone: "error" as const }
    : null;
}

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const gameSlug = singleValue(params, "game");
  const gameMode = singleValue(params, "mode");
  const timeBand = singleValue(params, "time");
  const language = singleValue(params, "language");

  if (!getSupabaseConfig()) {
    return (
      <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#111118] p-8">
          <h1 className="text-2xl font-bold">Feed de parties indisponível</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Configure o Supabase para publicar e encontrar parties.
          </p>
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
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase
      .from("game_catalog")
      .select("slug, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("gamer_profiles")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (gamesError) {
    throw gamesError;
  }
  if (profileError) {
    throw profileError;
  }

  const invalidFilters =
    (gameSlug && !(games ?? []).some((game) => game.slug === gameSlug)) ||
    (gameMode && !gameModes.some((option) => option.value === gameMode)) ||
    (timeBand && !timeBands.some((option) => option.value === timeBand)) ||
    (language && !languages.some((option) => option.value === language));

  let parties: PartyPost[] = [];
  if (!invalidFilters) {
    const { data, error } = await supabase.rpc("list_open_parties", {
      p_game_slug: gameSlug || null,
      p_game_mode: gameMode || null,
      p_time_band: timeBand || null,
      p_language: language || null,
      p_limit: 50,
    });
    if (error) {
      console.error("PartyUp party feed failed:", error.code ?? "unknown");
      throw error;
    }

    const feedRows: PartyFeedRow[] = data ?? [];
    parties = await Promise.all(
      feedRows.map(async (party) => {
        if (!party.organizer_avatar_path || !party.organizer_is_discoverable) {
          return { ...party, organizer_avatar_url: null };
        }
        const { data: signedAvatar, error: avatarError } = await supabase.storage
          .from("partyup-avatars")
          .createSignedUrl(party.organizer_avatar_path, 60);
        if (avatarError) {
          throw avatarError;
        }
        return {
          ...party,
          organizer_avatar_url: signedAvatar.signedUrl,
        };
      }),
    );
  }

  const timezone = profile?.timezone ?? "UTC";
  const notice = noticeFor(params);
  const languageLabels = new Map(languages.map((item) => [item.value, item.label]));
  const modeLabels = new Map(gameModes.map((item) => [item.value, item.label]));

  return (
    <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link className="text-sm font-semibold text-violet-300" href="/">
              PartyUp
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Parties com vagas
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Encontre uma equipe no seu jogo, horário e idioma.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              href="/amizades"
            >
              Amizades
            </Link>
            <Link
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              href="/perfil"
            >
              Meu perfil
            </Link>
            <Link
              className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
              href="/parties/nova"
            >
              Publicar party
            </Link>
          </div>
        </header>

        {notice ? (
          <p
            aria-live="polite"
            className={`mt-6 rounded-xl border p-4 text-sm ${
              notice.tone === "success"
                ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200"
                : "border-rose-300/20 bg-rose-300/5 text-rose-200"
            }`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.text}
          </p>
        ) : null}

        <form
          action="/parties"
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
              <option value="">Todos os jogos</option>
              {(games ?? []).map((game) => (
                <option key={game.slug} value={game.slug}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-200" htmlFor="mode">
            Modo de jogo
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3 text-white outline-none focus:border-violet-400"
              defaultValue={gameMode}
              id="mode"
              name="mode"
            >
              <option value="">Todos os modos</option>
              {gameModes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-200" htmlFor="time">
            Horário
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3 text-white outline-none focus:border-violet-400"
              defaultValue={timeBand}
              id="time"
              name="time"
            >
              <option value="">Qualquer horário</option>
              {timeBands.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
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
              <option value="">Todos os idiomas</option>
              {languages.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-4">
            <button
              className="rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white transition hover:bg-violet-400"
              type="submit"
            >
              Filtrar parties
            </button>
            <Link
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
              href="/parties"
            >
              Limpar filtros
            </Link>
          </div>
        </form>

        {invalidFilters ? (
          <p className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200" role="alert">
            Um dos filtros informados não é válido. Escolha uma opção da lista.
          </p>
        ) : parties.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-[#111118] p-8 text-center">
            <h2 className="text-xl font-semibold">Nenhuma party com vagas por aqui</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Tente outros filtros ou publique uma party para encontrar jogadores.
            </p>
            <Link
              className="mt-5 inline-flex rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white transition hover:bg-violet-400"
              href="/parties/nova"
            >
              Publicar uma party
            </Link>
          </section>
        ) : (
          <section aria-label="Parties abertas" className="mt-8 grid gap-4 lg:grid-cols-2">
            {parties.map((party) => {
              const modeLabel = modeLabels.get(party.game_mode) ?? party.game_mode;
              const languageLabel = languageLabels.get(party.language) ?? party.language;
              return (
                <article
                  className="rounded-3xl border border-white/10 bg-[#111118] p-6"
                  key={party.party_id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                        {party.game_name} · {party.game_genre}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">{party.title}</h2>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                      {party.available_spots} {party.available_spots === 1 ? "vaga" : "vagas"}
                    </span>
                  </div>

                  {party.description ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                      {party.description}
                    </p>
                  ) : null}

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <p className="rounded-xl bg-white/[0.04] p-3 text-zinc-300">
                      <span className="block text-xs text-zinc-500">Modo</span>
                      <span className="mt-1 block">{modeLabel}</span>
                    </p>
                    <p className="rounded-xl bg-white/[0.04] p-3 text-zinc-300">
                      <span className="block text-xs text-zinc-500">Quando</span>
                      <time className="mt-1 block" dateTime={party.starts_at}>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: timezone,
                        }).format(new Date(party.starts_at))}
                      </time>
                    </p>
                    <p className="rounded-xl bg-white/[0.04] p-3 text-zinc-300">
                      <span className="block text-xs text-zinc-500">Idioma</span>
                      <span className="mt-1 block">{languageLabel}</span>
                    </p>
                    <p className="rounded-xl bg-white/[0.04] p-3 text-zinc-300">
                      <span className="block text-xs text-zinc-500">Jogadores</span>
                      <span className="mt-1 block">
                        {party.active_players}/{party.max_players}
                      </span>
                    </p>
                  </div>

                  {party.contact_info && party.viewer_is_member ? (
                    <div className="mt-5 rounded-xl border border-violet-300/20 bg-violet-300/5 p-4 text-sm text-violet-200">
                      <span className="block text-xs text-violet-400">Contato da Party</span>
                      <p className="mt-1 font-mono">{party.contact_info}</p>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-400/10 text-sm font-bold text-violet-200">
                        {party.organizer_avatar_url ? (
                          <Image
                            alt=""
                            className="h-full w-full object-cover"
                            height={40}
                            unoptimized
                            src={party.organizer_avatar_url}
                            width={40}
                          />
                        ) : (
                          party.organizer_name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="truncate text-sm">
                        <span className="text-xs text-zinc-500">Organizada por</span>
                        <div className="truncate font-medium text-zinc-200">
                          {party.organizer_is_discoverable ? (
                            <Link
                              className="transition hover:text-violet-200"
                              href={`/jogadores/${party.organizer_id}`}
                            >
                              {party.organizer_name}
                            </Link>
                          ) : (
                            party.organizer_name
                          )}
                        </div>
                      </div>
                    </div>
                    {party.organizer_id === user.id ? (
                      <form action={cancelParty}>
                        <input name="partyId" type="hidden" value={party.party_id} />
                        <button
                          className="rounded-lg border border-rose-300/20 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-300/10"
                          type="submit"
                        >
                          Cancelar party
                        </button>
                      </form>
                    ) : party.viewer_is_member ? (
                      <form action={leaveParty}>
                        <input name="partyId" type="hidden" value={party.party_id} />
                        <button
                          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
                          type="submit"
                        >
                          Sair da party
                        </button>
                      </form>
                    ) : (
                      <form action={joinParty}>
                        <input name="partyId" type="hidden" value={party.party_id} />
                        <button
                          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
                          type="submit"
                        >
                          Entrar na party
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
