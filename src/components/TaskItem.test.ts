import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import TaskItem from './TaskItem.vue';
import ContextMenu from './ContextMenu.vue';
import source from './TaskItem.vue?raw';
import type { Task } from '../types/task';

const task: Task = {
  id: 't1',
  content: '原内容',
  completed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  timerEndTime: null,
  timerDuration: null,
  priority: 'normal',
};

// 通过右键菜单进入编辑模式
async function mountEditing() {
  const wrapper = mount(TaskItem, { props: { task } });
  wrapper.findComponent(ContextMenu).vm.$emit('edit');
  await nextTick();
  return wrapper;
}

describe('TaskItem', () => {
  it('编辑时点击本行空白处只保存，不切换完成状态', async () => {
    const wrapper = await mountEditing();
    const input = wrapper.find('.edit-input');
    await input.setValue('新内容');

    // 真实浏览器里的事件顺序：mousedown → 输入框 blur → click
    await wrapper.trigger('mousedown');
    await input.trigger('blur');
    await wrapper.trigger('click');

    expect(wrapper.emitted('update')).toEqual([['t1', '新内容']]);
    expect(wrapper.emitted('toggle')).toBeUndefined();
  });

  it('输入法组合输入时按回车不结束编辑', async () => {
    const wrapper = await mountEditing();
    const input = wrapper.find('.edit-input');
    await input.setValue('改api');

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { value: 229 });
    input.element.dispatchEvent(event);
    await nextTick();

    expect(wrapper.find('.edit-input').exists()).toBe(true);
    expect(wrapper.emitted('update')).toBeUndefined();
  });

  it('编辑框里按回车只保存，不切换完成状态', async () => {
    const wrapper = await mountEditing();
    const input = wrapper.find('.edit-input');
    await input.setValue('新内容');

    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('update')).toEqual([['t1', '新内容']]);
    expect(wrapper.emitted('toggle')).toBeUndefined();
  });
});

function keydown(el: Element, key: string, init: KeyboardEventInit = {}, keyCode?: number) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  if (keyCode !== undefined) Object.defineProperty(event, 'keyCode', { value: keyCode });
  el.dispatchEvent(event);
}

describe('TaskItem 键盘操作', () => {
  let wrapper: ReturnType<typeof mount> | undefined;

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('可以用 Tab 聚焦，并标明完成状态', () => {
    wrapper = mount(TaskItem, { props: { task } });
    expect(wrapper.attributes('tabindex')).toBe('0');
    expect(wrapper.attributes('role')).toBe('checkbox');
    expect(wrapper.attributes('aria-checked')).toBe('false');

    const done = mount(TaskItem, { props: { task: { ...task, completed: true } } });
    expect(done.attributes('aria-checked')).toBe('true');
    done.unmount();
  });

  it('Enter 和 Space 切换完成状态', () => {
    wrapper = mount(TaskItem, { props: { task } });

    keydown(wrapper.element, 'Enter');
    keydown(wrapper.element, ' ');

    expect(wrapper.emitted('toggle')).toEqual([['t1'], ['t1']]);
  });

  it('输入法组合输入中的按键不切换完成状态', () => {
    wrapper = mount(TaskItem, { props: { task } });

    keydown(wrapper.element, 'Enter', {}, 229);
    keydown(wrapper.element, ' ', { isComposing: true });

    expect(wrapper.emitted('toggle')).toBeUndefined();
  });

  it('Shift+F10 或菜单键打开右键菜单，Esc 关闭后焦点回到任务项', async () => {
    wrapper = mount(TaskItem, { props: { task }, attachTo: document.body });
    const item = wrapper.element as HTMLElement;

    for (const init of [{ key: 'F10', shiftKey: true }, { key: 'ContextMenu' }]) {
      item.focus();
      keydown(item, init.key, init);
      await flushPromises();
      expect(document.activeElement).toBe(document.body.querySelector('.menu-item'));

      keydown(document.activeElement!, 'Escape');
      await flushPromises();
      expect(document.body.querySelector('.context-menu')).toBeNull();
      expect(document.activeElement).toBe(item);
    }
  });
});

// WCAG 2 对比度
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// 取出组件源码里某条 CSS 规则的 color（测试环境不加载 SFC 样式，只能读源码）
function cssColor(selector: string) {
  const start = source.indexOf(`\n${selector} {`);
  if (start === -1) return undefined;
  return source.slice(start, source.indexOf('}', start)).match(/\scolor:\s*(#[0-9a-f]{6})/i)?.[1];
}

describe('TaskItem 加急配色', () => {
  it('浅色主题下加急文字对比度不低于 4.5:1，图标和深色主题保持原橙色', () => {
    // 浅色主题的面板接近白底
    expect(contrast(cssColor('.task-item.urgent .task-content')!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(cssColor('[data-theme="dark"] .task-item.urgent .task-content')).toBe('#f59e0b');
    expect(cssColor('.task-item.urgent .task-indicator')).toBe('#f59e0b');
  });
});
