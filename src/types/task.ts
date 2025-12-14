// 任务优先级
export type TaskPriority = 'normal' | 'urgent';

// 任务数据模型
export interface Task {
  id: string;
  content: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
  // 计时器相关字段
  timerEndTime: string | null; // 计时器结束的 ISO 时间戳
  timerDuration: number | null; // 计时器总时长（秒）
  // 优先级
  priority: TaskPriority;
}

// 设置数据模型
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  windowPosition: { x: number; y: number } | null;
  windowSize: { width: number; height: number } | null;
}

// 应用数据模型
export interface AppData {
  tasks: Task[];
  settings: Settings;
}

// 默认设置
export const defaultSettings: Settings = {
  theme: 'system',
  windowPosition: null,
  windowSize: null,
};

// 默认应用数据
export const defaultAppData: AppData = {
  tasks: [],
  settings: defaultSettings,
};

// 生成唯一 ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 创建新任务
export function createTask(content: string): Task {
  return {
    id: generateId(),
    content: content.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    timerEndTime: null,
    timerDuration: null,
    priority: 'normal',
  };
}
