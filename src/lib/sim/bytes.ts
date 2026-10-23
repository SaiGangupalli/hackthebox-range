// Build small, structurally valid binary files (as latin1 strings) for the
// practice labs, so `file`, `xxd`, `strings`, `binwalk` and `unzip` behave like
// they would on the real thing.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(s: string): number {
  let c = 0xffffffff;
  for (let i = 0; i < s.length; i++) c = CRC_TABLE[(c ^ s.charCodeAt(i)) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u16le = (n: number) => String.fromCharCode(n & 255, (n >>> 8) & 255);
const u32le = (n: number) => u16le(n & 0xffff) + u16le(n >>> 16);
const u32be = (n: number) => String.fromCharCode((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);

// A zip with stored (uncompressed) entries: local headers, central directory, end record.
export function makeZip(entries: { name: string; data: string }[]): string {
  let local = "", central = "";
  for (const e of entries) {
    const crc = crc32(e.data);
    const common = u16le(20) + u16le(0) + u16le(0) + u16le(0x4a6e) + u16le(0x5b57) + u32le(crc) + u32le(e.data.length) + u32le(e.data.length) + u16le(e.name.length) + u16le(0);
    central += "PK\x01\x02" + u16le(20) + common + u16le(0) + u16le(0) + u16le(0) + u32le(0) + u32le(local.length) + e.name;
    local += "PK\x03\x04" + common + e.name + e.data;
  }
  return local + central + "PK\x05\x06" + u16le(0) + u16le(0) + u16le(entries.length) + u16le(entries.length) + u32le(central.length) + u32le(local.length) + u16le(0);
}

const chunk = (type: string, data: string) => u32be(data.length) + type + data + u32be(crc32(type + data));

// A PNG with a real IHDR, optional tEXt chunks, a filler IDAT and IEND. `after`
// is appended past IEND — the classic "file glued onto an image" trick.
export function makePng(o: { width: number; height: number; text?: [string, string][]; idatBytes?: number; after?: string }): string {
  const ihdr = u32be(o.width) + u32be(o.height) + "\x08\x06\x00\x00\x00";
  let idat = "x\x9c";
  for (let i = 0; i < (o.idatBytes ?? 600); i++) idat += String.fromCharCode((i * 73 + 41) & 255);
  return "\x89PNG\r\n\x1a\n" + chunk("IHDR", ihdr)
    + (o.text ?? []).map(([k, v]) => chunk("tEXt", `${k}\x00${v}`)).join("")
    + chunk("IDAT", idat) + chunk("IEND", "") + (o.after ?? "");
}

// A minimal JPEG-looking file (SOI + JFIF APP0 + filler + EOI) for magic-byte lessons.
export function makeJpeg(fillerBytes = 400): string {
  let body = "";
  for (let i = 0; i < fillerBytes; i++) body += String.fromCharCode((i * 31 + 7) & 255);
  return "\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + body + "\xff\xd9";
}
