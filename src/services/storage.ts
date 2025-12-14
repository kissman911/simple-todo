import { BaseDirectory, mkdir, readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import type { AppData } from '../types/task';
import { defaultAppData } from '../types/task';

const DATA_DIR = 'SimpleTodo';
const DATA_FILE = 'data.json';

// 确保数据目录存在
async function ensureDataDir(): Promise<void> {
  try {
    const dirExists = await exists(DATA_DIR, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    }
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

// 获取数据文件路径
function getDataPath(): string {
  return `${DATA_DIR}/${DATA_FILE}`;
}

// 加载数据
export async function loadData(): Promise<AppData> {
  try {
    await ensureDataDir();
    const path = getDataPath();
    const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });

    if (!fileExists) {
      // 文件不存在，返回默认数据并保存
      await saveData(defaultAppData);
      return defaultAppData;
    }

    const content = await readTextFile(path, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(content) as AppData;

    // 确保数据结构完整
    return {
      tasks: data.tasks || [],
      settings: { ...defaultAppData.settings, ...data.settings },
    };
  } catch (error) {
    console.error('Failed to load data:', error);
    return defaultAppData;
  }
}

// 保存数据
export async function saveData(data: AppData): Promise<void> {
  try {
    await ensureDataDir();
    const path = getDataPath();
    const content = JSON.stringify(data, null, 2);
    await writeTextFile(path, content, { baseDir: BaseDirectory.AppData });
  } catch (error) {
    console.error('Failed to save data:', error);
  }
}
