import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TaskItem from './TaskItem.vue';
import ContextMenu from './ContextMenu.vue';
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
});
