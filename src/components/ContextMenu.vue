<script setup lang="ts">
import { ref, nextTick, onUnmounted, watch } from 'vue';
import { useDock } from '../composables/useDock';

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  hasTimer: boolean;
  isUrgent: boolean;
}>();

const emit = defineEmits<{
  close: [];
  edit: [];
  delete: [];
  setTimer: [];
  cancelTimer: [];
  toggleUrgent: [];
}>();

const menuRef = ref<HTMLDivElement | null>(null);

// 菜单实际位置：显示后按菜单尺寸收进窗口内，避免在小窗口里被截断
const pos = ref({ x: props.x, y: props.y });

watch(
  () => [props.visible, props.x, props.y],
  async () => {
    pos.value = { x: props.x, y: props.y };
    if (!props.visible) return;
    await nextTick();
    const el = menuRef.value;
    if (!el) return;
    pos.value = {
      x: Math.max(0, Math.min(props.x, window.innerWidth - el.offsetWidth - 4)),
      y: Math.max(0, Math.min(props.y, window.innerHeight - el.offsetHeight - 4)),
    };
  }
);

// 点击外部关闭菜单
function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close');
  }
}

// 打开菜单前的焦点元素，键盘关闭或执行菜单项后把焦点还给它
let returnFocusTo: HTMLElement | null = null;

// 关闭菜单并归还焦点
function close() {
  emit('close');
  returnFocusTo?.focus();
}

function getItems() {
  return [...(menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
}

// 上下移动焦点，首尾循环
function moveFocus(step: number) {
  const items = getItems();
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = index === -1 ? (step > 0 ? 0 : items.length - 1) : (index + step + items.length) % items.length;
  items[next].focus();
}

// 键盘操作：Esc 关闭，上下方向键移动，Enter 执行
function handleKeydown(event: KeyboardEvent) {
  // 输入法组合输入中的按键交给输入法处理（同 TaskInput）
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Escape') {
    close();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveFocus(event.key === 'ArrowDown' ? 1 : -1);
  } else if (event.key === 'Enter') {
    const item = document.activeElement as HTMLElement | null;
    if (item && getItems().includes(item)) {
      event.preventDefault();
      item.click();
    }
  }
}

// 处理编辑
function handleEdit() {
  emit('edit');
  close();
}

// 处理删除
function handleDelete() {
  emit('delete');
  close();
}

// 处理设置计时器
function handleSetTimer() {
  emit('setTimer');
  close();
}

// 处理取消计时器
function handleCancelTimer() {
  emit('cancelTimer');
  close();
}

// 处理切换加急状态
function handleToggleUrgent() {
  emit('toggleUrgent');
  close();
}

// 监听显示状态
watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeydown);
      // 打开时焦点进到第一项
      returnFocusTo = document.activeElement as HTMLElement | null;
      await nextTick();
      getItems()[0]?.focus();
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    }
  }
);

// 预览收回成悬浮球时直接取消菜单
const { mode } = useDock();
watch(mode, (m) => {
  if (m === 'ball' && props.visible) emit('close');
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="context-menu"
        role="menu"
        :style="{ top: `${pos.y}px`, left: `${pos.x}px` }"
      >
        <div class="menu-item" role="menuitem" tabindex="-1" @click="handleEdit">
          <span class="menu-icon">✏️</span>
          <span class="menu-text">编辑</span>
        </div>
        <div class="menu-divider" role="separator"></div>
        <!-- 加急选项 -->
        <div v-if="!isUrgent" class="menu-item menu-item--urgent" role="menuitem" tabindex="-1" @click="handleToggleUrgent">
          <span class="menu-icon">⚡</span>
          <span class="menu-text">设为加急</span>
        </div>
        <div v-else class="menu-item" role="menuitem" tabindex="-1" @click="handleToggleUrgent">
          <span class="menu-icon">📋</span>
          <span class="menu-text">取消加急</span>
        </div>
        <div class="menu-divider" role="separator"></div>
        <!-- 计时器选项 -->
        <div v-if="!hasTimer" class="menu-item" role="menuitem" tabindex="-1" @click="handleSetTimer">
          <span class="menu-icon">⏰</span>
          <span class="menu-text">设置计时器</span>
        </div>
        <div v-else class="menu-item menu-item--warning" role="menuitem" tabindex="-1" @click="handleCancelTimer">
          <span class="menu-icon">⏱️</span>
          <span class="menu-text">取消计时器</span>
        </div>
        <div class="menu-divider" role="separator"></div>
        <div class="menu-item menu-item--danger" role="menuitem" tabindex="-1" @click="handleDelete">
          <span class="menu-icon">🗑️</span>
          <span class="menu-text">删除</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  min-width: 140px;
  background-color: var(--bg-color, rgba(255, 255, 255, 0.98));
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 8px;
  padding: 4px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.menu-item:hover,
.menu-item:focus-visible {
  background-color: var(--hover-color, rgba(0, 0, 0, 0.05));
}

.menu-item:focus {
  outline: none;
}

.menu-item--danger:hover,
.menu-item--danger:focus-visible {
  background-color: rgba(239, 68, 68, 0.1);
}

.menu-item--danger .menu-text {
  color: #ef4444;
}

.menu-item--warning:hover,
.menu-item--warning:focus-visible {
  background-color: rgba(245, 158, 11, 0.1);
}

.menu-item--warning .menu-text {
  color: #f59e0b;
}

.menu-item--urgent:hover,
.menu-item--urgent:focus-visible {
  background-color: rgba(245, 158, 11, 0.1);
}

.menu-item--urgent .menu-text {
  color: #f59e0b;
}

.menu-icon {
  font-size: 14px;
  margin-right: 8px;
}

.menu-text {
  font-size: 13px;
  color: var(--text-color, #333);
}

.menu-divider {
  height: 1px;
  background-color: var(--border-color, rgba(0, 0, 0, 0.06));
  margin: 4px 0;
}

/* 动画 */
.menu-enter-active,
.menu-leave-active {
  transition: all 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
