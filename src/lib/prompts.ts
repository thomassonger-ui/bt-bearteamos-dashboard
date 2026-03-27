import fs from 'fs'
import path from 'path'

// ─── CACHE ────────────────────────────────────────────────────────────────────
// File is read once. All subsequent calls return the cached result.

let cache: Record<string, string> | null = null

// ─── PARSER ───────────────────────────────────────────────────────────────────
// Splits on ## headings only. No markdown libraries. No inference.

function loadSections(): Record<string, string> {
  if (cache !== null) return cache

  const filePath = path.resolve(process.cwd(), 'prompts/recruiting-positioning.md')

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `prompts/recruiting-positioning.md not found. Expected at: ${filePath}`
    )
  }

  const raw = fs.readFileSync(filePath, 'utf-8')

  // Split on ## headings. First element is content before first heading (ignored).
  const parts = raw.split(/^##\s+/gm)

  const result: Record<string, string> = {}

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const newlineIndex = part.indexOf('\n')

    if (newlineIndex === -1) {
      // Heading with no content
      const title = part.trim()
      result[title] = ''
      continue
    }

    const title = part.slice(0, newlineIndex).trim()
    const content = part.slice(newlineIndex + 1).trim()
    result[title] = content
  }

  cache = result
  return cache
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Returns all sections as a key→content map.
 * Keys are the ## heading titles, exactly as written.
 */
export function getAllSections(): Record<string, string> {
  return loadSections()
}

/**
 * Returns content for a single section by exact heading name.
 * Throws if the section does not exist.
 */
export function getSection(name: string): string {
  const sections = loadSections()

  if (!(name in sections)) {
    throw new Error(
      `Section "${name}" not found in recruiting-positioning.md. Available sections: ${Object.keys(sections).join(', ')}`
    )
  }

  return sections[name]
}
