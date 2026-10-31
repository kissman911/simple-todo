<script setup lang="ts">
import { ref } from 'vue';
import { useDialogFocus } from '../composables/useDialogFocus';

const props = defineProps<{
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const dialogRef = ref<HTMLDivElement | null>(null);
const confirmRef = ref<HTMLButtonElement | null>(null);

useDialogFocus(() => props.visible, dialogRef, confirmRef, () => emit('cancel'));
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="dialog-overlay" @click.self="emit('cancel')">
        <Transition name="scale">
          <div v-if="visible" ref="dialogRef" class="dialog">
            <div class="dialog-header">
              <h3 class="dialog-title">{{ title }}</h3>
            </div>
            <div class="dialog-body">
              <p class="dialog-message">{{ message }}</p>
            </div>
            <div class="dialog-footer">
              <button class="btn btn-cancel" @click="emit('cancel')">
                {{ cancelText || '取消' }}
              </button>
              <button ref="confirmRef" class="btn btn-confirm" @click="emit('confirm')">
                {{ confirmText || '确认' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.dialog {
  background-color: var(--bg-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: calc(100% - 24px);
  max-width: 320px;
  overflow: hidden;
}

.dialog-header {
  padding: 16px 20px 8px;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.dialog-body {
  padding: 8px 20px 16px;
}

.dialog-message {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--input-bg);
  border-top: 1px solid var(--border-color);
}

.btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel {
  background-color: var(--hover-color);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background-color: var(--border-color);
  color: var(--text-color);
}

.btn-confirm {
  background-color: var(--danger-color, #e81123);
  color: white;
}

.btn-confirm:hover {
  background-color: #c50f1f;
}

.btn:active {
  transform: scale(0.98);
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
