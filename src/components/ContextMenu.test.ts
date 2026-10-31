import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ContextMenu from './ContextMenu.vue';

const props = { visible: false, x: 0, y: 0, hasTimer: false, isUrgent: false };

let wrapper: ReturnType<typeof mount> | undefined;

async function openAt(x: number, y: number) {
  wrapper = mount(ContextMenu, { props, attachTo: document.body });
  await wrapper.setProps({ visible: true, x, y });
  await flushPromises();
  return document.body.querySelector<HTMLElement>('.context-menu')!;
}

describe('ContextMenu', () => {
  beforeEach(() => {
    // 默认窗口 280×360，菜单约 140×170（happy-dom 不做布局，手动给出尺寸）
    vi.stubGlobal('innerWidth', 280);
    vi.stubGlobal('innerHeight', 360);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(140);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(170);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('靠近窗口右下角右键时菜单不超出窗口', async () => {
    const menu = await openAt(250, 300);

    expect(parseFloat(menu.style.left) + 140).toBeLessThanOrEqual(280);
    expect(parseFloat(menu.style.top) + 170).toBeLessThanOrEqual(360);
  });

  it('空间足够时菜单出现在鼠标位置', async () => {
    const menu = await openAt(20, 40);

    expect(menu.style.left).toBe('20px');
    expect(menu.style.top).toBe('40px');
  });
});
