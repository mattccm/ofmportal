"use client";

import * as React from "react";
import {
  Globe,
  Search,
  Clock,
  MapPin,
  Check,
  ChevronDown,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TimezoneEntry,
  TimezoneRegion,
  TIMEZONE_REGIONS,
  COMMON_TIMEZONES,
} from "@/types/timezone";
import {
  detectLocalTimezone,
  getAllTimezones,
  getTimezonesByRegion,
  searchTimezones,
  getTimezoneEntry,
  formatTime,
  getTimezoneOffsetString,
} from "@/lib/timezone-utils";

// ============================================
// TYPES
// ============================================

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  showAutoDetect?: boolean;
  showCurrentTime?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
  description?: string;
}

// ============================================
// TIMEZONE OPTION COMPONENT
// ============================================

function TimezoneOption({
  timezone,
  isSelected,
  onClick,
  showCurrentTime,
}: {
  timezone: TimezoneEntry;
  isSelected: boolean;
  onClick: () => void;
  showCurrentTime: boolean;
}) {
  const [currentTime, setCurrentTime] = React.useState<string>("");

  React.useEffect(() => {
    if (showCurrentTime) {
      const updateTime = () => {
        setCurrentTime(formatTime(new Date(), timezone.id, { hour12: true }));
      };
      updateTime();
      const interval = setInterval(updateTime, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [timezone.id, showCurrentTime]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3 text-left rounded-lg transition-colors",
        "hover:bg-accent/50",
        isSelected && "bg-accent"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          <Globe className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{timezone.city}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {timezone.offset}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {timezone.name}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showCurrentTime && currentTime && (
          <span className="text-sm text-muted-foreground">{currentTime}</span>
        )}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    </button>
  );
}

// ============================================
// REGION GROUP COMPONENT
// ============================================

function RegionGroup({
  region,
  timezones,
  selectedTimezone,
  onSelect,
  showCurrentTime,
}: {
  region: TimezoneRegion;
  timezones: TimezoneEntry[];
  selectedTimezone: string;
  onSelect: (timezone: string) => void;
  showCurrentTime: boolean;
}) {
  const regionInfo = TIMEZONE_REGIONS[region];

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-popover z-10">
        <div className={cn("h-2 w-2 rounded-full", regionInfo.color)} />
        <span className="text-sm font-semibold text-muted-foreground">
          {regionInfo.label}
        </span>
        <span className="text-xs text-muted-foreground">
          ({timezones.length})
        </span>
      </div>
      <div className="space-y-1">
        {timezones.map((tz) => (
          <TimezoneOption
            key={tz.id}
            timezone={tz}
            isSelected={tz.id === selectedTimezone}
            onClick={() => onSelect(tz.id)}
            showCurrentTime={showCurrentTime}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN TIMEZONE SELECTOR COMPONENT
// ============================================

export function TimezoneSelector({
  value,
  onChange,
  showAutoDetect = true,
  showCurrentTime = true,
  disabled = false,
  placeholder = "Select timezone...",
  className,
  label,
  description,
}: TimezoneSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentTime, setCurrentTime] = React.useState<string>("");
  const [showAllTimezones, setShowAllTimezones] = React.useState(false);

  // Get selected timezone entry
  const selectedTimezone = React.useMemo(() => {
    if (!value) return null;
    return getTimezoneEntry(value);
  }, [value]);

  // Get filtered timezones based on search and mode
  const filteredTimezones = React.useMemo(() => {
    if (searchQuery) {
      return searchTimezones(searchQuery);
    }
    if (showAllTimezones) {
      return getAllTimezones();
    }
    // Show common timezones by default
    return COMMON_TIMEZONES.map((tz) => getTimezoneEntry(tz)).sort(
      (a, b) => a.offsetMinutes - b.offsetMinutes
    );
  }, [searchQuery, showAllTimezones]);

  // Group timezones by region
  const groupedTimezones = React.useMemo(() => {
    const grouped = new Map<TimezoneRegion, TimezoneEntry[]>();
    for (const tz of filteredTimezones) {
      const existing = grouped.get(tz.region) || [];
      existing.push(tz);
      grouped.set(tz.region, existing);
    }
    return grouped;
  }, [filteredTimezones]);

  // Update current time display
  React.useEffect(() => {
    if (value && showCurrentTime) {
      const updateTime = () => {
        setCurrentTime(formatTime(new Date(), value, { hour12: true }));
      };
      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [value, showCurrentTime]);

  // Handle auto-detect
  const handleAutoDetect = () => {
    const detected = detectLocalTimezone();
    onChange(detected);
    setOpen(false);
  };

  // Handle timezone selection
  const handleSelect = (timezone: string) => {
    onChange(timezone);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">{label}</Label>
      )}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-auto min-h-[44px] px-3 py-2",
              !value && "text-muted-foreground"
            )}
          >
            {selectedTimezone ? (
              <div className="flex items-center gap-3 text-left">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedTimezone.city}</span>
                    <Badge variant="secondary" className="text-xs">
                      {selectedTimezone.offset}
                    </Badge>
                  </div>
                  {showCurrentTime && currentTime && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {currentTime}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <span>{placeholder}</span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[400px] p-0"
          align="start"
        >
          {/* Search Header */}
          <div className="p-3 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search timezones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {showAutoDetect && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoDetect}
                  className="flex-1 gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Auto-detect
                </Button>
              )}
              <Button
                variant={showAllTimezones ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowAllTimezones(!showAllTimezones)}
                className="flex-1 gap-2"
              >
                <Globe className="h-4 w-4" />
                {showAllTimezones ? "Show Common" : "Show All"}
              </Button>
            </div>
          </div>

          {/* Timezone List */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {filteredTimezones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No timezones found</p>
                <p className="text-xs">Try a different search term</p>
              </div>
            ) : searchQuery ? (
              // Flat list when searching
              <div className="space-y-1">
                {filteredTimezones.map((tz) => (
                  <TimezoneOption
                    key={tz.id}
                    timezone={tz}
                    isSelected={tz.id === value}
                    onClick={() => handleSelect(tz.id)}
                    showCurrentTime={showCurrentTime}
                  />
                ))}
              </div>
            ) : (
              // Grouped by region when not searching
              Array.from(groupedTimezones.entries()).map(([region, tzs]) => (
                <RegionGroup
                  key={region}
                  region={region}
                  timezones={tzs}
                  selectedTimezone={value}
                  onSelect={handleSelect}
                  showCurrentTime={showCurrentTime}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {selectedTimezone && (
            <div className="p-3 border-t bg-muted/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>
                  Selected: {selectedTimezone.name} ({selectedTimezone.abbreviation})
                </span>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============================================
// COMPACT TIMEZONE SELECTOR
// ============================================

export function CompactTimezoneSelector({
  value,
  onChange,
  disabled = false,
  className,
}: Pick<TimezoneSelectorProps, "value" | "onChange" | "disabled" | "className">) {
  const [open, setOpen] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState<string>("");

  const selectedTimezone = React.useMemo(() => {
    if (!value) return null;
    return getTimezoneEntry(value);
  }, [value]);

  // Update current time
  React.useEffect(() => {
    if (value) {
      const updateTime = () => {
        setCurrentTime(formatTime(new Date(), value, { hour12: true }));
      };
      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn("gap-1.5 h-8", className)}
        >
          <Clock className="h-3.5 w-3.5" />
          {selectedTimezone ? (
            <>
              <span className="font-medium">{currentTime}</span>
              <span className="text-muted-foreground">
                ({selectedTimezone.abbreviation})
              </span>
            </>
          ) : (
            <span>Select timezone</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <TimezoneSelector
          value={value}
          onChange={(tz) => {
            onChange(tz);
            setOpen(false);
          }}
          showAutoDetect
          showCurrentTime
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// TIMEZONE DISPLAY BADGE
// ============================================

export function TimezoneBadge({
  timezone,
  showTime = true,
  showOffset = true,
  className,
}: {
  timezone: string;
  showTime?: boolean;
  showOffset?: boolean;
  className?: string;
}) {
  const [currentTime, setCurrentTime] = React.useState<string>("");
  const tzEntry = React.useMemo(() => getTimezoneEntry(timezone), [timezone]);

  React.useEffect(() => {
    if (showTime) {
      const updateTime = () => {
        setCurrentTime(formatTime(new Date(), timezone, { hour12: true }));
      };
      updateTime();
      const interval = setInterval(updateTime, 60000);
      return () => clearInterval(interval);
    }
  }, [timezone, showTime]);

  return (
    <Badge variant="outline" className={cn("gap-1.5", className)}>
      <Globe className="h-3 w-3" />
      {tzEntry.abbreviation}
      {showOffset && (
        <span className="text-muted-foreground">({tzEntry.offset})</span>
      )}
      {showTime && currentTime && (
        <>
          <span className="text-muted-foreground">|</span>
          {currentTime}
        </>
      )}
    </Badge>
  );
}

export default TimezoneSelector;
