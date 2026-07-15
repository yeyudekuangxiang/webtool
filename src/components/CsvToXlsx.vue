<script setup>
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import {
  DELIMITERS,
  READABLE_ENCODINGS,
  decodeAs,
  detectDelimiter,
  detectEncoding,
  downloadBlob,
  sanitizeFilename,
} from '../utils/csv.js'
import {
  INVALID_SHEET_NAME_CHARS,
  MAX_SHEET_NAME_LEN,
  sanitizeSheetName,
  stripExtension,
  uniqueName,
  validateSheetName,
} from '../utils/sheetName.js'

/**
 * 一行 = 一个 CSV 文件。
 * {
 *   id, fileName,
 *   fileBase,             // 去掉扩展名的文件名
 *   buffer,               // 原始 ArrayBuffer
 *   encoding, delimiter,  // 可切换
 *   sheetName,            // 目标 sheet 名 / 单独输出时的 xlsx 内 sheet 名
 *   rows, cols,           // 预览行列数（根据当前编码+分隔符实时算）
 *   text,                 // 用当前编码解码后的文本，缓存用
 * }
 */
const rows = ref([])
const isParsing = ref(false)
const isConverting = ref(false)
const fileInput = ref(null)

const outputMode = ref('merge') // 'merge' | 'separate'
const outputName = ref('converted.xlsx')

let rowSeq = 0

const sheetNames = computed(() => rows.value.map((r) => r.sheetName))

const duplicateSheetNames = computed(() => {
  if (outputMode.value !== 'merge') return new Set()
  const seen = new Map()
  for (const n of sheetNames.value) {
    const k = n.trim().toLowerCase()
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  const dups = new Set()
  for (const [k, c] of seen) if (c > 1 && k !== '') dups.add(k)
  return dups
})

const rowErrors = computed(() =>
  rows.value.map((r) => {
    const err = validateSheetName(r.sheetName)
    if (err) return err
    if (duplicateSheetNames.value.has(r.sheetName.trim().toLowerCase())) {
      return '与其他 sheet 名字重复'
    }
    return ''
  }),
)

const hasErrors = computed(() => rowErrors.value.some((e) => e !== ''))
const canConvert = computed(() => rows.value.length > 0 && !hasErrors.value && !isConverting.value)

function pickFiles() {
  fileInput.value?.click()
}

async function onFilesSelected(event) {
  const files = Array.from(event.target.files ?? [])
  event.target.value = ''
  await addFiles(files)
}

async function onDrop(event) {
  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
    /\.(csv|tsv|txt)$/i.test(f.name),
  )
  await addFiles(files)
}

function onDragOver(event) {
  event.preventDefault()
}

async function addFiles(files) {
  if (!files.length) return
  isParsing.value = true
  try {
    for (const f of files) {
      await parseFile(f)
    }
  } finally {
    isParsing.value = false
  }
}

async function parseFile(file) {
  try {
    const buffer = await file.arrayBuffer()
    const { encoding, text } = detectEncoding(buffer)
    const delimiter = /\.tsv$/i.test(file.name) ? '\t' : detectDelimiter(text)
    const { rows: rc, cols: cc } = countCsv(text, delimiter)
    const base = stripExtension(file.name)
    rows.value.push({
      id: `r${++rowSeq}`,
      fileName: file.name,
      fileBase: base,
      buffer,
      encoding,
      delimiter,
      sheetName: sanitizeSheetName(base) || 'sheet',
      rows: rc,
      cols: cc,
      text,
    })
  } catch (err) {
    console.error(err)
    alert(`解析失败：${file.name}\n${err.message ?? err}`)
  }
}

// 切编码或分隔符时刷新预览。
function refreshRow(r) {
  r.text = decodeAs(r.buffer, r.encoding)
  const { rows: rc, cols: cc } = countCsv(r.text, r.delimiter)
  r.rows = rc
  r.cols = cc
}

function onEncodingChange(r) {
  refreshRow(r)
}

function onDelimiterChange(r) {
  refreshRow(r)
}

function countCsv(text, delimiter) {
  // 用 SheetJS 解析成 aoa 再数，能正确处理引号内换行 / 分隔符。
  try {
    const wb = XLSX.read(text, { type: 'string', FS: delimiter, raw: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws || !ws['!ref']) return { rows: 0, cols: 0 }
    const range = XLSX.utils.decode_range(ws['!ref'])
    return {
      rows: range.e.r - range.s.r + 1,
      cols: range.e.c - range.s.c + 1,
    }
  } catch {
    return { rows: 0, cols: 0 }
  }
}

function removeRow(id) {
  rows.value = rows.value.filter((r) => r.id !== id)
}

function clearAll() {
  rows.value = []
}

function resetSheetNames() {
  const used = new Set()
  for (const r of rows.value) {
    const base = sanitizeSheetName(r.fileBase) || 'sheet'
    r.sheetName = outputMode.value === 'merge' ? uniqueName(base, used) : base
    used.add(r.sheetName.toLowerCase())
  }
}

function autoDedupe() {
  const used = new Set()
  for (const r of rows.value) {
    const base = sanitizeSheetName(r.sheetName) || 'sheet'
    r.sheetName = uniqueName(base, used)
    used.add(r.sheetName.toLowerCase())
  }
}

async function convertAndDownload() {
  if (!canConvert.value) return
  isConverting.value = true
  try {
    if (outputMode.value === 'merge') {
      await convertMerged()
    } else {
      await convertSeparate()
    }
  } catch (err) {
    console.error(err)
    alert(`转换失败：${err.message ?? err}`)
  } finally {
    isConverting.value = false
  }
}

async function convertMerged() {
  const out = XLSX.utils.book_new()
  for (const r of rows.value) {
    const wb = XLSX.read(r.text, { type: 'string', FS: r.delimiter, raw: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    XLSX.utils.book_append_sheet(out, ws, r.sheetName.trim())
  }
  const filename = sanitizeFilename(outputName.value.trim() || 'converted', 'converted')
  const finalName = /\.xlsx$/i.test(filename) ? filename : `${filename}.xlsx`
  XLSX.writeFile(out, finalName, { bookType: 'xlsx', compression: true })
}

async function convertSeparate() {
  if (rows.value.length === 1) {
    // 单文件直接下载 .xlsx。
    const r = rows.value[0]
    const wb = buildWorkbook(r)
    const name = sanitizeFilename(r.fileBase, 'converted') + '.xlsx'
    XLSX.writeFile(wb, name, { bookType: 'xlsx', compression: true })
    return
  }

  // 多文件打包成 zip。
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const used = new Set()
  for (const r of rows.value) {
    const wb = buildWorkbook(r)
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true })
    const baseName = sanitizeFilename(r.fileBase, 'converted')
    // zip 内文件名去重
    let name = `${baseName}.xlsx`
    let i = 2
    while (used.has(name.toLowerCase())) {
      name = `${baseName} (${i++}).xlsx`
    }
    used.add(name.toLowerCase())
    zip.file(name, buf)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const zipName = sanitizeFilename(stripExtension(outputName.value), 'converted') + '.zip'
  downloadBlob(blob, zipName, 'application/zip')
}

function buildWorkbook(r) {
  const wb = XLSX.read(r.text, { type: 'string', FS: r.delimiter, raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const out = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(out, ws, r.sheetName.trim() || 'Sheet1')
  return out
}
</script>

<template>
  <section>
    <div
      class="dropzone"
      :class="{ empty: rows.length === 0 }"
      @drop="onDrop"
      @dragover="onDragOver"
    >
      <div class="dropzone-inner">
        <p class="dz-title">
          <strong>拖拽 CSV / TSV 到这里</strong> 或
          <button class="primary" @click="pickFiles" :disabled="isParsing">
            {{ isParsing ? '正在解析…' : '选择文件' }}
          </button>
        </p>
        <p class="dz-hint">
          支持多选，编码和分隔符会自动探测，也可以手动切换。
        </p>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          multiple
          hidden
          @change="onFilesSelected"
        />
      </div>
    </div>

    <div v-if="rows.length" class="mode-row">
      <label>
        <input type="radio" v-model="outputMode" value="merge" />
        合并为一个 xlsx（每个 CSV 一个 sheet）
      </label>
      <label>
        <input type="radio" v-model="outputMode" value="separate" />
        每个 CSV 单独一个 xlsx（多文件自动打包 zip）
      </label>
    </div>

    <div v-if="rows.length" class="toolbar">
      <button @click="resetSheetNames">恢复 sheet 默认名</button>
      <button
        @click="autoDedupe"
        :disabled="outputMode !== 'merge' || (!hasErrors && duplicateSheetNames.size === 0)"
      >
        自动去重
      </button>
      <button class="danger" @click="clearAll">清空</button>
      <div class="spacer" />
      <label v-if="outputMode === 'merge'" class="output-name">
        输出文件名
        <input v-model="outputName" type="text" placeholder="converted.xlsx" />
      </label>
      <label v-else class="output-name">
        zip 名（多文件时）
        <input v-model="outputName" type="text" placeholder="converted.zip" />
      </label>
      <button class="primary" :disabled="!canConvert" @click="convertAndDownload">
        {{ isConverting ? '转换中…' : '转换并下载' }}
      </button>
    </div>

    <table v-if="rows.length" class="sheet-table">
      <thead>
        <tr>
          <th style="width: 22%">CSV 文件</th>
          <th style="width: 18%">编码</th>
          <th style="width: 14%">分隔符</th>
          <th style="width: 24%">
            {{ outputMode === 'merge' ? '目标 sheet 名' : 'xlsx 内 sheet 名' }}
          </th>
          <th style="width: 14%">行 × 列</th>
          <th style="width: 8%"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.id">
          <td class="mono">{{ r.fileName }}</td>
          <td>
            <select v-model="r.encoding" @change="onEncodingChange(r)">
              <option v-for="e in READABLE_ENCODINGS" :key="e.value" :value="e.value">
                {{ e.label }}
              </option>
            </select>
          </td>
          <td>
            <select v-model="r.delimiter" @change="onDelimiterChange(r)">
              <option v-for="d in DELIMITERS" :key="d.value" :value="d.value">
                {{ d.label }}
              </option>
            </select>
          </td>
          <td>
            <input
              v-model="r.sheetName"
              type="text"
              :class="{ invalid: !!rowErrors[i] }"
              :maxlength="MAX_SHEET_NAME_LEN + 20"
              spellcheck="false"
            />
            <div v-if="rowErrors[i]" class="row-error">{{ rowErrors[i] }}</div>
          </td>
          <td class="mono">{{ r.rows }} × {{ r.cols }}</td>
          <td>
            <button class="danger" @click="removeRow(r.id)">移除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="rows.length" class="hints">
      <p v-if="outputMode === 'merge'">
        <strong>命名规则：</strong>不能为空，长度 ≤ {{ MAX_SHEET_NAME_LEN }}，
        不能包含 <code>{{ INVALID_SHEET_NAME_CHARS }}</code
        >，也不能是 <code>History</code>。
      </p>
      <p>
        <strong>提示：</strong>如果预览的行列数看起来不对，切一下编码或分隔符再看看。
      </p>
    </div>
  </section>
</template>

<style scoped>
.dropzone {
  border: 2px dashed #d0d7de;
  border-radius: 8px;
  padding: 28px 16px;
  background: #fafbfc;
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.dropzone.empty {
  padding: 48px 16px;
}

.dropzone:hover {
  border-color: #1f6feb;
  background: #f2f7ff;
}

.dz-title {
  margin: 0 0 8px;
  font-size: 15px;
}

.dz-hint {
  margin: 0;
  color: #656d76;
  font-size: 13px;
}

.mode-row {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-size: 14px;
}

.mode-row label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.toolbar {
  margin: 14px 0 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.spacer {
  flex: 1;
}

.output-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #656d76;
}

.output-name input {
  width: 200px;
}

.sheet-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: hidden;
  font-size: 14px;
}

.sheet-table th,
.sheet-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #d0d7de;
  text-align: left;
  vertical-align: middle;
}

.sheet-table thead th {
  background: #f6f8fa;
  font-weight: 600;
}

.sheet-table tbody tr:last-child td {
  border-bottom: none;
}

.sheet-table tbody tr:hover {
  background: #fafbfc;
}

select {
  font: inherit;
  padding: 5px 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  width: 100%;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  color: #24292f;
  word-break: break-all;
}

.row-error {
  color: #cf222e;
  font-size: 12px;
  margin-top: 4px;
}

.hints {
  margin-top: 14px;
  font-size: 12px;
  color: #656d76;
}

.hints p {
  margin: 4px 0;
}

.hints code {
  background: #eaeef2;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
