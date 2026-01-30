/**
 * Generates a deterministic color for a user ID using HSL
 * @param userId - The user's ID
 * @returns HSL color string
 */
export function getUserColor(userId: string): string {
  // Simple hash function to convert userId to a number
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use hash to generate HSL values
  // Hue: 0-360 (full spectrum)
  // Saturation: 50-70% (vibrant but not too bright)
  // Lightness: 45-55% (readable text)
  const hue = Math.abs(hash) % 360;
  const saturation = 50 + (Math.abs(hash) % 21); // 50-70%
  const lightness = 45 + (Math.abs(hash) % 11); // 45-55%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Determines if text color should be light or dark based on background
 * @param backgroundColor - HSL color string
 * @returns 'light' or 'dark'
 */
export function getTextColor(backgroundColor: string): 'light' | 'dark' {
  // Extract lightness from HSL
  const match = backgroundColor.match(/(\d+)%\)$/);
  if (match) {
    const lightness = parseInt(match[1]);
    return lightness < 50 ? 'light' : 'dark';
  }
  return 'dark';
}
