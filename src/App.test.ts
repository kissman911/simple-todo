import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import type { AppData, Settings, Task } from './types/task';
import type { Rect, ScreenInfo } from './types/dock';

const mocks = vi.hoisted(() => ({
  loadData: vi.fn(),
  saveData: vi.fn(async (_data: unknown) => {}),
  reminder: vi.fn(async (_content: string) => {}),
  permission: vi.fn(async () => true),
  saveWindowState: vi.fn(
    async (): Promise<{ windowPosition: { x: number; y: number }; windowSize: { width: number; height: number } } | null> =>
      null
  ),
  restoreWindowState: vi.fn(async (_settings: unknown) => {}),
  onMove: null as (() => void) | null,
}));

// 贴边的 Rust command
const dock = vi.hoisted(() => {
  type End = { moved: boolean; pointer: { x: number; y: number }; frame: Rect };
  const end: End = { moved: false, pointer: { x: 0, y: 0 }, frame: { x: 0, y: 0, width: 0, height: 0 } };
  return {
    supported: vi.fn(async () => false),
    screens: vi.fn(async (): Promise<ScreenInfo[]> => []),
    setFrame: vi.fn(async (_mode: string, _frame: Rect, _hold?: boolean) => {}),
    trackPress: vi.fn(async (): Promise<End> => end),
    watchDrag: vi.fn(async (): Promise<End> => end),
    focus: null as ((focused: boolean) => void) | null,
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ minimize: vi.fn(), close: vi.fn() }),
}));
vi.mock('./services/window', () => ({
  saveWindowState: mocks.saveWindowState,
  restoreWindowState: mocks.restoreWindowState,
  onWindowMove: vi.fn(async (callback: () => void) => {
    mocks.onMove = callback;
    return () => {};
  }),
  onWindowResize: vi.fn(async () => () => {}),
}));
vi.mock('./services/dock', () => ({
  isDockSupported: dock.supported,
  getScreens: dock.screens,
  setDockFrame: dock.setFrame,
  trackPress: dock.trackPress,
  watchDrag: dock.watchDrag,
  onFocusChanged: vi.fn(async (callback: (focused: boolean) => void) => {
    dock.focus = callback;
    return () => {};
  }),
}));
vi.mock('./services/storage', () => ({
  loadData: mocks.loadData,
  saveData: mocks.saveData,
}));
vi.mock('./services/notification', () => ({
  checkNotificationPermission: mocks.permission,
  sendTaskReminder: mocks.reminder,
}));
vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: vi.fn(async () => false),
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
}));

const NOW = new Date('2026-01-01T09:00:00.000Z').getTime();

function task(content: string, overrides: Partial<Task> = {}): Task {
  return {
    id: content,
    content,
    completed: false,
    createdAt: new Date(NOW - 60_000).toISOString(),
    completedAt: null,
    timerEndTime: new Date(NOW + 60_000).toISOString(),
    timerDuration: 60,
    priority: 'normal',
    ...overrides,
  };
}

// 让 onMounted 里的异步链和事件处理跑完
async function flush() {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0);
}

let wrapper: ReturnType<typeof mount> | undefined;

async function mountApp(tasks: Task[], settings: Partial<Settings> = {}) {
  const data: AppData = {
    tasks,
    settings: { theme: 'system', windowPosition: null, windowSize: null, dock: null, ...settings },
  };
  mocks.loadData.mockImplementation(async () => structuredClone(data));
  vi.resetModules();
  const { default: App } = await import('./App.vue');
  wrapper = mount(App, { attachTo: document.body });
  await flush();
  return wrapper;
}

function body(selector: string) {
  return document.body.querySelector<HTMLElement>(selector)!;
}

function menuItem(text: string) {
  return [...document.body.querySelectorAll<HTMLElement>('.menu-item')].find((el) =>
    el.textContent?.includes(text)
  )!;
}

describe('任务计时器生命周期', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
  });

  it('未处理的任务到点会提醒', async () => {
    await mountApp([task('写周报')]);

    await vi.advanceTimersByTimeAsync(61_000);

    expect(mocks.reminder).toHaveBeenCalledWith('写周报');
  });

  it('删除任务后不再提醒', async () => {
    const app = await mountApp([task('写周报')]);

    await app.find('.task-item').trigger('contextmenu');
    menuItem('删除').click();
    await flush();
    await vi.advanceTimersByTimeAsync(61_000);

    expect(mocks.reminder).not.toHaveBeenCalled();
  });

  it('标记完成时取消计时器', async () => {
    const app = await mountApp([task('写周报')]);
    expect(app.find('.timer-badge').exists()).toBe(true);

    await app.find('.task-item').trigger('click');
    await flush();
    await vi.advanceTimersByTimeAsync(61_000);

    expect(mocks.reminder).not.toHaveBeenCalled();
    expect(app.find('.timer-badge').exists()).toBe(false);
  });

  it('启动时不恢复已完成任务上的计时器', async () => {
    await mountApp([task('写周报', { completed: true, completedAt: new Date(NOW).toISOString() })]);

    await vi.advanceTimersByTimeAsync(61_000);

    expect(mocks.reminder).not.toHaveBeenCalled();
  });

  it('清空已完成任务后不再提醒', async () => {
    const done = { completed: true, completedAt: new Date(NOW).toISOString(), timerEndTime: null, timerDuration: null };
    const app = await mountApp([task('写周报', done)]);

    // 给已完成任务设一个 5 分钟计时器
    await app.find('.task-item').trigger('contextmenu');
    menuItem('设置计时器').click();
    await flush();
    body('.preset-btn').click();
    await flush();
    body('.btn-confirm').click();
    await flush();

    // 清空已完成
    await app.find('.clear-completed-btn').trigger('click');
    await flush();
    body('.btn-confirm').click();
    await flush();
    await vi.advanceTimersByTimeAsync(301_000);

    expect(mocks.reminder).not.toHaveBeenCalled();
  });

  it('等待通知权限期间对话框被取消，计时器仍设在确认时的任务上', async () => {
    let grant!: (granted: boolean) => void;
    mocks.permission.mockImplementationOnce(() => new Promise<boolean>((resolve) => (grant = resolve)));
    const app = await mountApp([task('写周报', { timerEndTime: null, timerDuration: null })]);

    await app.find('.task-item').trigger('contextmenu');
    menuItem('设置计时器').click();
    await flush();
    body('.btn-confirm').click();
    await flush();
    // 权限请求还没返回时对话框被取消（如预览失焦收起）
    body('.btn-cancel').click();
    await flush();
    grant(true);
    await flush();

    expect(app.find('.timer-badge').exists()).toBe(true);
  });
});

// 在当前焦点元素上按键
function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
}

function taskItem(text: string) {
  return [...document.body.querySelectorAll<HTMLElement>('.task-item')].find((el) =>
    el.textContent?.includes(text)
  )!;
}

describe('键盘操作', () => {
  const idle = { timerEndTime: null, timerDuration: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
  });

  it('键盘标记完成后任务移到列表末尾，焦点跟着它', async () => {
    await mountApp([task('写周报', idle), task('买菜', idle), task('回邮件', idle)]);
    taskItem('写周报').focus();

    press('Enter');
    await flush();

    const items = [...document.body.querySelectorAll('.task-item')];
    expect(items[items.length - 1].textContent).toContain('写周报');
    expect(document.activeElement).toBe(taskItem('写周报'));
  });

  it('键盘打开菜单设置计时器，Esc 关闭对话框后焦点回到任务项', async () => {
    await mountApp([task('写周报', idle)]);
    taskItem('写周报').focus();

    press('F10', { shiftKey: true });
    await flush();
    press('ArrowDown');
    press('ArrowDown');
    press('Enter');
    await flush();
    expect(document.activeElement).toBe(body('.btn-confirm'));
    expect(body('.btn-confirm').textContent).toContain('开始计时');

    press('Escape');
    await flush();

    expect(document.body.querySelector('.dialog')).toBeNull();
    expect(document.activeElement).toBe(taskItem('写周报'));
  });
});

// 主屏 1440×900，菜单栏 25
const MAIN: ScreenInfo = {
  frame: { x: 0, y: 0, width: 1440, height: 900 },
  visibleFrame: { x: 0, y: 25, width: 1440, height: 875 },
};
// 外接屏在主屏右边
const EXT: ScreenInfo = {
  frame: { x: 1440, y: 0, width: 1920, height: 1080 },
  visibleFrame: { x: 1440, y: 25, width: 1920, height: 1055 },
};
const NORMAL_SIZE = { width: 300, height: 400 };
const DOCKED: Partial<Settings> = {
  windowPosition: { x: 200, y: 200 },
  windowSize: { width: 600, height: 800 },
  dock: { side: 'right', top: 300, screen: MAIN.frame, normalSize: NORMAL_SIZE },
};

function lastSavedSettings(): Settings {
  const calls = mocks.saveData.mock.calls;
  return (calls[calls.length - 1][0] as AppData).settings;
}

function ball() {
  return document.body.querySelector<HTMLElement>('.floating-ball');
}

function container() {
  return document.body.querySelector<HTMLElement>('.app-container')!;
}

function lastFrame() {
  const calls = dock.setFrame.mock.calls;
  return calls[calls.length - 1];
}

function moved(pointer: { x: number; y: number }, frame: Rect) {
  return { moved: true, pointer, frame };
}

async function pressBall() {
  ball()!.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
  await flush();
}

describe('贴边', () => {
  const idle = { timerEndTime: null, timerDuration: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    dock.supported.mockResolvedValue(true);
    dock.screens.mockResolvedValue([MAIN]);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
    dock.supported.mockResolvedValue(false);
    dock.screens.mockResolvedValue([]);
  });

  it('重启后保持悬浮球，在同一侧、同一高度', async () => {
    await mountApp([], DOCKED);

    expect(ball()).not.toBeNull();
    expect(dock.setFrame).toHaveBeenCalledWith('ball', { x: 1392, y: 300, width: 48, height: 48 }, false);
    expect(mocks.restoreWindowState).not.toHaveBeenCalled();
  });

  it('不支持贴边的平台上，即使保存过贴边状态也用普通窗口', async () => {
    dock.supported.mockResolvedValue(false);
    await mountApp([], DOCKED);

    expect(ball()).toBeNull();
    expect(dock.setFrame).not.toHaveBeenCalled();
    expect(mocks.restoreWindowState).toHaveBeenCalledTimes(1);
  });

  it('角标显示未完成任务数，有未完成的加急任务时变成橙色', async () => {
    await mountApp(
      [
        task('写周报', idle),
        task('买菜', { ...idle, priority: 'urgent' }),
        task('回邮件', { ...idle, completed: true, completedAt: new Date(NOW).toISOString() }),
      ],
      DOCKED
    );

    expect(ball()!.querySelector('.ball-badge')!.textContent).toBe('2');
    expect(ball()!.classList.contains('urgent')).toBe(true);
  });

  it('点悬浮球打开预览：从悬浮球那一侧展开，用上次普通窗口的尺寸，顶部对齐，没有最小化按钮', async () => {
    await mountApp([task('写周报', idle)], DOCKED);

    await pressBall();

    expect(lastFrame()).toEqual(['preview', { x: 1140, y: 300, ...NORMAL_SIZE }]);
    expect(ball()).toBeNull();
    expect(container().style.display).not.toBe('none');
    expect(document.body.querySelector('[aria-label="最小化"]')).toBeNull();
  });

  it('预览失焦时收回成悬浮球，开着的计时器对话框直接取消', async () => {
    const app = await mountApp([task('写周报', idle)], DOCKED);
    await pressBall();
    await app.find('.task-item').trigger('contextmenu');
    menuItem('设置计时器').click();
    await flush();
    expect(document.body.querySelector('.dialog')).not.toBeNull();

    dock.focus!(false);
    await flush();

    expect(ball()).not.toBeNull();
    expect(lastFrame()).toEqual(['ball', { x: 1392, y: 300, width: 48, height: 48 }, false]);
    expect(document.body.querySelector('.dialog')).toBeNull();
  });

  it('预览失焦时开着的右键菜单直接取消', async () => {
    const app = await mountApp([task('写周报', idle)], DOCKED);
    await pressBall();
    await app.find('.task-item').trigger('contextmenu');
    expect(document.body.querySelector('.context-menu')).not.toBeNull();

    dock.focus!(false);
    await flush();

    expect(document.body.querySelector('.context-menu')).toBeNull();
  });

  it('预览失焦时正在编辑的任务照常保存', async () => {
    const app = await mountApp([task('写周报', idle)], DOCKED);
    await pressBall();
    await app.find('.task-item').trigger('contextmenu');
    menuItem('编辑').click();
    await flush();
    await app.find('.edit-input').setValue('写月报');

    dock.focus!(false);
    await flush();

    const calls = mocks.saveData.mock.calls;
    expect((calls[calls.length - 1][0] as AppData).tasks[0].content).toBe('写月报');
  });

  it('计时器到点时悬浮球闪动，打开预览后停止', async () => {
    await mountApp([task('写周报')], DOCKED);

    await vi.advanceTimersByTimeAsync(61_000);
    expect(ball()!.classList.contains('alert')).toBe(true);

    await pressBall();
    dock.focus!(false);
    await flush();

    expect(ball()!.classList.contains('alert')).toBe(false);
  });

  it('把普通窗口拖到外侧边松手，立刻变成悬浮球，停在松手时的高度', async () => {
    dock.watchDrag.mockResolvedValueOnce(moved({ x: 1439, y: 310 }, { x: 1300, y: 300, ...NORMAL_SIZE }));
    const app = await mountApp([]);

    await app.find('.title-bar').trigger('mousedown', { button: 0, detail: 1 });
    await flush();

    expect(ball()).not.toBeNull();
    expect(lastFrame()).toEqual(['ball', { x: 1392, y: 300, width: 48, height: 48 }, true]);
    expect(lastSavedSettings().dock).toEqual({ side: 'right', top: 300, screen: MAIN.frame, normalSize: NORMAL_SIZE });
  });

  it('只是靠边放、指针没碰到边缘的，仍是普通窗口', async () => {
    dock.watchDrag.mockResolvedValueOnce(moved({ x: 1300, y: 310 }, { x: 1140, y: 300, ...NORMAL_SIZE }));
    const app = await mountApp([]);

    await app.find('.title-bar').trigger('mousedown', { button: 0, detail: 1 });
    await flush();

    expect(ball()).toBeNull();
    expect(dock.setFrame).not.toHaveBeenCalled();
  });

  it('把悬浮球拖离外侧边，还原成普通窗口：停在松手的位置，用上次普通窗口的尺寸', async () => {
    await mountApp([], DOCKED);
    dock.trackPress.mockResolvedValueOnce(moved({ x: 820, y: 420 }, { x: 800, y: 400, width: 48, height: 48 }));

    await pressBall();

    expect(ball()).toBeNull();
    expect(lastFrame()).toEqual(['normal', { x: 800, y: 400, ...NORMAL_SIZE }]);
    expect(lastSavedSettings().dock).toBeNull();
  });

  it('把悬浮球拖到另一侧的外侧边附近，继续贴边，停在新的高度', async () => {
    await mountApp([], DOCKED);
    dock.trackPress.mockResolvedValueOnce(moved({ x: 40, y: 520 }, { x: 20, y: 500, width: 48, height: 48 }));

    await pressBall();

    expect(lastFrame()).toEqual(['ball', { x: 0, y: 500, width: 48, height: 48 }, false]);
    expect(lastSavedSettings().dock).toEqual({ side: 'left', top: 500, screen: MAIN.frame, normalSize: NORMAL_SIZE });
  });

  it('拖动预览的标题栏到外侧边附近，继续贴边，停在新的高度', async () => {
    const app = await mountApp([], DOCKED);
    await pressBall();
    dock.trackPress.mockResolvedValueOnce(moved({ x: 1200, y: 510 }, { x: 1120, y: 500, ...NORMAL_SIZE }));

    await app.find('.title').trigger('mousedown', { button: 0, detail: 1 });
    await flush();

    expect(lastFrame()).toEqual(['preview', { x: 1140, y: 500, ...NORMAL_SIZE }]);
    expect(lastSavedSettings().dock!.top).toBe(500);
  });

  it('悬浮球所在的屏不在了，贴到剩下的屏里最近的外侧边，高度按原来的比例', async () => {
    await mountApp([], { ...DOCKED, dock: { side: 'right', top: 540, screen: EXT.frame, normalSize: NORMAL_SIZE } });

    expect(lastFrame()).toEqual(['ball', { x: 1392, y: 450, width: 48, height: 48 }, false]);
    expect(lastSavedSettings().dock).toEqual({ side: 'right', top: 450, screen: MAIN.frame, normalSize: NORMAL_SIZE });
  });

  it('运行中拔掉悬浮球所在的屏，悬浮球重新贴边', async () => {
    dock.screens.mockResolvedValue([MAIN, EXT]);
    await mountApp([], { ...DOCKED, dock: { side: 'right', top: 540, screen: EXT.frame, normalSize: NORMAL_SIZE } });
    expect(lastFrame()).toEqual(['ball', { x: 3312, y: 540, width: 48, height: 48 }, false]);

    dock.screens.mockResolvedValue([MAIN]);
    await vi.advanceTimersByTimeAsync(3000);
    await flush();

    expect(lastFrame()).toEqual(['ball', { x: 1392, y: 450, width: 48, height: 48 }, false]);
  });

  it('悬浮球的尺寸不会覆盖已经保存的普通窗口尺寸', async () => {
    await mountApp([], DOCKED);
    mocks.saveWindowState.mockResolvedValueOnce({ windowPosition: { x: 1392, y: 300 }, windowSize: { width: 96, height: 96 } });

    mocks.onMove!();
    await vi.advanceTimersByTimeAsync(500);

    const sizes = mocks.saveData.mock.calls.map((c) => (c[0] as AppData).settings.windowSize);
    expect(sizes).not.toContainEqual({ width: 96, height: 96 });
  });

  it('不支持贴边的平台上拖标题栏，行为和以前一样', async () => {
    dock.supported.mockResolvedValue(false);
    const app = await mountApp([]);

    await app.find('.title-bar').trigger('mousedown', { button: 0, detail: 1 });
    await flush();

    expect(dock.watchDrag).not.toHaveBeenCalled();
  });
});
