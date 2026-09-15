/**
 * Standard viewport presets used across responsiveness tests.
 */
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop:  { width: 1366, height: 768 },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 390,  height: 844 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;
