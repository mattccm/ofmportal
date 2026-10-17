"use client";

import { useCallback, useEffect, useState } from "react";

type Proxy = {
  host: string;
  port: string;
  username: string;
  password: string;
  app: string;
  expectIp: string;
};

const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;
type StepKey = (typeof STEP_KEYS)[number];
const PROGRESS_KEY = "cv-progress-v1";

const CSS = `
.cv-root{--bg:#f3f6f3;--surface:#fff;--raise:#fafcfa;--ink:#132017;--muted:#5a6a60;--line:#e0e8e2;
  --accent:#1f8a57;--accent-ink:#fff;--accent-soft:#e3f4ea;--good:#1f8a57;--good-soft:#e3f4ea;
  --warn:#b4701a;--warn-soft:#f8ecdc;--chip:#eaf1ec;
  --fsans:var(--font-inter),-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --fhead:var(--font-bricolage),var(--font-inter),sans-serif;--mono:var(--font-geist-mono),ui-monospace,Menlo,monospace;
  min-height:100%;background:var(--bg);color:var(--ink);font-family:var(--fsans);line-height:1.5}
@media (prefers-color-scheme:dark){.cv-root{--bg:#0d130f;--surface:#141c17;--raise:#18211b;--ink:#e8f0ea;
  --muted:#97a89d;--line:#273029;--accent:#36b579;--accent-ink:#06120b;--accent-soft:#16271d;
  --good:#36b579;--good-soft:#16271d;--warn:#e0a94a;--warn-soft:#271f12;--chip:#18211b}}
.cv-root *{box-sizing:border-box}
.cv-wrap{max-width:560px;margin:0 auto;padding:0 16px 56px}
.cv-top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);
  margin:0 -16px;padding:14px 16px 10px;border-bottom:1px solid var(--line)}
.cv-brand{display:flex;align-items:center;justify-content:space-between;gap:10px}
.cv-h1{font-family:var(--fhead);font-weight:700;font-size:18px;margin:0;letter-spacing:-.01em}
.cv-pct{font-family:var(--fhead);font-variant-numeric:tabular-nums;font-size:13px;color:var(--muted);font-weight:600}
.cv-bar{height:6px;border-radius:999px;background:var(--chip);margin-top:9px;overflow:hidden}
.cv-bar>i{display:block;height:100%;width:0;background:var(--accent);border-radius:999px;transition:width .35s ease}
.cv-intro{margin:18px 0 6px}
.cv-intro h2{font-family:var(--fhead);font-size:22px;line-height:1.2;margin:0 0 8px;text-wrap:balance}
.cv-intro p{color:var(--muted);margin:0 0 14px}
.cv-meta{display:flex;flex-wrap:wrap;gap:8px}
.cv-pill{display:inline-flex;align-items:center;background:var(--chip);color:var(--muted);font-size:12.5px;font-weight:600;padding:6px 11px;border-radius:999px}
.cv-steps{list-style:none;margin:20px 0 0;padding:0;display:flex;flex-direction:column;gap:14px}
.cv-step{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 15px}
.cv-step.done{border-color:color-mix(in srgb,var(--good) 45%,var(--line))}
.cv-shead{display:flex;gap:12px;align-items:flex-start}
.cv-num{flex:0 0 auto;width:30px;height:30px;border-radius:10px;background:var(--accent-soft);color:var(--accent);
  font-family:var(--fhead);font-weight:700;font-size:15px;display:grid;place-items:center;font-variant-numeric:tabular-nums}
.cv-step.done .cv-num{background:var(--good-soft);color:var(--good)}
.cv-stitle{font-family:var(--fhead);font-weight:600;font-size:16.5px;margin:3px 0 0;flex:1;min-width:0}
.cv-sbody{margin:11px 0 0}
.cv-sbody p{margin:0 0 10px;color:var(--muted)}
.cv-sbody p:last-child{margin-bottom:0}
.cv-sbody b{color:var(--ink);font-weight:600}
.cv-note{display:flex;gap:9px;background:var(--warn-soft);border-radius:11px;padding:11px 12px;margin-top:11px;font-size:13.5px;color:var(--ink)}
.cv-note.good{background:var(--good-soft)}
.cv-note .ic{flex:0 0 auto;font-weight:800;color:var(--warn)}
.cv-note.good .ic{color:var(--good)}
.cv-fields{margin-top:12px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--raise)}
.cv-frow{display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--line)}
.cv-frow:first-child{border-top:0}
.cv-flabel{flex:0 0 86px;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}
.cv-fval{flex:1;min-width:0;font-family:var(--mono);font-size:14px;word-break:break-all}
.cv-copy{flex:0 0 auto;border:1px solid var(--line);background:var(--surface);color:var(--accent);font-family:var(--fsans);
  font-weight:600;font-size:12.5px;padding:7px 12px;border-radius:9px;cursor:pointer}
.cv-copy.ok{color:var(--good);border-color:color-mix(in srgb,var(--good) 45%,var(--line))}
.cv-expect{display:flex;align-items:center;gap:10px;margin-top:12px;background:var(--good-soft);border-radius:12px;padding:12px}
.cv-expect .ip{font-family:var(--mono);font-weight:700;font-size:17px;color:var(--good)}
.cv-expect small{display:block;color:var(--muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.cv-check{display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:13px;border-top:1px dashed var(--line);cursor:pointer;user-select:none}
.cv-check input{width:20px;height:20px;accent-color:var(--good);flex:0 0 auto}
.cv-check span{font-size:14px;font-weight:600;color:var(--muted)}
.cv-step.done .cv-check span{color:var(--good)}
.cv-ts{margin-top:18px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:4px 15px}
.cv-ts summary{font-family:var(--fhead);font-weight:600;font-size:15px;padding:13px 0;cursor:pointer;list-style:none}
.cv-ts summary::-webkit-details-marker{display:none}
.cv-ts summary::after{content:"+";float:right;color:var(--muted);font-weight:700}
.cv-ts[open] summary::after{content:"\\2013"}
.cv-ts h4{margin:14px 0 4px;font-size:14px}
.cv-ts p{margin:0 0 6px;color:var(--muted);font-size:13.5px}
.cv-foot{margin-top:22px;color:var(--muted);font-size:12.5px;text-align:center}
.cv-gate{min-height:70vh;display:flex;align-items:center;justify-content:center;padding:24px 0}
.cv-card{width:100%;max-width:360px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:26px 22px;text-align:center}
.cv-lock{width:46px;height:46px;border-radius:13px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;margin:0 auto 14px;font-size:22px}
.cv-card h2{font-family:var(--fhead);font-size:19px;margin:0 0 6px}
.cv-card p{color:var(--muted);font-size:13.5px;margin:0 0 18px}
.cv-input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:11px;background:var(--raise);color:var(--ink);font:inherit;font-size:16px;text-align:center}
.cv-input:focus{outline:2px solid var(--accent);outline-offset:0;border-color:transparent}
.cv-btn{width:100%;margin-top:11px;border:none;border-radius:11px;padding:13px 14px;font-weight:700;font-size:15px;cursor:pointer;background:var(--accent);color:var(--accent-ink);font-family:var(--fsans)}
.cv-btn:disabled{opacity:.6;cursor:default}
.cv-err{color:#c23b3b;font-size:13px;min-height:18px;margin-top:10px}
.cv-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--bg);
  padding:9px 16px;border-radius:999px;font-size:13px;font-weight:600;opacity:0;transition:opacity .2s;pointer-events:none;z-index:50}
.cv-toast.show{opacity:1}
`;

function Field({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string, el: HTMLButtonElement) => void;
}) {
  return (
    <div className="cv-frow">
      <span className="cv-flabel">{label}</span>
      <span className="cv-fval">{value}</span>
      <button className="cv-copy" type="button" onClick={(e) => onCopy(value, e.currentTarget)}>
        Copy
      </button>
    </div>
  );
}

export default function CreatorVerifyPage() {
  const [locked, setLocked] = useState(true);
  const [pw, setPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [proxy, setProxy] = useState<Proxy | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // storage unavailable; start fresh
    }
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1500);
  }, []);

  const copy = useCallback(
    (text: string, el?: HTMLButtonElement) => {
      const ok = () => {
        flash("Copied");
        if (el) {
          const original = el.textContent;
          el.classList.add("ok");
          el.textContent = "Copied";
          window.setTimeout(() => {
            el.classList.remove("ok");
            el.textContent = original;
          }, 1400);
        }
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(ok, () => fallback(text) && ok());
      } else if (fallback(text)) {
        ok();
      }
    },
    [flash],
  );

  const unlock = useCallback(async () => {
    if (!pw || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/creatorverify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        const data = (await res.json()) as { proxy: Proxy };
        setProxy(data.proxy);
        setLocked(false);
      } else {
        setError("That password isn't right. Check with Matt.");
      }
    } catch {
      setError("Connection problem. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [pw, submitting]);

  const toggle = useCallback((key: StepKey, checked: boolean) => {
    setDone((prev) => {
      const next = { ...prev, [key]: checked };
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const completed = STEP_KEYS.filter((k) => done[k]).length;
  const pct = Math.round((completed / STEP_KEYS.length) * 100);

  if (locked) {
    return (
      <div className="cv-root">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="cv-wrap">
          <div className="cv-gate">
            <div className="cv-card">
              <div className="cv-lock" aria-hidden>
                &#128274;
              </div>
              <h2>Creator Verification</h2>
              <p>Enter the access password Matt gave you to open the guide.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void unlock();
                }}
              >
                <input
                  className="cv-input"
                  id="cv-password"
                  type="password"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="Access password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoFocus
                />
                <button className="cv-btn" type="submit" disabled={submitting || !pw}>
                  {submitting ? "Checking…" : "Unlock guide"}
                </button>
              </form>
              <div className="cv-err">{error}</div>
            </div>
          </div>
        </div>
        <div className={`cv-toast${toast ? " show" : ""}`}>{toast}</div>
      </div>
    );
  }

  const p = proxy as Proxy;
  const step = (key: StepKey, label: string) => (
    <label className="cv-check">
      <input type="checkbox" checked={!!done[key]} onChange={(e) => toggle(key, e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="cv-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cv-wrap">
        <header className="cv-top">
          <div className="cv-brand">
            <h1 className="cv-h1">Verification Walkthrough</h1>
            <span className="cv-pct">{pct}%</span>
          </div>
          <div className="cv-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </header>

        <section className="cv-intro">
          <h2>Set up the proxy, then do your selfie check</h2>
          <p>Follow these steps in order on your iPhone. Tap Copy on anything you need to paste. It takes about 10 minutes.</p>
          <div className="cv-meta">
            <span className="cv-pill">~10 minutes</span>
            <span className="cv-pill">Just a quick selfie</span>
            <span className="cv-pill">Good lighting</span>
            <span className="cv-pill">Keep the proxy ON the whole time</span>
          </div>
        </section>

        <ol className="cv-steps">
          <li className={`cv-step${done.s1 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">1</div>
              <h3 className="cv-stitle">Install the proxy app</h3>
            </div>
            <div className="cv-sbody">
              <p>
                On the iPhone, open the <b>App Store</b> and install <b>{p.app}</b> (free). It lets the phone use a proxy.
              </p>
            </div>
            {step("s1", "Installed")}
          </li>

          <li className={`cv-step${done.s2 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">2</div>
              <h3 className="cv-stitle">Add the proxy</h3>
            </div>
            <div className="cv-sbody">
              <p>
                Open {p.app} and add a new proxy. Choose type <b>SOCKS5</b>, turn <b>authentication on</b>, and enter the details
                below. Tap Copy and paste each one.
              </p>
              <div className="cv-fields">
                <div className="cv-frow">
                  <span className="cv-flabel">Type</span>
                  <span className="cv-fval">SOCKS5</span>
                </div>
                <Field label="Server" value={p.host} onCopy={copy} />
                <Field label="Port" value={p.port} onCopy={copy} />
                <Field label="Username" value={p.username} onCopy={copy} />
                <Field label="Password" value={p.password} onCopy={copy} />
              </div>
              <p style={{ marginTop: 11 }}>
                Give it any name you like, then <b>Save</b>.
              </p>
            </div>
            {step("s2", "Proxy added")}
          </li>

          <li className={`cv-step${done.s3 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">3</div>
              <h3 className="cv-stitle">Turn it on</h3>
            </div>
            <div className="cv-sbody">
              <p>
                Select the proxy you just added and tap the <b>connect toggle</b> so it turns on.
              </p>
              <p>
                The first time, iPhone asks to <b>Add VPN Configuration</b>. Tap <b>Allow</b> and confirm with Face ID or your
                passcode.
              </p>
              <div className="cv-note good">
                <span className="ic">&#10003;</span>
                <span>
                  You&rsquo;ll see a small <b>VPN</b> badge at the top of the screen. That means it&rsquo;s on.
                </span>
              </div>
            </div>
            {step("s3", "Connected (VPN badge showing)")}
          </li>

          <li className={`cv-step${done.s4 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">4</div>
              <h3 className="cv-stitle">Check it&rsquo;s working</h3>
            </div>
            <div className="cv-sbody">
              <p>
                Open <b>Safari</b> and go to <b>api.ipify.org</b>. It should show this exact number:
              </p>
              <div className="cv-expect">
                <div>
                  <small>You should see</small>
                  <span className="ip">{p.expectIp || "the IP Matt gave you"}</span>
                </div>
              </div>
              <div className="cv-note">
                <span className="ic">!</span>
                <span>If it shows a different number, the proxy isn&rsquo;t on. Go back to step 3 and connect, then check again.</span>
              </div>
            </div>
            {step("s4", "Shows the right IP")}
          </li>

          <li className={`cv-step${done.s5 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">5</div>
              <h3 className="cv-stitle">Get the verification link from Matt</h3>
            </div>
            <div className="cv-sbody">
              <p>
                <b>Ask Matt for the verification link.</b> These links refresh within about <b>10 minutes</b>, so message him once the
                proxy is on and you&rsquo;re ready.
              </p>
              <div className="cv-note">
                <span className="ic">!</span>
                <span>
                  Make sure you&rsquo;re <b>both online at the same time</b> so he can send a fresh link and you can open it right away
                  before it expires.
                </span>
              </div>
              <p style={{ marginTop: 11 }}>
                Open the link he sends in <b>Safari</b>, with the proxy still <b>ON</b>.
              </p>
            </div>
            {step("s5", "Opened Matt's link in Safari")}
          </li>

          <li className={`cv-step${done.s6 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">6</div>
              <h3 className="cv-stitle">Allow the camera</h3>
            </div>
            <div className="cv-sbody">
              <p>
                When Safari asks to use the <b>camera</b>, tap <b>Allow</b>. The page needs it for your selfie.
              </p>
              <div className="cv-note">
                <span className="ic">!</span>
                <span>
                  Tapped Don&rsquo;t Allow by accident? Go to <b>Settings &rsaquo; Safari &rsaquo; Camera &rsaquo; Allow</b>, then reopen
                  the link.
                </span>
              </div>
            </div>
            {step("s6", "Camera allowed")}
          </li>

          <li className={`cv-step${done.s7 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">7</div>
              <h3 className="cv-stitle">Take the selfie</h3>
            </div>
            <div className="cv-sbody">
              <p>
                It&rsquo;s a quick <b>selfie check</b> only. Center your face in the frame and follow the on-screen prompts (look
                straight at the camera, and move your head or blink if it asks).
              </p>
              <div className="cv-note good">
                <span className="ic">&#10003;</span>
                <span>
                  For the cleanest pass: bright, even light on your face; no hat, mask, or glasses glare; plain background; hold the
                  phone steady at eye level.
                </span>
              </div>
            </div>
            {step("s7", "Selfie submitted")}
          </li>

          <li className={`cv-step${done.s8 ? " done" : ""}`}>
            <div className="cv-shead">
              <div className="cv-num">8</div>
              <h3 className="cv-stitle">Finish</h3>
            </div>
            <div className="cv-sbody">
              <p>
                Wait for the page to say <b>submitted</b> or <b>complete</b>. Keep the proxy <b>ON</b> until you see that.
              </p>
              <p>
                Once it&rsquo;s confirmed, you can open {p.app} and <b>toggle it off</b>. Done.
              </p>
            </div>
            {step("s8", "Confirmation received")}
          </li>
        </ol>

        <details className="cv-ts">
          <summary>Something not working?</summary>
          <div>
            <h4>The page won&rsquo;t load or says verification failed</h4>
            <p>Check the proxy is on (VPN badge showing) and step 4 shows the right IP. Fully close Safari, reopen the link, and try again in a minute.</p>
            <h4>Stay on one connection</h4>
            <p>Don&rsquo;t switch between Wi-Fi and mobile data during the process. Pick one and keep it the whole time.</p>
            <h4>Camera is black or blocked</h4>
            <p>Settings &rsaquo; Safari &rsaquo; Camera &rsaquo; Allow. Also close other apps that might be using the camera.</p>
          </div>
        </details>

        <div className="cv-foot">Keep this page and password private.</div>
      </div>
      <div className={`cv-toast${toast ? " show" : ""}`}>{toast}</div>
    </div>
  );
}

function fallback(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
