import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { PartyGameChart, type PartyGameStat } from "@/app/party-game-chart";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Perfil de jogador",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function GamerPublicProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)) {
    notFound();
  }

  if (!getSupabaseConfig()) {
    notFound();
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
    { data: profileRows, error: profileError },
    { data: partyGameStats, error: partyGameStatsError },
    { data: platformCatalog, error: platformsError },
  ] = await Promise.all([
    supabase.rpc("get_discoverable_gamer_profile", {
      p_player_id: playerId,
    }),
    supabase.rpc("get_party_game_activity", {
      p_user_id: playerId,
    }),
    supabase
      .from("platform_catalog")
      .select("slug, name, badge")
      .eq("is_active", true),
  ]);

  if (profileError) {
    throw profileError;
  }
  if (partyGameStatsError) {
    if (partyGameStatsError.code === "42501") {
      notFound();
    }
    throw partyGameStatsError;
  }
  if (platformsError) {
    throw platformsError;
  }

  const profile = profileRows?.[0];
  if (!profile) {
    notFound();
  }

  const totalParties = (partyGameStats ?? []).reduce(
    (sum: number, game: PartyGameStat) => sum + game.party_count,
    0,
  );
  const isVeteran = totalParties >= 5;

  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data, error } = await supabase.storage
      .from("partyup-avatars")
      .createSignedUrl(profile.avatar_path, 60);
    if (error) {
      throw error;
    }
    avatarUrl = data.signedUrl;
  }

  const platformsBySlug = new Map(
    (platformCatalog ?? []).map((platform) => [platform.slug, platform]),
  );

  return (
    <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link className="text-sm font-semibold text-violet-300" href="/parties">
              ← Voltar às parties
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Perfil de jogador
            </h1>
          </div>
          <Link
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            href="/perfil"
          >
            Meu perfil
          </Link>
        </header>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#111118] p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-400/10 text-3xl font-bold text-violet-200">
              {avatarUrl ? (
                <Image
                  alt={`Foto de ${profile.display_name}`}
                  className="h-full w-full object-cover"
                  height={96}
                  unoptimized
                  src={avatarUrl}
                  width={96}
                />
              ) : (
                <span aria-hidden="true">
                  {profile.display_name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold">{profile.display_name}</h2>
                {isVeteran ? (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-500/20">
                    VETERANO
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {profile.preferred_language}
                {profile.play_style ? ` · ${profile.play_style}` : ""}
                {profile.communication_preference
                  ? ` · ${profile.communication_preference}`
                  : ""}
              </p>
            </div>
          </div>

          {profile.bio ? (
            <p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
              {profile.bio}
            </p>
          ) : null}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-200">Plataformas</h3>
            {profile.platform_slugs.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.platform_slugs.map((slug: string) => {
                  const platform = platformsBySlug.get(slug);
                  return platform ? (
                    <li
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
                    </li>
                  ) : null;
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Nenhuma plataforma informada.</p>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-200">Jogos do perfil</h3>
            {profile.game_names.length ? (
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {profile.game_names.join(", ")}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Nenhum jogo informado.</p>
            )}
          </div>
        </section>

        <PartyGameChart
          games={partyGameStats ?? []}
          title={`Parties de ${profile.display_name}`}
        />
      </div>
    </main>
  );
}
