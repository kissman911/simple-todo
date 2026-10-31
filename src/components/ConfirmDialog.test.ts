import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ConfirmDialog from './ConfirmDialog.vue';

const props = { visible: false, title: '清空已完成任务', message: '确定吗？' };

let wrapper: ReturnType<typeof mount> | undefined;

async function open() {
  wrapper = mount(ConfirmDialog, { props, attachTo: document.body });
  await wrapper.setProps({ visible: true });
  await flushPromises();
  return wrapper;
}

function $(selector: string) {
  return document.body.querySelector<HTMLElement>(selector)!;
}

// 在当前焦点元素上按键，返回事件是否被 preventDefault
function press(key: string, init: KeyboardEventInit = {}, keyCode?: number) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  if (keyCode !== undefined) Object.defineProperty(event, 'keyCode', { value: keyCode });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event.defaultPrevented;
}

describe('ConfirmDialog 焦点管理', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('打开时聚焦主按钮', async () => {
    await open();

    expect(document.activeElement).toBe($('.btn-confirm'));
  });

  it('Esc 取消', async () => {
    await open();

    press('Escape');

    expect(wrapper!.emitted('cancel')).toHaveLength(1);
  });

  it('输入法组合输入中的 Esc 不取消', async () => {
    await open();

    press('Escape', {}, 229);

    expect(wrapper!.emitted('cancel')).toBeUndefined();
  });

  it('Tab 焦点只在对话框内循环', async () => {
    await open();

    // 主按钮是最后一个可聚焦元素，Tab 回到第一个
    expect(press('Tab')).toBe(true);
    expect(document.activeElement).toBe($('.btn-cancel'));

    expect(press('Tab', { shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe($('.btn-confirm'));

    // 焦点跑到对话框外时 Tab 拉回对话框
    document.body.focus();
    expect(press('Tab')).toBe(true);
    expect(document.activeElement).toBe($('.btn-cancel'));
  });

  it('关闭后焦点回到打开前的元素', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    await open();
    expect(document.activeElement).toBe($('.btn-confirm'));
    await wrapper!.setProps({ visible: false });
    await flushPromises();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
