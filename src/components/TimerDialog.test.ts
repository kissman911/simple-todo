import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
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
