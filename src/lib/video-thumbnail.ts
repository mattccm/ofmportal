/**
 * Video Thumbnail Generation
 *
 * Client-side utility to extract a frame from a video file as a thumbnail.
 * Uses the HTML5 video element and canvas to capture a frame.
 */

/**
 * Extract a thumbnail frame from a video file
 * @param file - The video file to extract from
 * @param seekTime - Time in seconds to capture the frame (default: 1 second)
 * @param maxWidth - Maximum width of the thumbnail (default: 480px)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns A Blob containing the thumbnail image, or null if extraction fails
 */
export async function extractVideoThumbnail(
  file: File,
  seekTime: number = 1,
  maxWidth: number = 480,
  quality: number = 0.8
): Promise<Blob | null> {
  return new Promise((resolve) => {
    // Only process video files
    if (!file.type.startsWith("video/")) {
      resolve(null);
      return;
    }

    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      resolve(null);
      return;
    }

    // Set up video element
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    // Create object URL for the video file
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    // Set a timeout for the operation
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 30000); // 30 second timeout

    const cleanup = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      video.src = "";
      video.load();
    };

    video.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });

    video.addEventListener("loadedmetadata", () => {
      // Seek to the desired time, capped by video duration
      const targetTime = Math.min(seekTime, video.duration * 0.1);
      video.currentTime = targetTime;
    });

    video.addEventListener("seeked", () => {
      try {
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = video.videoWidth / video.videoHeight;
        let width = Math.min(video.videoWidth, maxWidth);
        let height = width / aspectRatio;

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          "image/jpeg",
          quality
        );
      } catch (error) {
        console.error("Error capturing video frame:", error);
        cleanup();
        resolve(null);
      }
    });

    // Start loading the video
    video.load();
  });
}

/**
 * Convert a Blob to a File object
 */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type });
}

/**
 * Check if a file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}
