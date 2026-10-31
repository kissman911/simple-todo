import { nextTick, onUnmounted, watch, type Ref } from 'vue';

// 对话框里可以聚焦的元素
const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

// 对话框焦点管理：打开时聚焦 initialFocusRef，Esc 取消，Tab 焦点只在对话框内循环，关闭后焦点还给打开前的元素
export function useDialogFocus(
  visible: () => boolean,
  dialogRef: Ref<HTMLElement | null>,
  initialFocusRef: Ref<HTMLElement | null>,
  onCancel: () => void
) {
  let returnFocusTo: HTMLElement | null = null;

  function getFocusable() {
    return [...(dialogRef.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
  }

  function handleKeydown(event: KeyboardEvent) {
    // 输入法组合输入中的按键交给输入法处理（同 TaskInput）
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') {
      onCancel();
    } else if (event.key === 'Tab') {
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !dialogRef.value?.contains(active);
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  watch(visible, async (isVisible) => {
    if (isVisible) {
      returnFocusTo = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', handleKeydown);
      await nextTick();
      // 要聚焦的按钮不可用时（如自定义分钟数无效）聚焦第一个可用元素
      const items = getFocusable();
      const initial = initialFocusRef.value;
      (initial && items.includes(initial) ? initial : items[0])?.focus();
    } else {
      document.removeEventListener('keydown', handleKeydown);
      returnFocusTo?.focus();
      returnFocusTo = null;
    }
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
}
