<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  submit: [content: string];
}>();

const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

function handleSubmit() {
  const content = inputValue.value.trim();
  if (!content) return;

  emit('submit', content);
  inputValue.value = '';

  // 保持输入框焦点
  inputRef.value?.focus();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSubmit();
  }
}
</script>

<template>
  <div class="task-input">
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      class="input-field"
      placeholder="输入新任务，按回车添加..."
      @keydown="handleKeydown"
    />
  </div>
</template>

<style scoped>
.task-input {
  flex-shrink: 0;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  background-color: var(--input-bg, rgba(255, 255, 255, 0.5));
}

.input-field {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-color, #333);
  background-color: var(--input-field-bg, rgba(0, 0, 0, 0.04));
  border: 1px solid transparent;
  border-radius: 8px;
  outline: none;
  transition: all 0.2s ease;
}

.input-field::placeholder {
  color: var(--text-disabled, #999);
}

.input-field:focus {
  background-color: var(--input-field-focus-bg, rgba(255, 255, 255, 0.8));
  border-color: var(--primary-color, #1890ff);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}
</style>
