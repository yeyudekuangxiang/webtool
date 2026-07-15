<script setup>
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import {
  DELIMITERS,
  WRITABLE_ENCODINGS,
  downloadBlob,
  encodeCsv,
  sanitizeFilename,
} from '../utils/csv.js'
import { stripExtension } from '../utils/sheetName.js'

/**
 * 一行 = 源 xlsx 中的一个 sheet。
 * {
 *   id, fileId, fileName, fileBase,
 *   sheetName,       // 源 sheet 名
 *   selected,        // 是否导出
 *   outputName,      // 输出 csv 名（不带 .csv）
 *   rows, cols,
 *   workbook,        // 共享的源 workbook
 * }
 */
const rows = ref([])
const isParsing = ref(false)
const isConverting = ref(false)
const fileInput = ref(null)

const outputEncoding = ref('utf-8-bom')
const outputDelimiter = ref(',')
const zipName = ref('csv-export.zip')

let rowSeq = 0
let fileSeq = 0

const selectedRows = computed(() => rows.value.filter((r) => r.selected))

const nameConflicts = computed(() => {
  const seen = new Map()
  for (const r of selectedRows.value) {
    const k = (r.outputName || '').trim().toLowerCase()
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  const dups = new Set()
  for (const [k, c] of seen) if (c > 1 && k !== '') dups.add(k)
  return dups
})

const rowErrors = computed(() =>
  rows.value.map((r) => {
    if (!r.selected) return ''
    const trimmed = (r.outputName ?? '').trim()
    if (!trimmed) return '文件名不能为空'
    if (nameConflicts.value.has(trimmed.toLowerCase())) return '与其他文件名重复'
    return ''
  }),
)

const hasErrors = computed(() => rowErrors.value.some((e) => e !== ''))
const canConvert = computed(
  () => selectedRows.value.length > 0 && !hasErrors.value && !isConverting.value,
)

const allSelected = computed({
  get: () => rows.value.length > 0 && rows.value.every((r) => r.selected),
  set: (v) => rows.value.forEach((r) => (r.selected = !!v)),
})

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
    /\.xlsx?$/i.test(f.name),
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
    for (const f of files) await parseFile(f)
  } finally {
    isParsing.value = false
  }
}

async function parseFile(file) {
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, {
      cellStyles: false,
      cellFormula: true,
      cellDates: true,
      cellNF: true,
    })
    const fileId = `f${++fileSeq}`
    const fileBase = stripExtension(file.name)
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
      const rc = range ? range.e.r - range.s.r + 1 : 0
      const cc = range ? range.e.c - range.s.c + 1 : 0
      rows.value.push({
        id: `r${++rowSeq}`,
        fileId,
        fileName: file.name,
        fileBase,
        sheetName: name,
        selected: true,
        outputName: sanitizeFilename(`${fileBase}_${name}`, 'sheet'),
        rows: rc,
        cols: cc,
        workbook: wb,
      })
    }
  } catch (err) {
    console.error(err)
    alert(`解析失败：${file.name}\n${err.message ?? err}`)
  }
}

function removeRow(id) {
  rows.value = rows.value.filter((r) => r.id !== id)
}

function removeFile(fileId) {
  rows.value = rows.value.filter((r) => r.fileId !== fileId)
}

function clearAll() {
  rows.value = []
}

function resetOutputNames() {
  for (const r of rows.value) {
    r.outputName = sanitizeFilename(`${r.fileBase}_${r.sheetName}`, 'sheet')
  }
}

function nameByFileOnly() {
  const used = new Set()
  for (const r of rows.value) {
    let base = sanitizeFilename(r.fileBase, 'sheet')
    let name = base
    let i = 2
    while (used.has(name.toLowerCase())) name = `${base} (${i++})`
    used.add(name.toLowerCase())
    r.outputName = name
  }
}

function nameBySheetOnly() {
  const used = new Set()
  for (const r of rows.value) {
    let base = sanitizeFilename(r.sheetName, 'sheet')
    let name = base
    let i = 2
    while (used.has(name.toLowerCase())) name = `${base} (${i++})`
    used.add(name.toLowerCase())
    r.outputName = name
  }
}

async function convertAndDownload() {
  if (!canConvert.value) return
  isConverting.value = true
  try {
    const targets = selectedRows.value.map((r) => ({
      row: r,
      csv: XLSX.utils.sheet_to_csv(r.workbook.Sheets[r.sheetName], {
        FS: outputDelimiter.value,
      }),
    }))

    if (targets.length === 1) {
      const { row, csv } = targets[0]
      const bytes = encodeCsv(csv, outputEncoding.value)
      const fname = sanitizeFilename(row.outputName, 'sheet') + '.csv'
      downloadBlob(bytes, fname, 'text/csv;charset=utf-8')
      return
    }

    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const used = new Set()
    for (const { row, csv } of targets) {
      let base = sanitizeFilename(row.outputName, 'sheet')
      let name = `${base}.csv`
      let i = 2
      while (used.has(name.toLowerCase())) name = `${base} (${i++}).csv`
      used.add(name.toLowerCase())
      zip.file(name, encodeCsv(csv, outputEncoding.value))
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const finalZip = sanitizeFilename(stripExtension(zipName.value), 'csv-export') + '.zip'
    downloadBlob(blob, finalZip, 'application/zip')
  } catch (err) {
    console.error(err)
    alert(`转换失败：${err.message ?? err}`)
  } finally {
    isConverting.value = false
  }
}

const groupedFiles = computed(() => {
  const groups = new Map()
  for (const r of rows.value) {
    if (!groups.has(r.fileId)) {
      groups.set(r.fileId, { fileId: r.fileId, fileName: r.fileName, count: 0 })
    }
    groups.get(r.fileId).count += 1
  }
  return Array.from(groups.values())
})
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
          <strong>拖拽 xlsx 到这里</strong> 或
          <button class="primary" @click="pickFiles" :disabled="isParsing">
            {{ isParsing ? '正在解析…' : '选择文件' }}
          </button>
        </p>
        <p class="dz-hint">支持多选，会把每个 sheet 单独导出为一个 CSV</p>
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          multiple
          hidden
          @change="onFilesSelected"
        />
      </div>
    </div>

    <div v-if="groupedFiles.length" class="file-chips">
      <span class="chips-label">已加载文件：</span>
      <span v-for="f in groupedFiles" :key="f.fileId" class="chip">
        {{ f.fileName }} ({{ f.count }})
        <button class="chip-x" @click="removeFile(f.fileId)" title="移除该文件的所有 sheet">
          ×
        </button>
      </span>
    </div>

    <div v-if="rows.length" class="option-row">
      <label class="opt">
        输出编码
        <select v-model="outputEncoding">
          <option v-for="e in WRITABLE_ENCODINGS" :key="e.value" :value="e.value">
            {{ e.label }}
          </option>
        </select>
      </label>
      <label class="opt">
        分隔符
        <select v-model="outputDelimiter">
          <option v-for="d in DELIMITERS" :key="d.value" :value="d.value">
            {{ d.label }}
          </option>
        </select>
      </label>
      <label class="opt zip">
        zip 名（多文件时）
        <input v-model="zipName" type="text" placeholder="csv-export.zip" />
      </label>
    </div>

    <div v-if="rows.length" class="toolbar">
      <button @click="resetOutputNames">恢复默认名（文件名_sheet 名）</button>
      <button @click="nameByFileOnly">全部按文件名命名</button>
      <button @click="nameBySheetOnly">全部按 sheet 名命名</button>
      <button class="danger" @click="clearAll">清空</button>
      <div class="spacer" />
      <button class="primary" :disabled="!canConvert" @click="convertAndDownload">
        {{ isConverting ? '导出中…' : `导出 ${selectedRows.length} 个 CSV` }}
      </button>
    </div>

    <table v-if="rows.length" class="sheet-table">
      <thead>
        <tr>
          <th style="width: 40px">
            <input type="checkbox" v-model="allSelected" />
          </th>
          <th style="width: 22%">来源文件</th>
          <th style="width: 20%">Sheet</th>
          <th style="width: 28%">输出文件名（不含扩展名）</th>
          <th style="width: 12%">行 × 列</th>
          <th style="width: 8%"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.id" :class="{ disabled: !r.selected }">
          <td>
            <input type="checkbox" v-model="r.selected" />
          </td>
          <td class="mono">{{ r.fileName }}</td>
          <td class="mono">{{ r.sheetName }}</td>
          <td>
            <div class="name-cell">
              <input
                v-model="r.outputName"
                type="text"
                :class="{ invalid: !!rowErrors[i] }"
                :disabled="!r.selected"
                spellcheck="false"
              />
              <span class="ext">.csv</span>
            </div>
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
      <p>
        <strong>提示：</strong>Excel 双击打开 UTF-8 CSV 中文容易乱码，导出时选
        <code>UTF-8 with BOM</code> 即可；如果目标是别的程序，选 <code>UTF-8 无 BOM</code>。
      </p>
      <p>
        选中多个 sheet 时会自动打包成一个 zip 下载；只选一个时直接下载 CSV。
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

.file-chips {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.chips-label {
  color: #656d76;
  font-size: 13px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 10px;
  background: #eaeef2;
  border-radius: 999px;
  font-size: 13px;
}

.chip-x {
  border: none;
  background: transparent;
  padding: 0 4px;
  border-radius: 999px;
  color: #656d76;
  line-height: 1;
  font-size: 16px;
}

.chip-x:hover:not(:disabled) {
  background: #d0d7de;
  color: #1f2328;
}

.option-row {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #656d76;
}

.opt.zip input {
  width: 180px;
}

.opt select {
  min-width: 220px;
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

.sheet-table tbody tr.disabled {
  color: #8a939e;
}

.sheet-table tbody tr.disabled .mono {
  color: #8a939e;
}

select {
  font: inherit;
  padding: 5px 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.name-cell input {
  flex: 1 1 auto;
  min-width: 0;
}

.ext {
  color: #656d76;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
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
