/* Plain helpers shared by server pages and client components. */

/** "1 photo · portrait", "Up to 5 files", "Text" from a template field */
export function fieldSpec(f: {
  type: string;
  quantity?: number;
  minFiles?: number;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  required?: boolean;
}): string {
  const parts: string[] = [];
  if (f.type === "file") {
    const kinds = f.acceptedFileTypes ?? [];
    const img = kinds.some((k) => k.startsWith("image"));
    const vid = kinds.some((k) => k.startsWith("video"));
    const noun = img && !vid ? "photo" : vid && !img ? "video" : "file";
    const n = f.quantity && f.quantity > 1 ? f.quantity : f.minFiles && f.minFiles > 1 ? f.minFiles : f.maxFiles;
    if (n && n > 1) parts.push(f.minFiles && f.maxFiles && f.minFiles !== f.maxFiles ? `${f.minFiles}–${f.maxFiles} ${noun}s` : `${n} ${noun}s`);
    else parts.push(`${noun === "file" ? "Files" : `${noun[0].toUpperCase()}${noun.slice(1)}s`}`);
  } else {
    const label: Record<string, string> = {
      text: "Text",
      textarea: "Long text",
      number: "Number",
      date: "Date",
      select: "Choice",
      checkbox: "Tick box",
    };
    parts.push(label[f.type] ?? "Text");
    if (f.quantity && f.quantity > 1) parts.push(`× ${f.quantity}`);
  }
  if (f.required === false) parts.push("optional");
  return parts.join(" · ");
}
