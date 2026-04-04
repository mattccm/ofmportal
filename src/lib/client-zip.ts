import JSZip from "jszip";

export interface FileToZip {
  url: string;
  fileName: string;
  folder?: string;
}

export interface ZipProgress {
  phase: "fetching" | "zipping" | "complete";
  current: number;
  total: number;
  fileName?: string;
}

/**
 * Creates a ZIP file from a list of file URLs, downloading them directly
 * from storage (R2/S3) without going through Vercel's serverless functions.
 *
 * This saves Vercel bandwidth - files are fetched directly from the CDN
 * to the user's browser, then zipped client-side.
 */
export async function createZipFromUrls(
  files: FileToZip[],
  onProgress?: (progress: ZipProgress) => void
): Promise<Blob> {
  const zip = new JSZip();
  const total = files.length;

  // Track filenames to handle duplicates
  const usedNames = new Map<string, number>();

  // Download all files and add to zip
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    onProgress?.({
      phase: "fetching",
      current: i + 1,
      total,
      fileName: file.fileName,
    });

    try {
      // Fetch file directly from R2/storage URL
      const response = await fetch(file.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${file.fileName}: ${response.status}`);
        continue;
      }

      const blob = await response.blob();

      // Handle duplicate filenames
      let finalName = file.fileName;
      const folderPath = file.folder || "";
      const fullPath = folderPath ? `${folderPath}/${file.fileName}` : file.fileName;

      const count = usedNames.get(fullPath) || 0;
      if (count > 0) {
        const lastDot = file.fileName.lastIndexOf(".");
        if (lastDot > 0) {
          const name = file.fileName.substring(0, lastDot);
          const ext = file.fileName.substring(lastDot);
          finalName = `${name} (${count})${ext}`;
        } else {
          finalName = `${file.fileName} (${count})`;
        }
      }
      usedNames.set(fullPath, count + 1);

      // Add to zip with optional folder structure
      const zipPath = folderPath ? `${folderPath}/${finalName}` : finalName;
      zip.file(zipPath, blob);
    } catch (error) {
      console.error(`Error fetching ${file.fileName}:`, error);
      // Continue with other files
    }
  }

  onProgress?.({
    phase: "zipping",
    current: total,
    total,
  });

  // Generate the zip file
  const zipBlob = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (metadata) => {
      // This callback is called during compression
      if (metadata.percent === 100) {
        onProgress?.({
          phase: "complete",
          current: total,
          total,
        });
      }
    }
  );

  return zipBlob;
}

/**
 * Triggers a download of a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads multiple files individually (no ZIP)
 */
export async function downloadFilesIndividually(
  files: FileToZip[],
  onProgress?: (current: number, total: number, fileName: string) => void,
  delayBetween = 300
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length, file.fileName);

    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Small delay between downloads to prevent browser blocking
    if (i < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayBetween));
    }
  }
}
