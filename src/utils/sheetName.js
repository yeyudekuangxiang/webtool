// Excel worksheet name constraints.
// Docs: https://support.microsoft.com/en-us/office/rename-a-worksheet-3f1f7148-ee83-404d-8ef0-9ff99fbad1f9
export const MAX_SHEET_NAME_LEN = 31
export const INVALID_SHEET_NAME_CHARS = '\\ / ? * [ ] :'

const INVALID_CHAR_RE = /[\\/?*\[\]:]/g
const RESERVED_NAMES = new Set(['history'])

/**
 * Return an error message for an invalid worksheet name, or an empty string when it is valid.
 * @param {string} name
 * @returns {string}
 */
export function validateSheetName(name) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '名字不能为空'
  if (trimmed.length > MAX_SHEET_NAME_LEN) {
    return `长度不能超过 ${MAX_SHEET_NAME_LEN}`
  }
  if (INVALID_CHAR_RE.test(trimmed)) {
    return `不能包含 ${INVALID_SHEET_NAME_CHARS}`
  }
  if (trimmed.startsWith("'") || trimmed.endsWith("'")) {
    return "不能以 ' 开头或结尾"
  }
  if (RESERVED_NAMES.has(trimmed.toLowerCase())) {
    return '不能使用保留名 History'
  }
  return ''
}

/**
 * Strip invalid characters and truncate to the maximum length.
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeSheetName(raw) {
  const cleaned = (raw ?? '')
    .replace(INVALID_CHAR_RE, '_')
    .replace(/^'+|'+$/g, '')
    .trim()
  return cleaned.slice(0, MAX_SHEET_NAME_LEN)
}

/**
 * Remove the last `.xlsx` / `.xls` extension from a file name.
 * @param {string} filename
 * @returns {string}
 */
export function stripExtension(filename) {
  return (filename ?? '').replace(/\.xlsx?$/i, '')
}

/**
 * Build a unique sheet name based on `base`, using ` (2)`, ` (3)` ... suffixes when needed.
 * The `used` set holds lowercased names that are already taken; the returned value is
 * always safe to append to that set.
 * @param {string} base
 * @param {Set<string>} used
 * @returns {string}
 */
export function uniqueName(base, used) {
  const cleanBase = sanitizeSheetName(base) || 'sheet'
  if (!used.has(cleanBase.toLowerCase())) return cleanBase

  for (let i = 2; i < 10000; i++) {
    const suffix = ` (${i})`
    const trimmedBase = cleanBase.slice(0, MAX_SHEET_NAME_LEN - suffix.length)
    const candidate = `${trimmedBase}${suffix}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  // Fallback: extremely unlikely to hit.
  return `${cleanBase.slice(0, 4)}_${Date.now()}`.slice(0, MAX_SHEET_NAME_LEN)
}
