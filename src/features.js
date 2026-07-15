import Base64Tool from './components/Base64Tool.vue'
import CsvToXlsx from './components/CsvToXlsx.vue'
import JwtTool from './components/JwtTool.vue'
import Md5Tool from './components/Md5Tool.vue'
import MergeSheets from './components/MergeSheets.vue'
import MergeXlsx from './components/MergeXlsx.vue'
import TimestampTool from './components/TimestampTool.vue'
import UrlEncodeTool from './components/UrlEncodeTool.vue'
import XlsxToCsv from './components/XlsxToCsv.vue'

/**
 * 分类。展示顺序即数组顺序。
 * - key:   唯一 id
 * - title: 分类标题
 * - desc:  可选说明
 */
export const categories = [
  { key: 'excel', title: 'Excel', desc: 'xlsx / csv 的合并与转换' },
  { key: 'encode', title: '编码 / 解码', desc: 'Base64、URL 等常见编解码' },
  { key: 'hash', title: '加密 / 散列', desc: '常见摘要算法' },
  { key: 'time', title: '时间 / 时间戳', desc: '当前时间戳与日期互转' },
  { key: 'token', title: 'Token', desc: 'JWT 等 Token 相关工具' },
]

/**
 * 所有工具。新增工具在这里追加一条即可，Home 页会按 category 分组展示。
 *
 * 字段：
 * - key:         URL slug，同时也是唯一 id
 * - category:    分类 key，需要在 categories 里存在
 * - title:       卡片标题
 * - description: 一行简介
 * - icon:        emoji
 * - tags:        标签
 * - component:   Vue 组件
 */
export const features = [
  // —— Excel ——
  {
    key: 'merge',
    category: 'excel',
    title: '合并 xlsx',
    description: '把多个 xlsx 的 sheet 合并到一个文件里，可以自定义每个 sheet 的新名字。',
    icon: '📎',
    tags: ['合并', '多文件'],
    component: MergeXlsx,
  },
  {
    key: 'merge-sheets',
    category: 'excel',
    title: '合并到一个 sheet',
    description:
      '把多个 xlsx 或同一文件的多个 sheet 拼到同一张 sheet 里，中间用空行分隔，每个 sheet 保留自己的标题。',
    icon: '🧷',
    tags: ['合并', '单 sheet'],
    component: MergeSheets,
  },
  {
    key: 'csv-to-xlsx',
    category: 'excel',
    title: 'CSV 转 xlsx',
    description: '把一个或多个 CSV/TSV 转成 xlsx，支持自动识别编码和分隔符。',
    icon: '📥',
    tags: ['CSV', '编码'],
    component: CsvToXlsx,
  },
  {
    key: 'xlsx-to-csv',
    category: 'excel',
    title: 'xlsx 转 CSV',
    description: '把 xlsx 的 sheet 导出为 CSV，多 sheet 自动打包 zip 下载。',
    icon: '📤',
    tags: ['CSV', '导出'],
    component: XlsxToCsv,
  },

  // —— 编码 / 解码 ——
  {
    key: 'base64',
    category: 'encode',
    title: 'Base64 编解码',
    description: '文本与 Base64 互相转换，按 UTF-8 处理，支持粘贴的多行 Base64。',
    icon: '🔤',
    tags: ['Base64', 'UTF-8'],
    component: Base64Tool,
  },
  {
    key: 'urlencode',
    category: 'encode',
    title: 'URL 编解码',
    description: '支持 encodeURIComponent（参数值）和 encodeURI（整段 URL）两种模式。',
    icon: '🔗',
    tags: ['URL', 'percent-encoding'],
    component: UrlEncodeTool,
  },

  // —— 加密 / 散列 ——
  {
    key: 'md5',
    category: 'hash',
    title: 'MD5',
    description: '实时计算字符串的 MD5 摘要，支持 32 位和 16 位输出，可切换大小写。',
    icon: '🔒',
    tags: ['MD5', '摘要'],
    component: Md5Tool,
  },

  // —— 时间 ——
  {
    key: 'timestamp',
    category: 'time',
    title: '时间戳工具',
    description: '实时显示当前秒/毫秒时间戳，支持时间戳与日期的双向转换。',
    icon: '⏱',
    tags: ['时间戳', '日期'],
    component: TimestampTool,
  },

  // —— Token ——
  {
    key: 'jwt',
    category: 'token',
    title: 'JWT 生成',
    description: '输入密钥和 JSON Payload，生成 HS256 / HS384 / HS512 签名的 JWT。',
    icon: '🪪',
    tags: ['JWT', 'HMAC'],
    component: JwtTool,
  },
]

export function findFeature(key) {
  return features.find((f) => f.key === key) ?? null
}

/**
 * 按 categories 顺序返回 [{ category, items }]，空分类会被过滤掉。
 */
export function groupedFeatures() {
  return categories
    .map((cat) => ({
      category: cat,
      items: features.filter((f) => f.category === cat.key),
    }))
    .filter((g) => g.items.length > 0)
}
