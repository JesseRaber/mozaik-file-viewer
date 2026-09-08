/** Detect UTF-8 / UTF-16 (with or without BOM) the way Windows job files actually arrive. */
export function decodeBytes(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  if (u.length >= 2 && u[0] === 0xff && u[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(u);
  }
  if (u.length >= 2 && u[0] === 0xfe && u[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(u);
  }
  if (u.length >= 3 && u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(u);
  }
  const n = Math.min(u.length, 512);
  let evenZero = 0;
  let oddZero = 0;
  for (let i = 0; i < n; i++) {
    if (u[i] !== 0) continue;
    if (i % 2 === 0) evenZero++;
    else oddZero++;
  }
  const pairs = Math.floor(n / 2);
  if (pairs > 20 && oddZero / pairs > 0.6 && evenZero / pairs < 0.2) {
    return new TextDecoder("utf-16le").decode(u);
  }
  if (pairs > 20 && evenZero / pairs > 0.6 && oddZero / pairs < 0.2) {
    return new TextDecoder("utf-16be").decode(u);
  }
  return new TextDecoder("utf-8").decode(u);
}

export function xmlPayload(text: string): string | null {
  const i = text.indexOf("<?xml");
  if (i >= 0) return text.slice(i);
  const j = text.search(/<[A-Za-z][\w:.]*/);
  if (j >= 0) return text.slice(j);
  return null;
}
