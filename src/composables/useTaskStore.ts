import { ref, computed } from 'vue';
import type { Task, AppData, Settings } from '../types/task';
import { createTask, defaultSettings } from '../types/task';
import { loadData, saveData } from '../services/storage';

// 全局状态
const tasks = ref<Task[]>([]);
const settings = ref<Settings>(defaultSettings);
const isLoaded = ref(false);

export function useTaskStore() {
  // 排序后的任务列表：加急未完成 → 普通未完成 → 已完成
  const sortedTasks = computed(() => {
    // 未完成任务
    const pending = tasks.value.filter((t) => !t.completed);

    // 加急未完成（按创建时间倒序）
    const urgentPending = pending
      .filter((t) => t.priority === 'urgent')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 普通未完成（按创建时间倒序）
    const normalPending = pending
      .filter((t) => t.priority === 'normal' || !t.priority)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 已完成（按完成时间倒序）
    const completed = tasks.value
      .filter((t) => t.completed)
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      });

    return [...urgentPending, ...normalPending, ...completed];
  });

  // 初始化：加载数据
  async function init(): Promise<void> {
    if (isLoaded.value) return;

    try {
      const data = await loadData();
      tasks.value = data.tasks;
      settings.value = data.settings;
      isLoaded.value = true;
    } catch (error) {
      console.error('Failed to initialize store:', error);
      tasks.value = [];
      settings.value = defaultSettings;
      isLoaded.value = true;
    }
  }

  // 保存数据
  async function save(): Promise<void> {
    const data: AppData = {
      tasks: tasks.value,
      settings: settings.value,
    };
    await saveData(data);
  }

  // 添加任务
  async function addTask(content: string): Promise<void> {
    if (!content.trim()) return;

    const task = createTask(content);
    tasks.value.unshift(task);
    await save();
  }

  // 切换任务完成状态
  async function toggleTask(id: string): Promise<void> {
    const task = tasks.value.find((t) => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    await save();
  }

  // 更新任务内容
  async function updateTask(id: string, content: string): Promise<void> {
    const task = tasks.value.find((t) => t.id === id);
    if (!task || !content.trim()) return;

    task.content = content.trim();
    await save();
  }

  // 删除任务
  async function deleteTask(id: string): Promise<void> {
    const index = tasks.value.findIndex((t) => t.id === id);
    if (index === -1) return;

    tasks.value.splice(index, 1);
    await save();
  }

  // 更新设置
  async function updateSettings(newSettings: Partial<Settings>): Promise<void> {
    settings.value = { ...settings.value, ...newSettings };
    await save();
  }

  // 清空已完成任务
  async function clearCompleted(): Promise<number> {
    const completedCount = tasks.value.filter((t) => t.completed).length;
    tasks.value = tasks.value.filter((t) => !t.completed);
    await save();
    return completedCount;
  }

  // 设置任务计时器
  async function setTaskTimer(id: string, durationSeconds: number): Promise<void> {
    const task = tasks.value.find((t) => t.id === id);
    if (!task) return;

    const endTime = new Date(Date.now() + durationSeconds * 1000);
    task.timerEndTime = endTime.toISOString();
    task.timerDuration = durationSeconds;
    await save();
  }

  // 取消任务计时器
  async function cancelTaskTimer(id: string): Promise<void> {
    const task = tasks.value.find((t) => t.id === id);
    if (!task) return;

    task.timerEndTime = null;
    task.timerDuration = null;
    await save();
  }

  // 切换任务加急状态
  async function toggleUrgent(id: string): Promise<void> {
    const task = tasks.value.find((t) => t.id === id);
    if (!task) return;

    task.priority = task.priority === 'urgent' ? 'normal' : 'urgent';
    await save();
  }

  return {
    // 状态
    tasks: sortedTasks,
    settings,

    // 方法
    init,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    updateSettings,
    clearCompleted,
    setTaskTimer,
    cancelTaskTimer,
    toggleUrgent,
  };
}
