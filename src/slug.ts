/**
 * Converts a URL slug into a Google Sheet tab name.
 * Examples:
 * - "logan" -> "Logan"
 * - "stretton" -> "Stretton"
 * - "gold-coast" -> "Gold Coast"
 */
export function slugToTabName(slug: string): string {
  return slug
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
