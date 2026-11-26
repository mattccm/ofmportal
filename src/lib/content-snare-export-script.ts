/**
 * The scripts staff paste into the browser console on app.contentsnare.com
 * (signed in) when their Content Snare plan doesn't allow API tokens: one
 * exports the request templates they tick, the other their clients' open
 * requests, each to a JSON file. They use the sign-in Content Snare's own app
 * already keeps in that tab, call the same API the app does, only read, and
 * save a file. The sign-in never leaves the tab or the file.
 * Templates are imported by Templates > Import from Content Snare
 * (lib/content-snare.ts, contentsFromExport).
 */

export const CONTENT_SNARE_EXPORT_FORMAT = "content-snare-export";
export const CONTENT_SNARE_REQUESTS_EXPORT_FORMAT = "content-snare-requests-export";

// ---------- shared by both scripts (plain JS, run in the page) ----------

/** The tab's sign-in, and get(path) against Content Snare's app API. Stops the script when signed out. */
const SIGN_IN = `  const API = "https://api.contentsnare.com/api/v1/";
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
  // Cancel stops the script at its next read
  const STOP = new Error("stopped");
  let stopped = false;
  async function get(path) {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (stopped) throw STOP;
      let res;
      // A dropped connection ("Failed to fetch") gets another go
      try { res = await fetch(API + path, { headers: Object.assign({ Accept: "application/json" }, auth) }); }
      catch (e) { if (attempt === 3) throw new Error("Couldn't reach Content Snare (" + e.message + ")"); await sleep(2000 * (attempt + 1)); continue; }
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
  function save(name, data) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
`;

/**
 * dialog(title, intro, find): an overlay on this page, in its own shadow root.
 * ui.say(text, done, total) shows what it's doing (a bar when total is known);
 * ui.pick([{ name, sub, ticked, value }]) lets them tick what to export and
 * resolves the ticked values (null when cancelled), switching to the working
 * view the moment they click Export; ui.close(). Cancel stops the script.
 * fmt(n) writes a number the way they read them (6,093).
 */
const DIALOG = `  const fmt = (n) => Number(n).toLocaleString();
  function dialog(title, intro, find) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML =
      "<style>" +
      ".back{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:15px/1.45 system-ui,sans-serif}" +
      ".box{background:#1b1d22;color:#eceef2;width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);display:flex;flex-direction:column;border-radius:12px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5)}" +
      "h2{margin:0 0 4px;font-size:18px}p{margin:0 0 12px;color:#a6aab3}[hidden]{display:none!important}" +
      ".pick{display:flex;flex-direction:column;flex:1;min-height:0}" +
      "input[type=search]{background:#0e0f12;color:#eceef2;border:1px solid #3a3d45;border-radius:8px;padding:9px 12px;font:inherit}" +
      ".bar{display:flex;gap:8px;align-items:center;margin:10px 0}.count{margin-left:auto;color:#a6aab3;font-size:13px}" +
      "ul{list-style:none;margin:0;padding:0;overflow:auto;flex:1;min-height:0;border-radius:8px;background:#0e0f12}" +
      "li label{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;cursor:pointer;border-bottom:1px solid #26282e}" +
      "li small{display:block;color:#a6aab3}input[type=checkbox]{width:18px;height:18px;margin-top:2px;accent-color:#eceef2}" +
      "button{font:inherit;border-radius:8px;padding:8px 14px;border:1px solid #3a3d45;background:transparent;color:#eceef2;cursor:pointer}" +
      "button:focus-visible,input:focus-visible{outline:2px solid #ffd23f;outline-offset:2px}" +
      ".go{background:#ffd23f;color:#0e0f12;border-color:#ffd23f;font-weight:600}.go:disabled{opacity:.5;cursor:not-allowed}" +
      ".foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}" +
      ".work{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:8px;background:#0e0f12}" +
      ".line{display:flex;gap:12px;align-items:center}" +
      ".spin{flex:none;width:18px;height:18px;border-radius:50%;border:2px solid #3a3d45;border-top-color:#ffd23f;animation:spin .8s linear infinite}" +
      "@keyframes spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.spin{animation:none}}" +
      ".track{height:6px;border-radius:3px;background:#26282e;overflow:hidden}.fill{height:100%;width:0;background:#ffd23f;transition:width .3s}" +
      "</style>" +
      "<div class=back><div class=box role=dialog aria-modal=true aria-labelledby=h>" +
      "<h2 id=h></h2><p class=intro></p>" +
      "<div class=pick hidden><input type=search>" +
      "<div class=bar><button type=button data-all>Tick all shown</button><button type=button data-none>Clear</button><span class=count aria-live=polite></span></div>" +
      "<ul></ul></div>" +
      "<div class=work hidden><div class=line role=status><span class=spin aria-hidden=true></span><span class=msg></span></div>" +
      "<div class=track role=progressbar aria-label=Progress aria-valuemin=0 aria-valuemax=100 hidden><div class=fill></div></div></div>" +
      "<div class=foot><button type=button data-cancel>Cancel</button><button type=button class=go data-go hidden>Export</button></div>" +
      "</div></div>";
    const $ = (s) => root.querySelector(s);
    $("h2").textContent = title;
    $(".intro").textContent = intro;
    const ul = $("ul"), search = $("input[type=search]"), count = $(".count"), go = $("[data-go]"), pickArea = $(".pick");
    const work = $(".work"), msg = $(".msg"), track = $(".track"), fill = $(".fill");
    search.placeholder = find;
    search.setAttribute("aria-label", find);
    let chose = null;
    const close = () => host.remove();
    const cancel = () => { stopped = true; close(); if (chose) chose(null); };
    const say = (text, done, total) => {
      work.hidden = false;
      msg.textContent = text;
      track.hidden = !(total > 0);
      if (total > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
        fill.style.width = pct + "%";
        track.setAttribute("aria-valuenow", String(pct));
      }
    };
    $("[data-cancel]").addEventListener("click", cancel);
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") cancel(); });
    document.body.appendChild(host);
    $("[data-cancel]").focus();
    return {
      say,
      close,
      pick: (list) => {
        const rows = list.map((item) => {
          const li = document.createElement("li"), label = document.createElement("label"), box = document.createElement("input"), text = document.createElement("span"), sub = document.createElement("small");
          box.type = "checkbox";
          box.checked = !!item.ticked;
          text.textContent = item.name;
          sub.textContent = item.sub || "";
          text.appendChild(sub); label.appendChild(box); label.appendChild(text); li.appendChild(label); ul.appendChild(li);
          return { item, li, box, words: (item.name + " " + (item.sub || "")).toLowerCase() };
        });
        const update = () => {
          const n = rows.filter((r) => r.box.checked).length;
          count.textContent = n + " of " + fmt(rows.length) + " ticked";
          go.disabled = n === 0;
          go.textContent = n ? "Export " + n : "Export";
        };
        ul.addEventListener("change", update);
        search.addEventListener("input", () => {
          const q = search.value.trim().toLowerCase();
          for (const r of rows) r.li.style.display = !q || r.words.indexOf(q) >= 0 ? "" : "none";
        });
        $("[data-all]").addEventListener("click", () => { for (const r of rows) if (r.li.style.display !== "none") r.box.checked = true; update(); });
        $("[data-none]").addEventListener("click", () => { for (const r of rows) r.box.checked = false; update(); });
        update();
        work.hidden = true;
        pickArea.hidden = false;
        go.hidden = false;
        search.focus();
        return new Promise((resolve) => {
          chose = resolve;
          go.addEventListener("click", () => {
            const ticked = rows.filter((r) => r.box.checked).map((r) => r.item.value);
            if (!ticked.length) return;
            chose = null;
            // The working view, straight away
            pickArea.hidden = true;
            go.hidden = true;
            $(".intro").textContent = "Keep this tab open until the file is saved. Cancel stops it.";
            say("Starting…");
            $("[data-cancel]").focus();
            resolve(ticked);
          });
        });
      },
    };
  }
`;

const plural = (one: string, many: string) => `(n) => fmt(n) + (n === 1 ? " ${one}" : " ${many}")`;

// ---------- request templates ----------

export const CONTENT_SNARE_EXPORT_SCRIPT = `(async () => {
  // CCM: export your Content Snare request templates to a file. Reads only.
${SIGN_IN}${DIALOG}  const templates = ${plural("template", "templates")};
  const ui = dialog("Export templates to CCM", "Tick the templates to export. Nothing changes in Content Snare.", "Find a template");
  try {
    ui.say("Listing your request templates…");
    const cats = await get("template_categories?template_type[]=request&sort_by=name&sort_direction=asc");
    const list = [], seen = {};
    for (const c of (Array.isArray(cats) ? cats : cats.template_categories || cats.results || [])) {
      for (const t of (c.templates || [])) {
        if (t && t.id != null && !seen[t.id]) { seen[t.id] = 1; list.push({ id: t.id, name: t.name, description: t.description || "", category: c.name || "" }); }
      }
    }
    if (!list.length) { ui.close(); alert("No request templates found in this Content Snare account."); return; }
    // A template open on this page starts ticked
    const open = location.pathname.match(new RegExp("templates/requests?/([0-9]+)"));
    const chosen = await ui.pick(list.map((t) => ({ name: t.name || "Untitled", sub: [t.category, t.description].filter(Boolean).join(" · "), ticked: !!open && String(t.id) === open[1], value: t })));
    if (!chosen) { console.log("CCM export: cancelled."); return; }
    const out = [];
    for (let i = 0; i < chosen.length; i++) {
      const t = chosen[i];
      ui.say("Exporting template " + (i + 1) + " of " + chosen.length + ": " + t.name, i, chosen.length);
      const entry = Object.assign({}, t, { template: null, pages: [], errors: [] });
      try {
        entry.template = await get("form_templates/" + t.id + "?include_all_content=true");
        // The pages are in template.content.tabs_attributes; each is loaded too, for its example files
        const tpl = entry.template || {}, content = tpl.content || {};
        const tabs = content.tabs_attributes || tpl.tabs_attributes || content.tabs || tpl.tabs || [];
        for (const tab of tabs) {
          if (!tab || tab.id == null) continue;
          try { entry.pages.push(await get("tabs/" + tab.id + "?template=true")); }
          catch (e) { if (e === STOP) throw e; entry.errors.push("page " + tab.id + ": " + e.message); }
        }
      } catch (e) { if (e === STOP) throw e; entry.errors.push(e.message); }
      out.push(entry);
    }
    ui.close();
    save("content-snare-templates.json", { format: "${CONTENT_SNARE_EXPORT_FORMAT}", version: 1, exportedAt: new Date().toISOString(), templates: out });
    const failed = out.filter((t) => t.errors.length).length;
    alert("Saved " + templates(out.length) + " to content-snare-templates.json" + (failed ? " (" + failed + " with problems: see the console)" : "") + ". Import that file in CCM.");
    if (failed) console.warn("CCM export problems:", out.filter((t) => t.errors.length).map((t) => ({ name: t.name, errors: t.errors })));
  } catch (e) {
    ui.close();
    if (e === STOP) console.log("CCM export: cancelled.");
    else alert("The export stopped: " + e.message);
  }
})();`;

// ---------- clients' open requests ----------

/**
 * Lists the clients, and for each one ticked reads only their requests (the
 * list narrowed to that client) to save the open ones (sent, waiting for
 * approval or past due) with their pages: questions, instructions, answers and
 * the uploaded files' details.
 */
export const CONTENT_SNARE_REQUESTS_EXPORT_SCRIPT = `(async () => {
  // CCM: export your Content Snare clients' open requests to a file. Reads only.
${SIGN_IN}${DIALOG}  const requests = ${plural("request", "requests")}, clients = ${plural("client", "clients")}, files = ${plural("file", "files")};
  const OPEN = { published: 1, waiting: 1, expired: 1 };
  const rowsOf = (page) => Array.isArray(page) ? page : (page && (page.results || page.requests)) || [];
  const totalOf = (page) => page && page.pagination && typeof page.pagination.total_count === "number" ? page.pagination.total_count : null;
  const nameOf = (c) => c.full_name || c.email || "Unnamed client";
  const lower = (v) => String(v || "").trim().toLowerCase();
  // Who a request is for: its client assignments (or plain clients)
  const clientsOf = (r) => {
    const out = [];
    for (const a of (r && r.client_assignments) || []) { const c = a && (a.client || a.external_client); if (c) out.push(c); }
    if (!out.length) for (const c of (r && r.clients) || []) if (c && typeof c === "object") out.push(c);
    return out;
  };
  const same = (x, c) => {
    const ids = [c.id, c.client_id].concat(c.related_internal_client_ids || []).filter((v) => v != null).map(String);
    return [x.id, x.client_id].some((v) => v != null && ids.indexOf(String(v)) >= 0) || (!!lower(x.email) && lower(x.email) === lower(c.email));
  };
  const size = (b) => b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : Math.max(1, Math.round(b / 1e6)) + " MB";
  const ui = dialog("Export requests to CCM", "Tick the clients whose open requests you want in CCM. Nothing changes in Content Snare.", "Find a client");
  try {
    ui.say("Listing your clients…");
    const people = [], seenClient = {};
    let total = null, offset = 0;
    for (let n = 0; n < 1000; n++) {
      const page = await get("combined_clients?merge_similar=true&limit=100&offset=" + offset);
      const rows = rowsOf(page);
      total = totalOf(page);
      for (const c of rows) if (c && c.id != null && !c.archived && !seenClient[c.id]) { seenClient[c.id] = 1; people.push(c); }
      offset += rows.length;
      ui.say("Listing your clients: " + fmt(offset) + (total ? " of " + fmt(total) : "") + "…", offset, total);
      if (!rows.length || (total != null ? offset >= total : rows.length < 100)) break;
    }
    if (!people.length) { ui.close(); alert("No clients found in this Content Snare account."); return; }
    people.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const chosen = await ui.pick(people.map((c) => ({ name: nameOf(c), sub: c.full_name ? c.email : "", value: c })));
    if (!chosen) { console.log("CCM export: cancelled."); return; }

    // Their open requests. A row that doesn't say who it's for is read in full to find out.
    const full = {}, found = {}, order = [];
    const forWhom = async (r) => {
      let cs = clientsOf(r);
      if (!cs.length) { full[r.id] = full[r.id] || await get("requests/" + r.id); cs = clientsOf(full[r.id]); }
      return chosen.filter((c) => cs.some((x) => same(x, c)));
    };
    ui.say("Finding " + (chosen.length === 1 ? nameOf(chosen[0]) + "'s" : "their") + " open requests…");
    const everyone = totalOf(await get("requests?limit=1"));
    // Reads the list (narrowed by filter when given); false when Content Snare didn't narrow it
    const scan = async (filter, label) => {
      let total = null, offset = 0, open = 0;
      for (let n = 0; n < 1000; n++) {
        const page = await get("requests?" + filter + "limit=100&offset=" + offset);
        const rows = rowsOf(page);
        total = totalOf(page);
        if (n === 0 && filter && everyone != null && total === everyone) return false;
        for (let j = 0; j < rows.length; j++) {
          const r = rows[j], checked = offset + j + 1;
          ui.say(label + ": " + fmt(checked) + (total ? " of " + fmt(total) : "") + " checked" + (open ? ", " + fmt(open) + " open so far" : ""), checked, total);
          if (!r || r.id == null || !OPEN[r.status] || found[r.id]) continue;
          const whose = await forWhom(r);
          if (whose.length) { found[r.id] = { listed: r, clients: whose }; order.push(r.id); open++; }
        }
        offset += rows.length;
        if (!rows.length || (total != null ? offset >= total : rows.length < 100)) break;
      }
      return true;
    };
    let narrowed = true;
    for (const c of chosen) {
      if (!(await scan("filter_by[clients][]=" + encodeURIComponent(c.id) + "&", "Finding " + nameOf(c) + "'s open requests"))) { narrowed = false; break; }
    }
    if (!narrowed) await scan("", "Content Snare couldn't narrow the list, so checking all your requests");
    const without = chosen.filter((c) => !order.some((id) => found[id].clients.indexOf(c) >= 0)).map(nameOf);
    if (!order.length) { ui.close(); alert((chosen.length === 1 ? nameOf(chosen[0]) + " has" : "None of them has") + " no open requests in Content Snare."); return; }

    const out = [];
    let fileCount = 0, bytes = 0;
    for (let i = 0; i < order.length; i++) {
      const { listed, clients: whose } = found[order[i]];
      const doing = "Exporting request " + (i + 1) + " of " + order.length + ": " + (listed.name || "Untitled");
      ui.say(doing, i, order.length);
      const entry = { id: listed.id, name: listed.name, status: listed.status, clients: whose.map((c) => ({ id: c.id, full_name: c.full_name, email: c.email })), listed, request: null, pages: [], errors: [] };
      try {
        entry.request = full[listed.id] || await get("requests/" + listed.id);
        const tabs = (entry.request.tabs_attributes || []).filter((tab) => tab && tab.id != null);
        for (let j = 0; j < tabs.length; j++) {
          const tab = tabs[j];
          if (tabs.length > 1) ui.say(doing + ", page " + (j + 1) + " of " + tabs.length, i + j / tabs.length, order.length);
          try { entry.pages.push(await get("tabs/" + tab.id)); }
          catch (e) { if (e === STOP) throw e; entry.errors.push("page " + tab.id + ": " + e.message); }
        }
      } catch (e) { if (e === STOP) throw e; entry.errors.push(e.message); }
      for (const p of entry.pages) for (const s of p.sections_attributes || []) for (const f of s.fields_attributes || []) for (const a of f.answers || []) {
        if (a && a.attachment) { fileCount++; bytes += Number(a.attachment.byte_size) || 0; }
      }
      out.push(entry);
    }
    ui.close();
    save("content-snare-requests.json", { format: "${CONTENT_SNARE_REQUESTS_EXPORT_FORMAT}", version: 1, exportedAt: new Date().toISOString(), clients: chosen, requests: out });
    const failed = out.filter((r) => r.errors.length).length;
    alert("Saved " + requests(out.length) + " for " + clients(chosen.length - without.length) + " to content-snare-requests.json, with " + files(fileCount) + (bytes ? " (" + size(bytes) + ")" : "") + " uploaded so far" +
      (without.length ? ". No open requests for " + without.join(", ") : "") + (failed ? ". " + failed + " had problems: see the console" : "") + ". Import that file in CCM.");
    if (failed) console.warn("CCM export problems:", out.filter((r) => r.errors.length).map((r) => ({ name: r.name, errors: r.errors })));
  } catch (e) {
    ui.close();
    if (e === STOP) console.log("CCM export: cancelled.");
    else alert("The export stopped: " + e.message);
  }
})();`;
