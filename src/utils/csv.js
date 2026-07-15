// CSV / 编码相关的浏览器端工具。
//
// 浏览器 TextDecoder 支持读多种编码（utf-8、gbk、gb18030、big5、shift_jis…），
// 但 TextEncoder **只支持 utf-8** 写出。因此本模块设计上：
//   - 读 CSV：支持自动探测 + 手动选常见的中文/日文编码
//   - 写 CSV：只支持 utf-8，可选是否带 BOM（带 BOM 方便 Excel 双击打开不乱码）

/** 常见的可读编码，按识别中文场景的优先级排列。 */
export const READABLE_ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gb18030', label: 'GB18030（兼容 GBK/GB2312）' },
  { value: 'big5', label: 'Big5（繁体）' },
  { value: 'shift_jis', label: 'Shift-JIS（日文）' },
  { value: 'euc-kr', label: 'EUC-KR（韩文）' },
  { value: 'windows-1252', label: 'Windows-1252（西欧）' },
]

/** 写 CSV 时可选的输出编码。 */
export const WRITABLE_ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8（无 BOM）' },
  { value: 'utf-8-bom', label: 'UTF-8 with BOM（Excel 友好）' },
]

/** 支持的分隔符。 */
export const DELIMITERS = [
  { value: ',', label: '逗号 ,' },
  { value: ';', label: '分号 ;' },
  { value: '\t', label: '制表符 \\t' },
  { value: '|', label: '竖线 |' },
]

const DETECT_ENCODINGS = ['utf-8', 'gb18030', 'big5', 'shift_jis']

/**
 * 尝试自动探测编码：先用 utf-8 严格解码，失败再依次试常见中文编码。
 * @param {ArrayBuffer} buffer
 * @returns {{ encoding: string, text: string }}
 */
export function detectEncoding(buffer) {
  // 优先看是否有 UTF-8/16 BOM
  const view = new Uint8Array(buffer)
  if (view.length >= 3 && view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) {
    return { encoding: 'utf-8', text: decodeAs(buffer, 'utf-8') }
  }
  for (const enc of DETECT_ENCODINGS) {
    try {
      const text = new TextDecoder(enc, { fatal: true }).decode(buffer)
      return { encoding: enc, text }
    } catch {
      /* try next */
    }
  }
  // 兜底：不 fatal，用 utf-8 尽力解码
  return { encoding: 'utf-8', text: decodeAs(buffer, 'utf-8') }
}

/**
 * 用指定编码把二进制解码为字符串，不抛错。
 * @param {ArrayBuffer} buffer
 * @param {string} encoding
 * @returns {string}
 */
export function decodeAs(buffer, encoding) {
  try {
    return new TextDecoder(encoding).decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}

/**
 * 根据首行内容猜测最可能的分隔符，取候选中出现次数最多的那一个，
 * 全部为 0 时回退到逗号。
 * @param {string} text
 * @returns {string}
 */
export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  let best = ','
  let bestCount = 0
  for (const { value } of DELIMITERS) {
    // 忽略引号内的分隔符——这里用简单近似即可，SheetJS 后续会做真正解析。
    const count = firstLine.split(value).length - 1
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * 把 CSV 字符串编码成 Uint8Array，可选带 UTF-8 BOM。
 * @param {string} csvText
 * @param {string} outputEncoding 'utf-8' 或 'utf-8-bom'
 * @returns {Uint8Array}
 */
export function encodeCsv(csvText, outputEncoding = 'utf-8') {
  const bytes = new TextEncoder().encode(csvText)
  if (outputEncoding === 'utf-8-bom') {
    const withBom = new Uint8Array(bytes.length + 3)
    withBom[0] = 0xef
    withBom[1] = 0xbb
    withBom[2] = 0xbf
    withBom.set(bytes, 3)
    return withBom
  }
  return bytes
}

// Windows 保留字符 + 路径分隔符。
const INVALID_FILENAME_RE = /[\\/:*?"<>|\x00-\x1f]/g

/**
 * 清理不能作为文件名的字符，去掉首尾空白 / 点。
 * @param {string} name
 * @param {string} fallback 空/全部非法时的兜底名字
 * @returns {string}
 */
export function sanitizeFilename(name, fallback = 'file') {
  const cleaned = (name ?? '')
    .replace(INVALID_FILENAME_RE, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim()
  return cleaned || fallback
}

/**
 * 触发浏览器下载。
 * @param {Blob|Uint8Array} data
 * @param {string} filename
 * @param {string} mime
 */
export function downloadBlob(data, filename, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 稍后释放，避免有的浏览器还没开始下载就撤销。
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
