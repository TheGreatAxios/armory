import { SignJWT, importPKCS8, importJWK } from "jose";

export interface CdpJwtOptions {
  apiKeyId: string;
  apiKeySecret: string;
  requestMethod: string;
  requestHost: string;
  requestPath: string;
  expiresIn?: number;
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isECKey(secret: string): Promise<boolean> {
  try {
    await importPKCS8(secret, "ES256");
    return true;
  } catch {
    return false;
  }
}

function isEd25519Key(secret: string): boolean {
  try {
    const decoded = Buffer.from(secret, "base64");
    return decoded.length === 64;
  } catch {
    return false;
  }
}

async function buildECJwt(
  secret: string,
  keyId: string,
  claims: Record<string, unknown>,
  now: number,
  expiresIn: number,
  nonce: string,
): Promise<string> {
  const key = await importPKCS8(secret, "ES256");
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT", nonce })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + expiresIn)
    .sign(key);
}

async function buildEd25519Jwt(
  secret: string,
  keyId: string,
  claims: Record<string, unknown>,
  now: number,
  expiresIn: number,
  nonce: string,
): Promise<string> {
  const decoded = Buffer.from(secret, "base64");
  const seed = decoded.subarray(0, 32);
  const publicKey = decoded.subarray(32);
  const jwk = {
    kty: "OKP",
    crv: "Ed25519",
    d: Buffer.from(seed).toString("base64url"),
    x: Buffer.from(publicKey).toString("base64url"),
  };
  const key = await importJWK(jwk, "EdDSA");
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "EdDSA", kid: keyId, typ: "JWT", nonce })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + expiresIn)
    .sign(key);
}

export async function generateCdpJwt(options: CdpJwtOptions): Promise<string> {
  if (!options.apiKeyId) throw new Error("apiKeyId is required");
  if (!options.apiKeySecret) throw new Error("apiKeySecret is required");

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresIn ?? 120;
  const nonce = generateNonce();
  const uri = `${options.requestMethod} ${options.requestHost}${options.requestPath}`;

  const claims: Record<string, unknown> = {
    sub: options.apiKeyId,
    iss: "cdp",
    uris: [uri],
  };

  if (await isECKey(options.apiKeySecret)) {
    return buildECJwt(
      options.apiKeySecret,
      options.apiKeyId,
      claims,
      now,
      expiresIn,
      nonce,
    );
  }

  if (isEd25519Key(options.apiKeySecret)) {
    return buildEd25519Jwt(
      options.apiKeySecret,
      options.apiKeyId,
      claims,
      now,
      expiresIn,
      nonce,
    );
  }

  throw new Error(
    "Invalid key format: must be a PEM EC private key or a base64-encoded Ed25519 key (64 bytes)",
  );
}
