"use client";

/**
 * SVG filters for simulating color blindness.
 * These filters are applied via CSS filter property when a color blind mode is selected.
 *
 * Include this component once at the root of your application.
 *
 * References:
 * - https://www.color-blindness.com/coblis-color-blindness-simulator/
 * - https://web.archive.org/web/20081014161121/http://www.colorjack.com/labs/colormatrix/
 */
export function ColorBlindFilters() {
  return (
    <svg
      className="absolute w-0 h-0 overflow-hidden"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Protanopia (Red-blind) - ~1% of males */}
        <filter id="protanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.567, 0.433, 0,     0, 0
                    0.558, 0.442, 0,     0, 0
                    0,     0.242, 0.758, 0, 0
                    0,     0,     0,     1, 0"
          />
        </filter>

        {/* Deuteranopia (Green-blind) - ~1% of males */}
        <filter id="deuteranopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.625, 0.375, 0,   0, 0
                    0.7,   0.3,   0,   0, 0
                    0,     0.3,   0.7, 0, 0
                    0,     0,     0,   1, 0"
          />
        </filter>

        {/* Tritanopia (Blue-blind) - ~0.01% of population */}
        <filter id="tritanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.95, 0.05,  0,     0, 0
                    0,    0.433, 0.567, 0, 0
                    0,    0.475, 0.525, 0, 0
                    0,    0,     0,     1, 0"
          />
        </filter>

        {/* Achromatopsia (Complete color blindness) - rare */}
        <filter id="achromatopsia-filter">
          <feColorMatrix
            type="matrix"
            values="0.299, 0.587, 0.114, 0, 0
                    0.299, 0.587, 0.114, 0, 0
                    0.299, 0.587, 0.114, 0, 0
                    0,     0,     0,     1, 0"
          />
        </filter>

        {/* Protanomaly (Red-weak) - ~1% of males */}
        <filter id="protanomaly-filter">
          <feColorMatrix
            type="matrix"
            values="0.817, 0.183, 0,     0, 0
                    0.333, 0.667, 0,     0, 0
                    0,     0.125, 0.875, 0, 0
                    0,     0,     0,     1, 0"
          />
        </filter>

        {/* Deuteranomaly (Green-weak) - ~5% of males */}
        <filter id="deuteranomaly-filter">
          <feColorMatrix
            type="matrix"
            values="0.8,   0.2,   0,     0, 0
                    0.258, 0.742, 0,     0, 0
                    0,     0.142, 0.858, 0, 0
                    0,     0,     0,     1, 0"
          />
        </filter>

        {/* Tritanomaly (Blue-weak) - rare */}
        <filter id="tritanomaly-filter">
          <feColorMatrix
            type="matrix"
            values="0.967, 0.033, 0,     0, 0
                    0,     0.733, 0.267, 0, 0
                    0,     0.183, 0.817, 0, 0
                    0,     0,     0,     1, 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

export default ColorBlindFilters;
