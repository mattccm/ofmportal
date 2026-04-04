"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  SkipBack,
  SkipForward,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
  className?: string;
  poster?: string;
  onLoad?: () => void;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function VideoPlayer({ src, className, poster, onLoad }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState("1");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Check PiP support
  useEffect(() => {
    setIsPiPSupported(document.pictureInPictureEnabled);
  }, []);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered(bufferedEnd);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("progress", handleProgress);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    setShowControls(true);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [isPlaying, resetControlsTimer]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
        case "j":
          e.preventDefault();
          skip(-10);
          break;
        case "l":
          e.preventDefault();
          skip(10);
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
          const percent = parseInt(e.key) / 10;
          video.currentTime = duration * percent;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [duration]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = Math.min(Math.max(video.volume + delta, 0), 1);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      video.duration
    );
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const progress = progressRef.current;
      if (!video || !progress) return;

      const rect = progress.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      video.currentTime = pos * duration;
    },
    [duration]
  );

  const handleSpeedChange = useCallback((value: string) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = parseFloat(value);
    setPlaybackSpeed(value);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isPiPSupported) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP error:", err);
    }
  }, [isPiPSupported]);

  const formatTime = useCallback((time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden group w-full max-w-4xl max-h-[calc(100dvh-10rem)]",
        isFullscreen && "rounded-none max-w-none max-h-none",
        className
      )}
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full max-h-[calc(100dvh-10rem)] object-contain"
        style={isFullscreen ? { maxHeight: 'none' } : undefined}
        onClick={togglePlay}
        playsInline
        onLoadedData={onLoad}
      />

      {/* Big play button overlay */}
      {!isPlaying && (
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/30"
          onClick={togglePlay}
        >
          <div className="rounded-full bg-white/90 p-4 transition-transform hover:scale-110">
            <Play className="h-12 w-12 text-black fill-current" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 transition-opacity duration-300",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer group/progress"
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div
            className="absolute h-1 bg-white/50 rounded-full"
            style={{ width: `${bufferedProgress}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-1 bg-white rounded-full transition-all group-hover/progress:h-1.5"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/20"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/20"
            onClick={() => skip(-10)}
            title="Back 10s (J)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/20"
            onClick={() => skip(10)}
            title="Forward 10s (L)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          {/* Volume */}
          <div className="flex items-center gap-1 group/volume">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={toggleMute}
              title="Mute (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                setIsMuted(val === 0);
                if (videoRef.current) {
                  videoRef.current.volume = val;
                  videoRef.current.muted = val === 0;
                }
              }}
              className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-white h-1 cursor-pointer"
            />
          </div>

          {/* Time display */}
          <span className="text-white text-sm ml-2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Playback speed */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 text-xs gap-1"
              >
                <Settings className="h-3 w-3" />
                {playbackSpeed}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[100px]">
              <DropdownMenuRadioGroup
                value={playbackSpeed}
                onValueChange={handleSpeedChange}
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <DropdownMenuRadioItem key={speed} value={speed.toString()}>
                    {speed}x
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Picture-in-Picture */}
          {isPiPSupported && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/20"
              onClick={togglePiP}
              title="Picture-in-Picture (P)"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </Button>
          )}

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/20"
            onClick={toggleFullscreen}
            title="Fullscreen (F)"
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div
        className={cn(
          "absolute top-4 right-4 text-xs text-white/50 bg-black/30 px-2 py-1 rounded transition-opacity",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        Space: Play/Pause | Arrows: Seek/Volume | F: Fullscreen
      </div>
    </div>
  );
}
