import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Encontre sua party",
    description:
      "Descubra jogadores que procuram o mesmo jogo, modo e horário que você.",
  },
  {
    number: "02",
    title: "Combine de verdade",
    description:
      "Veja plataforma, idioma e estilo de jogo antes de enviar um convite.",
  },
  {
    number: "03",
    title: "Jogue junto de novo",
    description:
      "Crie equipes temporárias e reencontre pessoas com quem foi bom jogar.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0b10] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(127,70,255,0.24),transparent_66%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 sm:px-10">
        <header className="flex h-20 items-center justify-between border-b border-white/10">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="PartyUp início"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-lg font-black text-white shadow-lg shadow-violet-950/40">
              P
            </span>
            <span className="text-lg font-bold tracking-tight">partyup</span>
          </Link>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-400">
            MVP em desenvolvimento
          </span>
          <nav aria-label="Conta" className="ml-auto flex items-center gap-3">
            <Link
              className="hidden text-sm font-medium text-zinc-300 transition hover:text-white sm:inline"
              href="/jogadores"
            >
              Jogadores
            </Link>
            <Link
              className="text-sm font-medium text-zinc-300 transition hover:text-white"
              href="/entrar"
            >
              Entrar
            </Link>
            <Link
              className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
              href="/cadastro"
            >
              Criar conta
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-14 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="max-w-2xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-sm font-medium text-violet-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Sua próxima equipe começa aqui
            </p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Menos fila solo.
              <span className="mt-2 block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-emerald-200 bg-clip-text text-transparent">
                Mais jogo em equipe.
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
              O PartyUp conecta você a jogadores compatíveis com seu jogo,
              plataforma, idioma e horário — para a próxima partida valer mais.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3.5 font-semibold text-white transition hover:bg-violet-400"
                href="/cadastro"
              >
                Criar meu perfil
                <span aria-hidden="true">↗</span>
              </Link>
              <Link
                className="text-sm font-medium text-zinc-300 transition hover:text-white"
                href="/jogadores"
              >
                Encontrar jogadores
              </Link>
            </div>
            <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-500">
              <span className="flex items-center gap-2">
                <span className="text-emerald-300">✓</span> PC, PlayStation,
                Xbox e mobile
              </span>
              <span className="flex items-center gap-2">
                <span className="text-emerald-300">✓</span> Compatibilidade
                explicável
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-8 rounded-[3rem] bg-violet-500/10 blur-3xl" />
            <div className="relative rounded-3xl border border-white/10 bg-[#111118]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-semibold">Procurando equipe</p>
                  <p className="mt-1 text-xs text-zinc-500">Exemplo de party</p>
                </div>
                <span className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  3 vagas
                </span>
              </div>
              <div className="mt-5 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-transparent p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                      Exemplo de partida
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Missão cooperativa</h2>
                  </div>
                  <span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-300">
                    Cross-play
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-xs text-zinc-500">Plataforma</p>
                    <p className="mt-1 text-sm font-medium">PC + console</p>
                  </div>
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-xs text-zinc-500">Comunicação</p>
                    <p className="mt-1 text-sm font-medium">Voz opcional</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {["A", "M", "L"].map((initial, index) => (
                      <span
                        key={initial}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#17151f] text-xs font-bold ${
                          index === 0
                            ? "bg-violet-400 text-violet-950"
                            : index === 1
                              ? "bg-fuchsia-300 text-fuchsia-950"
                              : "bg-emerald-300 text-emerald-950"
                        }`}
                      >
                        {initial}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-zinc-400">
                    Perfis ilustrativos
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
                <span className="text-sm text-zinc-400">
                  Compatibilidade explicada
                </span>
                <span className="text-sm font-semibold text-emerald-300">
                  Jogo · idioma · horário
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-white/10 py-10 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
            >
              <span className="text-xs font-bold tracking-[0.2em] text-violet-300">
                {feature.number}
              </span>
              <h2 className="mt-3 text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {feature.description}
              </p>
            </article>
          ))}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6 text-xs text-zinc-600">
          <span>PartyUp · Feito para encontrar sua próxima equipe.</span>
          <span>Uma experiência social gamer em desenvolvimento.</span>
        </footer>
      </div>
    </main>
  );
}
