<script setup lang="ts">
import { ref, computed } from 'vue';
import { TIMER_PRESETS } from '../services/timer';

defineProps<{
  visible: boolean;
  taskContent: string;
}>();

const emit = defineEmits<{
  confirm: [duration: number];
  cancel: [];
}>();

// 选中的预设（-1 表示自定义）
const selectedPreset = ref(TIMER_PRESETS[2].value); // 默认 25 分钟
const customMinutes = ref(10);

// 计算最终时长（秒），自定义分钟数不是 1-999 的整数时为 0
const finalDuration = computed(() => {
  if (selectedPreset.value === -1) {
    const minutes = customMinutes.value;
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 999 ? minutes * 60 : 0;
  }
  return selectedPreset.value;
});

// 确认
function handleConfirm() {
  if (finalDuration.value > 0) {
    emit('confirm', finalDuration.value);
  }
}

// 选择预设
function selectPreset(value: number) {
  selectedPreset.value = value;
}

// 选择自定义
function selectCustom() {
  selectedPreset.value = -1;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="dialog-overlay" @click.self="emit('cancel')">
        <Transition name="scale">
          <div v-if="visible" class="dialog">
            <div class="dialog-header">
              <h3 class="dialog-title">⏰ 设置计时器</h3>
            </div>
            <div class="dialog-body">
              <p class="task-content">{{ taskContent }}</p>

              <!-- 预设选项 -->
              <div class="preset-grid">
                <button
                  v-for="preset in TIMER_PRESETS"
                  :key="preset.value"
                  class="preset-btn"
                  :class="{ active: selectedPreset === preset.value }"
                  @click="selectPreset(preset.value)"
                >
                  {{ preset.label }}
                </button>
              </div>

              <!-- 自定义输入 -->
              <div class="custom-input-wrapper">
                <button
                  class="preset-btn custom-btn"
                  :class="{ active: selectedPreset === -1 }"
                  @click="selectCustom"
                >
                  自定义
                </button>
                <div v-if="selectedPreset === -1" class="custom-input">
                  <input
                    v-model.number="customMinutes"
                    type="number"
                    min="1"
                    max="999"
                    class="minutes-input"
                  />
                  <span class="minutes-label">分钟</span>
                </div>
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn btn-cancel" @click="emit('cancel')">
                取消
              </button>
              <button class="btn btn-confirm" :disabled="finalDuration === 0" @click="handleConfirm">
                开始计时
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

.task-content {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  padding: 8px 12px;
  background-color: var(--input-field-bg);
  border-radius: 6px;
  word-break: break-word;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.preset-btn {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: transparent;
  color: var(--text-color);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  background-color: var(--hover-color);
  border-color: var(--primary-color);
}

.preset-btn.active {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.custom-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-btn {
  flex-shrink: 0;
}

.custom-input {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.minutes-input {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--input-field-bg);
  color: var(--text-color);
  font-size: 14px;
  text-align: center;
}

.minutes-input:focus {
  outline: none;
  border-color: var(--primary-color);
  background-color: var(--input-field-focus-bg);
}

.minutes-label {
  font-size: 14px;
  color: var(--text-secondary);
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
  background-color: var(--primary-color);
  color: white;
}

.btn-confirm:hover {
  filter: brightness(1.1);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
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
