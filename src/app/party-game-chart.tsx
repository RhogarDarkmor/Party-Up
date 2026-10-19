export type PartyGameStat = {
  game_slug: string;
  game_name: string;
  party_count: number;
};

function colorForSlug(slug: string) {
  let hash = 0;
  for (const character of slug) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `hsl(${hash % 360} 76% 64%)`;
}

export function PartyGameChart({
  games,
  title = "Jogos nas minhas parties",
}: {
  games: PartyGameStat[];
  title?: string;
}) {
  const total = games.reduce((sum, game) => sum + game.party_count, 0);
  const segments = games.map((game, index) => {
    const offset = games
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.party_count, 0);
    return {
      ...game,
      color: colorForSlug(game.game_slug),
      portion: total ? (game.party_count / total) * 100 : 0,
      offset: total ? (offset / total) * 100 : 0,
    };
  });

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-[#111118] p-6 sm:p-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Distribuição das parties em que você participou, agrupadas por jogo.
      </p>

      {segments.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-zinc-300">
          Seu gráfico aparecerá aqui quando você criar uma party ou entrar em
          uma equipe.
        </p>
      ) : (
        <div className="mt-6 grid items-center gap-8 sm:grid-cols-[220px_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-[220px]">
            <svg
              aria-label={`Gráfico de ${total} participações em parties`}
              className="h-full w-full -rotate-90"
              role="img"
              viewBox="0 0 42 42"
            >
              <title>
                Parties por jogo:{" "}
                {segments
                  .map((game) => `${game.game_name}: ${game.party_count}`)
                  .join(", ")}
              </title>
              <circle
                cx="21"
                cy="21"
                fill="none"
                r="15.9155"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="7"
              />
              {segments.map((game) => (
                <circle
                  cx="21"
                  cy="21"
                  fill="none"
                  key={game.game_slug}
                  pathLength="100"
                  r="15.9155"
                  stroke={game.color}
                  strokeDasharray={`${game.portion} ${100 - game.portion}`}
                  strokeDashoffset={-game.offset}
                  strokeWidth="7"
                >
                  <title>
                    {game.game_name}: {game.party_count}{" "}
                    {game.party_count === 1 ? "party" : "parties"}
                  </title>
                </circle>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{total}</span>
              <span className="text-xs text-zinc-400">
                {total === 1 ? "party" : "parties"}
              </span>
            </div>
          </div>
          <ul aria-label="Legenda do gráfico" className="grid gap-3 sm:grid-cols-2">
            {segments.map((game) => (
              <li
                className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3"
                key={game.game_slug}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: game.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {game.game_name}
                </span>
                <span className="text-sm font-semibold text-white">
                  {game.party_count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
