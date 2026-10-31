import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playNotificationSound, sendTaskReminder } from './notification';

const plugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => 'granted'),
  sendNotification: vi.fn((_options: { title: string; body: string }) => {}),
}));

vi.mock('@tauri-apps/plugin-notification', () => plugin);

class FakeOscillator {
  frequency = { value: 0 };
  type = '';
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  destination = {};
  oscillators: FakeOscillator[] = [];
  close = vi.fn(async () => {});
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain() {
    return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} };
  }
}

describe('notification', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    FakeAudioContext.instances = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  it('提示音播放结束后关闭 AudioContext', () => {
    playNotificationSound();

    const ctx = FakeAudioContext.instances[0];
    ctx.oscillators[0].onended?.();

    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  it('系统通知失败时提示音只响一次', async () => {
    plugin.sendNotification.mockImplementationOnce(() => {
      throw new Error('notification failed');
    });

    await sendTaskReminder('写周报');

    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('通知文案为"任务到期：[任务内容]"', async () => {
    await sendTaskReminder('写周报');

    expect(plugin.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: '任务到期：写周报' })
    );
  });
});
