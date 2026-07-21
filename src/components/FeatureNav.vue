<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { categories, features } from '../features.js'

const props = defineProps({
  currentKey: { type: String, default: '' },
})

const categoryIcons = {
  excel: '📊',
  encode: '🔤',
  hash: '🔒',
  time: '⏱',
  token: '🪪',
}

const groups = computed(() =>
  categories
    .map((category) => ({
      category,
      items: features.filter((feature) => feature.category === category.key),
    }))
    .filter((group) => group.items.length > 0),
)

const currentCategory = computed(
  () => features.find((feature) => feature.key === props.currentKey)?.category ?? '',
)

const openKey = ref('')
const align = ref('left')
let closeTimer = null

function cancelClose() {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

function detectAlign(element) {
  const group = element?.closest?.('.nav-group')
  if (!group) return 'left'
  return window.innerWidth - group.getBoundingClientRect().left < 300 ? 'right' : 'left'
}

function openGroup(key, event) {
  cancelClose()
  align.value = detectAlign(event?.currentTarget)
  openKey.value = key
}

function scheduleClose() {
  cancelClose()
  closeTimer = setTimeout(() => {
    openKey.value = ''
    closeTimer = null
  }, 150)
}

function toggleGroup(key, event) {
  if (openKey.value === key) {
    openKey.value = ''
    return
  }
  openGroup(key, event)
}

onBeforeUnmount(cancelClose)
</script>

<template>
  <nav class="feature-nav" aria-label="工具快捷导航">
    <a
      class="nav-button home-button"
      href="#/"
      target="_blank"
      rel="noopener noreferrer"
      title="在新标签页打开首页"
    >
      <span class="category-icon" aria-hidden="true">🏠</span>
      <span>首页</span>
    </a>

    <div
      v-for="group in groups"
      :key="group.category.key"
      class="nav-group"
      :class="{
        open: openKey === group.category.key,
        current: currentCategory === group.category.key,
      }"
      @mouseenter="openGroup(group.category.key, $event)"
      @mouseleave="scheduleClose"
    >
      <button
        type="button"
        class="nav-button"
        :aria-expanded="openKey === group.category.key"
        @click="toggleGroup(group.category.key, $event)"
      >
        <span class="category-icon" aria-hidden="true">
          {{ categoryIcons[group.category.key] ?? '🧩' }}
        </span>
        <span>{{ group.category.title }}</span>
        <span class="count">{{ group.items.length }}</span>
        <span class="arrow" aria-hidden="true">▾</span>
      </button>

      <div
        v-show="openKey === group.category.key"
        class="tool-menu"
        :class="`align-${align}`"
        role="menu"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <a
          v-for="feature in group.items"
          :key="feature.key"
          :class="{ active: currentKey === feature.key }"
          :href="`#/${feature.key}`"
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
        >
          <span class="tool-icon" aria-hidden="true">{{ feature.icon }}</span>
          <span class="tool-title">{{ feature.title }}</span>
          <span v-if="currentKey === feature.key" class="current-mark">当前</span>
        </a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.feature-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: -4px -4px 18px;
  padding: 4px 4px 14px;
  border-bottom: 1px solid #d8dee4;
}

.nav-group {
  position: relative;
}

.nav-button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #fff;
  color: #24292f;
  text-decoration: none;
  font-size: 12px;
  white-space: nowrap;
}

.nav-button:hover,
.nav-group.open > .nav-button,
.nav-group.current > .nav-button {
  border-color: #1f6feb;
  background: #f6f9ff;
  color: #0969da;
}

.nav-group.current > .nav-button {
  background: #eaf2ff;
  font-weight: 600;
}

.home-button {
  background: #f6f8fa;
  font-weight: 600;
}

.category-icon {
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  font-size: 14px;
}

.count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #eaeef2;
  color: #656d76;
  font-size: 10px;
}

.arrow {
  color: #8c959f;
  font-size: 10px;
  transition: transform 0.15s ease;
}

.nav-group.open .arrow {
  transform: rotate(180deg);
}

.tool-menu {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 30;
  width: max-content;
  min-width: 210px;
  max-width: 290px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 28px rgba(31, 35, 40, 0.14);
}

.tool-menu.align-left {
  left: 0;
  right: auto;
}

.tool-menu.align-right {
  left: auto;
  right: 0;
}

.tool-menu a {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 7px 9px;
  border-radius: 7px;
  color: #24292f;
  text-decoration: none;
  font-size: 12px;
}

.tool-menu a:hover {
  background: #f3f4f6;
}

.tool-menu a.active {
  background: #eaf2ff;
  color: #0969da;
  font-weight: 600;
}

.tool-icon {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 6px;
  background: #f0f5ff;
  font-size: 13px;
}

.tool-title {
  flex: 1 1 auto;
}

.current-mark {
  flex: 0 0 auto;
  color: #656d76;
  font-size: 10px;
  font-weight: 400;
}

@media (max-width: 640px) {
  .feature-nav {
    gap: 6px;
  }

  .nav-button {
    padding: 5px 8px;
  }

  .tool-menu {
    width: min(260px, calc(100vw - 48px));
  }
}
</style>
