"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProjectCommit,
  ProjectMilestone,
  ProjectProgressData,
} from "@/lib/github-dashboard";

type ProjectApiError = {
  code?: string;
  message?: string;
};

function isProjectApiError(value: unknown): value is ProjectApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("message" in value) || typeof value.message === "string") &&
    (!("code" in value) || typeof value.code === "string")
  );
}

function isProjectProgressData(value: unknown): value is ProjectProgressData {
  return (
    typeof value === "object" &&
    value !== null &&
    "repository" in value &&
    typeof value.repository === "string" &&
    "refreshedAt" in value &&
    typeof value.refreshedAt === "string" &&
    "progressPercent" in value &&
    typeof value.progressPercent === "number" &&
    "closedIssues" in value &&
    typeof value.closedIssues === "number" &&
    "totalIssues" in value &&
    typeof value.totalIssues === "number" &&
    "milestones" in value &&
    Array.isArray(value.milestones) &&
    "commits" in value &&
    Array.isArray(value.commits)
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sem previsão";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getMilestoneStatus(milestone: ProjectMilestone) {
  if (milestone.state === "closed") {
    return { label: "Concluída", classes: "text-emerald-300 bg-emerald-300/10" };
  }
  if (milestone.closed_issues > 0) {
    return { label: "Em andamento", classes: "text-violet-200 bg-violet-300/10" };
  }
  return { label: "Planejada", classes: "text-zinc-300 bg-white/[0.06]" };
}

function WorkflowStatus({
  workflow,
}: {
  workflow: ProjectProgressData["latestWorkflow"];
}) {
  if (!workflow) {
    return (
      <span className="text-sm text-zinc-500">
        Nenhuma execução de CI encontrada
      </span>
    );
  }

  const label =
    workflow.status !== "completed"
      ? "Em execução"
      : workflow.conclusion === "success"
        ? "Aprovada"
        : workflow.conclusion === "failure"
          ? "Com falhas"
          : workflow.conclusion ?? "Concluída";
  const color =
    workflow.status !== "completed"
      ? "bg-amber-300"
      : workflow.conclusion === "success"
        ? "bg-emerald-300"
        : workflow.conclusion === "failure"
          ? "bg-rose-300"
          : "bg-zinc-400";

  return (
    <a
      className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200 transition hover:text-white"
      href={workflow.html_url}
      rel="noreferrer"
      target="_blank"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {workflow.name}: {label}
    </a>
  );
}

function MilestoneCard({ milestone }: { milestone: ProjectMilestone }) {
  const status = getMilestoneStatus(milestone);
  const total = milestone.open_issues + milestone.closed_issues;
  const percent =
    total > 0 ? Math.round((milestone.closed_issues / total) * 100) : 0;

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a
            className="font-semibold text-white transition hover:text-violet-200"
            href={milestone.html_url}
            rel="noreferrer"
            target="_blank"
          >
            {milestone.title}
          </a>
          <p className="mt-1 text-xs text-zinc-500">
            {milestone.due_on
              ? `Prazo ${formatDate(milestone.due_on)}`
              : `${milestone.closed_issues} de ${total} tarefas concluídas`}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.classes}`}
        >
          {status.label}
        </span>
      </div>
      {milestone.description ? (
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {milestone.description}
        </p>
      ) : null}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Issues concluídas</span>
          <span>
            {milestone.closed_issues}/{total}
          </span>
        </div>
        <div
          aria-label={`${percent}% das tarefas desta etapa concluídas`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-300 transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function CommitRow({ commit }: { commit: ProjectCommit }) {
  const title = commit.commit.message.split("\n")[0] ?? "Commit sem título";
  const author = commit.author?.login ?? commit.commit.author?.name ?? "Autor";

  return (
    <li className="flex items-start justify-between gap-4 border-t border-white/[0.06] py-4 first:border-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <a
          className="block truncate text-sm font-medium text-zinc-200 transition hover:text-violet-200"
          href={commit.html_url}
          rel="noreferrer"
          target="_blank"
        >
          {title}
        </a>
        <p className="mt-1 text-xs text-zinc-500">
          {author} · {commit.sha.slice(0, 7)}
        </p>
      </div>
      <time
        className="shrink-0 text-xs text-zinc-500"
        dateTime={commit.commit.author?.date}
      >
        {commit.commit.author?.date
          ? formatDate(commit.commit.author.date)
          : "Data indisponível"}
      </time>
    </li>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<ProjectProgressData | null>(null);
  const [error, setError] = useState<ProjectApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const requestInProgress = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInProgress.current) {
      return;
    }
    requestInProgress.current = true;

    try {
      const response = await fetch("/api/admin/project", {
        cache: "no-store",
      });
      const result: unknown = await response.json();

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        setError(
          isProjectApiError(result)
            ? result
            : { message: "Não foi possível carregar os dados do projeto." },
        );
        return;
      }

      if (!isProjectProgressData(result)) {
        setError({ message: "A resposta do projeto está em formato inválido." });
        return;
      }

      setData(result);
      setError(null);
    } catch {
      setError({
        message: "Falha de conexão ao atualizar o painel.",
      });
    } finally {
      setIsLoading(false);
      requestInProgress.current = false;
    }
  }, [router]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function logout() {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setError({ message: "Não foi possível encerrar a sessão." });
        return;
      }
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError({ message: "Falha de conexão ao encerrar a sessão." });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b10] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-lg font-black">
              P
            </span>
            <div>
              <p className="text-sm font-semibold">PartyUp</p>
              <p className="text-xs text-zinc-500">Painel administrativo</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-zinc-500 sm:inline">
              Atualização automática a cada 30 segundos
            </span>
            <button
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              disabled={isLoggingOut}
              onClick={logout}
              type="button"
            >
              {isLoggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </header>

        <section className="flex flex-wrap items-end justify-between gap-5 py-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              Visão do projeto
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Avanço do PartyUp
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Acompanhe etapas, entregas, atividade recente e integração
              contínua do repositório.
            </p>
          </div>
          <button
            className="rounded-lg bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void refresh()}
            type="button"
          >
            {isLoading ? "Atualizando..." : "Atualizar agora"}
          </button>
        </section>

        {error ? (
          <section
            aria-live="polite"
            className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-5"
            role="status"
          >
            <h2 className="font-semibold text-amber-100">
              Integração do projeto indisponível
            </h2>
            <p className="mt-2 text-sm leading-6 text-amber-100/75">
              {error.message ?? "Não foi possível carregar os dados."}
            </p>
            {error.code === "github_token_missing" ? (
              <p className="mt-2 text-xs leading-5 text-amber-100/60">
                Execute npm run github:configure no terminal integrado. O
                comando recebe o token sem exibi-lo e salva-o apenas em
                .env.local, arquivo ignorado pelo Git.
              </p>
            ) : null}
            {error.code === "github_repository_missing" ? (
              <p className="mt-2 text-xs leading-5 text-amber-100/60">
                Configure GITHUB_REPOSITORY no ambiente privado do servidor.
              </p>
            ) : null}
            <button
              className="mt-4 text-sm font-semibold text-amber-100 underline decoration-amber-100/30 underline-offset-4 hover:decoration-amber-100"
              onClick={() => void refresh()}
              type="button"
            >
              Tentar novamente
            </button>
          </section>
        ) : null}

        {isLoading && !data ? (
          <div
            aria-label="Carregando dados do projeto"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
              />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-white/[0.08] bg-[#111118] p-5">
                <p className="text-sm text-zinc-400">Progresso das issues</p>
                <p className="mt-4 text-4xl font-bold">
                  {data.progressPercent}
                  <span className="text-2xl text-violet-300">%</span>
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {data.closedIssues} concluídas de {data.totalIssues} issues
                  com milestone
                </p>
              </article>
              <article className="rounded-2xl border border-white/[0.08] bg-[#111118] p-5">
                <p className="text-sm text-zinc-400">Etapas planejadas</p>
                <p className="mt-4 text-4xl font-bold">
                  {data.milestones.length}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Milestones registrados no GitHub
                </p>
              </article>
              <article className="rounded-2xl border border-white/[0.08] bg-[#111118] p-5">
                <p className="text-sm text-zinc-400">Atividade recente</p>
                <p className="mt-4 text-4xl font-bold">{data.commits.length}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Commits mais recentes consultados
                </p>
              </article>
              <article className="rounded-2xl border border-white/[0.08] bg-[#111118] p-5">
                <p className="text-sm text-zinc-400">Integração contínua</p>
                <div className="mt-5">
                  <WorkflowStatus workflow={data.latestWorkflow} />
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Última execução de GitHub Actions
                </p>
              </article>
            </section>

            <section className="mt-10">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Etapas do projeto</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {data.repository} · progresso calculado pelas issues
                    concluídas
                  </p>
                </div>
                <time className="text-xs text-zinc-500" dateTime={data.refreshedAt}>
                  Sincronizado {formatDate(data.refreshedAt)}
                </time>
              </div>
              {data.milestones.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.milestones.map((milestone) => (
                    <MilestoneCard
                      key={milestone.number}
                      milestone={milestone}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                  <p className="font-medium text-zinc-200">
                    Nenhuma etapa encontrada no GitHub
                  </p>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500">
                    Crie milestones e associe issues no repositório para o
                    painel calcular o andamento automaticamente.
                  </p>
                </div>
              )}
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-2xl border border-white/[0.08] bg-[#111118] p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Commits recentes</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Alterações detectadas no repositório
                </p>
                {data.commits.length > 0 ? (
                  <ul className="mt-5">
                    {data.commits.map((commit) => (
                      <CommitRow key={commit.sha} commit={commit} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 text-sm text-zinc-500">
                    Ainda não há commits para exibir.
                  </p>
                )}
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-[#111118] p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Fonte do progresso</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Sincronizado diretamente com o GitHub
                </p>
                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Repositório</dt>
                    <dd className="max-w-[65%] truncate text-right text-zinc-200">
                      {data.repository}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Frequência</dt>
                    <dd className="text-right text-zinc-200">
                      A cada 30 segundos
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Última sincronização</dt>
                    <dd className="text-right text-zinc-200">
                      {new Intl.DateTimeFormat("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(data.refreshedAt))}
                    </dd>
                  </div>
                </dl>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
