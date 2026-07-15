<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

// —— 当前时间戳（每秒刷新） ——
const now = ref(Date.now())
let timer = null
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const nowMs = computed(() => String(now.value))
const nowSec = computed(() => String(Math.floor(now.value / 1000)))

// —— 时间戳 → 日期 ——
const tsInput = ref(String(Math.floor(Date.now() / 1000)))
const tsUnit = ref('auto') // 'auto' | 's' | 'ms'
const tsError = ref('')

function parseInputTsToMs(raw, unit) {
  const t = raw.trim()
  if (!t) return null
  if (!/^-?\d+$/.test(t)) return NaN
  const n = Number(t)
  if (!Number.isFinite(n)) return NaN
  if (unit === 's') return n * 1000
  if (unit === 'ms') return n
  // auto：位数 >= 13 视为毫秒，其余视为秒
  return Math.abs(n) >= 1e12 ? n : n * 1000
}

const tsResult = computed(() => {
  tsError.value = ''
  const ms = parseInputTsToMs(tsInput.value, tsUnit.value)
  if (ms === null) return null
  if (Number.isNaN(ms)) {
    tsError.value = '时间戳必须是整数'
    return null
  }
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) {
    tsError.value = '无法解析该时间戳'
    return null
  }
  return {
    local: formatLocal(d),
    iso: d.toISOString(),
    utc: d.toUTCString(),
  }
})

function formatLocal(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds())
  )
}

// —— 日期 → 时间戳 ——
const dateInput = ref(formatLocal(new Date()))
const dateError = ref('')

const dateResult = computed(() => {
  dateError.value = ''
  const raw = dateInput.value.trim()
  if (!raw) return null
  // 支持 "YYYY-MM-DD HH:mm:ss" 或标准 ISO
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) {
    dateError.value = '无法解析该日期，请使用 YYYY-MM-DD HH:mm:ss 或 ISO 格式'
    return null
  }
  const ms = d.getTime()
  return {
    ms: String(ms),
    sec: String(Math.floor(ms / 1000)),
    iso: d.toISOString(),
  }
})

watch(tsUnit, () => {
  // 切换单位时保留原输入
})

async function copy(text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

function setNowInSeconds() {
  tsInput.value = String(Math.floor(Date.now() / 1000))
  tsUnit.value = 's'
}
function setNowInMs() {
  tsInput.value = String(Date.now())
  tsUnit.value = 'ms'
}
function setNowInDateInput() {
  dateInput.value = formatLocal(new Date())
}
</script>

<template>
  <section class="tool">
    <h2>时间戳工具</h2>
    <p class="hint">当前时间戳每秒刷新，可以在下面的两个区域相互转换。</p>

    <div class="card">
      <div class="card-title">当前时间戳</div>
      <div class="rows">
        <div class="row">
          <span class="pill">秒</span>
          <code>{{ nowSec }}</code>
          <button class="mini" @click="copy(nowSec)">复制</button>
        </div>
        <div class="row">
          <span class="pill alt">毫秒</span>
          <code>{{ nowMs }}</code>
          <button class="mini" @click="copy(nowMs)">复制</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">时间戳 → 日期</div>
      <div class="form">
        <input v-model="tsInput" type="text" placeholder="1700000000 或 1700000000000" />
        <select v-model="tsUnit">
          <option value="auto">自动识别</option>
          <option value="s">按秒</option>
          <option value="ms">按毫秒</option>
        </select>
        <button @click="setNowInSeconds">用当前秒</button>
        <button @click="setNowInMs">用当前毫秒</button>
      </div>
      <p v-if="tsError" class="error">{{ tsError }}</p>
      <div v-if="tsResult" class="rows">
        <div class="row">
          <span class="pill">本地</span>
          <code>{{ tsResult.local }}</code>
          <button class="mini" @click="copy(tsResult.local)">复制</button>
        </div>
        <div class="row">
          <span class="pill alt">ISO</span>
          <code>{{ tsResult.iso }}</code>
          <button class="mini" @click="copy(tsResult.iso)">复制</button>
        </div>
        <div class="row">
          <span class="pill alt">UTC</span>
          <code>{{ tsResult.utc }}</code>
          <button class="mini" @click="copy(tsResult.utc)">复制</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">日期 → 时间戳</div>
      <div class="form">
        <input v-model="dateInput" type="text" placeholder="YYYY-MM-DD HH:mm:ss 或 ISO" />
        <button @click="setNowInDateInput">填入当前时间</button>
      </div>
      <p v-if="dateError" class="error">{{ dateError }}</p>
      <div v-if="dateResult" class="rows">
        <div class="row">
          <span class="pill">秒</span>
          <code>{{ dateResult.sec }}</code>
          <button class="mini" @click="copy(dateResult.sec)">复制</button>
        </div>
        <div class="row">
          <span class="pill alt">毫秒</span>
          <code>{{ dateResult.ms }}</code>
          <button class="mini" @click="copy(dateResult.ms)">复制</button>
        </div>
        <div class="row">
          <span class="pill alt">ISO</span>
          <code>{{ dateResult.iso }}</code>
          <button class="mini" @click="copy(dateResult.iso)">复制</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tool h2 {
  margin: 0;
  font-size: 18px;
}
.hint {
  margin: 0;
  color: #656d76;
  font-size: 13px;
}
.card {
  border: 1px solid #d0d7de;
  border-radius: 10px;
  padding: 14px 16px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #24292f;
}
.form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.form input[type='text'] {
  flex: 1 1 220px;
  min-width: 220px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.form select {
  font: inherit;
  padding: 5px 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #f6f8fa;
}
.row code {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  color: #24292f;
}
.pill {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eaf2ff;
  color: #1f6feb;
  font-size: 11px;
}
.pill.alt {
  background: #eaeef2;
  color: #24292f;
}
.mini {
  padding: 2px 8px;
  font-size: 12px;
}
.error {
  margin: 0;
  color: #cf222e;
  font-size: 13px;
}
</style>
