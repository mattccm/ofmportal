// File utilities that can be used in both client and server components
// No Node.js-specific imports here

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
  "video/webm",
  "video/x-matroska", // .mkv
];

export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/wav",
  "audio/aac",
  "audio/ogg",
];

export const ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_TYPES.includes(mimeType);
}

// Canonical MIME type for each allowed extension (must match ALLOWED_TYPES and
// the server's extension allow-list in lib/storage.ts)
const EXTENSION_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
};

// Non-standard names some browsers/OSes report for allowed formats
const MIME_TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/heic-sequence": "image/heic",
  "image/heif-sequence": "image/heif",
  "video/avi": "video/x-msvideo",
  "video/msvideo": "video/x-msvideo",
  "video/mkv": "video/x-matroska",
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/mpeg3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/x-aac": "audio/aac",
  "audio/aacp": "audio/aac",
  "audio/x-ogg": "audio/ogg",
  "application/ogg": "audio/ogg",
};

/** Comma-separated list of every allowed extension, for <input accept> */
export const ALLOWED_EXTENSION_ACCEPT = Object.keys(EXTENSION_MIME_TYPES).join(",");

/**
 * Resolve the MIME type to use for a file. Browsers often report an empty
 * type, application/octet-stream, or an alias (e.g. image/jpg, audio/x-wav)
 * for valid media such as HEIC, MKV or WAV. Falls back to the extension's
 * canonical type when the reported type is generic or in the same category.
 * Returns the reported type unchanged when nothing better is known.
 */
export function resolveMimeType(fileName: string, reportedType?: string | null): string {
  const type = (reportedType || "").trim().toLowerCase();
  if (ALLOWED_TYPES.includes(type)) return type;
  if (MIME_TYPE_ALIASES[type]) return MIME_TYPE_ALIASES[type];

  const dot = fileName.lastIndexOf(".");
  const fromExtension = dot >= 0 ? EXTENSION_MIME_TYPES[fileName.slice(dot).toLowerCase()] : undefined;
  if (fromExtension) {
    const generic = !type || type === "application/octet-stream" || type === "binary/octet-stream";
    if (generic || type.split("/")[0] === fromExtension.split("/")[0]) {
      return fromExtension;
    }
  }

  return reportedType || "application/octet-stream";
}

/**
 * Build an <input accept> value from MIME types / wildcards, adding the
 * matching extensions so OS file pickers don't hide files whose MIME type
 * the OS doesn't know (e.g. .heic or .mkv on Windows).
 */
export function buildAcceptAttribute(types: string[]): string {
  const extensions = Object.entries(EXTENSION_MIME_TYPES)
    .filter(([, mime]) =>
      types.some(
        (t) =>
          t === "*/*" ||
          t === mime ||
          (t.endsWith("/*") && mime.startsWith(t.slice(0, -1)))
      )
    )
    .map(([ext]) => ext);
  return [...types, ...extensions].join(",");
}

export function getFileCategory(mimeType: string): "image" | "video" | "audio" | "unknown" {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return "video";
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return "audio";
  return "unknown";
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
