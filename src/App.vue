<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import TitleBar from './components/TitleBar.vue';
import TaskList from './components/TaskList.vue';
import TaskInput from './components/TaskInput.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import TimerDialog from './components/TimerDialog.vue';
import { useTaskStore } from './composables/useTaskStore';
import { startTaskTimer, stopTaskTimer } from './services/timer';
import { checkNotificationPermission } from './services/notification';
import { useTheme } from './composables/useTheme';
import { saveWindowState, restoreWindowState, onWindowMove, onWindowResize } from './services/window';

// 确认对话框状态
const showClearConfirm = ref(false);

// 计时器对话框状态
const showTimerDialog = ref(false);
const timerTaskId = ref<string | null>(null);
const timerTaskContent = ref('');

const store = useTaskStore();
const { theme, init: initTheme } = useTheme();

// 窗口事件清理函数
let unlistenMove: (() => void) | null = null;
let unlistenResize: (() => void) | null = null;

// 防抖保存窗口状态
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedSaveWindowState() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(async () => {
    const state = await saveWindowState();
    await store.updateSettings(state);
  }, 300);
}

// 监听主题变化并保存
watch(theme, async (newTheme) => {
  await store.updateSettings({ theme: newTheme });
});

// 初始化加载数据和窗口状态
onMounted(async () => {
  await store.init();

  // 初始化主题
  initTheme(store.settings.value.theme);

  // 恢复窗口位置和尺寸
  await restoreWindowState(store.settings.value);

  // 恢复已有的计时器
  store.tasks.value.forEach((task) => {
    if (task.timerEndTime) {
      startTaskTimer(task, async () => {
        await store.cancelTaskTimer(task.id);
      });
    }
  });

  // 监听窗口移动
  unlistenMove = await onWindowMove(() => {
    debouncedSaveWindowState();
  });

  // 监听窗口尺寸变化
  unlistenResize = await onWindowResize(() => {
    debouncedSaveWindowState();
  });
});

// 清理事件监听
onUnmounted(() => {
  unlistenMove?.();
  unlistenResize?.();
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
});

// 添加任务
async function handleAddTask(content: string) {
  await store.addTask(content);
}

// 切换任务状态
async function handleToggleTask(id: string) {
  await store.toggleTask(id);
}

// 更新任务内容
async function handleUpdateTask(id: string, content: string) {
  await store.updateTask(id, content);
}

// 删除任务
async function handleDeleteTask(id: string) {
  await store.deleteTask(id);
}

// 显示清空确认对话框
function handleShowClearConfirm() {
  showClearConfirm.value = true;
}

// 取消清空
function handleCancelClear() {
  showClearConfirm.value = false;
}

// 确认清空已完成任务
async function handleConfirmClear() {
  await store.clearCompleted();
  showClearConfirm.value = false;
}

// 显示设置计时器对话框
function handleShowTimerDialog(id: string) {
  const task = store.tasks.value.find((t) => t.id === id);
  if (!task) return;

  timerTaskId.value = id;
  timerTaskContent.value = task.content;
  showTimerDialog.value = true;
}

// 取消设置计时器
function handleCancelTimerDialog() {
  showTimerDialog.value = false;
  timerTaskId.value = null;
  timerTaskContent.value = '';
}

// 确认设置计时器
async function handleConfirmTimer(duration: number) {
  if (!timerTaskId.value) return;

  // 请求通知权限
  await checkNotificationPermission();

  // 设置计时器
  await store.setTaskTimer(timerTaskId.value, duration);

  // 启动计时器监控
  const task = store.tasks.value.find((t) => t.id === timerTaskId.value);
  if (task) {
    startTaskTimer(task, async () => {
      // 计时器到期时，清除任务的计时器状态
      await store.cancelTaskTimer(task.id);
    });
  }

  handleCancelTimerDialog();
}

// 取消任务计时器
async function handleCancelTaskTimer(id: string) {
  stopTaskTimer(id);
  await store.cancelTaskTimer(id);
}

// 切换任务加急状态
async function handleToggleUrgent(id: string) {
  await store.toggleUrgent(id);
}
</script>

<template>
  <div class="app-container">
    <!-- 自定义标题栏 -->
    <TitleBar />

    <!-- 任务列表 -->
    <TaskList
      :tasks="store.tasks.value"
      @toggle="handleToggleTask"
      @update="handleUpdateTask"
      @delete="handleDeleteTask"
      @clear-completed="handleShowClearConfirm"
      @set-timer="handleShowTimerDialog"
      @cancel-timer="handleCancelTaskTimer"
      @toggle-urgent="handleToggleUrgent"
    />

    <!-- 任务输入 -->
    <TaskInput @submit="handleAddTask" />

    <!-- 清空确认对话框 -->
    <ConfirmDialog
      :visible="showClearConfirm"
      title="清空已完成任务"
      message="确定要清空所有已完成的任务吗？此操作不可撤销。"
      confirm-text="清空"
      cancel-text="取消"
      @confirm="handleConfirmClear"
      @cancel="handleCancelClear"
    />

    <!-- 计时器设置对话框 -->
    <TimerDialog
      :visible="showTimerDialog"
      :task-content="timerTaskContent"
      @confirm="handleConfirmTimer"
      @cancel="handleCancelTimerDialog"
    />
  </div>
</template>

<style>
/* 全局样式 */

/* 浅色主题（默认） */
:root,
[data-theme="light"] {
  --bg-color: rgba(255, 255, 255, 0.75);
  --text-color: #333;
  --text-secondary: #666;
  --text-disabled: #999;
  --border-color: rgba(0, 0, 0, 0.08);
  --hover-color: rgba(0, 0, 0, 0.05);
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --input-bg: rgba(255, 255, 255, 0.6);
  --input-field-bg: rgba(0, 0, 0, 0.04);
  --input-field-focus-bg: rgba(255, 255, 255, 0.9);
}

/* 深色主题 */
[data-theme="dark"] {
  --bg-color: rgba(30, 30, 30, 0.75);
  --text-color: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-disabled: #666;
  --border-color: rgba(255, 255, 255, 0.1);
  --hover-color: rgba(255, 255, 255, 0.08);
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --input-bg: rgba(0, 0, 0, 0.4);
  --input-field-bg: rgba(255, 255, 255, 0.08);
  --input-field-focus-bg: rgba(255, 255, 255, 0.15);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans SC', sans-serif;
  font-size: 14px;
  color: var(--text-color);
  background: transparent;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-disabled);
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}
</style>
