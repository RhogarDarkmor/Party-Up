import { randomBytes } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env.local");
const decoder = new StringDecoder("utf8");
let input = "";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("Execute este script no terminal interativo do VS Code.");
  process.exit(1);
}

function isValidProjectUrl(value) {
  try {
    const url = new URL(value);
    const isLocal =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    const isHosted =
      url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
    return (
      (isLocal || isHosted) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.pathname === "/" || url.pathname === "")
    );
  } catch {
    return false;
  }
}

function isValidSiteUrl(value) {
  try {
    const url = new URL(value);
    const isLocal =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    const isHosted = url.protocol === "https:";
    return (
      (isLocal || isHosted) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.pathname === "/" || url.pathname === "")
    );
  } catch {
    return false;
  }
}

function isPublicSupabaseKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)) {
    return true;
  }

  const parts = value.split(".");
  if (parts.length !== 3 || !/^eyJ[A-Za-z0-9_-]+$/.test(parts[0])) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return payload.role === "anon";
  } catch {
    return false;
  }
}

function promptHidden(label) {
  return new Promise((resolvePrompt) => {
    input = "";
    process.stdout.write(`${label} (input hidden): `);

    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === "\u0003") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          input = "";
          process.stdout.write("\nConfiguration cancelled.\n");
          process.exit(130);
        }

        if (character === "\r" || character === "\n") {
          const value = input.trim();
          input = "";
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolvePrompt(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          const characters = Array.from(input);
          if (characters.length > 0) {
            characters.pop();
            input = characters.join("");
            process.stdout.write("\b \b");
          }
          continue;
        }

        if (character >= " " && input.length < 2048) {
          input += character;
          process.stdout.write("*");
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function readExistingEnv() {
  try {
    return await readFile(envPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") {
        return "";
      }
    }
    throw error;
  }
}

function readEnvValue(envText, name) {
  const match = envText.match(
    new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)\\s*$`, "m"),
  );
  if (!match) {
    return "";
  }

  const value = match[1].trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function saveConfiguration(projectUrl, publicKey, siteUrl) {
  const existingText = await readExistingEnv();
  const variableNames = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ];
  const envLines = existingText.split(/\r?\n/).filter((line) => {
    const assignment = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !assignment || !variableNames.includes(assignment[1]);
  });
  while (envLines.length > 0 && envLines.at(-1) === "") {
    envLines.pop();
  }

  envLines.push(
    "",
    "# Public Supabase project configuration; access is enforced by RLS.",
    `NEXT_PUBLIC_SUPABASE_URL=${projectUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${publicKey}`,
    `NEXT_PUBLIC_SITE_URL=${siteUrl}`,
  );

  await mkdir(dirname(envPath), { recursive: true });
  const temporaryPath = `${envPath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporaryPath, `${envLines.join("\n")}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, envPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

try {
  const existingEnv = await readExistingEnv();
  process.stdin.setRawMode(true);
  process.stdin.resume();

  const savedProjectUrl = readEnvValue(
    existingEnv,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const projectUrl = isValidProjectUrl(savedProjectUrl)
    ? savedProjectUrl
    : await promptHidden("Supabase project URL");
  if (!isValidProjectUrl(projectUrl)) {
    throw new Error(
      "URL inválida. Use o URL HTTPS do projeto Supabase (ou localhost para desenvolvimento local).",
    );
  }

  const publicKey = await promptHidden(
    "Supabase publishable/anon key (never use a secret/service_role key)",
  );
  if (!isPublicSupabaseKey(publicKey)) {
    throw new Error(
      "A chave não parece ser uma publishable key ou uma chave anon. Não use secret/service_role.",
    );
  }

  const savedSiteUrl = readEnvValue(existingEnv, "NEXT_PUBLIC_SITE_URL");
  const siteUrl = isValidSiteUrl(savedSiteUrl)
    ? savedSiteUrl
    : await promptHidden("App URL (for example http://127.0.0.1:3001)");
  if (!isValidSiteUrl(siteUrl)) {
    throw new Error(
      "URL do aplicativo inválida. Use localhost em desenvolvimento ou HTTPS em produção, sem caminhos.",
    );
  }

  await saveConfiguration(
    projectUrl.replace(/\/$/, ""),
    publicKey,
    siteUrl.replace(/\/$/, ""),
  );
  console.log(
    "Supabase configurado em .env.local. Os valores não foram exibidos; esse arquivo permanece ignorado pelo Git.",
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Não foi possível configurar o Supabase.",
  );
  process.exitCode = 1;
} finally {
  input = "";
  if (process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
}
