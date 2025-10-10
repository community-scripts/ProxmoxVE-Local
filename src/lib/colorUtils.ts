/**
 * Calculate the appropriate text color (black or white) for a given background color
 * to ensure optimal readability based on luminance
 */
export function getContrastColor(hexColor: string): 'black' | 'white' {
  if (!hexColor || hexColor.length !== 7 || !hexColor.startsWith('#')) {
    return 'black'; // Default to black for invalid colors
  }

  // Remove the # and convert to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Calculate relative luminance using the standard formula
  // https://www.w3.org/WAI/GL/wiki/Relative_luminance
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Check if a color string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color);
}

/**
 * Get a default color for servers that don't have one set
 */
export function getDefaultServerColor(): string {
  return '#3b82f6'; // Blue-500 from Tailwind
}
