// Client-side removal of GPS location from photos before they are uploaded.
//
// Only JPEG is handled. The file is edited in place (same length): the Exif
// GPS IFD has its entries and out-of-line values zeroed and its entry count
// set to 0, and any GPS values in an XMP packet are blanked with spaces.
// Everything else, including Orientation, is left untouched.
//
// This must never block an upload: anything unexpected returns the original
// file unchanged.

const GPS_IFD_POINTER_TAG = 0x8825;
// Don't read very large "JPEGs" into memory; real photos are far smaller.
const MAX_JPEG_BYTES = 200 * 1024 * 1024;

// Byte sizes of the TIFF field types (index = type id).
const TIFF_TYPE_SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4];

function isJpeg(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/pjpeg") return true;
  return /\.jpe?g$/i.test(file.name);
}

// Zero the GPS IFD inside one Exif APP1 segment. `tiff` is the offset of the
// TIFF header and `end` the end of the segment. Returns true if bytes changed.
function stripGpsFromExif(bytes: Uint8Array, tiff: number, end: number): boolean {
  if (end > bytes.length || tiff + 8 > end) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let little: boolean;
  if (bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49) little = true;
  else if (bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d) little = false;
  else return false;
  if (view.getUint16(tiff + 2, little) !== 0x2a) return false;

  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  const ifd0 = tiff + u32(tiff + 4);
  if (ifd0 + 2 > end) return false;
  const ifd0Count = u16(ifd0);
  if (ifd0 + 2 + ifd0Count * 12 > end) return false;

  let gpsIfd = -1;
  for (let i = 0; i < ifd0Count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (u16(entry) === GPS_IFD_POINTER_TAG) {
      gpsIfd = tiff + u32(entry + 8);
      break;
    }
  }
  if (gpsIfd < 0 || gpsIfd + 2 > end) return false;

  const gpsCount = u16(gpsIfd);
  const entriesEnd = gpsIfd + 2 + gpsCount * 12;
  if (gpsCount === 0 || entriesEnd > end) return false;

  // Zero any out-of-line values first, while the entries are still readable.
  for (let i = 0; i < gpsCount; i++) {
    const entry = gpsIfd + 2 + i * 12;
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    const size = (TIFF_TYPE_SIZES[type] ?? 0) * count;
    if (size > 4) {
      const valueStart = tiff + u32(entry + 8);
      const valueEnd = valueStart + size;
      // Only zero values that lie inside this segment and outside IFD0.
      if (
        valueStart >= tiff + 8 &&
        valueEnd <= end &&
        (valueEnd <= ifd0 || valueStart >= ifd0 + 2 + ifd0Count * 12 + 4)
      ) {
        bytes.fill(0, valueStart, valueEnd);
      }
    }
  }

  // Zero the entries and set the count to 0. The next-IFD offset (read at
  // gpsIfd + 2 once the count is 0) is now zero as well, i.e. "no next IFD".
  bytes.fill(0, gpsIfd + 2, entriesEnd);
  view.setUint16(gpsIfd, 0, little);
  return true;
}

const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

// Blank GPS values in an XMP packet without changing its length. The text is
// handled one character per byte (latin1) so every offset stays the same.
function stripGpsFromXmp(bytes: Uint8Array, start: number, end: number): boolean {
  let text = "";
  for (let i = start; i < end; i++) text += String.fromCharCode(bytes[i]);
  const blank = (s: string) => " ".repeat(s.length);
  const stripped = text
    .replace(/(exif:GPS\w+\s*=\s*")([^"]*)(")/g, (_m, a: string, v: string, b: string) => a + blank(v) + b)
    .replace(/(exif:GPS\w+\s*=\s*')([^']*)(')/g, (_m, a: string, v: string, b: string) => a + blank(v) + b)
    .replace(/(<exif:GPS\w+>)([^<]*)(<\/exif:GPS\w+>)/g, (_m, a: string, v: string, b: string) => a + blank(v) + b);
  if (stripped === text || stripped.length !== text.length) return false;
  for (let i = 0; i < stripped.length; i++) bytes[start + i] = stripped.charCodeAt(i);
  return true;
}

function matchesAscii(bytes: Uint8Array, offset: number, ascii: string): boolean {
  if (offset + ascii.length > bytes.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Remove GPS location metadata from a JPEG photo. Returns a new File with the
 * same name, type and lastModified when something was removed, otherwise the
 * original file. Never throws.
 */
export async function stripImageLocation(file: File): Promise<File> {
  try {
    if (!isJpeg(file) || file.size < 4 || file.size > MAX_JPEG_BYTES) return file;

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return file;

    // Scan for every APP1 segment rather than only walking the header chain,
    // so Exif/XMP blocks of embedded images (e.g. MPF secondary images) are
    // covered too. 0xFF 0xE1 cannot occur inside entropy-coded scan data
    // (0xFF there is always followed by 0x00 or a restart marker), and every
    // hit is structurally validated before anything is changed.
    let changed = false;
    for (let i = 2; i + 4 <= bytes.length; i++) {
      if (bytes[i] !== 0xff || bytes[i + 1] !== 0xe1) continue;
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      const dataStart = i + 4;
      const segmentEnd = i + 2 + length;
      if (length < 8 || segmentEnd > bytes.length) continue;

      if (matchesAscii(bytes, dataStart, "Exif\0\0")) {
        if (stripGpsFromExif(bytes, dataStart + 6, segmentEnd)) changed = true;
      } else if (matchesAscii(bytes, dataStart, XMP_HEADER)) {
        if (stripGpsFromXmp(bytes, dataStart + XMP_HEADER.length, segmentEnd)) changed = true;
      } else {
        continue;
      }
      i = segmentEnd - 1;
    }

    if (!changed) return file;
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch (error) {
    console.warn("[ImagePrivacy] Could not strip location data; uploading original:", error);
    return file;
  }
}
