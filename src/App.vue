<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Home from './components/Home.vue'
import { findFeature } from './features.js'

// Simple hash-based router:
//   #/            -> home
//   #/<key>       -> feature with the given key (unknown keys fall back to home)
const route = ref(readHash())

function readHash() {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h || ''
}

function syncFromHash() {
  route.value = readHash()
}

function navigate(key) {
  const target = key ? `#/${key}` : '#/'
  if (window.location.hash === target) {
    syncFromHash()
  } else {
    window.location.hash = target
  }
}

onMounted(() => window.addEventListener('hashchange', syncFromHash))
onUnmounted(() => window.removeEventListener('hashchange', syncFromHash))

const currentFeature = computed(() => (route.value ? findFeature(route.value) : null))
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="brand" @click="navigate('')">
        <span class="logo" aria-hidden="true">🧰</span>
        <div>
          <h1>工具箱</h1>
          <p class="subtitle">浏览器里就能用的开发者小工具</p>
        </div>
      </div>
      <nav v-if="currentFeature" class="crumbs">
        <a href="#/" @click.prevent="navigate('')">首页</a>
        <span class="sep">/</span>
        <span>{{ currentFeature.title }}</span>
      </nav>
    </header>

    <main class="content">
      <template v-if="currentFeature">
        <component :is="currentFeature.component" />
      </template>
      <template v-else>
        <Home @open="navigate" />
      </template>
    </main>

    <footer class="app-footer">
      <span>© 工具箱 · 纯浏览器执行</span>
    </footer>
  </div>
</template>

<style scoped>
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #1f6feb;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.brand h1 {
  margin: 0;
  font-size: 20px;
}

.subtitle {
  margin: 2px 0 0;
  color: #656d76;
  font-size: 13px;
}

.crumbs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #656d76;
}

.crumbs a {
  color: #1f6feb;
  text-decoration: none;
}

.crumbs a:hover {
  text-decoration: underline;
}

.crumbs .sep {
  color: #d0d7de;
}

.content {
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  padding: 20px;
  flex: 1 1 auto;
}

.app-footer {
  margin-top: auto;
  text-align: center;
  color: #8a939e;
  font-size: 12px;
}
</style>
