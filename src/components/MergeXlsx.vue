<script setup>
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import {
  INVALID_SHEET_NAME_CHARS,
  MAX_SHEET_NAME_LEN,
  sanitizeSheetName,
  stripExtension,
  uniqueName,
  validateSheetName,
} from '../utils/sheetName.js'

/**
 * Each row represents one sheet from one uploaded file.
 * {
 *   id: string,          // unique row id
 *   fileId: string,      // groups rows from the same file
 *   fileName: string,    // original file name incl. extension
 *   fileBase: string,    // file name without extension
 *   originalName: string,// sheet name in the source workbook
 *   targetName: string,  // sheet name in the merged workbook (editable)
 *   rows: number,
 *   cols: number,
 *   workbook: XLSX.WorkBook, // parsed source workbook, shared between rows of same file
 * }
 */
const rows = ref([])
const isParsing = ref(false)
const isMerging = ref(false)
const fileInput = ref(null)
const outputName = ref('merged.xlsx')

let rowSeq = 0
let fileSeq = 0

const targetNames = computed(() => rows.value.map((r) => r.targetName))

const duplicateNames = computed(() => {
  const seen = new Map()
  for (const name of targetNames.value) {
    const key = name.trim().toLowerCase()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const dups = new Set()
  for (const [key, count] of seen) {
    if (count > 1 && key !== '') dups.add(key)
  }
  return dups
})

const rowErrors = computed(() => {
  return rows.value.map((r) => {
    const err = validateSheetName(r.targetName)
    if (err) return err
    if (duplicateNames.value.has(r.targetName.trim().toLowerCase())) {
      return '与其他 sheet 名字重复'
    }
    return ''
  })
})

const hasErrors = computed(() => rowErrors.value.some((e) => e !== ''))
const canMerge = computed(() => rows.value.length > 0 && !hasErrors.value && !isMerging.value)

function pickFiles() {
  fileInput.value?.click()
}

async function onFilesSelected(event) {
  const files = Array.from(event.target.files ?? [])
  event.target.value = '' // allow re-selecting the same file
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
    for (const file of files) {
      await parseFile(file)
    }
  } finally {
    isParsing.value = false
  }
}

async function parseFile(file) {
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, {
      cellStyles: true,
      cellFormula: true,
      cellDates: true,
      cellNF: true,
      dense: false,
    })
    const fileId = `f${++fileSeq}`
    const fileBase = stripExtension(file.name)
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
      const rowCount = range ? range.e.r - range.s.r + 1 : 0
      const colCount = range ? range.e.c - range.s.c + 1 : 0
      rows.value.push({
        id: `r${++rowSeq}`,
        fileId,
        fileName: file.name,
        fileBase,
        originalName: name,
        targetName: name,
        rows: rowCount,
        cols: colCount,
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

function resetToOriginal() {
  for (const r of rows.value) r.targetName = r.originalName
}

function setAllToFilename() {
  const used = new Set()
  for (const r of rows.value) {
    const base = sanitizeSheetName(r.fileBase) || 'sheet'
    r.targetName = uniqueName(base, used)
    used.add(r.targetName.toLowerCase())
  }
}

function autoDedupe() {
  const used = new Set()
  for (const r of rows.value) {
    const base = sanitizeSheetName(r.targetName) || 'sheet'
    r.targetName = uniqueName(base, used)
    used.add(r.targetName.toLowerCase())
  }
}

async function mergeAndDownload() {
  if (!canMerge.value) return
  isMerging.value = true
  try {
    const out = XLSX.utils.book_new()
    for (const r of rows.value) {
      const src = r.workbook.Sheets[r.originalName]
      // Shallow clone the worksheet so downstream re-merges won't mutate the source.
      const cloned = { ...src }
      XLSX.utils.book_append_sheet(out, cloned, r.targetName.trim())
    }
    const filename = outputName.value.trim() || 'merged.xlsx'
    const finalName = /\.xlsx$/i.test(filename) ? filename : `${filename}.xlsx`
    XLSX.writeFile(out, finalName, { bookType: 'xlsx', compression: true })
  } catch (err) {
    console.error(err)
    alert(`合并失败：${err.message ?? err}`)
  } finally {
    isMerging.value = false
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
        <p class="dz-hint">支持多选，每个文件里的 sheet 会全部列出</p>
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

    <div v-if="rows.length" class="toolbar">
      <button @click="setAllToFilename">全部设为文件名</button>
      <button @click="resetToOriginal">恢复默认名</button>
      <button @click="autoDedupe" :disabled="!hasErrors && duplicateNames.size === 0">
        自动去重
      </button>
      <button class="danger" @click="clearAll">清空</button>
      <div class="spacer" />
      <label class="output-name">
        输出文件名
        <input v-model="outputName" type="text" placeholder="merged.xlsx" />
      </label>
      <button class="primary" :disabled="!canMerge" @click="mergeAndDownload">
        {{ isMerging ? '正在合并…' : '合并并下载' }}
      </button>
    </div>

    <table v-if="rows.length" class="sheet-table">
      <thead>
        <tr>
          <th style="width: 28%">来源文件</th>
          <th style="width: 22%">原 sheet 名</th>
          <th style="width: 30%">新 sheet 名</th>
          <th style="width: 12%">行 × 列</th>
          <th style="width: 8%"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.id">
          <td class="mono">{{ r.fileName }}</td>
          <td class="mono">{{ r.originalName }}</td>
          <td>
            <input
              v-model="r.targetName"
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
      <p>
        <strong>命名规则：</strong>不能为空，长度 ≤ {{ MAX_SHEET_NAME_LEN }}，
        不能包含 <code>{{ INVALID_SHEET_NAME_CHARS }}</code
        >，也不能是 <code>History</code>。
      </p>
      <p>
        <strong>提示：</strong>合并会保留单元格值、公式和基本格式；SheetJS 社区版对复杂样式
        （条件格式、图表、图片等）支持有限。
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

.toolbar {
  margin: 20px 0 12px;
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
  width: 180px;
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
  color: #1f2328;
}

.sheet-table tbody tr:last-child td {
  border-bottom: none;
}

.sheet-table tbody tr:hover {
  background: #fafbfc;
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
