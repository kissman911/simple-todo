import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import TimerDialog from './TimerDialog.vue';

let wrapper: ReturnType<typeof mount> | undefined;

function $<T extends HTMLElement = HTMLElement>(selector: string) {
  return document.body.querySelector<T>(selector)!;
}

async function setMinutes(value: string) {
  const input = $<HTMLInputElement>('.minutes-input');
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await nextTick();
}

describe('TimerDialog', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('自定义分钟数必须是 1-999 的整数', async () => {
    wrapper = mount(TimerDialog, { props: { visible: true, taskContent: '写周报' }, attachTo: document.body });
    $('.custom-btn').click();
    await nextTick();

    for (const invalid of ['1000', '0', '0.5', '']) {
      await setMinutes(invalid);
      expect($<HTMLButtonElement>('.btn-confirm').disabled).toBe(true);
      $('.btn-confirm').click();
    }
    expect(wrapper.emitted('confirm')).toBeUndefined();

    await setMinutes('30');
    expect($<HTMLButtonElement>('.btn-confirm').disabled).toBe(false);
    $('.btn-confirm').click();
    expect(wrapper.emitted('confirm')).toEqual([[1800]]);
  });
});

// 在当前焦点元素上按键，返回事件是否被 preventDefault
function press(key: string, init: KeyboardEventInit = {}, keyCode?: number) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  if (keyCode !== undefined) Object.defineProperty(event, 'keyCode', { value: keyCode });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event.defaultPrevented;
}

describe('TimerDialog 焦点管理', () => {
  async function open() {
    wrapper = mount(TimerDialog, { props: { visible: false, taskContent: '写周报' }, attachTo: document.body });
    await wrapper.setProps({ visible: true });
    await flushPromises();
    return wrapper;
  }

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('打开时聚焦「开始计时」', async () => {
    await open();

    expect(document.activeElement).toBe($('.btn-confirm'));
  });

  it('Esc 取消，输入法组合输入中的 Esc 不取消', async () => {
    await open();

    press('Escape', { isComposing: true });
    expect(wrapper!.emitted('cancel')).toBeUndefined();

    press('Escape');
    expect(wrapper!.emitted('cancel')).toHaveLength(1);
  });

  it('Tab 焦点只在对话框内循环', async () => {
    await open();
    const first = $('.preset-btn');

    expect(press('Tab')).toBe(true);
    expect(document.activeElement).toBe(first);

    expect(press('Tab', { shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe($('.btn-confirm'));
  });

  it('「开始计时」不可用时聚焦第一个可用元素', async () => {
    await open();
    $('.custom-btn').click();
    await nextTick();
    await setMinutes('0');

    await wrapper!.setProps({ visible: false });
    await flushPromises();
    await wrapper!.setProps({ visible: true });
    await flushPromises();

    expect(document.activeElement).toBe($('.preset-btn'));
  });
});
