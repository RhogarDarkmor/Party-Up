import { hasAdminSession } from "@/lib/admin-auth";
import {
  getProjectProgress,
  GitHubDashboardError,
} from "@/lib/github-dashboard";

const noStoreHeaders = { "Cache-Control": "no-store, private" };

export async function GET() {
  if (!(await hasAdminSession())) {
    return Response.json(
      { message: "Acesso não autorizado." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    return Response.json(await getProjectProgress(), {
      headers: noStoreHeaders,
    });
  } catch (error) {
    if (error instanceof GitHubDashboardError) {
      if (
        error.message === "github_repository_missing" ||
        error.message === "github_token_missing"
      ) {
        const repositoryIsMissing =
          error.message === "github_repository_missing";
        return Response.json(
          {
            code: error.message,
            message: repositoryIsMissing
              ? "O repositório GitHub ainda não foi configurado no servidor."
              : "O token de leitura do GitHub ainda não foi configurado no servidor.",
          },
          { status: 503, headers: noStoreHeaders },
        );
      }

      if (error.message === "github_repository_invalid") {
        return Response.json(
          {
            code: "github_repository_invalid",
            message: "O repositório GitHub está configurado incorretamente.",
          },
          { status: 503, headers: noStoreHeaders },
        );
      }

      console.error("GitHub dashboard request failed.", {
        status: error.status,
      });

      const message =
        error.status === 401 || error.status === 403
          ? "O GitHub recusou o acesso. Confira o token e suas permissões."
          : error.status === 404
            ? "O repositório ou algum recurso solicitado não foi encontrado."
            : "O GitHub não conseguiu fornecer os dados agora.";

      return Response.json(
        { code: "github_request_failed", message },
        { status: error.status === 404 ? 404 : 502, headers: noStoreHeaders },
      );
    }

    console.error("Unexpected project dashboard error.", error);
    return Response.json(
      {
        code: "project_dashboard_unavailable",
        message: "Não foi possível atualizar o painel do projeto agora.",
      },
      { status: 502, headers: noStoreHeaders },
    );
  }
}
