import "server-only";

import { createHash, createHmac, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "partyup_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function derivePasswordHash(
  password: string,
  salt: Buffer,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(derivedKey));
    });
  });
}

type AdminConfiguration = {
  username: string;
  passwordSalt: Buffer;
  passwordHash: Buffer;
  sessionSecret: string;
};

type AdminSessionPayload = {
  sub: "admin";
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("ADMIN_SESSION_SECRET is missing or too short.");
  }
  return secret;
}

export function getAdminConfiguration(): AdminConfiguration {
  const username = process.env.ADMIN_USERNAME;
  const encodedPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!username || username.length > 120 || !encodedPasswordHash) {
    throw new Error("Admin credentials are not configured.");
  }

  const [algorithm, saltHex, hashHex, extra] = encodedPasswordHash.split(":");
  if (
    algorithm !== "scrypt" ||
    !saltHex ||
    !/^[\da-f]{32}$/i.test(saltHex) ||
    !hashHex ||
    !/^[\da-f]{128}$/i.test(hashHex) ||
    extra !== undefined
  ) {
    throw new Error("ADMIN_PASSWORD_HASH has an invalid format.");
  }

  return {
    username,
    passwordSalt: Buffer.from(saltHex, "hex"),
    passwordHash: Buffer.from(hashHex, "hex"),
    sessionSecret: getSessionSecret(),
  };
}

export async function verifyAdminCredentials(
  username: string,
  password: string,
  config: AdminConfiguration,
) {
  const submittedUsernameHash = createHash("sha256")
    .update(username, "utf8")
    .digest();
  const configuredUsernameHash = createHash("sha256")
    .update(config.username, "utf8")
    .digest();
  const usernameMatches = timingSafeEqual(
    submittedUsernameHash,
    configuredUsernameHash,
  );

  const submittedPasswordHash = await derivePasswordHash(
    password,
    config.passwordSalt,
    config.passwordHash.length,
  );

  return (
    usernameMatches && timingSafeEqual(submittedPasswordHash, config.passwordHash)
  );
}

export function createAdminSessionToken(config: AdminConfiguration) {
  const payload: AdminSessionPayload = {
    sub: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", config.sessionSecret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function isAdminSessionPayload(value: unknown): value is AdminSessionPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "sub" in value &&
    value.sub === "admin" &&
    "exp" in value &&
    typeof value.exp === "number" &&
    Number.isSafeInteger(value.exp)
  );
}

export function verifyAdminSessionToken(token: string, secret: string) {
  if (!/^[A-Za-z\d_-]+\.[A-Za-z\d_-]+$/.test(token)) {
    return false;
  }

  const [encodedPayload, submittedSignature] = token.split(".");
  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();
  const signature = Buffer.from(submittedSignature, "base64url");

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(signature, expectedSignature)
  ) {
    return false;
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    return (
      isAdminSessionPayload(payload) &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export async function hasAdminSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return false;
  }

  return verifyAdminSessionToken(token, getSessionSecret());
}

export const adminSessionCookieName = SESSION_COOKIE;
export const adminSessionDurationSeconds = SESSION_DURATION_SECONDS;
