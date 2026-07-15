<script setup>
import { ref } from 'vue'

const input = ref('')
const output = ref('')
const error = ref('')
// encode 模式：标准 Base64 或 Base64URL（无 padding、+→- 、/→_）
const encodeMode = ref('std')

// —— 编码 ——
function utf8ToBase64Std(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
function toBase64Url(std) {
  return std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encode() {
  error.value = ''
  try {
    const std = utf8ToBase64Std(input.value)
    output.value = encodeMode.value === 'url' ? toBase64Url(std) : std
  } catch (e) {
    error.value = '编码失败：' + (e?.message ?? e)
    output.value = ''
  }
}

// —— 解码 —— 兼容 Base64 和 Base64URL，自动补 padding，
// 遇到 `.` 视作 JWT 那样的分段并逐段解码。
function normalizeBase64(s) {
  const cleaned = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (cleaned.length % 4)) % 4
  return cleaned + '='.repeat(pad)
}

function base64SegmentToText(seg) {
  if (!seg) return ''
  const bin = atob(normalizeBase64(seg))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  // 非 fatal：signature 那种二进制段会含非法 UTF-8 字节，会被替换成 �
  return new TextDecoder('utf-8').decode(bytes)
}

function decode() {
  error.value = ''
  const raw = input.value.trim()
  if (!raw) {
    output.value = ''
    return
  }
  try {
    if (raw.includes('.')) {
      // 看着像 JWT 一类的分段结构，逐段解码
      const parts = raw.split('.')
      const decoded = parts.map((p, i) => {
        try {
          return base64SegmentToText(p)
        } catch {
          return `[第 ${i + 1} 段解码失败]`
        }
      })
      output.value = decoded.join('\n\n')
    } else {
      output.value = base64SegmentToText(raw)
    }
  } catch (e) {
    error.value = '解码失败：内容不是合法的 Base64。' + (e?.message ? ' (' + e.message + ')' : '')
    output.value = ''
  }
}

function swap() {
  input.value = output.value
  output.value = ''
  error.value = ''
}

function clearAll() {
  input.value = ''
  output.value = ''
  error.value = ''
}

async function copyOutput() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <section class="tool">
    <h2>Base64 编解码</h2>
    <p class="hint">
      按 UTF-8 处理。解码时自动兼容 Base64URL（<code>-</code>/<code>_</code>）、自动补 padding，
      粘贴 JWT 那样带 <code>.</code> 的字符串会分段解码。
    </p>

    <label class="field">
      <span class="label">输入</span>
      <textarea v-model="input" rows="6" placeholder="要编码的文本，或要解码的 Base64 / Base64URL / JWT" />
    </label>

    <div class="row">
      <div class="mode">
        <span class="mode-label">编码输出：</span>
        <label><input type="radio" v-model="encodeMode" value="std" />标准 Base64</label>
        <label><input type="radio" v-model="encodeMode" value="url" />Base64URL</label>
      </div>
    </div>

    <div class="actions">
      <button class="primary" @click="encode">编码 →</button>
      <button class="primary" @click="decode">← 解码</button>
      <button @click="swap" :disabled="!output">把结果放回上面</button>
      <button @click="clearAll">清空</button>
    </div>

    <label class="field">
      <span class="label">
        输出
        <button v-if="output" class="mini" @click="copyOutput">复制</button>
      </span>
      <textarea v-model="output" rows="6" readonly />
    </label>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
.hint code {
  background: #f6f8fa;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 13px;
  color: #24292f;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
textarea {
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  padding: 8px 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  resize: vertical;
}
textarea:focus {
  outline: none;
  border-color: #1f6feb;
  box-shadow: 0 0 0 3px rgba(31, 111, 235, 0.2);
}
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.mode {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #24292f;
  flex-wrap: wrap;
}
.mode-label {
  color: #656d76;
}
.mode label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
