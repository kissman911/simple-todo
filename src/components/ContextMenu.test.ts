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

  it('打开时焦点进到第一项，上下方向键移动并首尾循环', async () => {
    await openAt(20, 40);
    const items = menuItems();
    expect(items.map((el) => el.getAttribute('role'))).toEqual(['menuitem', 'menuitem', 'menuitem', 'menuitem']);
    expect(document.activeElement).toBe(items[0]);

    press('ArrowUp');
    expect(document.activeElement).toBe(items[3]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items[1]);
  });

  it('Enter 执行当前项', async () => {
    await openAt(20, 40);

    press('ArrowDown');
    press('ArrowDown');
    expect(document.activeElement?.textContent).toContain('设置计时器');
    press('Enter');

    expect(wrapper!.emitted('setTimer')).toHaveLength(1);
    expect(wrapper!.emitted('close')).toHaveLength(1);
  });

  it('输入法组合输入中的 Enter 不执行菜单项', async () => {
    await openAt(20, 40);

    press('Enter', {}, 229);

    expect(wrapper!.emitted('edit')).toBeUndefined();
    expect(wrapper!.emitted('close')).toBeUndefined();
  });

  it('Esc 关闭并把焦点还给打开前的元素', async () => {
    const trigger = document.createElement('div');
    trigger.tabIndex = 0;
    document.body.appendChild(trigger);
    trigger.focus();

    await openAt(20, 40);
    expect(document.activeElement).toBe(menuItems()[0]);
    press('Escape');

    expect(wrapper!.emitted('close')).toHaveLength(1);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

function menuItems() {
  return [...document.body.querySelectorAll<HTMLElement>('.menu-item')];
}

// 在当前焦点元素上按键
function press(key: string, init: KeyboardEventInit = {}, keyCode?: number) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  if (keyCode !== undefined) Object.defineProperty(event, 'keyCode', { value: keyCode });
  (document.activeElement ?? document.body).dispatchEvent(event);
}
