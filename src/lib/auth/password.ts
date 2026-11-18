// Password rules shared by the admin "add user" form, the server actions and the change form.
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
  return null;
}

// No look-alike characters (0/O, 1/l/I), so a temporary password can be read out or retyped.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Random temporary password such as "Hs-7kQm2xP9w". */
export function generateTempPassword(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(10);
  let body = "";
  for (const b of bytes) body += ALPHABET[b % ALPHABET.length];
  // Guarantee a digit so it always passes passwordProblem().
  return `Hs-${body.slice(0, 9)}${2 + ((bytes[0] ?? 0) % 8)}`;
}

function defaultRandom(n: number) {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}
