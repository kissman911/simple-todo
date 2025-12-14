import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

// 检查通知权限
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    return permissionGranted;
  } catch (error) {
    console.error('Failed to check notification permission:', error);
    return false;
  }
}

// 播放提示音（使用 Web Audio API）
export function playNotificationSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // 创建振荡器产生提示音
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 设置音调 - 两声"叮"
    oscillator.frequency.value = 880; // A5 音符
    oscillator.type = 'sine';

    // 设置音量包络
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);

    // 第一声
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);

    // 第二声
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.3);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);

    oscillator.start(now);
    oscillator.stop(now + 0.6);

    // 清理
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

// 发送任务提醒通知（带声音）
export async function sendTaskReminder(taskContent: string): Promise<void> {
  try {
    // 先播放声音（确保用户听到）
    playNotificationSound();

    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return;
    }

    await sendNotification({
      title: '⏰ 任务提醒',
      body: taskContent,
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    // 即使通知失败，也尝试播放声音
    playNotificationSound();
  }
}
