<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const secret = ref('your-256-bit-secret')
const payload = ref(
  JSON.stringify(
    {
      sub: '1234567890',
      name: 'John Doe',
      iat: Math.floor(Date.now() / 1000),
    },
    null,
    2,
  ),
)
const algorithm = ref('HS256') // HS256 | HS384 | HS512
const secretIsBase64 = ref(false)

const token = ref('')
const error = ref('')
const busy = ref(false)

const ALG_TO_HASH = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
}

// —— Payload 预设：只存 payload，密钥不存 —— //
const PRESETS_STORAGE_KEY = 'webtool.jwt.payload-presets'
const MAX_PRESETS = 30

/**
 * 结构：{ id: string, name: string, payload: string, savedAt: number }
 * 顺序：新的排在前面。
 */
const presets = ref([])
const activePresetId = ref('')

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    presets.value = parsed
      .filter(
        (p) =>
          p &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          typeof p.payload === 'string',
      )
      .slice(0, MAX_PRESETS)
  } catch {
    /* 存的内容坏了就当没有 */
  }
}

function persistPresets() {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets.value))
  } catch {
    /* 配额满 / 隐私模式：忽略 */
  }
}

function suggestName() {
  try {
    const obj = JSON.parse(payload.value)
    if (obj && typeof obj === 'object') {
      const guess = obj.name || obj.sub || obj.username || obj.email || obj.iss
      if (typeof guess === 'string' && guess.trim()) return guess.trim()
    }
  } catch {
    /* ignore */
  }
  return `预设 ${presets.value.length + 1}`
}

function savePreset() {
  error.value = ''

  // 保存前先校验 JSON 合法，避免存进去一堆用不了的东西
  let parsed
  try {
    parsed = JSON.parse(payload.value)
  } catch (e) {
    error.value = '当前 Payload 不是合法 JSON，无法保存：' + (e?.message ?? e)
    return
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    error.value = '只能保存 JSON 对象'
    return
  }

  const raw = window.prompt('给这条 Payload 起个名字', suggestName())
  if (raw === null) return // 用户取消
  const name = raw.trim()
  if (!name) return

  const id =
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)

  presets.value.unshift({
    id,
    name,
    payload: payload.value,
    savedAt: Date.now(),
  })
  if (presets.value.length > MAX_PRESETS) {
    presets.value = presets.value.slice(0, MAX_PRESETS)
  }
  activePresetId.value = id
  persistPresets()
}

function usePreset(p) {
  payload.value = p.payload
  activePresetId.value = p.id
  error.value = ''
}

function deletePreset(id) {
  const p = presets.value.find((x) => x.id === id)
  if (!p) return
  if (!window.confirm(`删除预设「${p.name}」？`)) return
  presets.value = presets.value.filter((x) => x.id !== id)
  if (activePresetId.value === id) activePresetId.value = ''
  persistPresets()
}

// 手动改动 payload 之后就不再算作"选中"某个预设
watch(payload, () => {
  if (!activePresetId.value) return
  const cur = presets.value.find((p) => p.id === activePresetId.value)
  if (!cur || cur.payload !== payload.value) activePresetId.value = ''
})

// —— Base64 工具 —— //
function base64UrlEncodeBytes(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlEncodeString(str) {
  return base64UrlEncodeBytes(new TextEncoder().encode(str))
}

function base64ToBytes(b64) {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function generate() {
  error.value = ''
  token.value = ''
  if (busy.value) return
  busy.value = true
  try {
    let payloadObj
    try {
      payloadObj = JSON.parse(payload.value)
    } catch (e) {
      throw new Error('Payload 不是合法的 JSON：' + (e?.message ?? e))
    }
    if (typeof payloadObj !== 'object' || payloadObj === null || Array.isArray(payloadObj)) {
      throw new Error('Payload 必须是一个 JSON 对象')
    }

    const hash = ALG_TO_HASH[algorithm.value]
    if (!hash) throw new Error('不支持的算法：' + algorithm.value)

    const header = { alg: algorithm.value, typ: 'JWT' }
    const headerB64 = base64UrlEncodeString(JSON.stringify(header))
    const payloadB64 = base64UrlEncodeString(JSON.stringify(payloadObj))
    const signingInput = headerB64 + '.' + payloadB64

    const keyBytes = secretIsBase64.value
      ? base64ToBytes(secret.value)
      : new TextEncoder().encode(secret.value)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      new TextEncoder().encode(signingInput),
    )
    const sigB64 = base64UrlEncodeBytes(new Uint8Array(sig))

    token.value = signingInput + '.' + sigB64
  } catch (e) {
    error.value = e?.message ?? String(e)
  } finally {
    busy.value = false
  }
}

function insertIat() {
  try {
    const obj = JSON.parse(payload.value || '{}')
    obj.iat = Math.floor(Date.now() / 1000)
    payload.value = JSON.stringify(obj, null, 2)
  } catch {
    /* ignore parse errors */
  }
}

function insertExp1h() {
  try {
    const obj = JSON.parse(payload.value || '{}')
    obj.exp = Math.floor(Date.now() / 1000) + 3600
    payload.value = JSON.stringify(obj, null, 2)
  } catch {
    /* ignore */
  }
}

async function copy(text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

// 输入变化时清掉旧的报错，让界面看着不那么陈旧
watch([secret, payload, algorithm, secretIsBase64], () => {
  error.value = ''
})

const hasPresets = computed(() => presets.value.length > 0)

onMounted(loadPresets)
</script>

<template>
  <section class="tool">
    <h2>JWT 生成</h2>
    <p class="hint">
      使用 HMAC 签名生成 JWT。密钥和 Payload 只在浏览器里处理，不会上传。
      <strong>只有 Payload 会被保存到本地缓存，密钥不会保存。</strong>
    </p>

    <label class="field">
      <span class="label">算法</span>
      <div class="alg">
        <label><input type="radio" v-model="algorithm" value="HS256" />HS256</label>
        <label><input type="radio" v-model="algorithm" value="HS384" />HS384</label>
        <label><input type="radio" v-model="algorithm" value="HS512" />HS512</label>
      </div>
    </label>

    <label class="field">
      <span class="label">
        密钥
        <label class="check">
          <input type="checkbox" v-model="secretIsBase64" />
          密钥是 Base64
        </label>
      </span>
      <textarea v-model="secret" rows="2" placeholder="签名用的密钥（不会保存到本地）" />
    </label>

    <div class="field">
      <div class="label">
        <span>Payload 预设</span>
        <button class="mini" @click="savePreset">保存当前 Payload</button>
      </div>
      <div v-if="hasPresets" class="presets">
        <div
          v-for="p in presets"
          :key="p.id"
          class="preset"
          :class="{ active: activePresetId === p.id }"
          :title="p.payload"
        >
          <button
            class="preset-use"
            type="button"
            :aria-pressed="activePresetId === p.id"
            @click="usePreset(p)"
          >
            <span class="preset-name">{{ p.name }}</span>
          </button>
          <button
            class="preset-del"
            type="button"
            title="删除"
            aria-label="删除"
            @click="deletePreset(p.id)"
          >
            ×
          </button>
        </div>
      </div>
      <p v-else class="empty">
        还没有保存的 Payload。编辑好下面的 JSON，点「保存当前 Payload」就会加入这里。
      </p>
    </div>

    <label class="field">
      <span class="label">
        Payload（JSON）
        <span class="mini-actions">
          <button class="mini" @click="insertIat">写入 iat</button>
          <button class="mini" @click="insertExp1h">写入 exp（1 小时后）</button>
        </span>
      </span>
      <textarea v-model="payload" rows="10" />
    </label>

    <div class="actions">
      <button class="primary" :disabled="busy" @click="generate">生成 Token</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <label v-if="token" class="field">
      <span class="label">
        Token
        <button class="mini" @click="copy(token)">复制</button>
      </span>
      <textarea :value="token" rows="4" readonly />
    </label>
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
.hint strong {
  color: #24292f;
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
  gap: 10px;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #656d76;
  font-weight: normal;
  cursor: pointer;
}
.alg {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
}
.alg label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
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
  gap: 8px;
}
.mini-actions {
  display: inline-flex;
  gap: 6px;
}
.mini {
  padding: 2px 8px;
  font-size: 12px;
}
.error {
  margin: 0;
  color: #cf222e;
  font-size: 13px;
  white-space: pre-wrap;
}

/* —— 预设列表 —— */
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #f6f8fa;
  max-height: 140px;
  overflow-y: auto;
}
.preset {
  display: inline-flex;
  align-items: stretch;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 999px;
  overflow: hidden;
  font-size: 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.preset:hover {
  border-color: #1f6feb;
}
.preset.active {
  border-color: #1f6feb;
  box-shadow: 0 0 0 2px rgba(31, 111, 235, 0.2);
}
.preset-use {
  padding: 3px 10px;
  border: none;
  background: transparent;
  color: #24292f;
  cursor: pointer;
  max-width: 220px;
  border-radius: 0;
}
.preset-use:hover {
  background: #f3f4f6;
}
.preset.active .preset-use {
  background: #eaf2ff;
  color: #1f6feb;
  font-weight: 600;
}
.preset-name {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: middle;
}
.preset-del {
  padding: 0 8px;
  border: none;
  border-left: 1px solid #d0d7de;
  background: transparent;
  color: #8a939e;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  border-radius: 0;
}
.preset-del:hover {
  background: #ffebe9;
  color: #cf222e;
}
.empty {
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed #d0d7de;
  border-radius: 8px;
  background: #fafbfc;
  color: #656d76;
  font-size: 12px;
}
</style>
