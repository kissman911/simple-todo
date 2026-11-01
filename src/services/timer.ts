import type { Task } from '../types/task';
import { sendTaskReminder } from './notification';

// 存储每个任务的定时器 ID
const timerIntervals = new Map<string, ReturnType<typeof setInterval>>();

// 格式化时间为 mm:ss
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 计算剩余秒数
export function getRemainingSeconds(endTime: string | null): number {
  if (!endTime) return 0;
  const end = new Date(endTime).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 1000));
}

// 启动任务计时器
export function startTaskTimer(task: Task, onExpire: () => void): void {
  // 清除已存在的计时器
  stopTaskTimer(task.id);

  if (!task.timerEndTime) return;

  // 如果已经过期，直接触发
  if (getRemainingSeconds(task.timerEndTime) <= 0) {
    handleTimerExpire(task, onExpire);
    return;
  }

  // 每秒检查一次
  const interval = setInterval(() => {
    if (getRemainingSeconds(task.timerEndTime) <= 0) {
      handleTimerExpire(task, onExpire);
    }
  }, 1000);

  timerIntervals.set(task.id, interval);
}

// 处理计时器到期
async function handleTimerExpire(task: Task, onExpire: () => void): Promise<void> {
  stopTaskTimer(task.id);
  await sendTaskReminder(task.content);
  onExpire();
}

// 停止任务计时器
export function stopTaskTimer(taskId: string): void {
  const interval = timerIntervals.get(taskId);
  if (interval) {
    clearInterval(interval);
    timerIntervals.delete(taskId);
  }
}

// 预设时间选项（秒）
export const TIMER_PRESETS = [
  { label: '5 分钟', value: 5 * 60 },
  { label: '15 分钟', value: 15 * 60 },
  { label: '25 分钟', value: 25 * 60 },
  { label: '60 分钟', value: 60 * 60 },
];
