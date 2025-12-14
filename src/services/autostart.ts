import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

// 检查自启动状态
export async function checkAutoStart(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch (error) {
    console.error('Failed to check autostart status:', error);
    return false;
  }
}

// 启用自启动
export async function enableAutoStart(): Promise<boolean> {
  try {
    await enable();
    return true;
  } catch (error) {
    console.error('Failed to enable autostart:', error);
    return false;
  }
}

// 禁用自启动
export async function disableAutoStart(): Promise<boolean> {
  try {
    await disable();
    return true;
  } catch (error) {
    console.error('Failed to disable autostart:', error);
    return false;
  }
}

// 切换自启动状态
export async function toggleAutoStart(): Promise<boolean> {
  try {
    const enabled = await isEnabled();
    if (enabled) {
      await disable();
      return false;
    } else {
      await enable();
      return true;
    }
  } catch (error) {
    console.error('Failed to toggle autostart:', error);
    return false;
  }
}
