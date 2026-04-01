"use client";

import * as React from "react";
import { useState, useRef } from "react";
import {
  MessageSquarePlus,
  Star,
  Bug,
  Lightbulb,
  MessageCircle,
  Camera,
  X,
  Send,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FeedbackType } from "@/types/feedback";

interface FeedbackOption {
  value: FeedbackType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  bgColor: string;
}

const feedbackOptions: FeedbackOption[] = [
  {
    value: "BUG",
    label: "Bug Report",
    icon: <Bug className="h-5 w-5" />,
    description: "Something isn't working correctly",
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50",
  },
  {
    value: "FEATURE_REQUEST",
    label: "Feature Request",
    icon: <Lightbulb className="h-5 w-5" />,
    description: "Suggest a new feature or improvement",
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50",
  },
  {
    value: "GENERAL",
    label: "General Feedback",
    icon: <MessageCircle className="h-5 w-5" />,
    description: "Share your thoughts and experiences",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50",
  },
];

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"type" | "details" | "success">("type");
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setStep("type");
    setFeedbackType(null);
    setRating(0);
    setHoveredRating(0);
    setMessage("");
    setScreenshot(null);
    setScreenshotPreview(null);
    setError(null);
  };

  const handleOpen = () => {
    setIsOpen(true);
    resetForm();
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  const handleTypeSelect = (type: FeedbackType) => {
    setFeedbackType(type);
    setStep("details");
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Screenshot must be less than 5MB");
        return;
      }
      setScreenshot(file);
      setScreenshotPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
      setScreenshotPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!feedbackType || !message.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // In a real app, you would upload the screenshot first and get a URL
      // For now, we'll skip screenshot upload
      let screenshotUrl: string | undefined;

      if (screenshot) {
        // TODO: Implement screenshot upload to storage
        // For now, we'll create a data URL for demo purposes
        // In production, upload to S3/R2 and get the URL
        console.log("Screenshot would be uploaded:", screenshot.name);
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: feedbackType,
          rating,
          message: message.trim(),
          screenshotUrl,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOption = feedbackOptions.find((opt) => opt.value === feedbackType);

  return (
    <>
      {/* Floating Feedback Button */}
      <Button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-50 shadow-lg",
          "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
          "text-white rounded-full px-4 py-2 h-auto",
          "transition-all duration-300 ease-in-out",
          "hover:shadow-xl hover:scale-105",
          "flex items-center gap-2"
        )}
        aria-label="Give Feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline font-medium">Give Feedback</span>
      </Button>

      {/* Feedback Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[480px]">
          {step === "type" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <MessageSquarePlus className="h-6 w-6 text-violet-500" />
                  Send Feedback
                </DialogTitle>
                <DialogDescription>
                  We value your input! What type of feedback would you like to share?
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-4">
                {feedbackOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleTypeSelect(option.value)}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-xl border-2 text-left",
                      "transition-all duration-200 hover:scale-[1.02]",
                      option.bgColor,
                      "hover:shadow-md"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg bg-white dark:bg-gray-900", option.color)}>
                      {option.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold">{option.label}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "details" && selectedOption && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <div className={cn("p-1.5 rounded-lg", selectedOption.color, selectedOption.bgColor)}>
                    {selectedOption.icon}
                  </div>
                  {selectedOption.label}
                </DialogTitle>
                <DialogDescription>
                  {selectedOption.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                {/* Rating */}
                <div className="space-y-2">
                  <Label>How would you rate your experience?</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
                        aria-label={`Rate ${star} stars`}
                      >
                        <Star
                          className={cn(
                            "h-8 w-8 transition-colors",
                            (hoveredRating || rating) >= star
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300 dark:text-gray-600"
                          )}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-3 text-sm text-muted-foreground">
                        {rating === 1 && "Poor"}
                        {rating === 2 && "Fair"}
                        {rating === 3 && "Good"}
                        {rating === 4 && "Very Good"}
                        {rating === 5 && "Excellent"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="feedback-message">
                    Tell us more <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      feedbackType === "BUG"
                        ? "Please describe what happened, what you expected, and steps to reproduce..."
                        : feedbackType === "FEATURE_REQUEST"
                        ? "Describe the feature you'd like to see and how it would help you..."
                        : "Share your thoughts, suggestions, or experiences..."
                    }
                    className="min-h-[120px] resize-none"
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {message.length}/2000
                  </p>
                </div>

                {/* Screenshot */}
                <div className="space-y-2">
                  <Label>Attach a screenshot (optional)</Label>
                  {screenshotPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="max-h-32 rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        aria-label="Remove screenshot"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Add Screenshot
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="hidden"
                    aria-label="Upload screenshot"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("type")}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !message.trim() || rating === 0}
                  className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "success" && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Thank You!</h3>
                <p className="text-muted-foreground">
                  Your feedback has been submitted successfully. We truly appreciate you taking the time to help us improve.
                </p>
              </div>
              <Button
                onClick={handleClose}
                className="mt-4 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
