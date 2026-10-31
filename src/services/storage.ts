import { BaseDirectory, mkdir, readTextFile, writeTextFile, exists, rename } from '@tauri-apps/plugin-fs';
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
  const path = getDataPath();
  let fileExists = false;
  try {
    await ensureDataDir();
    fileExists = await exists(path, { baseDir: BaseDirectory.AppData });

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
    // 文件存在却读不出来（如内容损坏）：先改名备份，避免下一次保存把它覆盖掉
    if (fileExists) {
      await rename(path, `${DATA_DIR}/data.corrupted-${Date.now()}.json`, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      }).catch((e) => console.error('Failed to back up data file:', e));
    }
    return defaultAppData;
  }
}

// 保存操作排队串行执行，避免并发写入时旧数据覆盖新数据
let saveQueue: Promise<void> = Promise.resolve();

// 保存数据：先写临时文件再改名替换，写到一半中断也不会破坏原文件
export async function saveData(data: AppData): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  saveQueue = saveQueue.then(async () => {
    try {
      await ensureDataDir();
      const tmpPath = `${getDataPath()}.tmp`;
      await writeTextFile(tmpPath, content, { baseDir: BaseDirectory.AppData });
      await rename(tmpPath, getDataPath(), {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      });
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  });
  return saveQueue;
}
