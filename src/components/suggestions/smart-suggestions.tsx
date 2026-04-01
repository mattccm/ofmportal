"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SuggestionCard, InlineSuggestion } from "./suggestion-card";
import {
  type Suggestion,
  type SuggestionContext,
  getDismissedSuggestions,
  dismissSuggestion,
  getSuggestionsForPage,
} from "@/lib/suggestions";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SmartSuggestionsProps {
  /**
   * Context data for generating suggestions
   */
  context: Omit<SuggestionContext, "dismissedSuggestions">;

  /**
   * Display variant
   * - 'default': Full cards with all details
   * - 'compact': Smaller inline suggestions
   * - 'inline': Single-line suggestions
   */
  variant?: "default" | "compact" | "inline";

  /**
   * Maximum number of suggestions to show (overrides page defaults)
   */
  maxSuggestions?: number;

  /**
   * Whether suggestions can be collapsed
   */
  collapsible?: boolean;

  /**
   * Initial collapsed state
   */
  defaultCollapsed?: boolean;

  /**
   * Title to show above suggestions
   */
  title?: string;

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Callback when a suggestion is dismissed
   */
  onDismiss?: (suggestionId: string) => void;

  /**
   * Callback when suggestions are updated
   */
  onSuggestionsChange?: (suggestions: Suggestion[]) => void;
}

export function SmartSuggestions({
  context,
  variant = "default",
  maxSuggestions,
  collapsible = false,
  defaultCollapsed = false,
  title,
  className,
  onDismiss,
  onSuggestionsChange,
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Load dismissed suggestions and generate new ones
  useEffect(() => {
    const dismissed = getDismissedSuggestions();
    setDismissedIds(dismissed);

    const fullContext: SuggestionContext = {
      ...context,
      dismissedSuggestions: dismissed,
    };

    let newSuggestions = getSuggestionsForPage(fullContext);

    // Apply max limit if specified
    if (maxSuggestions !== undefined) {
      newSuggestions = newSuggestions.slice(0, maxSuggestions);
    }

    setSuggestions(newSuggestions);
    onSuggestionsChange?.(newSuggestions);
  }, [context, maxSuggestions, onSuggestionsChange]);

  // Handle dismissing a suggestion
  const handleDismiss = useCallback(
    (suggestionId: string) => {
      dismissSuggestion(suggestionId);
      setDismissedIds((prev) => [...prev, suggestionId]);
      setSuggestions((prev) => {
        const updated = prev.filter((s) => s.id !== suggestionId);
        onSuggestionsChange?.(updated);
        return updated;
      });
      onDismiss?.(suggestionId);
    },
    [onDismiss, onSuggestionsChange]
  );

  // Don't render if no suggestions
  if (suggestions.length === 0) {
    return null;
  }

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Inline variant
  if (variant === "inline") {
    return (
      <div className={cn("space-y-2", className)}>
        {suggestions.map((suggestion) => (
          <InlineSuggestion
            key={suggestion.id}
            suggestion={suggestion}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        {title && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Lightbulb className="h-4 w-4" />
              <span>{title}</span>
            </div>
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapse}
                className="h-7 px-2 text-muted-foreground"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}
        {!isCollapsed && (
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onDismiss={handleDismiss}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} for you
              </p>
            </div>
          </div>
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? "Show" : "Hide"}
              {isCollapsed ? (
                <ChevronDown className="ml-1 h-4 w-4" />
              ) : (
                <ChevronUp className="ml-1 h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Export a server-compatible wrapper that accepts pre-computed suggestions
interface ServerSuggestionsProps {
  suggestions: Suggestion[];
  variant?: "default" | "compact" | "inline";
  title?: string;
  className?: string;
}

export function ServerSuggestions({
  suggestions: initialSuggestions,
  variant = "default",
  title,
  className,
}: ServerSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);

  // Filter out already dismissed suggestions on client
  useEffect(() => {
    const dismissed = getDismissedSuggestions();
    setSuggestions(initialSuggestions.filter((s) => !dismissed.includes(s.id)));
  }, [initialSuggestions]);

  const handleDismiss = useCallback((suggestionId: string) => {
    dismissSuggestion(suggestionId);
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  }, []);

  if (suggestions.length === 0) {
    return null;
  }

  if (variant === "inline") {
    return (
      <div className={cn("space-y-2", className)}>
        {suggestions.map((suggestion) => (
          <InlineSuggestion
            key={suggestion.id}
            suggestion={suggestion}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        {title && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>{title}</span>
          </div>
        )}
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onDismiss={handleDismiss}
              compact
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} for you
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
}

// Export types
export type { SmartSuggestionsProps, ServerSuggestionsProps };
