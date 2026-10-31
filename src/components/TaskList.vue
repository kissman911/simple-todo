<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '../types/task';
import TaskItem from './TaskItem.vue';

const props = defineProps<{
  tasks: Task[];
}>();

const emit = defineEmits<{
  toggle: [id: string];
  update: [id: string, content: string];
  delete: [id: string];
  clearCompleted: [];
  setTimer: [id: string];
  cancelTimer: [id: string];
  toggleUrgent: [id: string];
}>();

// 计算已完成任务数量
const completedCount = computed(() => {
  return props.tasks.filter((t) => t.completed).length;
});
</script>

<template>
  <div class="task-list-container">
    <div class="task-list">
      <div v-if="tasks.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-text">暂无待办事项</div>
        <div class="empty-hint">在下方输入框添加新任务</div>
      </div>

      <TransitionGroup v-else name="task" tag="div">
        <TaskItem
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          @toggle="emit('toggle', $event)"
          @update="(id, content) => emit('update', id, content)"
          @delete="emit('delete', $event)"
          @set-timer="emit('setTimer', $event)"
          @cancel-timer="emit('cancelTimer', $event)"
          @toggle-urgent="emit('toggleUrgent', $event)"
        />
      </TransitionGroup>
    </div>

    <!-- 清空已完成按钮 -->
    <Transition name="fade">
      <div v-if="completedCount > 0" class="clear-completed-bar">
        <button class="clear-completed-btn" @click="emit('clearCompleted')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>清空已完成 ({{ completedCount }})</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.task-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-list {
  /* 删除动画中离场的任务项是 absolute 定位，以列表为参照才不会溢出 */
  position: relative;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-disabled, #999);
}

/* 清空已完成按钮区域 */
.clear-completed-bar {
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-color);
}

.clear-completed-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-completed-btn:hover {
  background-color: rgba(232, 17, 35, 0.1);
  color: var(--danger-color, #e81123);
}

.clear-completed-btn:active {
  transform: scale(0.98);
}

/* 列表动画 */
.task-move,
.task-enter-active,
.task-leave-active {
  transition: all 0.3s ease;
}

.task-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.task-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.task-leave-active {
  position: absolute;
  width: 100%;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
