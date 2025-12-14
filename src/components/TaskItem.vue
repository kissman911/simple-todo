<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import type { Task } from '../types/task';
import ContextMenu from './ContextMenu.vue';
import { formatTime, getRemainingSeconds } from '../services/timer';

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  update: [id: string, content: string];
  delete: [id: string];
  setTimer: [id: string];
  cancelTimer: [id: string];
  toggleUrgent: [id: string];
}>();

// 编辑状态
const isEditing = ref(false);
const editContent = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);

// 右键菜单状态
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);

// 计时器相关
const remainingSeconds = ref(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

// 是否有计时器
const hasTimer = computed(() => props.task.timerEndTime !== null);

// 是否为加急任务
const isUrgent = computed(() => props.task.priority === 'urgent');

// 格式化的剩余时间
const formattedTime = computed(() => formatTime(remainingSeconds.value));

// 更新剩余时间
function updateRemainingTime() {
  if (props.task.timerEndTime) {
    remainingSeconds.value = getRemainingSeconds(props.task.timerEndTime);
  } else {
    remainingSeconds.value = 0;
  }
}

// 启动本地计时器更新
function startLocalTimer() {
  stopLocalTimer();
  if (props.task.timerEndTime) {
    updateRemainingTime();
    timerInterval = setInterval(() => {
      updateRemainingTime();
      if (remainingSeconds.value <= 0) {
        stopLocalTimer();
      }
    }, 1000);
  }
}

// 停止本地计时器
function stopLocalTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// 监听任务计时器变化
watch(
  () => props.task.timerEndTime,
  () => {
    if (props.task.timerEndTime) {
      startLocalTimer();
    } else {
      stopLocalTimer();
      remainingSeconds.value = 0;
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.task.timerEndTime) {
    startLocalTimer();
  }
});

onUnmounted(() => {
  stopLocalTimer();
});

// 点击切换完成状态
function handleClick() {
  if (!isEditing.value) {
    emit('toggle', props.task.id);
  }
}

// 右键显示菜单
function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  menuVisible.value = true;
}

// 关闭菜单
function handleMenuClose() {
  menuVisible.value = false;
}

// 开始编辑
function startEdit() {
  isEditing.value = true;
  editContent.value = props.task.content;
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
}

// 保存编辑
function saveEdit() {
  const content = editContent.value.trim();
  if (content && content !== props.task.content) {
    emit('update', props.task.id, content);
  }
  isEditing.value = false;
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false;
  editContent.value = '';
}

// 编辑时按键处理
function handleEditKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveEdit();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelEdit();
  }
}

// 处理删除
function handleDelete() {
  emit('delete', props.task.id);
}

// 处理设置计时器
function handleSetTimer() {
  emit('setTimer', props.task.id);
}

// 处理取消计时器
function handleCancelTimer() {
  emit('cancelTimer', props.task.id);
}

// 处理切换加急状态
function handleToggleUrgent() {
  emit('toggleUrgent', props.task.id);
}
</script>

<template>
  <div
    class="task-item"
    :class="{ completed: task.completed, editing: isEditing, 'has-timer': hasTimer, urgent: isUrgent }"
    @click="handleClick"
    @contextmenu="handleContextMenu"
  >
    <!-- 普通显示模式 -->
    <template v-if="!isEditing">
      <span class="task-indicator">
        <span v-if="isUrgent && !task.completed" class="urgent-icon">⚡</span>
        {{ task.completed ? '✓' : '○' }}
      </span>
      <span class="task-content">{{ task.content }}</span>
      <!-- 计时器显示 -->
      <span v-if="hasTimer && remainingSeconds > 0" class="timer-badge">
        ⏰ {{ formattedTime }}
      </span>
      <span v-else-if="hasTimer && remainingSeconds <= 0" class="timer-badge expired">
        ⏰ 已到时
      </span>
    </template>

    <!-- 编辑模式 -->
    <template v-else>
      <span class="task-indicator">✏️</span>
      <input
        ref="editInputRef"
        v-model="editContent"
        type="text"
        class="edit-input"
        @keydown="handleEditKeydown"
        @blur="saveEdit"
        @click.stop
      />
    </template>

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="menuVisible"
      :x="menuX"
      :y="menuY"
      :has-timer="hasTimer"
      :is-urgent="isUrgent"
      @close="handleMenuClose"
      @edit="startEdit"
      @delete="handleDelete"
      @set-timer="handleSetTimer"
      @cancel-timer="handleCancelTimer"
      @toggle-urgent="handleToggleUrgent"
    />
  </div>
</template>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.task-item:hover {
  background-color: var(--hover-color, rgba(0, 0, 0, 0.03));
}

.task-item:last-child {
  border-bottom: none;
}

.task-item.editing {
  background-color: var(--hover-color, rgba(0, 0, 0, 0.03));
}

.task-item.has-timer {
  background-color: rgba(24, 144, 255, 0.03);
}

.task-item.has-timer:hover {
  background-color: rgba(24, 144, 255, 0.06);
}

.task-indicator {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 14px;
  color: var(--text-secondary, #666);
}

.task-item.completed .task-indicator {
  color: var(--success-color, #52c41a);
}

.task-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-color, #333);
  word-break: break-word;
}

.task-item.completed .task-content {
  text-decoration: line-through;
  color: var(--text-disabled, #999);
}

.timer-badge {
  flex-shrink: 0;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--primary-color, #1890ff);
  background-color: rgba(24, 144, 255, 0.1);
  border-radius: 10px;
  white-space: nowrap;
}

.timer-badge.expired {
  color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.edit-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-color, #333);
  background-color: var(--input-field-bg, rgba(255, 255, 255, 0.8));
  border: 1px solid var(--primary-color, #1890ff);
  border-radius: 4px;
  outline: none;
}

.edit-input:focus {
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

/* 加急任务样式 */
.task-item.urgent .task-content {
  color: #f59e0b;
}

.task-item.urgent.completed .task-content {
  color: #d97706;
  opacity: 0.6;
}

.task-item.urgent .task-indicator {
  color: #f59e0b;
}

.urgent-icon {
  margin-right: 2px;
}
</style>
