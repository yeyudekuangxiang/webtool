<script setup>
import { ref } from 'vue'

const input = ref('')
const output = ref('')
const error = ref('')
// 'component': encodeURIComponent, 覆盖更多字符，适合参数值
// 'uri':       encodeURI,          保留 URL 结构字符，适合整段 URL
const mode = ref('component')

function encode() {
  error.value = ''
  try {
    output.value =
      mode.value === 'uri' ? encodeURI(input.value) : encodeURIComponent(input.value)
  } catch (e) {
    error.value = '编码失败：' + (e?.message ?? e)
    output.value = ''
  }
}

function decode() {
  error.value = ''
  try {
    output.value =
      mode.value === 'uri' ? decodeURI(input.value) : decodeURIComponent(input.value)
  } catch {
    error.value = '解码失败：内容包含非法的转义序列'
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
    <h2>URL 编解码</h2>
    <p class="hint">
      encodeURIComponent 用来编码参数值；encodeURI 用来编码整段 URL，会保留 <code>: / ? # &amp; =</code> 等结构字符。
    </p>

    <div class="mode">
      <label>
        <input type="radio" v-model="mode" value="component" />
        encodeURIComponent（参数值）
      </label>
      <label>
        <input type="radio" v-model="mode" value="uri" />
        encodeURI（整段 URL）
      </label>
    </div>

    <label class="field">
      <span class="label">输入</span>
      <textarea v-model="input" rows="5" placeholder="要编码或解码的文本" />
    </label>

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
      <textarea v-model="output" rows="5" readonly />
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
.mode {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #24292f;
}
.mode label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
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
