import { db } from "@/lib/db";
import { deleteStorageObjects } from "@/lib/storage";

/**
 * Upload and MediaItem rows can share a storage object: importing an upload
 * into the media library copies its storageKey/thumbnailKey instead of copying
 * the file. Before deleting an object we must check nothing else points at it.
 */

type MaybeKey = string | null | undefined;

/**
 * Return the subset of `keys` that no remaining Upload or MediaItem row
 * references (as storageKey or thumbnailKey). Rows listed in the exclude
 * options are the ones being deleted and are ignored.
 */
export async function findUnreferencedKeys(
  keys: MaybeKey[],
  exclude: { uploadIds?: string[]; mediaItemIds?: string[] } = {}
): Promise<string[]> {
  const unique = Array.from(new Set(keys.filter((k): k is string => Boolean(k))));
  if (unique.length === 0) return [];

  const excludeUploadIds = exclude.uploadIds ?? [];
  const excludeMediaItemIds = exclude.mediaItemIds ?? [];

  const [uploads, mediaItems] = await Promise.all([
    db.upload.findMany({
      where: {
        ...(excludeUploadIds.length > 0 && { id: { notIn: excludeUploadIds } }),
        OR: [{ storageKey: { in: unique } }, { thumbnailKey: { in: unique } }],
      },
      select: { storageKey: true, thumbnailKey: true },
    }),
    db.mediaItem.findMany({
      where: {
        ...(excludeMediaItemIds.length > 0 && { id: { notIn: excludeMediaItemIds } }),
        OR: [{ storageKey: { in: unique } }, { thumbnailKey: { in: unique } }],
      },
      select: { storageKey: true, thumbnailKey: true },
    }),
  ]);

  const stillUsed = new Set<string>();
  for (const row of [...uploads, ...mediaItems]) {
    stillUsed.add(row.storageKey);
    if (row.thumbnailKey) stillUsed.add(row.thumbnailKey);
  }

  return unique.filter((key) => !stillUsed.has(key));
}

/**
 * Best-effort: delete the storage objects in `keys` that no other Upload or
 * MediaItem row still references. Call this AFTER the DB delete has committed
 * (the deleted rows then no longer count as references). Never throws.
 */
export async function deleteUnreferencedStorageObjects(
  keys: MaybeKey[],
  exclude: { uploadIds?: string[]; mediaItemIds?: string[] } = {}
): Promise<{ deleted: string[]; failed: string[] }> {
  try {
    const unreferenced = await findUnreferencedKeys(keys, exclude);
    return await deleteStorageObjects(unreferenced);
  } catch (error) {
    console.error("Failed to clean up storage objects:", error);
    return { deleted: [], failed: [] };
  }
}
