import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { LOCAL_UPLOAD_DIR, fileExists, getPublicFileUrl, uploadToStorage, useLocalStorage } from "./storage";

/**
 * Template and request example files (public by design, under template-assets/).
 * Server only.
 */

export const TEMPLATE_ASSETS_PREFIX = "template-assets";

const isLocal = process.env.R2_ENDPOINT?.includes("localhost");
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "upload-portal";

/** Where an example file can be seen once stored */
export function templateAssetUrl(key: string): string {
  const publicUrl = getPublicFileUrl(key);
  if (publicUrl) return publicUrl;

  // Local development: served by the local stand-in for R2
  if (isLocal) return `${process.env.R2_ENDPOINT}/${BUCKET_NAME}/${key}`;

  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (!publicDomain) {
    console.error(
      "R2_PUBLIC_DOMAIN is not set. Template asset URLs will not work. " +
      "Set R2_PUBLIC_DOMAIN to your custom domain or r2.dev URL."
    );
    return `https://missing-r2-public-domain/${key}`;
  }
  return `https://${publicDomain}/${key}`;
}

/** Store an example file the server fetched itself */
export async function saveTemplateAsset(key: string, data: Uint8Array, contentType: string): Promise<void> {
  if (useLocalStorage) {
    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return;
  }
  await uploadToStorage(key, data, contentType);
}

export const templateAssetExists = (key: string) => fileExists(key);
