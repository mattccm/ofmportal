"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================
// CAMERA ACCESS HOOK
// ============================================

export interface CameraOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}

export interface CameraState {
  stream: MediaStream | null;
  error: Error | null;
  isActive: boolean;
  hasPermission: boolean | null;
}

export function useCamera(options: CameraOptions = {}) {
  const [state, setState] = useState<CameraState>({
    stream: null,
    error: null,
    isActive: false,
    hasPermission: null,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: options.facingMode || "environment",
          width: options.width ? { ideal: options.width } : undefined,
          height: options.height ? { ideal: options.height } : undefined,
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setState({
        stream,
        error: null,
        isActive: true,
        hasPermission: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      const err = error as Error;
      setState((prev) => ({
        ...prev,
        error: err,
        isActive: false,
        hasPermission: err.name === "NotAllowedError" ? false : prev.hasPermission,
      }));
      throw error;
    }
  }, [options.facingMode, options.width, options.height]);

  const stopCamera = useCallback(() => {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      setState((prev) => ({
        ...prev,
        stream: null,
        isActive: false,
      }));
    }
  }, [state.stream]);

  const capturePhoto = useCallback((): string | null => {
    if (!videoRef.current || !state.isActive) return null;

    const canvas = document.createElement("canvas");
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, [state.isActive]);

  const switchCamera = useCallback(async () => {
    stopCamera();
    const newFacingMode =
      options.facingMode === "user" ? "environment" : "user";
    return startCamera();
  }, [options.facingMode, stopCamera, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.stream) {
        state.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
  };
}

// ============================================
// VIBRATION API HOOK
// ============================================

export interface VibrationOptions {
  enabled?: boolean;
}

export function useVibration(options: VibrationOptions = {}) {
  const { enabled = true } = options;
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(
      typeof navigator !== "undefined" && "vibrate" in navigator
    );
  }, []);

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (!enabled || !isSupported) return false;
      return navigator.vibrate(pattern);
    },
    [enabled, isSupported]
  );

  const vibrateLight = useCallback(() => vibrate(10), [vibrate]);
  const vibrateMedium = useCallback(() => vibrate(25), [vibrate]);
  const vibrateHeavy = useCallback(() => vibrate(50), [vibrate]);
  const vibrateSuccess = useCallback(() => vibrate([10, 50, 10]), [vibrate]);
  const vibrateError = useCallback(() => vibrate([50, 100, 50]), [vibrate]);
  const vibrateWarning = useCallback(() => vibrate([30, 50, 30]), [vibrate]);

  const stopVibration = useCallback(() => {
    if (isSupported) {
      navigator.vibrate(0);
    }
  }, [isSupported]);

  return {
    isSupported,
    vibrate,
    vibrateLight,
    vibrateMedium,
    vibrateHeavy,
    vibrateSuccess,
    vibrateError,
    vibrateWarning,
    stopVibration,
  };
}

// ============================================
// SHARE API HOOK
// ============================================

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export interface ShareResult {
  shared: boolean;
  error?: Error;
}

export function useShare() {
  const [isSupported, setIsSupported] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsSupported("share" in navigator);
      setCanShareFiles("canShare" in navigator);
    }
  }, []);

  const share = useCallback(
    async (data: ShareData): Promise<ShareResult> => {
      if (!isSupported) {
        return {
          shared: false,
          error: new Error("Web Share API is not supported"),
        };
      }

      try {
        // Check if we can share files
        if (data.files && data.files.length > 0) {
          if (!canShareFiles) {
            return {
              shared: false,
              error: new Error("File sharing is not supported"),
            };
          }

          const canShare = navigator.canShare?.({ files: data.files });
          if (!canShare) {
            return {
              shared: false,
              error: new Error("These files cannot be shared"),
            };
          }
        }

        await navigator.share(data);
        return { shared: true };
      } catch (error) {
        const err = error as Error;
        // User cancelled sharing is not an error
        if (err.name === "AbortError") {
          return { shared: false };
        }
        return { shared: false, error: err };
      }
    },
    [isSupported, canShareFiles]
  );

  const shareUrl = useCallback(
    async (url: string, title?: string, text?: string) => {
      return share({ url, title, text });
    },
    [share]
  );

  const shareText = useCallback(
    async (text: string, title?: string) => {
      return share({ text, title });
    },
    [share]
  );

  const shareFile = useCallback(
    async (file: File, title?: string, text?: string) => {
      return share({ files: [file], title, text });
    },
    [share]
  );

  const shareFiles = useCallback(
    async (files: File[], title?: string, text?: string) => {
      return share({ files, title, text });
    },
    [share]
  );

  return {
    isSupported,
    canShareFiles,
    share,
    shareUrl,
    shareText,
    shareFile,
    shareFiles,
  };
}

// ============================================
// ONLINE/OFFLINE DETECTION HOOK
// ============================================

export interface NetworkState {
  isOnline: boolean;
  wasOffline: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NetworkInformation {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

export function useOnlineStatus() {
  const [state, setState] = useState<NetworkState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    wasOffline: false,
  });

  useEffect(() => {
    const updateOnlineStatus = () => {
      setState((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
        wasOffline: prev.wasOffline || !navigator.onLine,
      }));
    };

    const updateNetworkInfo = () => {
      const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
      if (connection) {
        setState((prev) => ({
          ...prev,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        }));
      }
    };

    // Initial network info
    updateNetworkInfo();

    // Listen for online/offline events
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    // Listen for network info changes
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection) {
      connection.addEventListener("change", updateNetworkInfo);
    }

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      if (connection) {
        connection.removeEventListener("change", updateNetworkInfo);
      }
    };
  }, []);

  const resetWasOffline = useCallback(() => {
    setState((prev) => ({ ...prev, wasOffline: false }));
  }, []);

  return {
    ...state,
    resetWasOffline,
  };
}

// ============================================
// DEVICE DETECTION HOOK
// ============================================

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isPWA: boolean;
  hasNotch: boolean;
  prefersReducedMotion: boolean;
  prefersDarkMode: boolean;
  hasTouch: boolean;
}

export function useDeviceInfo(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    isAndroid: false,
    isPWA: false,
    hasNotch: false,
    prefersReducedMotion: false,
    prefersDarkMode: false,
    hasTouch: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent;

    const isMobile =
      /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
      window.innerWidth < 768;

    const isTablet =
      /iPad/i.test(ua) ||
      (window.innerWidth >= 768 && window.innerWidth < 1024 && "ontouchstart" in window);

    const isIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as Window & { MSStream?: unknown }).MSStream;

    const isAndroid = /Android/i.test(ua);

    const isPWA =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    // Check for notch (iPhone X and later)
    const hasNotch =
      isIOS &&
      window.screen.height >= 812 &&
      !window.matchMedia("(orientation: landscape)").matches;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const prefersDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const hasTouch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;

    setInfo({
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      isIOS,
      isAndroid,
      isPWA,
      hasNotch,
      prefersReducedMotion,
      prefersDarkMode,
      hasTouch,
    });

    // Listen for preference changes
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      setInfo((prev) => ({ ...prev, prefersDarkMode: e.matches }));
    };

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setInfo((prev) => ({ ...prev, prefersReducedMotion: e.matches }));
    };

    darkModeQuery.addEventListener("change", handleDarkModeChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      darkModeQuery.removeEventListener("change", handleDarkModeChange);
      reducedMotionQuery.removeEventListener(
        "change",
        handleReducedMotionChange
      );
    };
  }, []);

  return info;
}

// ============================================
// SCREEN ORIENTATION HOOK
// ============================================

export type Orientation = "portrait" | "landscape";

export function useScreenOrientation() {
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOrientation = () => {
      if (screen.orientation) {
        const type = screen.orientation.type;
        setOrientation(
          type.includes("portrait") ? "portrait" : "landscape"
        );
        setAngle(screen.orientation.angle);
      } else {
        // Fallback for older browsers
        setOrientation(
          window.innerHeight > window.innerWidth ? "portrait" : "landscape"
        );
        setAngle(
          (window as Window & { orientation?: number }).orientation || 0
        );
      }
    };

    updateOrientation();

    if (screen.orientation) {
      screen.orientation.addEventListener("change", updateOrientation);
    } else {
      window.addEventListener("orientationchange", updateOrientation);
    }
    window.addEventListener("resize", updateOrientation);

    return () => {
      if (screen.orientation) {
        screen.orientation.removeEventListener("change", updateOrientation);
      } else {
        window.removeEventListener("orientationchange", updateOrientation);
      }
      window.removeEventListener("resize", updateOrientation);
    };
  }, []);

  const lockOrientation = useCallback(async (lockType: "any" | "natural" | "landscape" | "portrait" | "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary") => {
    const orientation = screen.orientation as { lock?: (type: string) => Promise<void> };
    if (orientation?.lock) {
      try {
        await orientation.lock(lockType);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const unlockOrientation = useCallback(() => {
    if (screen.orientation?.unlock) {
      screen.orientation.unlock();
    }
  }, []);

  return {
    orientation,
    angle,
    isPortrait: orientation === "portrait",
    isLandscape: orientation === "landscape",
    lockOrientation,
    unlockOrientation,
  };
}

// ============================================
// SAFE AREA INSETS HOOK
// ============================================

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);

      setInsets({
        top:
          parseInt(
            computedStyle.getPropertyValue("--sat") ||
              computedStyle.getPropertyValue("env(safe-area-inset-top)") ||
              "0"
          ) || 0,
        right:
          parseInt(
            computedStyle.getPropertyValue("--sar") ||
              computedStyle.getPropertyValue("env(safe-area-inset-right)") ||
              "0"
          ) || 0,
        bottom:
          parseInt(
            computedStyle.getPropertyValue("--sab") ||
              computedStyle.getPropertyValue("env(safe-area-inset-bottom)") ||
              "0"
          ) || 0,
        left:
          parseInt(
            computedStyle.getPropertyValue("--sal") ||
              computedStyle.getPropertyValue("env(safe-area-inset-left)") ||
              "0"
          ) || 0,
      });
    };

    // Create a temporary element to measure CSS env values
    const measureDiv = document.createElement("div");
    measureDiv.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      right: env(safe-area-inset-right, 0px);
      bottom: env(safe-area-inset-bottom, 0px);
      left: env(safe-area-inset-left, 0px);
      pointer-events: none;
      visibility: hidden;
    `;
    document.body.appendChild(measureDiv);

    const rect = measureDiv.getBoundingClientRect();
    setInsets({
      top: rect.top,
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.bottom,
      left: rect.left,
    });

    document.body.removeChild(measureDiv);

    window.addEventListener("resize", updateInsets);
    window.addEventListener("orientationchange", updateInsets);

    return () => {
      window.removeEventListener("resize", updateInsets);
      window.removeEventListener("orientationchange", updateInsets);
    };
  }, []);

  return insets;
}

// ============================================
// BATTERY STATUS HOOK
// ============================================

interface BatteryManager {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

export interface BatteryState {
  isSupported: boolean;
  level: number | null;
  charging: boolean | null;
  chargingTime: number | null;
  dischargingTime: number | null;
}

export function useBatteryStatus(): BatteryState {
  const [state, setState] = useState<BatteryState>({
    isSupported: false,
    level: null,
    charging: null,
    chargingTime: null,
    dischargingTime: null,
  });

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("getBattery" in navigator)
    ) {
      return;
    }

    let battery: BatteryManager | null = null;

    const updateBatteryInfo = () => {
      if (!battery) return;
      setState({
        isSupported: true,
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      });
    };

    (navigator as Navigator & { getBattery: () => Promise<BatteryManager> })
      .getBattery()
      .then((bat) => {
        battery = bat;
        updateBatteryInfo();

        battery.addEventListener("levelchange", updateBatteryInfo);
        battery.addEventListener("chargingchange", updateBatteryInfo);
        battery.addEventListener("chargingtimechange", updateBatteryInfo);
        battery.addEventListener("dischargingtimechange", updateBatteryInfo);
      })
      .catch(() => {
        // Battery API not available
      });

    return () => {
      if (battery) {
        battery.removeEventListener("levelchange", updateBatteryInfo);
        battery.removeEventListener("chargingchange", updateBatteryInfo);
        battery.removeEventListener("chargingtimechange", updateBatteryInfo);
        battery.removeEventListener("dischargingtimechange", updateBatteryInfo);
      }
    };
  }, []);

  return state;
}

// ============================================
// COMBINED MOBILE FEATURES HOOK
// ============================================

export function useMobileFeatures() {
  const camera = useCamera();
  const vibration = useVibration();
  const share = useShare();
  const network = useOnlineStatus();
  const device = useDeviceInfo();
  const orientation = useScreenOrientation();
  const safeArea = useSafeAreaInsets();
  const battery = useBatteryStatus();

  return {
    camera,
    vibration,
    share,
    network,
    device,
    orientation,
    safeArea,
    battery,
  };
}
