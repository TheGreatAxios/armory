const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
type BufferLike = {
  from(data: Uint8Array): { toString(encoding: "base64"): string };
  from(data: string, encoding: "base64"): Uint8Array;
};

function getNodeBuffer(): BufferLike | undefined {
  if ("Buffer" in globalThis) {
    return (globalThis as { Buffer?: BufferLike }).Buffer;
  }
  return undefined;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  }

  const nodeBuffer = getNodeBuffer();
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString("base64");
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

  const nodeBuffer = getNodeBuffer();
  if (nodeBuffer) {
    return Uint8Array.from(nodeBuffer.from(base64, "base64"));
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

export function normalizeBase64Url(value: string): string {
  return value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
}
