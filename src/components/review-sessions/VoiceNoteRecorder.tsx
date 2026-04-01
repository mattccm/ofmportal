"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Send,
  Volume2,
  AlertCircle,
} from "lucide-react";

interface VoiceNoteRecorderProps {
  sessionId: string;
  uploadId: string;
  onSendVoiceNote: (audioBlob: Blob, duration: number) => Promise<void>;
  disabled?: boolean;
  maxDuration?: number; // Max recording duration in seconds
}

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
}

function AudioVisualizer({ analyser, isRecording }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current || !isRecording) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "rgb(240, 240, 240)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgb(239, 68, 68)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="rounded bg-muted"
    />
  );
}

export function VoiceNoteRecorder({
  sessionId,
  uploadId,
  onSendVoiceNote,
  disabled = false,
  maxDuration = 120, // 2 minutes default
}: VoiceNoteRecorderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [recordedUrl]);

  const checkPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      return true;
    } catch {
      setHasPermission(false);
      setError("Microphone permission denied. Please allow access to record voice notes.");
      return false;
    }
  };

  const startRecording = async () => {
    setError(null);

    // Check permission first
    const permitted = await checkPermission();
    if (!permitted) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Failed to start recording. Please check your microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration((prev) => {
            if (prev >= maxDuration - 1) {
              stopRecording();
              return prev;
            }
            return prev + 1;
          });
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const playRecording = () => {
    if (!recordedUrl) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(recordedUrl);
    audioRef.current = audio;

    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.play();
    setIsPlaying(true);
  };

  const discardRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const sendVoiceNote = async () => {
    if (!recordedBlob) return;

    setIsSending(true);
    setError(null);

    try {
      await onSendVoiceNote(recordedBlob, duration);
      discardRecording();
      setIsOpen(false);
    } catch (err) {
      console.error("Error sending voice note:", err);
      setError("Failed to send voice note. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Cleanup when closing
      if (isRecording) {
        stopRecording();
      }
      discardRecording();
    }
    setIsOpen(open);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground"
          title="Record voice note"
        >
          <Mic className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="top" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Voice Note</h4>
            {isRecording && (
              <Badge variant="destructive" className="gap-1">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                Recording
              </Badge>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Recording visualization */}
          {isRecording && (
            <div className="space-y-2">
              <AudioVisualizer
                analyser={analyserRef.current}
                isRecording={isRecording && !isPaused}
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatTime(duration)} / {formatTime(maxDuration)}
                </span>
                <Progress
                  value={(duration / maxDuration) * 100}
                  className="w-20 h-2"
                />
              </div>
            </div>
          )}

          {/* Recorded audio preview */}
          {recordedUrl && !isRecording && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playRecording}
                  className="h-10 w-10"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="h-8 bg-muted-foreground/20 rounded flex items-center px-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 mx-2 h-1 bg-muted-foreground/30 rounded">
                      <div
                        className={`h-full bg-primary rounded transition-all ${
                          isPlaying ? "animate-pulse" : ""
                        }`}
                        style={{ width: isPlaying ? "100%" : "0%" }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Duration: {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between">
            {!isRecording && !recordedUrl && (
              <Button
                onClick={startRecording}
                className="w-full gap-2"
                variant="destructive"
              >
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
            )}

            {isRecording && (
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={pauseRecording}
                >
                  {isPaused ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={stopRecording}
                  className="flex-1 gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop Recording
                </Button>
              </div>
            )}

            {recordedUrl && !isRecording && (
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={discardRecording}
                  title="Discard"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={startRecording}
                  className="gap-2"
                >
                  <Mic className="h-4 w-4" />
                  Re-record
                </Button>
                <Button
                  onClick={sendVoiceNote}
                  disabled={isSending}
                  className="flex-1 gap-2"
                >
                  {isSending ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default VoiceNoteRecorder;
