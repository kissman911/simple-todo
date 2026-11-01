import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import TitleBar from './TitleBar.vue';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ minimize: vi.fn(), close: vi.fn() }),
}));
vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: vi.fn(async () => true),
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
}));

const dock = vi.hoisted(() => ({
  mode: { value: 'normal' as 'normal' | 'ball' | 'preview' },
  pressPreviewTitleBar: vi.fn(async () => {}),
  watchTitleBarDrag: vi.fn(async () => {}),
}));
vi.mock('../composables/useDock', () => ({ useDock: () => dock }));

describe('TitleBar', () => {
  afterEach(() => {
    dock.mode.value = 'normal';
    vi.clearAllMocks();
  });

  it('图标按钮都有 aria-label', async () => {
    const wrapper = mount(TitleBar);
    await flushPromises();

    const labels = wrapper.findAll('button').map((btn) => btn.attributes('aria-label'));
    expect(labels).toEqual(['开机自启: 开', '主题: 跟随系统', '最小化', '关闭']);
    wrapper.unmount();
  });

  it('普通窗口按下标题栏时等原生拖动结束再判断贴边', async () => {
    const wrapper = mount(TitleBar);

    await wrapper.find('.title-bar').trigger('mousedown', { button: 0, detail: 1 });

    expect(dock.watchTitleBarDrag).toHaveBeenCalledTimes(1);
    expect(dock.pressPreviewTitleBar).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('预览隐藏最小化按钮，保留主题、开机自启和关闭', async () => {
    dock.mode.value = 'preview';
    const wrapper = mount(TitleBar);
    await flushPromises();

    const labels = wrapper.findAll('button').map((btn) => btn.attributes('aria-label'));
    expect(labels).toEqual(['开机自启: 开', '主题: 跟随系统', '关闭']);
    wrapper.unmount();
  });

  it('预览的标题栏不用原生拖动，按下时交给贴边逻辑', async () => {
    dock.mode.value = 'preview';
    const wrapper = mount(TitleBar);

    expect(wrapper.find('.title-bar').attributes('data-tauri-drag-region')).toBe('false');
    await wrapper.find('.title').trigger('mousedown', { button: 0, detail: 1 });
    await wrapper.find('.control-btn.close').trigger('mousedown', { button: 0, detail: 1 });

    expect(dock.pressPreviewTitleBar).toHaveBeenCalledTimes(1);
    expect(dock.watchTitleBarDrag).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
