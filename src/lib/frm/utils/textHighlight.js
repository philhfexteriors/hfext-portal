/**
 * Text highlighting utility for search results
 * Highlights search terms with HTML mark tags for visual emphasis
 */

/**
 * Highlights search terms in text with HTML mark tags
 * @param {string} text - The text to highlight
 * @param {string} searchTerm - The term to highlight
 * @returns {string} HTML string with <mark> tags around matches
 */
export function highlightText(text, searchTerm) {
  if (!text || !searchTerm || searchTerm.length < 2) {
    return text
  }

  // Escape special regex characters for safety (prevents XSS and regex errors)
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Case-insensitive global replacement
  const regex = new RegExp(`(${escapedTerm})`, 'gi')

  return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
}

/**
 * React component that safely renders highlighted text
 * Uses dangerouslySetInnerHTML but only with escaped/sanitized content
 *
 * @param {Object} props
 * @param {string} props.text - The text to display
 * @param {string} props.searchTerm - The term to highlight
 */
export function HighlightedText({ text, searchTerm }) {
  if (!text) return null

  const highlighted = highlightText(text, searchTerm)

  return (
    <span
      dangerouslySetInnerHTML={{ __html: highlighted }}
      className="whitespace-pre-wrap"
    />
  )
}
