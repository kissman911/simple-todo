import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import type { AppData, Task } from './types/task';

const mocks = vi.hoisted(() => ({
  loadData: vi.fn(),
  saveData: vi.fn(async (_data: unknown) => {}),
  reminder: vi.fn(async (_content: string) => {}),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ minimize: vi.fn(), close: vi.fn() }),
}));
vi.mock('./services/window', () => ({
  saveWindowState: vi.fn(async () => null),
  restoreWindowState: vi.fn(async () => {}),
  onWindowMove: vi.fn(async () => () => {}),
  onWindowResize: vi.fn(async () => () => {}),
}));
vi.mock('./services/storage', () => ({
  loadData: mocks.loadData,
  saveData: mocks.saveData,
}));
vi.mock('./services/notification', () => ({
  checkNotificationPermission: vi.fn(async () => true),
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

async function mountApp(tasks: Task[]) {
  const data: AppData = {
    tasks,
    settings: { theme: 'system', windowPosition: null, windowSize: null },
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
