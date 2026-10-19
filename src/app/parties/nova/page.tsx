import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createParty } from "@/app/parties/actions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Publicar party",
  robots: { index: false, follow: false },
};

export const instant = false;

const modes = [
  { value: "casual", label: "Casual" },
  { value: "competitive", label: "Competitivo" },
  { value: "cooperative", label: "Cooperativo" },
  { value: "ranked", label: "Ranqueado" },
];

const languages = [
  { value: "pt-BR", label: "Português" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
];

const timeZoneLabels: Record<string, string> = {
  "America/Sao_Paulo": "Brasília",
  "America/Manaus": "Manaus",
  "America/Fortaleza": "Fortaleza",
  UTC: "UTC",
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-3 text-white outline-none focus:border-violet-400";

function toLocalInputValue(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export default async function NewPartyPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  if (!getSupabaseConfig()) {
    return (
      <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#111118] p-8">
          <h1 className="text-2xl font-bold">Publicação indisponível</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Configure o Supabase para publicar uma party.
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
      .select("display_name, preferred_language, timezone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (gamesError) {
    throw gamesError;
  }
  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#111118] p-8">
          <h1 className="text-2xl font-bold">Complete seu perfil primeiro</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Para publicar uma party, primeiro escolha seu nome de jogador e
            conclua seu perfil.
          </p>
          <Link
            className="mt-6 inline-flex rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white transition hover:bg-violet-400"
            href="/perfil"
          >
            Ir para meu perfil
          </Link>
        </section>
      </main>
    );
  }

  const errorMessage =
    erro === "invalid"
      ? "Confira os dados: escolha um jogo, horário futuro e valores válidos."
      : erro === "save"
        ? "Não foi possível publicar. Confira o horário e tente novamente."
        : "";
  const timeZoneLabel =
    timeZoneLabels[profile.timezone] ?? profile.timezone;
  const requestTime = new Date().getTime();
  const minimumStart = toLocalInputValue(
    requestTime + 15 * 60 * 1000,
    profile.timezone,
  );
  const latestStart = toLocalInputValue(
    requestTime + 60 * 24 * 60 * 60 * 1000,
    profile.timezone,
  );

  return (
    <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-white/10 pb-6">
          <Link className="text-sm font-semibold text-violet-300" href="/parties">
            ← Voltar às parties
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Publicar uma party
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Compartilhe os detalhes para outros jogadores encontrarem sua equipe.
            Horário local de {timeZoneLabel}, conforme o fuso salvo no seu perfil.
          </p>
        </header>

        {errorMessage ? (
          <p
            aria-live="polite"
            className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <form
          action={createParty}
          className="mt-8 grid gap-5 rounded-3xl border border-white/10 bg-[#111118] p-6 sm:grid-cols-2 sm:p-8"
        >
          <label className="text-sm font-medium text-zinc-200" htmlFor="game">
            Jogo
            <select className={fieldClass} defaultValue="" id="game" name="game" required>
              <option disabled value="">
                Escolha um jogo
              </option>
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
              className={fieldClass}
              defaultValue="cooperative"
              id="mode"
              name="mode"
              required
            >
              {modes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-200 sm:col-span-2" htmlFor="title">
            Título
            <input
              className={fieldClass}
              id="title"
              maxLength={80}
              minLength={3}
              name="title"
              placeholder={`Party de ${profile.display_name}`}
              required
            />
          </label>
          <label className="text-sm font-medium text-zinc-200 sm:col-span-2" htmlFor="description">
            Detalhes <span className="font-normal text-zinc-500">(opcional)</span>
            <textarea
              className={`${fieldClass} min-h-24 resize-y`}
              id="description"
              maxLength={500}
              name="description"
              placeholder="Conte o que a equipe vai jogar ou combinar."
            />
          </label>
          <label className="text-sm font-medium text-zinc-200" htmlFor="startsAt">
            Horário da partida
            <input
              className={fieldClass}
              id="startsAt"
              max={latestStart}
              min={minimumStart}
              name="startsAt"
              required
              type="datetime-local"
            />
          </label>
          <label className="text-sm font-medium text-zinc-200" htmlFor="language">
            Idioma da party
            <select
              className={fieldClass}
              defaultValue={languages.some((item) => item.value === profile.preferred_language)
                ? profile.preferred_language
                : "pt-BR"}
              id="language"
              name="language"
              required
            >
              {languages.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-200 sm:col-span-2" htmlFor="maxPlayers">
            Tamanho total da equipe (incluindo você)
            <select
              className={fieldClass}
              defaultValue="4"
              id="maxPlayers"
              name="maxPlayers"
              required
            >
              {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                <option key={count} value={count}>
                  {count} jogadores
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-xl bg-violet-500 px-5 py-3.5 font-semibold text-white transition hover:bg-violet-400 sm:col-span-2"
            type="submit"
          >
            Publicar party
          </button>
        </form>
      </div>
    </main>
  );
}
