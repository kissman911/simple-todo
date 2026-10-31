import { describe, it, expect, vi } from 'vitest';
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

describe('TitleBar', () => {
  it('图标按钮都有 aria-label', async () => {
    const wrapper = mount(TitleBar);
    await flushPromises();

    const labels = wrapper.findAll('button').map((btn) => btn.attributes('aria-label'));
    expect(labels).toEqual(['开机自启: 开', '主题: 跟随系统', '最小化', '关闭']);
    wrapper.unmount();
  });
});
