import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { respondToFriendRequest } from "@/app/amizades/actions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Amizades",
  robots: { index: false, follow: false },
};

export const instant = false;

type Friendship = {
  player_id: string;
  display_name: string;
  request_status: "pending" | "accepted";
  requester_id: string;
  updated_at: string;
  is_discoverable: boolean;
};

const notices: Record<string, string> = {
  aceito: "Pedido aceito. Agora vocês são amigos!",
  recusado: "Pedido de amizade recusado.",
  erro: "Não foi possível atualizar esse pedido. Talvez ele já tenha sido respondido.",
};

export default async function FriendshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ amizade?: string }>;
}) {
  const { amizade } = await searchParams;
  if (!getSupabaseConfig()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b10] px-6 py-12 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111118] p-8">
          <h1 className="text-2xl font-bold">Amizades indisponíveis</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Configure o Supabase para gerenciar pedidos de amizade.
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

  const { data, error } = await supabase.rpc("list_friend_requests");
  if (error) {
    throw error;
  }
  const friendships = (data ?? []) as Friendship[];
  const pendingCount = friendships.filter(
    (friendship) => friendship.request_status === "pending",
  ).length;

  return (
    <main className="min-h-screen bg-[#0b0b10] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link className="text-sm font-semibold text-violet-300" href="/">
              PartyUp
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Amizades</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {pendingCount
                ? `${pendingCount} pedido${pendingCount === 1 ? "" : "s"} aguardando sua resposta.`
                : "Seus pedidos e amizades em um só lugar."}
            </p>
          </div>
          <nav aria-label="Navegação da conta" className="flex flex-wrap gap-3">
            <Link
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              href="/jogadores"
            >
              Encontrar jogadores
            </Link>
            <Link
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              href="/perfil"
            >
              Meu perfil
            </Link>
          </nav>
        </header>

        {amizade && notices[amizade] ? (
          <p
            aria-live="polite"
            className={`mt-6 rounded-xl border p-4 text-sm ${
              amizade === "erro"
                ? "border-rose-300/20 bg-rose-300/5 text-rose-200"
                : "border-emerald-300/20 bg-emerald-300/5 text-emerald-200"
            }`}
            role={amizade === "erro" ? "alert" : "status"}
          >
            {notices[amizade]}
          </p>
        ) : null}

        {friendships.length ? (
          <section aria-label="Pedidos e amizades" className="mt-8 space-y-4">
            {friendships.map((friendship) => {
              const incoming =
                friendship.request_status === "pending" &&
                friendship.requester_id !== user.id;
              const accepted = friendship.request_status === "accepted";

              return (
                <article
                  className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-white/10 bg-[#111118] p-5 sm:p-6"
                  key={friendship.player_id}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      aria-hidden="true"
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/10 text-xl font-bold text-violet-200"
                    >
                      {friendship.display_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">
                        {friendship.is_discoverable ? (
                          <Link
                            className="transition hover:text-violet-200"
                            href={`/jogadores/${friendship.player_id}`}
                          >
                            {friendship.display_name}
                          </Link>
                        ) : (
                          friendship.display_name
                        )}
                      </h2>
                      <p
                        className={`mt-1 text-sm ${
                          accepted ? "text-emerald-300" : incoming ? "text-amber-200" : "text-zinc-400"
                        }`}
                      >
                        {accepted
                          ? "Vocês são amigos"
                          : incoming
                            ? "Enviou um pedido de amizade"
                            : "Pedido enviado · aguardando resposta"}
                      </p>
                    </div>
                  </div>

                  {incoming ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={respondToFriendRequest}>
                        <input name="playerId" type="hidden" value={friendship.player_id} />
                        <input name="response" type="hidden" value="aceitar" />
                        <button
                          className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
                          type="submit"
                        >
                          Aceitar
                        </button>
                      </form>
                      <form action={respondToFriendRequest}>
                        <input name="playerId" type="hidden" value={friendship.player_id} />
                        <input name="response" type="hidden" value="recusar" />
                        <button
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white"
                          type="submit"
                        >
                          Recusar
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-white/10 bg-[#111118] p-8 text-center">
            <h2 className="text-xl font-semibold">Sua lista de amizades está vazia</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Encontre jogadores que compartilham seus jogos e envie um pedido.
            </p>
            <Link
              className="mt-6 inline-flex rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
              href="/jogadores"
            >
              Encontrar jogadores
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
