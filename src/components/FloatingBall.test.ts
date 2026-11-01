import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FloatingBall from './FloatingBall.vue';

function ball(props: Partial<{ pendingCount: number; urgent: boolean; alert: boolean }> = {}) {
  return mount(FloatingBall, {
    props: { pendingCount: 0, urgent: false, alert: false, side: 'right' as const, ...props },
  });
}

describe('FloatingBall', () => {
  it('中间画 📝', () => {
    expect(ball().find('.ball-icon').text()).toBe('📝');
  });

  it('角标显示未完成任务数，0 时不显示，超过 99 显示 99+', () => {
    expect(ball({ pendingCount: 0 }).find('.ball-badge').exists()).toBe(false);
    expect(ball({ pendingCount: 3 }).find('.ball-badge').text()).toBe('3');
    expect(ball({ pendingCount: 120 }).find('.ball-badge').text()).toBe('99+');
  });

  it('有未完成的加急任务时变成橙色，计时器到点时闪动', () => {
    expect(ball({ urgent: true }).find('.floating-ball').classes()).toContain('urgent');
    expect(ball({ alert: true }).find('.floating-ball').classes()).toContain('alert');
    expect(ball().find('.floating-ball').classes()).not.toContain('urgent');
  });

  it('左键按下时发出 press，右键不发', async () => {
    const wrapper = ball();

    await wrapper.find('.floating-ball').trigger('mousedown', { button: 2 });
    expect(wrapper.emitted('press')).toBeUndefined();

    await wrapper.find('.floating-ball').trigger('mousedown', { button: 0 });
    expect(wrapper.emitted('press')).toHaveLength(1);
  });

  it('右键不弹出 webview 自带的菜单', () => {
    const wrapper = ball();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    wrapper.find('.floating-ball').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
