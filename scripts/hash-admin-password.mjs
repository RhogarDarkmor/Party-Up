import { randomBytes, scryptSync } from "node:crypto";
import { StringDecoder } from "node:string_decoder";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("Execute este script em um terminal interativo.");
  process.exit(1);
}

const decoder = new StringDecoder("utf8");
let password = "";

function finish() {
  process.stdin.setRawMode(false);
  process.stdin.pause();

  if (password.length === 0) {
    console.error("A senha não pode ficar vazia.");
    process.exitCode = 1;
    return;
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  password = "";
  process.stdout.write(
    `\nscrypt:${salt.toString("hex")}:${hash.toString("hex")}\n`,
  );
}

process.stdout.write("Senha administrativa (entrada oculta): ");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  const input = decoder.write(chunk);

  for (const character of input) {
    if (character === "\u0003") {
      password = "";
      process.stdin.setRawMode(false);
      process.exit(130);
    }
    if (character === "\r" || character === "\n") {
      finish();
      return;
    }
    if (character === "\u007f" || character === "\b") {
      const characters = Array.from(password);
      if (characters.length > 0) {
        characters.pop();
        password = characters.join("");
        process.stdout.write("\b \b");
      }
      continue;
    }
    if (character >= " ") {
      password += character;
      process.stdout.write("*");
    }
  }
});
