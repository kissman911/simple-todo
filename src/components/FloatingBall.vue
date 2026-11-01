<script setup lang="ts">
import { computed } from 'vue';
import type { DockSide } from '../types/dock';
import { badgeText } from '../services/dockLayout';

const props = defineProps<{
  pendingCount: number;
  urgent: boolean;
  alert: boolean;
  side: DockSide;
}>();

const emit = defineEmits<{
  press: [];
}>();

const badge = computed(() => badgeText(props.pendingCount));

// 只响应左键；按下后由 Rust 判断是点击还是拖动
function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  emit('press');
}
</script>

<template>
  <!-- 贴边和悬浮球不支持键盘操作，这里只给读屏软件一个说明 -->
  <div
    class="floating-ball"
    :class="[side, { urgent, alert }]"
    role="img"
    :aria-label="pendingCount > 0 ? `SimpleTodo：${pendingCount} 项未完成` : 'SimpleTodo'"
    @mousedown="handleMouseDown"
    @contextmenu.prevent
  >
    <span class="ball-icon">📝</span>
    <span v-if="badge" class="ball-badge">{{ badge }}</span>
  </div>
</template>

<style scoped>
/* 固定 48×48，贴在窗口靠边的角上：预览收起、窗口还没缩小的那一帧里，它已经在最终位置 */
.floating-ball {
  position: fixed;
  top: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
}

.floating-ball.left {
  left: 0;
}

.floating-ball.right {
  right: 0;
}

.ball-icon {
  font-size: 24px;
  line-height: 1;
}

.ball-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 1;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background-color: #e81123;
  color: white;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

/* 有未完成的加急任务时变成橙色 */
.floating-ball.urgent {
  background-color: rgba(245, 158, 11, 0.85);
  border-color: rgba(180, 83, 9, 0.6);
}

/* 计时器到点时闪动 */
.floating-ball.alert::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: var(--primary-color);
  animation: ball-blink 1s ease-in-out infinite;
}

@keyframes ball-blink {
  0%, 100% { opacity: 0; }
  50% { opacity: 0.6; }
}
</style>
