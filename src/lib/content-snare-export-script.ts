/**
 * The script staff paste into the browser console on app.contentsnare.com
 * (signed in) to export the request templates they tick to a JSON file, when their
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
  // Pick what to export: an overlay on this page, in its own shadow root
  function picker(list) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML =
      "<style>" +
      ".back{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:15px/1.45 system-ui,sans-serif}" +
      ".box{background:#1b1d22;color:#eceef2;width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);display:flex;flex-direction:column;border-radius:12px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5)}" +
      "h2{margin:0 0 4px;font-size:18px}p{margin:0 0 12px;color:#a6aab3}" +
      "input[type=search]{background:#0e0f12;color:#eceef2;border:1px solid #3a3d45;border-radius:8px;padding:9px 12px;font:inherit}" +
      ".bar{display:flex;gap:8px;align-items:center;margin:10px 0}.count{margin-left:auto;color:#a6aab3;font-size:13px}" +
      "ul{list-style:none;margin:0;padding:0;overflow:auto;flex:1;border-radius:8px;background:#0e0f12}" +
      "li label{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;cursor:pointer;border-bottom:1px solid #26282e}" +
      "li small{display:block;color:#a6aab3}input[type=checkbox]{width:18px;height:18px;margin-top:2px;accent-color:#eceef2}" +
      "button{font:inherit;border-radius:8px;padding:8px 14px;border:1px solid #3a3d45;background:transparent;color:#eceef2;cursor:pointer}" +
      "button:focus-visible,input:focus-visible{outline:2px solid #ffd23f;outline-offset:2px}" +
      ".go{background:#ffd23f;color:#0e0f12;border-color:#ffd23f;font-weight:600}.go:disabled{opacity:.5;cursor:not-allowed}" +
      ".foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.status{color:#a6aab3;margin-top:10px;min-height:1.4em}" +
      "</style>" +
      "<div class=back><div class=box role=dialog aria-modal=true aria-labelledby=h>" +
      "<h2 id=h>Export templates to CCM</h2><p>Tick the templates to export. Nothing changes in Content Snare.</p>" +
      "<input type=search placeholder='Find a template' aria-label='Find a template'>" +
      "<div class=bar><button type=button data-all>Tick all shown</button><button type=button data-none>Clear</button><span class=count aria-live=polite></span></div>" +
      "<ul></ul><div class=status role=status></div>" +
      "<div class=foot><button type=button data-cancel>Cancel</button><button type=button class=go data-go>Export</button></div>" +
      "</div></div>";
    const ul = root.querySelector("ul"), search = root.querySelector("input[type=search]"), count = root.querySelector(".count");
    const go = root.querySelector("[data-go]"), status = root.querySelector(".status");
    // A template open on this page starts ticked
    const open = location.pathname.match(new RegExp("templates/requests?/([0-9]+)"));
    const rows = list.map((t) => {
      const li = document.createElement("li"), label = document.createElement("label"), box = document.createElement("input"), text = document.createElement("span"), cat = document.createElement("small");
      box.type = "checkbox";
      box.checked = !!open && String(t.id) === open[1];
      text.textContent = t.name || "Untitled";
      cat.textContent = [t.category, t.description].filter(Boolean).join(" · ");
      text.appendChild(cat); label.appendChild(box); label.appendChild(text); li.appendChild(label); ul.appendChild(li);
      return { t, li, box };
    });
    const update = () => {
      const n = rows.filter((r) => r.box.checked).length;
      count.textContent = n + " of " + rows.length + " ticked";
      go.disabled = n === 0;
      go.textContent = n ? "Export " + n : "Export";
    };
    ul.addEventListener("change", update);
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      for (const r of rows) r.li.style.display = !q || (r.t.name + " " + r.t.category + " " + r.t.description).toLowerCase().indexOf(q) >= 0 ? "" : "none";
    });
    root.querySelector("[data-all]").addEventListener("click", () => { for (const r of rows) if (r.li.style.display !== "none") r.box.checked = true; update(); });
    root.querySelector("[data-none]").addEventListener("click", () => { for (const r of rows) r.box.checked = false; update(); });
    update();
    document.body.appendChild(host);
    search.focus();
    return new Promise((resolve) => {
      const done = (chosen) => {
        if (!chosen) host.remove();
        resolve(chosen && {
          list: chosen,
          say: (msg) => { status.textContent = msg; },
          close: () => host.remove(),
        });
      };
      root.querySelector("[data-cancel]").addEventListener("click", () => done(null));
      root.addEventListener("keydown", (e) => { if (e.key === "Escape") done(null); });
      go.addEventListener("click", () => {
        const chosen = rows.filter((r) => r.box.checked).map((r) => r.t);
        if (!chosen.length) return;
        for (const el of root.querySelectorAll("button,input")) el.disabled = true;
        done(chosen);
      });
    });
  }
  let picked = null;
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
    picked = await picker(list);
    if (!picked) { console.log("CCM export: cancelled."); return; }
    const chosen = picked.list;
    const out = [];
    for (let i = 0; i < chosen.length; i++) {
      const t = chosen[i];
      picked.say("Exporting " + (i + 1) + " of " + chosen.length + ": " + t.name);
      console.log("CCM export: " + (i + 1) + " of " + chosen.length + ": " + t.name);
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
    picked.close();
    const file = JSON.stringify({ format: "${CONTENT_SNARE_EXPORT_FORMAT}", version: 1, exportedAt: new Date().toISOString(), templates: out });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([file], { type: "application/json" }));
    a.download = "content-snare-templates.json";
    document.body.appendChild(a); a.click(); a.remove();
    const failed = out.filter((t) => t.errors.length).length;
    alert("Saved " + out.length + (out.length === 1 ? " template" : " templates") + " to content-snare-templates.json" + (failed ? " (" + failed + " with problems: see the console)" : "") + ". Import that file in CCM.");
    if (failed) console.warn("CCM export problems:", out.filter((t) => t.errors.length).map((t) => ({ name: t.name, errors: t.errors })));
  } catch (e) {
    if (picked) picked.close();
    alert("The export stopped: " + e.message);
  }
})();`;
