"use client";

import * as React from "react";
import { Bell, Check, Loader2, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Set up your phone": two tasks on the creator's home screen.
 *   1. Add CCM to the home screen. Done by itself the first time the portal
 *      is opened from there (the layout tells the server; see phone-ping).
 *   2. Turn on notifications (Web Push). On an iPhone this only works in the
 *      portal opened from the home screen, so it waits for task 1 there.
 * Hidden once both are done on this device; "Later" hides it for a week.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const LATER_KEY = "ccm-phone-setup-later";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function tokenHeader(): Record<string, string> {
  try {
    return { "x-creator-token": localStorage.getItem("creatorToken") || "" };
  } catch {
    return {};
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function platform() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  return { ios, android, phone: ios || android };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PushState = "unsupported" | "needs-home-screen" | "blocked" | "off" | "on";

export function PhoneSetup() {
  const [server, setServer] = React.useState<{ appInstalled: boolean; notifications: number; publicKey: string | null } | null>(null);
  const [push, setPush] = React.useState<PushState | null>(null);
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [later, setLater] = React.useState(false);
  const [{ ios, android, phone }] = React.useState(platform);
  const standalone = React.useMemo(() => isStandalone(), []);

  const readPush = React.useCallback(async (): Promise<PushState> => {
    // iPhones and iPads allow notifications only in the portal opened from the home screen, in every browser
    if (ios && !standalone) return "needs-home-screen";
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return "unsupported";
    if (Notification.permission === "denied") return "blocked";
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  }, [ios, standalone]);

  React.useEffect(() => {
    try {
      const at = Number(localStorage.getItem(LATER_KEY) || 0);
      setLater(Date.now() - at < WEEK);
    } catch {
      /* private mode: always show */
    }
    fetch("/api/portal/phone", { headers: tokenHeader() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setServer(d))
      .catch(() => {});
    readPush().then(setPush).catch(() => setPush("unsupported"));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [readPush]);

  if (!server || !push) return null;
  const homeDone = server.appInstalled || standalone;
  const pushDone = push === "on";
  if ((homeDone && pushDone) || later) return null;
  // Push isn't possible on this device and the app is already added: nothing left to do here
  if (homeDone && push === "unsupported") return null;

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      setInstallEvent(null);
      toast.success("Added. Open CCM from your home screen next time.");
    }
  };

  const turnOn = async () => {
    if (!server.publicKey) {
      toast.error("Notifications aren't set up on the portal yet. Ask your team.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPush(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(server.publicKey) as BufferSource }));
      const res = await fetch("/api/portal/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Notifications didn't turn on");
      setPush("on");
      setServer((s) => (s ? { ...s, notifications: s.notifications + 1 } : s));
      toast.success("Notifications are on. We just sent you one to check.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Notifications didn't turn on. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const hideForNow = () => {
    try {
      localStorage.setItem(LATER_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setLater(true);
  };

  const homeHow = installEvent ? null : ios ? (
    <>
      Tap <Share className="inline size-4 align-[-3px]" aria-label="Share" /> at the bottom of Safari, then <span className="font-semibold text-ink">Add to Home Screen</span>.
    </>
  ) : android ? (
    <>
      Open your browser&rsquo;s menu (⋮), then <span className="font-semibold text-ink">Add to Home screen</span> or{" "}
      <span className="font-semibold text-ink">Install app</span>.
    </>
  ) : (
    <>Open the portal on your phone to add it to your home screen.</>
  );

  const pushHow =
    push === "needs-home-screen"
      ? "On an iPhone, notifications work once CCM is on your home screen. Open it from there, then turn them on."
      : push === "blocked"
        ? "Notifications are blocked for CCM. Turn them on in your phone's settings for CCM (or this browser), then come back."
        : push === "unsupported"
          ? "This browser can't show notifications. Try the portal on your phone."
          : "Get a nudge on your phone when there's a new request, a reminder or feedback. Nothing private shows on the lock screen.";

  return (
    <section aria-labelledby="phone-setup-h" className="mt-5 max-w-[560px] rounded-[10px] bg-tile p-4 lg:mt-0 lg:max-w-none">
      <div className="flex items-start gap-3">
        <h2 id="phone-setup-h" className="flex-1 text-[17px] font-semibold leading-snug">
          Set up your phone
        </h2>
        <button
          type="button"
          onClick={hideForNow}
          className="min-h-9 rounded-md px-1 text-[14px] text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          Later
        </button>
      </div>
      <p className="text-[14px] leading-normal text-ink-2">Two quick steps so the portal works like an app.</p>

      <ol className="mt-3 divide-y divide-line">
        <Task
          done={homeDone}
          icon={<Smartphone aria-hidden="true" />}
          title="Add CCM to your home screen"
          doneText={standalone ? "Done. You're using it from your home screen." : "Done. Open CCM from your home screen."}
          how={homeHow}
          action={
            installEvent ? (
              <Button className="h-11 md:h-9" onClick={() => void install()}>
                Add to home screen
              </Button>
            ) : null
          }
          note={!phone && !installEvent ? null : !homeDone ? "This ticks itself off the first time you open CCM from your home screen." : null}
        />
        <Task
          done={pushDone}
          icon={<Bell aria-hidden="true" />}
          title="Turn on notifications"
          doneText="Done. You'll get a notification when there's something new."
          how={pushHow}
          action={
            push === "off" ? (
              <Button className="h-11 md:h-9" onClick={() => void turnOn()} disabled={busy} variant={homeDone ? "default" : "outline"}>
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                Turn on notifications
              </Button>
            ) : null
          }
          note={!pushDone && server.notifications > 0 && push === "off" ? "They're on for another device already; turn them on here too." : null}
        />
      </ol>
    </section>
  );
}

function Task({
  done,
  icon,
  title,
  doneText,
  how,
  action,
  note,
}: {
  done: boolean;
  icon: React.ReactNode;
  title: string;
  doneText: string;
  how: React.ReactNode;
  action: React.ReactNode;
  note?: string | null;
}) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4",
          done ? "bg-ink text-ground" : "bg-tile-hi text-icon"
        )}
      >
        {done ? <Check aria-hidden="true" strokeWidth={3} /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] font-semibold leading-snug", done && "text-ink-2")}>
          {title}
          <span className="sr-only">{done ? ": done" : ": to do"}</span>
        </p>
        <p className="mt-0.5 text-[14px] leading-normal text-ink-2">{done ? doneText : how}</p>
        {!done && note && <p className="mt-1 text-[13px] leading-normal text-ink-2">{note}</p>}
        {!done && action && <div className="mt-2.5">{action}</div>}
      </div>
    </li>
  );
}
