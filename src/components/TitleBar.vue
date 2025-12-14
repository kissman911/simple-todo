<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTheme } from '../composables/useTheme';
import { checkAutoStart, toggleAutoStart } from '../services/autostart';

const appWindow = getCurrentWindow();
const { theme, cycleTheme, getThemeLabel } = useTheme();

// 自启动状态
const autoStartEnabled = ref(false);

// 初始化检查自启动状态
onMounted(async () => {
  autoStartEnabled.value = await checkAutoStart();
});

// 切换自启动
async function handleToggleAutoStart() {
  autoStartEnabled.value = await toggleAutoStart();
}

// 最小化窗口
async function minimizeWindow() {
  await appWindow.minimize();
}

// 关闭窗口
async function closeWindow() {
  await appWindow.close();
}

// 获取主题图标
function getThemeIcon(t: string): string {
  const icons: Record<string, string> = {
    system: '🖥️',
    light: '☀️',
    dark: '🌙',
  };
  return icons[t] || '🖥️';
}
</script>

<template>
  <div class="title-bar" data-tauri-drag-region>
    <span class="title" data-tauri-drag-region>SimpleTodo</span>
    <div class="window-controls">
      <button
        class="control-btn autostart"
        :class="{ active: autoStartEnabled }"
        @click="handleToggleAutoStart"
        :title="autoStartEnabled ? '开机自启: 开' : '开机自启: 关'"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M17.66 6.34a8 8 0 1 1-11.32 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        class="control-btn theme"
        @click="cycleTheme"
        :title="'主题: ' + getThemeLabel(theme)"
      >
        {{ getThemeIcon(theme) }}
      </button>
      <button class="control-btn minimize" @click="minimizeWindow" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
        </svg>
      </button>
      <button class="control-btn close" @click="closeWindow" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  border-radius: 12px 12px 0 0;
  user-select: none;
  -webkit-app-region: drag;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
  letter-spacing: 0.5px;
}

.window-controls {
  display: flex;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.control-btn:hover {
  background-color: var(--hover-color);
  color: var(--text-color);
}

.control-btn.close:hover {
  background-color: #e81123;
  color: white;
}

.control-btn.autostart.active {
  color: var(--success-color, #52c41a);
}

.control-btn.autostart.active:hover {
  background-color: rgba(82, 196, 26, 0.1);
}

.control-btn:active {
  transform: scale(0.95);
}
</style>
