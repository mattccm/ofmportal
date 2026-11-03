/**
 * The script staff paste into the browser console on app.contentsnare.com
 * (signed in) to export every request template to a JSON file, when their
 * Content Snare plan doesn't allow API tokens. It uses the sign-in Content
 * Snare's own app already keeps in that tab, calls the same API the app does,
 * only reads, and saves a file. The sign-in never leaves the tab or the file.
 * Imported by Templates > Import from Content Snare (lib/content-snare.ts, contentsFromExport).
 */

export const CONTENT_SNARE_EXPORT_FORMAT = "content-snare-export";

export const CONTENT_SNARE_EXPORT_SCRIPT = `(async () => {
  // CCM: export your Content Snare request templates to a file. Reads only.
  const API = "https://api.contentsnare.com/api/v1/";
  const NAMES = { accessToken: "access-token", client: "client", uid: "uid", expiry: "expiry", tokenType: "token-type" };
  const auth = {}, kept = {};
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i), m = key && key.match(/(?:^|[:._-])(accessToken|client|uid|expiry|tokenType)$/);
      if (!m || auth[NAMES[m[1]]]) continue;
      let value = store.getItem(key), json = false;
      try { const v = JSON.parse(value); if (typeof v === "string" || typeof v === "number") { value = String(v); json = true; } } catch (e) {}
      if (value) { auth[NAMES[m[1]]] = value; kept[NAMES[m[1]]] = { store, key, json }; }
    }
  }
  if (location.hostname.indexOf("contentsnare.com") < 0 || !auth["access-token"] || !auth.uid) {
    alert("Open app.contentsnare.com, sign in, then run this again in that tab.");
    return;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function get(path) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(API + path, { headers: Object.assign({ Accept: "application/json" }, auth) });
      // Content Snare may hand out a fresh sign-in with each answer: keep the app's copy current too
      const fresh = res.headers.get("access-token");
      if (fresh && fresh !== auth["access-token"]) {
        auth["access-token"] = fresh;
        const k = kept["access-token"];
        if (k) k.store.setItem(k.key, k.json ? JSON.stringify(fresh) : fresh);
        const exp = res.headers.get("expiry");
        if (exp && kept.expiry) { auth.expiry = exp; kept.expiry.store.setItem(kept.expiry.key, kept.expiry.json ? JSON.stringify(exp) : exp); }
      }
      if (res.status === 429) { await sleep(4000); continue; }
      if (res.status === 401) throw new Error("Content Snare signed you out. Sign in again and rerun this.");
      if (!res.ok) throw new Error(path + " answered " + res.status);
      await sleep(250);
      return res.json();
    }
    throw new Error("Content Snare is busy. Wait a minute and rerun this.");
  }
  try {
    console.log("CCM export: listing your request templates…");
    const cats = await get("template_categories?template_type[]=request&sort_by=name&sort_direction=asc");
    const list = [], seen = {};
    for (const c of (Array.isArray(cats) ? cats : cats.template_categories || cats.results || [])) {
      for (const t of (c.templates || [])) {
        if (t && t.id != null && !seen[t.id]) { seen[t.id] = 1; list.push({ id: t.id, name: t.name, description: t.description || "", category: c.name || "" }); }
      }
    }
    if (!list.length) { alert("No request templates found in this Content Snare account."); return; }
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      console.log("CCM export: " + (i + 1) + " of " + list.length + ": " + t.name);
      const entry = Object.assign({}, t, { template: null, pages: [], errors: [] });
      try {
        entry.template = await get("form_templates/" + t.id + "?include_all_content=true");
        const tabs = (entry.template && (entry.template.tabs_attributes || entry.template.tabs || entry.template.pages)) || [];
        for (const tab of tabs) {
          if (!tab || tab.id == null) continue;
          try { entry.pages.push(await get("tabs/" + tab.id + "?template=true")); }
          catch (e) { entry.errors.push("page " + tab.id + ": " + e.message); }
        }
      } catch (e) { entry.errors.push(e.message); }
      out.push(entry);
    }
    const file = JSON.stringify({ format: "${CONTENT_SNARE_EXPORT_FORMAT}", version: 1, exportedAt: new Date().toISOString(), templates: out });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([file], { type: "application/json" }));
    a.download = "content-snare-templates.json";
    document.body.appendChild(a); a.click(); a.remove();
    const failed = out.filter((t) => t.errors.length).length;
    alert("Saved " + out.length + " templates to content-snare-templates.json" + (failed ? " (" + failed + " with problems: see the console)" : "") + ". Import that file in CCM.");
    if (failed) console.warn("CCM export problems:", out.filter((t) => t.errors.length).map((t) => ({ name: t.name, errors: t.errors })));
  } catch (e) {
    alert("The export stopped: " + e.message);
  }
})();`;
