import { randomBytes } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "RhogarDarkmor/PartyUp";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env.local");
const decoder = new StringDecoder("utf8");
let token = "";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("Execute este script no terminal interativo do VS Code.");
  process.exit(1);
}

async function validateToken(value) {
  const endpoints = [
    `repos/${repository}`,
    `repos/${repository}/commits?per_page=1`,
    `repos/${repository}/milestones?state=all&per_page=1`,
    `repos/${repository}/actions/runs?per_page=1`,
  ];

  for (const endpoint of endpoints) {
    let response;
    try {
      response = await fetch(`https://api.github.com/${endpoint}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${value}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error(
        "Não foi possível conectar à API do GitHub para validar o token.",
      );
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "O GitHub recusou o token ou uma das permissões de leitura.",
        );
      }
      if (response.status === 404) {
        throw new Error(
          "O token não tem acesso a um recurso do repositório. Confira acesso e permissões.",
        );
      }
      throw new Error(
        `O GitHub não conseguiu validar o token (HTTP ${response.status}).`,
      );
    }
  }
}

async function saveToken(value) {
  let existingText = "";
  try {
    existingText = await readFile(envPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const envLines = existingText.split(/\r?\n/).filter((line) => {
    const assignment = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return (
      !assignment ||
      !["GITHUB_REPOSITORY", "GITHUB_TOKEN"].includes(assignment[1])
    );
  });
  while (envLines.length > 0 && envLines.at(-1) === "") {
    envLines.pop();
  }

  envLines.push(
    "",
    "# GitHub project dashboard; keep this token private.",
    `GITHUB_REPOSITORY=${repository}`,
    `GITHUB_TOKEN=${value}`,
  );

  const parent = dirname(envPath);
  await mkdir(parent, { recursive: true });
  const temporaryPath = `${envPath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporaryPath, `${envLines.join("\n")}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, envPath);
  } catch (error) {
    await import("node:fs/promises").then(({ rm }) =>
      rm(temporaryPath, { force: true }),
    );
    throw error;
  }
}

function eraseInput() {
  if (process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
  token = "";
}

process.stdout.write(
  `GitHub fine-grained token for ${repository} (input hidden): `,
);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", async (chunk) => {
  for (const character of decoder.write(chunk)) {
    if (character === "\u0003") {
      eraseInput();
      process.stdout.write("\nConfiguration cancelled.\n");
      process.exitCode = 130;
      return;
    }

    if (character === "\r" || character === "\n") {
      let submittedToken = token;
      eraseInput();
      process.stdout.write("\nValidating token and read-only permissions...\n");

      if (!/^github_pat_[A-Za-z0-9_]+$/.test(submittedToken)) {
        submittedToken = "";
        console.error(
          "Token format is invalid. Create a fine-grained token and try again.",
        );
        process.exitCode = 1;
        return;
      }

      try {
        await validateToken(submittedToken);
        await saveToken(submittedToken);
        console.log(
          "GitHub integration configured in this project's .env.local. The token was not displayed.",
        );
      } catch (error) {
        console.error(
          error instanceof Error
            ? error.message
            : "GitHub integration could not be configured.",
        );
        process.exitCode = 1;
      } finally {
        submittedToken = "";
      }
      return;
    }

    if (character === "\u007f" || character === "\b") {
      const characters = Array.from(token);
      if (characters.length > 0) {
        characters.pop();
        token = characters.join("");
        process.stdout.write("\b \b");
      }
      continue;
    }

    if (character >= " " && token.length < 512) {
      token += character;
      process.stdout.write("*");
    }
  }
});
