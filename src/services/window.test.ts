import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Settings } from '../types/task';
import { restoreWindowState, saveWindowState } from './window';

const win = vi.hoisted(() => ({
  isMinimized: vi.fn(async () => false),
  outerPosition: vi.fn(async () => ({ x: 100, y: 100 })),
  outerSize: vi.fn(async () => ({ width: 280, height: 360 })),
  setPosition: vi.fn(async (_pos: { x: number; y: number }) => {}),
  setSize: vi.fn(async (_size: { width: number; height: number }) => {}),
}));

// 一块 1920×1080 的主屏
const availableMonitors = vi.hoisted(() =>
  vi.fn(async () => [{ position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } }])
);

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => win,
  availableMonitors,
  PhysicalPosition: class {
    constructor(public x: number, public y: number) {}
  },
  PhysicalSize: class {
    constructor(public width: number, public height: number) {}
  },
}));

function settings(x: number, y: number): Settings {
  return { theme: 'system', windowPosition: { x, y }, windowSize: { width: 280, height: 360 } };
}

describe('window state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('位置在屏幕内时正常恢复位置和尺寸', async () => {
    await restoreWindowState(settings(100, 100));

    expect(win.setPosition).toHaveBeenCalledTimes(1);
    expect(win.setPosition.mock.calls[0][0]).toEqual({ x: 100, y: 100 });
    expect(win.setSize).toHaveBeenCalledTimes(1);
  });

  it('位置完全落在所有屏幕之外时不恢复位置（Windows 最小化坐标、外接屏已拔掉）', async () => {
    await restoreWindowState(settings(-32000, -32000));

    expect(win.setPosition).not.toHaveBeenCalled();
    expect(win.setSize).toHaveBeenCalledTimes(1);
  });

  it('窗口最小化时不保存窗口状态', async () => {
    win.isMinimized.mockResolvedValueOnce(true);

    expect(await saveWindowState()).toBeNull();
  });
});
