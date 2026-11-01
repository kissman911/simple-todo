import { ref, computed, nextTick } from 'vue';
import type { DockMode, Point, ScreenInfo } from '../types/dock';
import { useTaskStore } from './useTaskStore';
import {
  isDockSupported,
  getScreens,
  setDockFrame,
  trackPress,
  watchDrag,
  onFocusChanged,
  type PressEnd,
} from '../services/dock';
import {
  ballFrame,
  previewFrame,
  dockTop,
  dockTargetOnRelease,
  dockTargetNear,
  relocateDock,
  sameRect,
  sameScreens,
  type DockPlacement,
} from '../services/dockLayout';

// 屏幕布局变化（拔屏、改分辨率、挪 Dock）的检查间隔
const SCREEN_CHECK_INTERVAL = 2000;

// 全局状态
const mode = ref<DockMode>('normal');
// 悬浮球闪动：计时器到点时开始，打开预览后停止
const alert = ref(false);

let supported = false;
// 切换形态和拖动一次只做一个
let busy = false;
// 忙的时候窗口失焦了，忙完再收回成悬浮球
let blurredWhileBusy = false;
let lastScreens: ScreenInfo[] = [];
let screenCheckTimer: ReturnType<typeof setInterval> | null = null;
let unlistenFocus: (() => void) | null = null;

export function useDock() {
  const store = useTaskStore();

  const side = computed(() => store.settings.value.dock?.side ?? 'right');

  async function exclusive(task: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    blurredWhileBusy = false;
    try {
      await task();
      if (blurredWhileBusy && mode.value === 'preview') await showBall();
    } catch (error) {
      console.error('Failed to update dock:', error);
    } finally {
      busy = false;
    }
  }

  // 按当前屏幕布局确定悬浮球位置，位置变了就保存
  async function placeDock(): Promise<DockPlacement | null> {
    const dock = store.settings.value.dock;
    if (!dock) return null;
    lastScreens = await getScreens();
    const placement = relocateDock(dock, lastScreens);
    if (!placement) return null;
    const next = placement.dock;
    if (next.side !== dock.side || next.top !== dock.top || !sameRect(next.screen, dock.screen)) {
      await store.updateSettings({ dock: next });
    }
    return placement;
  }

  // 变成悬浮球。hold：刚从原生拖动松手，要盖掉系统平铺的结果
  async function showBall(hold = false) {
    const placement = await placeDock();
    if (!placement) return;
    // 先换内容再缩小窗口，免得露出被挤扁的任务列表
    mode.value = 'ball';
    await nextTick();
    await setDockFrame('ball', ballFrame(placement.screen, placement.dock.side, placement.dock.top), hold);
    startScreenCheck();
  }

  async function openPreview() {
    const placement = await placeDock();
    if (!placement) return;
    alert.value = false;
    const { screen, dock } = placement;
    // 先放大窗口再换内容，悬浮球一直停在窗口靠边的角上
    await setDockFrame('preview', previewFrame(screen, dock.side, dock.top, dock.normalSize));
    mode.value = 'preview';
  }

  // 还原成普通窗口：停在松手的位置，尺寸用上次普通窗口的尺寸
  async function restore(at: Point) {
    const { normalSize } = store.settings.value.dock!;
    await setDockFrame('normal', { x: at.x, y: at.y, ...normalSize });
    mode.value = 'normal';
    stopScreenCheck();
    await store.updateSettings({ dock: null });
  }

  // 悬浮球和预览标题栏拖完松手：离外侧边不超过约 48px 就继续贴边（可以换到另一侧），否则还原
  async function drop(end: PressEnd) {
    const screens = await getScreens();
    const target = dockTargetNear(end.pointer, end.frame, screens);
    if (!target) {
      await restore({ x: end.frame.x, y: end.frame.y });
      return;
    }
    const top = dockTop(screens, target.screen, target.side, end.frame.y);
    await store.updateSettings({
      dock: { ...store.settings.value.dock!, side: target.side, top, screen: target.screen.frame },
    });
    if (mode.value === 'preview') {
      await openPreview();
    } else {
      await showBall();
    }
  }

  // 普通窗口标题栏按下：等原生拖动结束，松手时满足条件就贴边
  async function watchTitleBarDrag() {
    if (!supported || mode.value !== 'normal') return;
    await exclusive(async () => {
      const end = await watchDrag();
      if (!end.moved) return;
      const screens = await getScreens();
      const target = dockTargetOnRelease(end.pointer, end.frame, screens);
      if (!target) return;
      await store.updateSettings({
        dock: {
          side: target.side,
          top: dockTop(screens, target.screen, target.side, end.frame.y),
          screen: target.screen.frame,
          normalSize: { width: end.frame.width, height: end.frame.height },
        },
      });
      await showBall(true);
    });
  }

  // 按下悬浮球：移动距离很小的按点击处理，打开预览
  async function pressBall() {
    if (mode.value !== 'ball') return;
    await exclusive(async () => {
      const end = await trackPress();
      await (end.moved ? drop(end) : openPreview());
    });
  }

  // 按下预览的标题栏：拖动规则和悬浮球一样
  async function pressPreviewTitleBar() {
    if (mode.value !== 'preview') return;
    await exclusive(async () => {
      const end = await trackPress();
      if (end.moved) await drop(end);
    });
  }

  // 预览失焦时收回成悬浮球；鼠标移出不收
  function handleFocus(focused: boolean) {
    if (focused) {
      blurredWhileBusy = false;
      return;
    }
    if (busy) {
      blurredWhileBusy = true;
    } else if (mode.value === 'preview') {
      exclusive(showBall);
    }
  }

  // 计时器到点：悬浮球闪动
  function notifyTimerExpired() {
    if (mode.value === 'ball') alert.value = true;
  }

  // 定时检查屏幕布局，变了就重新贴边
  async function checkScreens() {
    if (busy || mode.value === 'normal') return;
    const screens = await getScreens();
    if (sameScreens(screens, lastScreens)) return;
    await exclusive(mode.value === 'preview' ? openPreview : showBall);
  }

  function startScreenCheck() {
    if (!screenCheckTimer) screenCheckTimer = setInterval(checkScreens, SCREEN_CHECK_INTERVAL);
  }

  function stopScreenCheck() {
    if (screenCheckTimer) clearInterval(screenCheckTimer);
    screenCheckTimer = null;
  }

  // 启动时调用：上次退出时已贴边就直接变成悬浮球，返回是否已贴边
  async function init(): Promise<boolean> {
    supported = await isDockSupported();
    if (!supported) return false;
    unlistenFocus = await onFocusChanged(handleFocus);
    if (store.settings.value.dock) await exclusive(() => showBall());
    return mode.value !== 'normal';
  }

  function dispose() {
    unlistenFocus?.();
    unlistenFocus = null;
    stopScreenCheck();
  }

  return {
    mode,
    alert,
    side,
    init,
    dispose,
    pressBall,
    pressPreviewTitleBar,
    watchTitleBarDrag,
    notifyTimerExpired,
  };
}
