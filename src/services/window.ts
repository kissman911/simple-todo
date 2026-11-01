import { getCurrentWindow, availableMonitors, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import type { Settings } from '../types/task';

const appWindow = getCurrentWindow();

// 保存窗口状态（最小化时读到的位置和尺寸不可信，返回 null）
export async function saveWindowState(): Promise<{
  windowPosition: { x: number; y: number };
  windowSize: { width: number; height: number };
} | null> {
  if (await appWindow.isMinimized()) return null;

  const position = await appWindow.outerPosition();
  const size = await appWindow.outerSize();

  return {
    windowPosition: { x: position.x, y: position.y },
    windowSize: { width: size.width, height: size.height },
  };
}

// 保存的窗口区域是否和当前某块屏幕有重叠（外接屏拔掉后，旧坐标可能落在所有屏幕之外）
async function isOnScreen(
  { x, y }: { x: number; y: number },
  size: { width: number; height: number } | null
): Promise<boolean> {
  const { width, height } = size ?? { width: 280, height: 360 };
  const monitors = await availableMonitors();
  return monitors.some(
    (m) =>
      x < m.position.x + m.size.width &&
      x + width > m.position.x &&
      y < m.position.y + m.size.height &&
      y + height > m.position.y
  );
}

// 恢复窗口状态
export async function restoreWindowState(settings: Settings): Promise<void> {
  try {
    if (settings.windowPosition && (await isOnScreen(settings.windowPosition, settings.windowSize))) {
      await appWindow.setPosition(
        new PhysicalPosition(settings.windowPosition.x, settings.windowPosition.y)
      );
    }
    if (settings.windowSize) {
      await appWindow.setSize(
        new PhysicalSize(settings.windowSize.width, settings.windowSize.height)
      );
    }
  } catch (error) {
    console.error('Failed to restore window state:', error);
  }
}

// 监听窗口移动
export async function onWindowMove(callback: () => void): Promise<() => void> {
  return await appWindow.onMoved(() => {
    callback();
  });
}

// 监听窗口尺寸变化
export async function onWindowResize(callback: () => void): Promise<() => void> {
  return await appWindow.onResized(() => {
    callback();
  });
}
