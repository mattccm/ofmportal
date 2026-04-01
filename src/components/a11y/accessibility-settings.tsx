"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Eye,
  Type,
  Zap,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  Accessibility,
  Minus,
  Plus,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface AccessibilitySettings {
  /** Reduce motion for animations */
  reduceMotion: boolean;
  /** Enable high contrast mode */
  highContrast: boolean;
  /** Font size scale (1 = 100%, 1.25 = 125%, etc.) */
  fontSize: number;
  /** Focus indicators visibility */
  enhancedFocus: boolean;
  /** Color blind mode */
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  /** Dyslexia-friendly font */
  dyslexiaFont: boolean;
  /** Link underlines always visible */
  underlineLinks: boolean;
  /** Cursor size */
  largeCursor: boolean;
}

interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => void;
  resetSettings: () => void;
  isLoaded: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'uploadportal-a11y-settings';

const DEFAULT_SETTINGS: AccessibilitySettings = {
  reduceMotion: false,
  highContrast: false,
  fontSize: 1,
  enhancedFocus: false,
  colorBlindMode: 'none',
  dyslexiaFont: false,
  underlineLinks: false,
  largeCursor: false,
};

const FONT_SIZE_OPTIONS = [
  { value: 0.875, label: 'Small (87.5%)' },
  { value: 1, label: 'Default (100%)' },
  { value: 1.125, label: 'Large (112.5%)' },
  { value: 1.25, label: 'Extra Large (125%)' },
  { value: 1.5, label: 'Huge (150%)' },
];

const COLOR_BLIND_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'protanopia', label: 'Protanopia (Red-blind)' },
  { value: 'deuteranopia', label: 'Deuteranopia (Green-blind)' },
  { value: 'tritanopia', label: 'Tritanopia (Blue-blind)' },
] as const;

// ============================================
// CONTEXT
// ============================================

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
}

// ============================================
// PROVIDER
// ============================================

interface AccessibilityProviderProps {
  children: React.ReactNode;
  /** Default settings override */
  defaultSettings?: Partial<AccessibilitySettings>;
}

export function AccessibilityProvider({
  children,
  defaultSettings,
}: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    ...DEFAULT_SETTINGS,
    ...defaultSettings,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }

      // Check system preferences
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setSettings((prev) => ({ ...prev, reduceMotion: true }));
      }
      if (
        window.matchMedia('(prefers-contrast: more)').matches ||
        window.matchMedia('(prefers-contrast: high)').matches
      ) {
        setSettings((prev) => ({ ...prev, highContrast: true }));
      }
    } catch (error) {
      console.error('Failed to load accessibility settings:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save accessibility settings:', error);
      }
    }
  }, [settings, isLoaded]);

  // Apply settings to document
  useEffect(() => {
    if (!isLoaded) return;

    const html = document.documentElement;

    // Reduce motion
    if (settings.reduceMotion) {
      html.classList.add('reduce-motion');
      html.style.setProperty('--animation-duration', '0.01ms');
    } else {
      html.classList.remove('reduce-motion');
      html.style.removeProperty('--animation-duration');
    }

    // High contrast
    if (settings.highContrast) {
      html.classList.add('high-contrast');
    } else {
      html.classList.remove('high-contrast');
    }

    // Font size
    html.style.setProperty('--a11y-font-scale', String(settings.fontSize));
    html.style.fontSize = `${settings.fontSize * 100}%`;

    // Enhanced focus
    if (settings.enhancedFocus) {
      html.classList.add('enhanced-focus');
    } else {
      html.classList.remove('enhanced-focus');
    }

    // Color blind mode
    html.dataset.colorBlindMode = settings.colorBlindMode;
    html.classList.remove('protanopia', 'deuteranopia', 'tritanopia');
    if (settings.colorBlindMode !== 'none') {
      html.classList.add(settings.colorBlindMode);
    }

    // Dyslexia font
    if (settings.dyslexiaFont) {
      html.classList.add('dyslexia-font');
    } else {
      html.classList.remove('dyslexia-font');
    }

    // Underline links
    if (settings.underlineLinks) {
      html.classList.add('underline-links');
    } else {
      html.classList.remove('underline-links');
    }

    // Large cursor
    if (settings.largeCursor) {
      html.classList.add('large-cursor');
    } else {
      html.classList.remove('large-cursor');
    }
  }, [settings, isLoaded]);

  const updateSetting = useCallback(
    <K extends keyof AccessibilitySettings>(
      key: K,
      value: AccessibilitySettings[K]
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{ settings, updateSetting, resetSettings, isLoaded }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

// ============================================
// SETTINGS PANEL
// ============================================

interface AccessibilitySettingsPanelProps {
  className?: string;
  compact?: boolean;
}

export function AccessibilitySettingsPanel({
  className,
  compact = false,
}: AccessibilitySettingsPanelProps) {
  const { settings, updateSetting, resetSettings } = useAccessibility();

  return (
    <div
      className={cn(
        "space-y-6",
        compact && "space-y-4",
        className
      )}
      role="region"
      aria-label="Accessibility settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Accessibility className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Accessibility</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetSettings}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" />
          Reset
        </Button>
      </div>

      {/* Motion */}
      <SettingRow
        icon={<Zap className="h-4 w-4" />}
        label="Reduce motion"
        description="Minimize animations and transitions"
        compact={compact}
      >
        <ToggleSwitch
          checked={settings.reduceMotion}
          onChange={(checked) => updateSetting('reduceMotion', checked)}
          aria-label="Reduce motion"
        />
      </SettingRow>

      {/* High Contrast */}
      <SettingRow
        icon={<Eye className="h-4 w-4" />}
        label="High contrast"
        description="Increase contrast for better visibility"
        compact={compact}
      >
        <ToggleSwitch
          checked={settings.highContrast}
          onChange={(checked) => updateSetting('highContrast', checked)}
          aria-label="High contrast mode"
        />
      </SettingRow>

      {/* Enhanced Focus */}
      <SettingRow
        icon={<Monitor className="h-4 w-4" />}
        label="Enhanced focus"
        description="Make focus indicators more visible"
        compact={compact}
      >
        <ToggleSwitch
          checked={settings.enhancedFocus}
          onChange={(checked) => updateSetting('enhancedFocus', checked)}
          aria-label="Enhanced focus indicators"
        />
      </SettingRow>

      {/* Font Size */}
      <SettingRow
        icon={<Type className="h-4 w-4" />}
        label="Font size"
        description="Adjust text size across the application"
        compact={compact}
        stacked
      >
        <FontSizeControl
          value={settings.fontSize}
          onChange={(value) => updateSetting('fontSize', value)}
        />
      </SettingRow>

      {/* Dyslexia Font */}
      <SettingRow
        icon={<Type className="h-4 w-4" />}
        label="Dyslexia-friendly font"
        description="Use a font designed for easier reading"
        compact={compact}
      >
        <ToggleSwitch
          checked={settings.dyslexiaFont}
          onChange={(checked) => updateSetting('dyslexiaFont', checked)}
          aria-label="Dyslexia-friendly font"
        />
      </SettingRow>

      {/* Underline Links */}
      <SettingRow
        icon={<Type className="h-4 w-4" />}
        label="Underline links"
        description="Always show underlines on links"
        compact={compact}
      >
        <ToggleSwitch
          checked={settings.underlineLinks}
          onChange={(checked) => updateSetting('underlineLinks', checked)}
          aria-label="Always underline links"
        />
      </SettingRow>

      {/* Color Blind Mode */}
      <SettingRow
        icon={<Eye className="h-4 w-4" />}
        label="Color blind mode"
        description="Adjust colors for color vision deficiency"
        compact={compact}
        stacked
      >
        <ColorBlindSelector
          value={settings.colorBlindMode}
          onChange={(value) => updateSetting('colorBlindMode', value)}
        />
      </SettingRow>

      {/* Large Cursor */}
      <SettingRow
        icon={<Monitor className="h-4 w-4" />}
        label="Large cursor"
        description="Increase cursor size for better visibility"
        compact={compact}
      >
        <ToggleSwitch
          checked={settings.largeCursor}
          onChange={(checked) => updateSetting('largeCursor', checked)}
          aria-label="Large cursor"
        />
      </SettingRow>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
  compact?: boolean;
  stacked?: boolean;
}

function SettingRow({
  icon,
  label,
  description,
  children,
  compact = false,
  stacked = false,
}: SettingRowProps) {
  const id = React.useId();

  return (
    <div
      className={cn(
        "flex gap-4",
        stacked ? "flex-col" : "items-center justify-between",
        compact ? "py-2" : "py-3",
        "border-b border-border/50 last:border-0"
      )}
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="text-muted-foreground mt-0.5" aria-hidden="true">
          {icon}
        </span>
        <div className="flex-1">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {label}
          </Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className={cn(stacked && "ml-7")}>{children}</div>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label': string;
}

function ToggleSwitch({ checked, onChange, 'aria-label': ariaLabel }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0",
          "transform transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

interface FontSizeControlProps {
  value: number;
  onChange: (value: number) => void;
}

function FontSizeControl({ value, onChange }: FontSizeControlProps) {
  const currentIndex = FONT_SIZE_OPTIONS.findIndex((opt) => opt.value === value);
  const currentLabel = FONT_SIZE_OPTIONS.find((opt) => opt.value === value)?.label || 'Custom';

  const decrease = () => {
    const prevIndex = Math.max(0, currentIndex - 1);
    onChange(FONT_SIZE_OPTIONS[prevIndex].value);
  };

  const increase = () => {
    const nextIndex = Math.min(FONT_SIZE_OPTIONS.length - 1, currentIndex + 1);
    onChange(FONT_SIZE_OPTIONS[nextIndex].value);
  };

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Font size control"
    >
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={decrease}
        disabled={currentIndex === 0}
        aria-label="Decrease font size"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span
        className="min-w-[100px] text-center text-sm font-medium"
        aria-live="polite"
        aria-atomic="true"
      >
        {currentLabel}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={increase}
        disabled={currentIndex === FONT_SIZE_OPTIONS.length - 1}
        aria-label="Increase font size"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

interface ColorBlindSelectorProps {
  value: AccessibilitySettings['colorBlindMode'];
  onChange: (value: AccessibilitySettings['colorBlindMode']) => void;
}

function ColorBlindSelector({ value, onChange }: ColorBlindSelectorProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="Color blind mode"
    >
      {COLOR_BLIND_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full",
            "transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// QUICK ACCESS TOGGLE
// ============================================

interface AccessibilityQuickToggleProps {
  className?: string;
}

export function AccessibilityQuickToggle({ className }: AccessibilityQuickToggleProps) {
  const { settings, updateSetting } = useAccessibility();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Accessibility quick settings"
        className={cn(
          "h-9 w-9 rounded-lg",
          "hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        <Accessibility className="h-5 w-5" aria-hidden="true" />
      </Button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 z-50",
            "w-64 p-4 rounded-xl",
            "bg-popover/95 backdrop-blur-xl border border-border/50 shadow-xl",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          )}
          role="dialog"
          aria-label="Quick accessibility settings"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reduce motion</span>
              <ToggleSwitch
                checked={settings.reduceMotion}
                onChange={(checked) => updateSetting('reduceMotion', checked)}
                aria-label="Reduce motion"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">High contrast</span>
              <ToggleSwitch
                checked={settings.highContrast}
                onChange={(checked) => updateSetting('highContrast', checked)}
                aria-label="High contrast"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Enhanced focus</span>
              <ToggleSwitch
                checked={settings.enhancedFocus}
                onChange={(checked) => updateSetting('enhancedFocus', checked)}
                aria-label="Enhanced focus"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default AccessibilitySettingsPanel;
