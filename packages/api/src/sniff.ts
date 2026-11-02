export type MediaType = "image/webp" | "image/jpeg" | "image/png" | "audio/webm" | "audio/mp4" | "audio/ogg" | "audio/mpeg";

/** Checks the first bytes of an upload really are the kind of file it claims. */
export function sniffMedia(bytes: Uint8Array): MediaType | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "audio/webm";
  if (bytes.length > 12 && ascii(4, 8) === "ftyp") return "audio/mp4";
  if (bytes.length > 4 && ascii(0, 4) === "OggS") return "audio/ogg";
  if (bytes.length > 3 && (ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0))) return "audio/mpeg";
  return null;
}
export const sniffImage = sniffMedia;
