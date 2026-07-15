<script setup>
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import { sanitizeFilename } from '../utils/csv.js'
import {
  INVALID_SHEET_NAME_CHARS,
  MAX_SHEET_NAME_LEN,
  sanitizeSheetName,
  stripExtension,
  validateSheetName,
} from '../utils/sheetName.js'

/**
 * 一行 = 一个源 sheet。
 * {
 *   id, fileId, fileName, fileBase,
 *   sheetName, selected,
 *   rows, cols,
 *   workbook,
 * }
 */
const rows = ref([])
const isParsing = ref(false)
const isMerging = ref(false)
const fileInput = ref(null)

// 分隔用的空行数
const blankRows = ref(1)

// 是否跳过后续 sheet 的前 N 行（也就是"只保留第一个 sheet 的标题"）
const stripFollowingHeaders = ref(false)
const headerRowCount = ref(1)

// 来源列设置
const addSourceColumn = ref(false)
const sourceColumnPosition = ref('left') // 'left' | 'right'
const sourceLabelMode = ref('file-sheet') // 'file-sheet' | 'file' | 'sheet'

// 输出
const outputFileName = ref('merged-into-one.xlsx')
const outputSheetName = ref('合并')

let rowSeq = 0
let fileSeq = 0

const outputSheetError = computed(() => validateSheetName(outputSheetName.value))
const selectedRows = computed(() => rows.value.filter((r) => r.selected))

const canMerge = computed(
  () =>
    selectedRows.value.length > 0 &&
    !outputSheetError.value &&
    !isMerging.value &&
    Number.isInteger(blankRows.value) &&
    blankRows.value >= 0 &&
    Number.isInteger(headerRowCount.value) &&
    headerRowCount.value >= 0,
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
      cellFormula: false,
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

function moveUp(index) {
  if (index <= 0) return
  const arr = rows.value
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
}

function moveDown(index) {
  const arr = rows.value
  if (index >= arr.length - 1) return
  ;[arr[index + 1], arr[index]] = [arr[index], arr[index + 1]]
}

function sourceLabelFor(r) {
  switch (sourceLabelMode.value) {
    case 'file':
      return r.fileBase
    case 'sheet':
      return r.sheetName
    case 'file-sheet':
    default:
      return `${r.fileBase} - ${r.sheetName}`
  }
}

/**
 * 把一个源 sheet 转成 array-of-arrays（保持原始的空格 / null，避免掉列）。
 * @returns {Array<Array<any>>}
 */
function sheetToAoa(r) {
  const ws = r.workbook.Sheets[r.sheetName]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true,
  })
}

async function mergeAndDownload() {
  if (!canMerge.value) return
  isMerging.value = true
  try {
    const merged = []
    const separator = Array.from({ length: blankRows.value }, () => [])

    selectedRows.value.forEach((r, idx) => {
      let aoa = sheetToAoa(r)

      // 跳过后续 sheet 的标题行
      if (stripFollowingHeaders.value && idx > 0 && headerRowCount.value > 0) {
        aoa = aoa.slice(headerRowCount.value)
      }

      // 添加来源列
      if (addSourceColumn.value) {
        const label = sourceLabelFor(r)
        aoa = aoa.map((row) =>
          sourceColumnPosition.value === 'right' ? [...row, label] : [label, ...row],
        )
      }

      if (idx > 0 && blankRows.value > 0) merged.push(...separator)
      merged.push(...aoa)
    })

    const ws = XLSX.utils.aoa_to_sheet(merged)
    const wb = XLSX.utils.book_new()
    const sheetName = outputSheetName.value.trim() || '合并'
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    const filename = sanitizeFilename(outputFileName.value.trim() || 'merged-into-one', 'merged')
    const finalName = /\.xlsx$/i.test(filename) ? filename : `${filename}.xlsx`
    XLSX.writeFile(wb, finalName, { bookType: 'xlsx', compression: true })
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

const totalRowsPreview = computed(() => {
  const sel = selectedRows.value
  if (!sel.length) return 0
  let total = 0
  sel.forEach((r, idx) => {
    let rc = r.rows
    if (stripFollowingHeaders.value && idx > 0) {
      rc = Math.max(0, rc - headerRowCount.value)
    }
    total += rc
    if (idx > 0) total += blankRows.value
  })
  return total
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
        <p class="dz-hint">
          支持多选。所有勾选的 sheet 会按下面表格的顺序拼到同一张 sheet 里，之间用空行隔开。
        </p>
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

    <div v-if="rows.length" class="options">
      <div class="opt-group">
        <label class="opt-inline">
          分隔空行数
          <input type="number" min="0" max="20" v-model.number="blankRows" />
        </label>

        <label class="opt-inline">
          <input type="checkbox" v-model="stripFollowingHeaders" />
          只保留第一个 sheet 的标题（后续 sheet 跳过前
          <input
            class="mini"
            type="number"
            min="0"
            max="20"
            v-model.number="headerRowCount"
            :disabled="!stripFollowingHeaders"
          />
          行）
        </label>
      </div>

      <div class="opt-group">
        <label class="opt-inline">
          <input type="checkbox" v-model="addSourceColumn" />
          添加来源列
        </label>
        <label class="opt-inline" :class="{ dim: !addSourceColumn }">
          位置
          <select v-model="sourceColumnPosition" :disabled="!addSourceColumn">
            <option value="left">最左侧</option>
            <option value="right">最右侧</option>
          </select>
        </label>
        <label class="opt-inline" :class="{ dim: !addSourceColumn }">
          内容
          <select v-model="sourceLabelMode" :disabled="!addSourceColumn">
            <option value="file-sheet">文件名 - Sheet 名</option>
            <option value="file">文件名</option>
            <option value="sheet">Sheet 名</option>
          </select>
        </label>
      </div>

      <div class="opt-group">
        <label class="opt-inline">
          输出文件名
          <input type="text" v-model="outputFileName" placeholder="merged-into-one.xlsx" />
        </label>
        <label class="opt-inline">
          输出 sheet 名
          <input
            type="text"
            v-model="outputSheetName"
            :class="{ invalid: !!outputSheetError }"
            :maxlength="MAX_SHEET_NAME_LEN + 20"
          />
          <span v-if="outputSheetError" class="row-error inline">{{ outputSheetError }}</span>
        </label>
      </div>
    </div>

    <div v-if="rows.length" class="toolbar">
      <button class="danger" @click="clearAll">清空</button>
      <div class="spacer" />
      <span class="preview-count" v-if="selectedRows.length">
        预计输出 {{ totalRowsPreview }} 行（{{ selectedRows.length }} 个 sheet）
      </span>
      <button class="primary" :disabled="!canMerge" @click="mergeAndDownload">
        {{ isMerging ? '正在合并…' : '合并并下载' }}
      </button>
    </div>

    <table v-if="rows.length" class="sheet-table">
      <thead>
        <tr>
          <th style="width: 40px">
            <input type="checkbox" v-model="allSelected" />
          </th>
          <th style="width: 6%">顺序</th>
          <th style="width: 28%">来源文件</th>
          <th style="width: 22%">Sheet</th>
          <th style="width: 12%">行 × 列</th>
          <th style="width: 12%">调整顺序</th>
          <th style="width: 8%"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.id" :class="{ disabled: !r.selected }">
          <td>
            <input type="checkbox" v-model="r.selected" />
          </td>
          <td class="mono seq">{{ i + 1 }}</td>
          <td class="mono">{{ r.fileName }}</td>
          <td class="mono">{{ r.sheetName }}</td>
          <td class="mono">{{ r.rows }} × {{ r.cols }}</td>
          <td>
            <div class="order-btns">
              <button :disabled="i === 0" @click="moveUp(i)" title="上移">↑</button>
              <button
                :disabled="i === rows.length - 1"
                @click="moveDown(i)"
                title="下移"
              >
                ↓
              </button>
            </div>
          </td>
          <td>
            <button class="danger" @click="removeRow(r.id)">移除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="rows.length" class="hints">
      <p>
        <strong>默认行为：</strong>每个 sheet 完整保留（含标题），按上面顺序依次拼到同一张 sheet，
        中间空 {{ blankRows }} 行。
      </p>
      <p>
        <strong>命名规则：</strong>输出 sheet 名不能为空，长度 ≤ {{ MAX_SHEET_NAME_LEN }}，
        不能包含 <code>{{ INVALID_SHEET_NAME_CHARS }}</code
        >。
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

.options {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 8px;
}

.opt-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.opt-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #24292f;
}

.opt-inline.dim {
  color: #8a939e;
}

.opt-inline input[type='number'] {
  width: 64px;
  padding: 3px 6px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font: inherit;
}

.opt-inline input[type='number'].mini {
  width: 52px;
}

.opt-inline input[type='text'] {
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font: inherit;
  min-width: 200px;
}

.opt-inline input[type='text'].invalid {
  border-color: #cf222e;
  background: #fff5f5;
}

.opt-inline select {
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font: inherit;
  background: #fff;
}

.row-error.inline {
  margin-left: 4px;
  color: #cf222e;
  font-size: 12px;
}

.toolbar {
  margin: 12px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.spacer {
  flex: 1;
}

.preview-count {
  color: #656d76;
  font-size: 13px;
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

.seq {
  color: #656d76;
}

.order-btns {
  display: inline-flex;
  gap: 4px;
}

.order-btns button {
  padding: 2px 8px;
  min-width: 28px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  color: #24292f;
  word-break: break-all;
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
