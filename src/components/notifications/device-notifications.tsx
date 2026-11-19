"use client";

import * as React from "react";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isStandalone } from "@/components/portal/phone-setup";
import { cn } from "@/lib/utils";

/**
 * Notifications on this device (Web Push).
 * Staff: new messages, comments and mentions reach a computer or phone with
 * CCM closed. Settings > Notifications has the full card; the Messages page
 * offers it once (variant "prompt", hidden after "Not now" or once it's on).
 * Creators (audience "creator", variant "plain" in their Settings): new
 * requests, reminders and feedback on their phone, turned on or off here as
 * well as on the "Set up your phone" card.
 */

type Audience = "staff" | "creator";

const API: Record<Audience, string> = { staff: "/api/notifications/push", creator: "/api/portal/phone" };

function headersFor(audience: Audience): Record<string, string> {
  if (audience !== "creator") return {};
  try {
    return { "x-creator-token": localStorage.getItem("creatorToken") || "" };
  } catch {
    return {};
  }
}

type State = "loading" | "unsupported" | "needs-home-screen" | "blocked" | "off" | "on";

const LATER_KEY = "ccm-staff-push-later";
const MONTH = 30 * 24 * 60 * 60 * 1000;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export function DeviceNotifications({
  variant = "card",
  audience = "staff",
  className,
}: {
  variant?: "card" | "prompt" | "plain";
  audience?: Audience;
  className?: string;
}) {
  const [state, setState] = React.useState<State>("loading");
  const [publicKey, setPublicKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<false | "on" | "off" | "test">(false);
  const [later, setLater] = React.useState(false);

  const read = React.useCallback(async () => {
    try {
      if (variant === "prompt") {
        try {
          setLater(Date.now() - Number(localStorage.getItem(LATER_KEY) || 0) < MONTH);
        } catch {
          /* private mode: offer it */
        }
      }
      // iPhones and iPads allow notifications only in CCM opened from the home screen
      if (isIos() && !isStandalone()) return setState("needs-home-screen");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const sub = Notification.permission === "granted" ? await currentSubscription() : null;
      const res = await fetch(`${API[audience]}${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ""}`, { cache: "no-store", headers: headersFor(audience) });
      const data = res.ok ? await res.json() : {};
      setPublicKey(data.publicKey ?? null);
      setState(sub && data.thisDevice ? "on" : "off");
    } catch {
      setState("unsupported");
    }
  }, [variant, audience]);

  React.useEffect(() => {
    void read();
  }, [read]);

  const register = async (sub: PushSubscription) => {
    const res = await fetch(API[audience], {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headersFor(audience) },
      body: JSON.stringify(audience === "creator" ? { action: "subscribe", subscription: sub.toJSON() } : { subscription: sub.toJSON() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Notifications didn't turn on");
    return data as { testSent?: boolean };
  };

  const turnOn = async () => {
    if (!publicKey) {
      toast.error("Notifications aren't set up on the portal yet.");
      return;
    }
    setBusy("on");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource }));
      const { testSent } = await register(sub);
      setState("on");
      toast.success(testSent ? "Notifications are on. We just sent one to check." : "Notifications are on for this device.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Notifications didn't turn on. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      const sub = await currentSubscription();
      if (!sub) {
        setState("off");
        return;
      }
      const { testSent } = await register(sub);
      toast(testSent ? "Sent. It should arrive in a moment." : "It didn't send. Turn notifications off and on again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It didn't send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy("off");
    try {
      const sub = await currentSubscription();
      if (sub) {
        await fetch(API[audience], {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...headersFor(audience) },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setState("off");
      toast(audience === "creator" ? "Notifications are off on this phone." : "Notifications are off for this device.");
    } catch {
      toast.error("That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const notNow = () => {
    try {
      localStorage.setItem(LATER_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setLater(true);
  };

  if (variant === "prompt") {
    // Only an offer that can be taken up right here
    if (later || state !== "off") return null;
    return (
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--tw-r-tile)] bg-tile px-4 py-3", className)} role="region" aria-label="Notifications on this device">
        <Bell className="size-4 shrink-0 text-icon" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm">
          Get a notification when someone writes, even with CCM closed.
          <span className="text-ink-2"> It says who wrote, never what.</span>
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void turnOn()} disabled={!!busy}>
            {busy === "on" && <Loader2 className="animate-spin" aria-hidden="true" />}
            Turn on
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Not now" onClick={notNow}>
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  const creatorText: Record<State, string> = {
    loading: "Checking this phone…",
    unsupported: "This browser can't show notifications. Open CCM on your phone to turn them on.",
    "needs-home-screen":
      "On an iPhone, notifications work in CCM added to your home screen: tap Share, then Add to Home Screen, open it from there, and turn them on here.",
    blocked: "Notifications are blocked for CCM. Allow them in your phone's settings for CCM (or this browser), then come back.",
    off: "Off. Turn them on to get a nudge when there's a new request, a reminder or feedback. Nothing private shows on the lock screen.",
    on: "On for this phone. You'll get a nudge when there's a new request, a reminder or feedback.",
  };
  const text: Record<State, string> = audience === "creator" ? creatorText : {
    loading: "Checking this device…",
    unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari on a computer, or CCM on your phone.",
    "needs-home-screen":
      "On an iPhone or iPad, add CCM to your home screen first (Share, then Add to Home Screen), open it from there, then turn these on.",
    blocked: "Notifications are blocked for CCM in this browser. Allow them in the browser's site settings for portal.of-m.com, then come back.",
    off: "Get a notification on this computer or phone when a creator or teammate writes, comments or mentions you, even with CCM closed. It says who, never what was said.",
    on: "On for this device. New messages, comments and mentions reach it with CCM closed. What reaches you follows your settings below.",
  };

  const buttons = (state === "off" || state === "on") && (
    <div className="mt-3 flex flex-wrap gap-2">
      {state === "off" ? (
        <Button className="h-11 md:h-9" onClick={() => void turnOn()} disabled={!!busy}>
          {busy === "on" && <Loader2 className="animate-spin" aria-hidden="true" />}
          Turn on notifications
        </Button>
      ) : (
        <>
          <Button variant="outline" className="h-11 md:h-9" onClick={() => void sendTest()} disabled={!!busy}>
            {busy === "test" && <Loader2 className="animate-spin" aria-hidden="true" />}
            Send a test
          </Button>
          <Button variant="ghost" className="h-11 md:h-9" onClick={() => void turnOff()} disabled={!!busy}>
            {busy === "off" && <Loader2 className="animate-spin" aria-hidden="true" />}
            Turn off
          </Button>
        </>
      )}
    </div>
  );

  if (variant === "plain") {
    return (
      <div className={className}>
        <p className="text-[14px] leading-normal text-ink-2" aria-live="polite">
          {text[state]}
        </p>
        {buttons}
      </div>
    );
  }

  return (
    <section aria-labelledby="device-notifications-h" className={cn("rounded-[var(--tw-r-tile)] bg-tile p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tile-hi text-icon [&_svg]:size-4" aria-hidden="true">
          {state === "on" ? <Bell /> : <BellOff />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="device-notifications-h" className="text-[17px] font-semibold leading-snug">
            Notifications on this device
          </h2>
          <p className="mt-0.5 text-sm text-ink-2" aria-live="polite">
            {text[state]}
          </p>
          {buttons}
        </div>
      </div>
    </section>
  );
}
