<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { categories, features } from '../features.js'

// —— 分类分组数据 ——
const groups = computed(() =>
  categories
    .map((c) => ({
      ...c,
      items: features.filter((f) => f.category === c.key),
    }))
    .filter((g) => g.items.length > 0),
)

// 每个分类给一个代表色 + 图标
const CATEGORY_STYLE = {
  excel: { icon: '📊', color: '#1f6feb', bg: '#eaf2ff' },
  encode: { icon: '🔤', color: '#953800', bg: '#fff1e5' },
  hash: { icon: '🔒', color: '#8250df', bg: '#f5eeff' },
  time: { icon: '⏱', color: '#116329', bg: '#e6f6ea' },
  token: { icon: '🪪', color: '#9a6700', bg: '#fff8c5' },
}
function styleOf(key) {
  return CATEGORY_STYLE[key] ?? { icon: '🧩', color: '#1f6feb', bg: '#eaf2ff' }
}

// —— 展开态管理：同一时刻只展开一个分类 ——
const openKey = ref(null)
const submenuAlign = ref('left') // 'left' | 'right'
let closeTimer = null

function cancelClose() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}
function computeAlign(el) {
  // 根据分类卡片在容器里的真实位置决定下拉方向，避免右侧或换行后左侧溢出
  const card = el?.closest?.('.cat')
  const parent = card?.parentElement
  if (!card || !parent) return 'left'
  const cardRect = card.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()
  const menuWidth = 340
  const spaceRight = parentRect.right - cardRect.left
  return spaceRight < menuWidth ? 'right' : 'left'
}
function openCat(key, event) {
  cancelClose()
  submenuAlign.value = computeAlign(event?.currentTarget)
  openKey.value = key
}
function scheduleClose() {
  cancelClose()
  closeTimer = setTimeout(() => {
    openKey.value = null
    closeTimer = null
  }, 160)
}
function toggleCat(key, event) {
  if (openKey.value === key) {
    openKey.value = null
  } else {
    submenuAlign.value = computeAlign(event?.currentTarget)
    openKey.value = key
  }
}

// 点击卡片外面 / ESC 关闭
function onDocClick(e) {
  const t = e.target
  if (t instanceof Element && t.closest('.cat')) return
  openKey.value = null
}
function onKey(e) {
  if (e.key === 'Escape') openKey.value = null
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
  cancelClose()
})
</script>

<template>
  <section class="home">
    <div class="hero">
      <h2>选一个分类开始</h2>
      <p>把鼠标放到分类上会展开工具菜单。所有操作都在浏览器里完成。</p>
    </div>

    <div class="cats">
      <div
        v-for="g in groups"
        :key="g.key"
        class="cat"
        :class="{ open: openKey === g.key }"
        @mouseenter="openCat(g.key, $event)"
        @mouseleave="scheduleClose"
      >
        <button
          type="button"
          class="cat-card"
          :aria-expanded="openKey === g.key"
          :aria-controls="`submenu-${g.key}`"
          @click="toggleCat(g.key, $event)"
        >
          <span
            class="cat-icon"
            :style="{ background: styleOf(g.key).bg, color: styleOf(g.key).color }"
            aria-hidden="true"
          >
            {{ styleOf(g.key).icon }}
          </span>
          <span class="cat-text">
            <span class="cat-title">{{ g.title }}</span>
            <span v-if="g.desc" class="cat-desc">{{ g.desc }}</span>
          </span>
          <span class="cat-count">{{ g.items.length }}</span>
        </button>

        <div
          v-show="openKey === g.key"
          :id="`submenu-${g.key}`"
          class="submenu"
          :class="`align-${submenuAlign}`"
          role="menu"
          @mouseenter="cancelClose"
          @mouseleave="scheduleClose"
        >
          <a
            v-for="f in g.items"
            :key="f.key"
            class="submenu-item"
            role="menuitem"
            :href="`#/${f.key}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="mi-icon" aria-hidden="true">{{ f.icon }}</span>
            <span class="mi-body">
              <span class="mi-title">{{ f.title }}</span>
              <span class="mi-desc">{{ f.description }}</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home {
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.hero p {
  margin: 0;
  color: #656d76;
  font-size: 14px;
}

.cats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.cat {
  position: relative;
}

/* 分类卡片本体 */
.cat-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.cat-card:hover,
.cat.open .cat-card {
  border-color: #1f6feb;
  box-shadow: 0 4px 16px rgba(31, 111, 235, 0.08);
  transform: translateY(-1px);
}

.cat-icon {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.cat-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cat-title {
  font-size: 15px;
  font-weight: 600;
  color: #24292f;
}

.cat-desc {
  font-size: 12px;
  color: #656d76;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.cat-count {
  flex: 0 0 auto;
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #eaeef2;
  color: #24292f;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* —— 悬停 / 点击弹出的子菜单 —— */
.submenu {
  position: absolute;
  top: calc(100% + 6px);
  min-width: 100%;
  max-width: 340px;
  width: max-content;
  padding: 6px;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(31, 35, 40, 0.12);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.submenu.align-left {
  left: 0;
  right: auto;
}
.submenu.align-right {
  left: auto;
  right: 0;
}

.submenu-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.1s ease;
}

.submenu-item:hover {
  background: #f3f4f6;
}

.mi-icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #eaf2ff;
  color: #1f6feb;
  display: grid;
  place-items: center;
  font-size: 15px;
}

.mi-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.mi-title {
  font-size: 13px;
  font-weight: 600;
  color: #24292f;
}

.mi-desc {
  font-size: 12px;
  color: #656d76;
  line-height: 1.4;
}

/* 窄屏：子菜单撑满卡片、贴紧下方，避免飘到屏幕外 */
@media (max-width: 640px) {
  .submenu,
  .submenu.align-left,
  .submenu.align-right {
    left: 0;
    right: 0;
    max-width: none;
    width: 100%;
  }
}
</style>
