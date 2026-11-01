import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppData } from '../types/task';
import { loadData, saveData } from './storage';

// 用内存 Map 模拟 plugin-fs
const fs = vi.hoisted(() => {
  const files = new Map<string, string>();
  return {
    files,
    exists: vi.fn(async (path: string) => files.has(path) || path === 'SimpleTodo'),
    mkdir: vi.fn(async () => {}),
    readTextFile: vi.fn(async (path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`not found: ${path}`);
      return content;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    rename: vi.fn(async (oldPath: string, newPath: string) => {
      const content = files.get(oldPath);
      if (content === undefined) throw new Error(`not found: ${oldPath}`);
      files.set(newPath, content);
      files.delete(oldPath);
    }),
  };
});

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 14 },
  exists: fs.exists,
  mkdir: fs.mkdir,
  readTextFile: fs.readTextFile,
  writeTextFile: fs.writeTextFile,
  rename: fs.rename,
}));

const DATA_PATH = 'SimpleTodo/data.json';

function appData(content: string): AppData {
  return {
    tasks: [
      {
        id: content,
        content,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        completedAt: null,
        timerEndTime: null,
        timerDuration: null,
        priority: 'normal',
      },
    ],
    settings: { theme: 'system', windowPosition: null, windowSize: null },
  };
}

describe('storage', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fs.files.clear();
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('数据文件损坏时先备份，不会被下一次保存覆盖', async () => {
    fs.files.set(DATA_PATH, '{"tasks": [ broken');

    const data = await loadData();
    expect(data.tasks).toEqual([]);

    await saveData(appData('新任务'));

    const backups = [...fs.files.keys()].filter((p) => /^SimpleTodo\/data\.corrupted-\d+\.json$/.test(p));
    expect(backups).toHaveLength(1);
    expect(fs.files.get(backups[0])).toBe('{"tasks": [ broken');
    expect(JSON.parse(fs.files.get(DATA_PATH)!).tasks[0].content).toBe('新任务');
  });

  it('写入中途失败不会破坏原有数据文件', async () => {
    fs.files.set(DATA_PATH, JSON.stringify(appData('旧数据')));

    // 模拟 Rust 侧 File::create 先截断、写到一半进程退出
    fs.writeTextFile.mockImplementationOnce(async (path: string) => {
      fs.files.set(path, '');
      throw new Error('process killed');
    });
    await saveData(appData('新数据'));

    expect(JSON.parse(fs.files.get(DATA_PATH)!).tasks[0].content).toBe('旧数据');
  });

  it('并发保存按调用顺序落盘，旧快照不会覆盖新数据', async () => {
    // 第一次写入比第二次慢
    fs.writeTextFile.mockImplementationOnce(async (path: string, content: string) => {
      await new Promise((r) => setTimeout(r, 20));
      fs.files.set(path, content);
    });

    await Promise.all([saveData(appData('first')), saveData(appData('second'))]);

    expect(JSON.parse(fs.files.get(DATA_PATH)!).tasks[0].content).toBe('second');
  });
});
