import { getCurrentWindow, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import type { Settings } from '../types/task';

const appWindow = getCurrentWindow();

// 保存窗口状态
export async function saveWindowState(): Promise<{
  windowPosition: { x: number; y: number };
  windowSize: { width: number; height: number };
}> {
  const position = await appWindow.outerPosition();
  const size = await appWindow.outerSize();

  return {
    windowPosition: { x: position.x, y: position.y },
    windowSize: { width: size.width, height: size.height },
  };
}

// 恢复窗口状态
export async function restoreWindowState(settings: Settings): Promise<void> {
  try {
    if (settings.windowPosition) {
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
