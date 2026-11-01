import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DockMode, Point, Rect, ScreenInfo } from '../types/dock';

// 一次按下到松手的结果，moved 为 false 时按点击处理
export interface PressEnd {
  moved: boolean;
  pointer: Point;
  frame: Rect;
}

// 当前平台支不支持贴边（只有 macOS 支持）
export async function isDockSupported(): Promise<boolean> {
  return await invoke<boolean>('dock_supported');
}

// 所有屏幕的 frame 和可用区域，第一个是主屏
export async function getScreens(): Promise<ScreenInfo[]> {
  return await invoke<ScreenInfo[]>('dock_screens');
}

// 切换窗口形态并一次设好尺寸和位置。hold 为 true 时守住位置一小段时间，盖掉系统平铺的结果
export async function setDockFrame(mode: DockMode, frame: Rect, hold = false): Promise<void> {
  await invoke('dock_set_frame', { mode, frame, hold });
}

// 悬浮球和预览标题栏：按下后跟踪鼠标，移动超过阈值就拖动窗口，松手时返回结果
export async function trackPress(): Promise<PressEnd> {
  return await invoke<PressEnd>('dock_track_press');
}

// 普通窗口标题栏开始原生拖动后，等到松手返回结果
export async function watchDrag(): Promise<PressEnd> {
  return await invoke<PressEnd>('dock_watch_drag');
}

// 监听窗口获得/失去焦点
export async function onFocusChanged(callback: (focused: boolean) => void): Promise<() => void> {
  return await getCurrentWindow().onFocusChanged(({ payload }) => callback(payload));
}
