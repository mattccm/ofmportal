"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type VideoTimestamp,
  type VideoPlayerState,
  formatTimestamp,
  TIMESTAMP_TYPE_COLORS,
} from "@/types/video-timestamps";
import { TimelineMarkers } from "./timestamp-marker";

// ============================================
// TYPES
// ============================================

interface VideoPlayerWithTimestampsProps {
  src: string;
  poster?: string;
  timestamps: VideoTimestamp[];
  onTimeUpdate?: (time: number) => void;
  onAddTimestamp?: (time: number) => void;
  onTimestampSelect?: (timestamp: VideoTimestamp) => void;
  onTimestampResolve?: (id: string, resolved: boolean) => void;
  selectedTimestampId?: string;
  className?: string;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SEEK_STEP = 5; // seconds
const FRAME_STEP = 1 / 30; // ~1 frame at 30fps

// ============================================
// VIDEO PLAYER
// ============================================

export const VideoPlayerWithTimestamps = forwardRef<
  VideoPlayerRef,
  VideoPlayerWithTimestampsProps
>(function VideoPlayerWithTimestamps(
  {
    src,
    poster,
    timestamps,
    onTimeUpdate,
    onAddTimestamp,
    onTimestampSelect,
    onTimestampResolve,
    selectedTimestampId,
    className,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<VideoPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playbackRate: 1,
    isFullscreen: false,
    isMuted: false,
  });
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    getDuration: () => videoRef.current?.duration || 0,
    getVideoElement: () => videoRef.current,
  }));

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setState((prev) => ({ ...prev, duration: video.duration }));
    };

    const handleTimeUpdate = () => {
      setState((prev) => ({ ...prev, currentTime: video.currentTime }));
      onTimeUpdate?.(video.currentTime);
    };

    const handlePlay = () => {
      setState((prev) => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
    };

    const handleVolumeChange = () => {
      setState((prev) => ({
        ...prev,
        volume: video.volume,
        isMuted: video.muted,
      }));
    };

    const handleRateChange = () => {
      setState((prev) => ({ ...prev, playbackRate: video.playbackRate }));
    };

    const handleEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("ratechange", handleRateChange);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("ratechange", handleRateChange);
      video.removeEventListener("ended", handleEnded);
    };
  }, [onTimeUpdate]);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState((prev) => ({
        ...prev,
        isFullscreen: !!document.fullscreenElement,
      }));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          if (state.isPlaying) {
            video.pause();
          } else {
            video.play();
          }
          break;

        case "arrowleft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - SEEK_STEP);
          break;

        case "arrowright":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + SEEK_STEP);
          break;

        case "j":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;

        case "l":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;

        case ",":
          e.preventDefault();
          video.pause();
          video.currentTime = Math.max(0, video.currentTime - FRAME_STEP);
          break;

        case ".":
          e.preventDefault();
          video.pause();
          video.currentTime = Math.min(video.duration, video.currentTime + FRAME_STEP);
          break;

        case "m":
          e.preventDefault();
          if (e.shiftKey) {
            // Add marker at current time
            onAddTimestamp?.(video.currentTime);
          } else {
            // Toggle mute
            video.muted = !video.muted;
          }
          break;

        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;

        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          e.preventDefault();
          video.currentTime = (video.duration * parseInt(e.key)) / 10;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isPlaying, onAddTimestamp]);

  // Auto-hide controls
  useEffect(() => {
    if (state.isPlaying && !isDragging) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [state.isPlaying, isDragging, showControls]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (state.isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [state.isPlaying]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (state.isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [state.isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const setVolume = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value[0];
    video.muted = value[0] === 0;
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration));
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect || !state.duration) return;

      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const time = percentage * state.duration;
      seekTo(time);
    },
    [state.duration, seekTo]
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect || !state.duration) return;

      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      setHoverTime(percentage * state.duration);
      setHoverPosition(x);
    },
    [state.duration]
  );

  const handleProgressLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const jumpToTimestamp = useCallback(
    (time: number) => {
      seekTo(time);
    },
    [seekTo]
  );

  const jumpToNextTimestamp = useCallback(() => {
    const nextTimestamp = timestamps
      .filter((t) => t.timestamp > state.currentTime)
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    if (nextTimestamp) {
      seekTo(nextTimestamp.timestamp);
      onTimestampSelect?.(nextTimestamp);
    }
  }, [timestamps, state.currentTime, seekTo, onTimestampSelect]);

  const jumpToPrevTimestamp = useCallback(() => {
    const prevTimestamp = timestamps
      .filter((t) => t.timestamp < state.currentTime - 1)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (prevTimestamp) {
      seekTo(prevTimestamp.timestamp);
      onTimestampSelect?.(prevTimestamp);
    }
  }, [timestamps, state.currentTime, seekTo, onTimestampSelect]);

  const progressPercentage =
    state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden group",
        state.isFullscreen && "rounded-none",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => state.isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        onClick={togglePlayPause}
        playsInline
      />

      {/* Center Play Button (when paused) */}
      {!state.isPlaying && (
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
          onClick={togglePlayPause}
        >
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
            <Play className="h-10 w-10 text-gray-900 ml-1" />
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 pt-20",
          showControls || !state.isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress Bar with Timestamp Markers */}
        <div className="px-4 mb-2">
          {/* Timestamp markers */}
          <div className="relative h-6 mb-1">
            <TimelineMarkers
              timestamps={timestamps}
              duration={state.duration}
              currentTime={state.currentTime}
              onJumpTo={jumpToTimestamp}
              onResolve={onTimestampResolve || (() => {})}
              onSelect={onTimestampSelect || (() => {})}
              selectedTimestampId={selectedTimestampId}
            />
          </div>

          {/* Progress bar */}
          <div
            ref={progressRef}
            className="relative h-1.5 bg-white/30 rounded-full cursor-pointer group/progress"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={handleProgressLeave}
          >
            {/* Buffered progress */}
            <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" />

            {/* Played progress */}
            <div
              className="absolute inset-y-0 left-0 bg-white rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />

            {/* Progress handle */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-md transition-transform",
                "opacity-0 group-hover/progress:opacity-100",
                isDragging && "opacity-100 scale-125"
              )}
              style={{ left: `${progressPercentage}%` }}
            />

            {/* Hover time tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute bottom-full mb-2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded"
                style={{ left: hoverPosition }}
              >
                {formatTimestamp(hoverTime)}
              </div>
            )}
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-2 px-4 pb-4">
          {/* Play/Pause */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/20"
                  onClick={togglePlayPause}
                >
                  {state.isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {state.isPlaying ? "Pause (Space)" : "Play (Space)"}
              </TooltipContent>
            </Tooltip>

            {/* Skip buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => seekTo(state.currentTime - SEEK_STEP)}
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rewind 5s (Left Arrow)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => seekTo(state.currentTime + SEEK_STEP)}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Forward 5s (Right Arrow)</TooltipContent>
            </Tooltip>

            {/* Timestamp navigation */}
            {timestamps.length > 0 && (
              <>
                <div className="w-px h-6 bg-white/30 mx-1" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-white hover:bg-white/20"
                      onClick={jumpToPrevTimestamp}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous timestamp</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-white hover:bg-white/20"
                      onClick={jumpToNextTimestamp}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next timestamp</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Volume */}
            <div className="flex items-center gap-1 group/volume">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-white hover:bg-white/20"
                    onClick={toggleMute}
                  >
                    {state.isMuted || state.volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{state.isMuted ? "Unmute" : "Mute"} (M)</TooltipContent>
              </Tooltip>

              <div className="w-0 overflow-hidden transition-all group-hover/volume:w-20">
                <Slider
                  value={[state.isMuted ? 0 : state.volume]}
                  max={1}
                  step={0.1}
                  onValueChange={setVolume}
                  className="w-20"
                />
              </div>
            </div>

            {/* Time display */}
            <div className="text-white text-sm font-mono ml-2">
              {formatTimestamp(state.currentTime)}
              <span className="text-white/60"> / {formatTimestamp(state.duration)}</span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Add timestamp button */}
            {onAddTimestamp && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 gap-1.5"
                    onClick={() => onAddTimestamp(state.currentTime)}
                  >
                    <Plus className="h-4 w-4" />
                    Add marker
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add timestamp marker (Shift+M)</TooltipContent>
              </Tooltip>
            )}

            {/* Playback speed */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20 font-mono"
                    >
                      {state.playbackRate}x
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Playback speed</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className="justify-between"
                  >
                    {rate}x
                    {state.playbackRate === rate && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fullscreen */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                >
                  {state.isFullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {state.isFullscreen ? "Exit fullscreen" : "Fullscreen"} (F)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Timestamp count indicator */}
      {timestamps.length > 0 && (
        <div className="absolute top-4 right-4 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-sm font-medium flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          {timestamps.length} {timestamps.length === 1 ? "marker" : "markers"}
        </div>
      )}
    </div>
  );
});

export default VideoPlayerWithTimestamps;
