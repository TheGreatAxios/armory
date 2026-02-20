const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  }

  throw new Error("No base64 encoder available in this runtime");
}

function fromBase64(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  throw new Error("No base64 decoder available in this runtime");
}

export function encodeUtf8ToBase64(value: string): string {
  const bytes = textEncoder.encode(value);
  return toBase64(bytes);
}

export function decodeBase64ToUtf8(value: string): string {
  const bytes = fromBase64(value);
  return textDecoder.decode(bytes);
}

export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function normalizeBase64Url(value: string): string {
  return value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
}
