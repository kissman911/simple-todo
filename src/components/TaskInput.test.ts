import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TaskInput from './TaskInput.vue';

// 输入法组合输入中的回车：WKWebView 里 isComposing 可能已是 false，但 keyCode 仍为 229
function imeEnter(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { value: 229 });
  return event;
}

describe('TaskInput', () => {
  it('输入法组合输入时按回车不提交', async () => {
    const wrapper = mount(TaskInput);
    const input = wrapper.find('input');
    await input.setValue('修复 api');

    input.element.dispatchEvent(imeEnter());

    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('普通回车提交内容', async () => {
    const wrapper = mount(TaskInput);
    const input = wrapper.find('input');
    await input.setValue('修复 API bug');

    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('submit')).toEqual([['修复 API bug']]);
  });
});
