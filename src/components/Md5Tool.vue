<script setup>
import { computed, ref } from 'vue'
import { md5 } from '../utils/md5.js'

const input = ref('')
const upper = ref(false)

const hash = computed(() => {
  if (!input.value) return ''
  const h = md5(input.value)
  return upper.value ? h.toUpperCase() : h
})

const hash16 = computed(() => (hash.value ? hash.value.slice(8, 24) : ''))

async function copy(text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

function clearAll() {
  input.value = ''
}
</script>

<template>
  <section class="tool">
    <h2>MD5</h2>
    <p class="hint">输入字符串，按 UTF-8 编码后计算 MD5 摘要。结果实时更新。</p>

    <label class="field">
      <span class="label">输入</span>
      <textarea v-model="input" rows="6" placeholder="要计算 MD5 的文本" />
    </label>

    <div class="actions">
      <label class="option">
        <input type="checkbox" v-model="upper" />
        大写输出
      </label>
      <button @click="clearAll">清空</button>
    </div>

    <div class="results">
      <div class="row">
        <span class="tag-32">32 位</span>
        <code>{{ hash || '—' }}</code>
        <button class="mini" :disabled="!hash" @click="copy(hash)">复制</button>
      </div>
      <div class="row">
        <span class="tag-16">16 位</span>
        <code>{{ hash16 || '—' }}</code>
        <button class="mini" :disabled="!hash16" @click="copy(hash16)">复制</button>
      </div>
    </div>
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
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 13px;
  color: #24292f;
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
.actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #24292f;
  cursor: pointer;
}
.results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
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
.tag-32,
.tag-16 {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eaf2ff;
  color: #1f6feb;
  font-size: 11px;
}
.tag-16 {
  background: #eaeef2;
  color: #24292f;
}
.mini {
  padding: 2px 8px;
  font-size: 12px;
}
</style>
