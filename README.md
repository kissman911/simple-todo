# SimpleTodo

一款轻量级桌面待办事项应用，基于 Tauri v2 + Vue 3 + TypeScript 构建。

![SimpleTodo](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8.svg)
![Vue](https://img.shields.io/badge/Vue-3.5-42b883.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg)

## 特性

- **轻量小巧** - 窗口默认 280×360，可调整大小
- **桌面置顶** - 始终保持在其他窗口之上
- **透明毛玻璃** - 现代化的视觉效果（Windows / macOS）
- **深色/浅色主题** - 支持手动切换和跟随系统
- **数据本地存储** - 所有数据保存在本地，保护隐私

## 功能

### 基础功能
- 添加/编辑/删除任务
- 点击切换任务完成状态
- 右键菜单快捷操作
- 任务列表动画效果

### 任务优先级
- **加急任务** - ⚡ 图标 + 橙色高亮显示
- **智能排序** - 加急任务自动置顶
- 右键菜单一键切换优先级

### 任务计时器
- 预设时间选项（5/15/25/60 分钟）
- 支持自定义分钟数
- 实时倒计时显示
- 到期系统通知 + 声音提醒

### 清理功能
- 一键清空所有已完成任务
- 确认对话框防止误操作

### 窗口管理
- 自定义标题栏（拖拽移动）
- 记住窗口位置和大小
- 最小化/关闭按钮

### 贴边（仅 macOS）
- 把窗口拖到屏幕左右的外侧边（往外没有别的显示器的那条边），松手时指针碰到边缘、或窗口越过边约 1/4 宽度，就变成悬浮球
- 悬浮球显示未完成任务数（超过 99 显示 99+），有未完成的加急任务时变橙色，计时器到点时闪动，在所有 Space 显示
- 点悬浮球打开预览，功能和普通窗口一样；点了别的地方就收回成悬浮球
- 拖动悬浮球或预览的标题栏：松手时离外侧边不超过约 48px 就继续贴边（可以换到另一侧），否则还原成普通窗口
- 重启后保持悬浮球；悬浮球所在的屏不在了，就贴到剩下的屏里最近的外侧边
- 不支持键盘操作；Windows 和 Linux 上拖到边上和以前一样，不会贴边

## 截图

```
┌─────────────────────────┐
│  SimpleTodo        — ✕  │
├─────────────────────────┤
│  ⚡○ 紧急任务      24:59│
│  ○ 普通任务             │
│  ✓ 已完成任务           │
│                         │
│  [清空已完成 (1)]       │
├─────────────────────────┤
│  添加新任务...          │
└─────────────────────────┘
```

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| [Tauri](https://tauri.app/) | v2 | 跨平台桌面应用框架 |
| [Vue](https://vuejs.org/) | 3.5 | 前端框架 |
| [TypeScript](https://www.typescriptlang.org/) | 5.6 | 类型安全 |
| [Vite](https://vitejs.dev/) | 6.0 | 构建工具 |

### Tauri 插件
- `@tauri-apps/plugin-fs` - 文件系统操作
- `@tauri-apps/plugin-notification` - 系统通知
- `@tauri-apps/plugin-autostart` - 开机自启

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/) >= 1.70
- [pnpm](https://pnpm.io/) / npm / yarn

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-username/simple-todo.git
cd simple-todo

# 安装依赖
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建应用

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

> macOS 的毛玻璃效果依赖 Tauri 的 `macOSPrivateApi`（私有 API），开启后构建的应用无法上架 Mac App Store。

## 项目结构

```
simple-todo/
├── src/                      # 前端源码
│   ├── components/           # Vue 组件
│   │   ├── FloatingBall.vue # 贴边后的悬浮球
│   │   ├── TitleBar.vue     # 自定义标题栏
│   │   ├── TaskList.vue     # 任务列表
│   │   ├── TaskItem.vue     # 任务项
│   │   ├── TaskInput.vue    # 任务输入框
│   │   ├── ContextMenu.vue  # 右键菜单
│   │   ├── ConfirmDialog.vue# 确认对话框
│   │   └── TimerDialog.vue  # 计时器设置
│   ├── composables/          # 组合式函数
│   │   ├── useTaskStore.ts  # 任务状态管理
│   │   ├── useDock.ts       # 贴边：普通窗口 / 悬浮球 / 预览的切换
│   │   └── useTheme.ts      # 主题管理
│   ├── services/             # 服务层
│   │   ├── dock.ts          # 贴边的 Rust command
│   │   ├── dockLayout.ts    # 贴边判定、外侧边、重新定位等纯逻辑
│   │   ├── storage.ts       # 数据持久化
│   │   ├── timer.ts         # 计时器服务
│   │   ├── notification.ts  # 通知服务
│   │   ├── autostart.ts     # 开机自启
│   │   └── window.ts        # 窗口管理
│   ├── types/                # 类型定义
│   │   ├── dock.ts          # 贴边相关的几何类型
│   │   └── task.ts          # 任务类型
│   ├── App.vue               # 主组件
│   └── main.ts               # 入口文件
├── src-tauri/                # Tauri 后端
│   ├── src/
│   │   ├── main.rs          # Rust 入口
│   │   ├── lib.rs           # 插件注册、窗口毛玻璃效果
│   │   └── dock.rs          # 贴边（macOS）：屏幕布局、窗口尺寸位置、跟踪鼠标
│   ├── capabilities/         # 权限配置
│   ├── icons/                # 应用图标
│   ├── Cargo.toml           # Rust 依赖
│   └── tauri.conf.json      # Tauri 配置
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 数据存储

应用数据以 JSON 格式存储在用户目录：

- **Windows**: `%APPDATA%\com.simpletodo.app\SimpleTodo\data.json`
- **macOS**: `~/Library/Application Support/com.simpletodo.app/SimpleTodo/data.json`
- **Linux**: `~/.local/share/com.simpletodo.app/SimpleTodo/data.json`

### 数据结构

```typescript
interface AppData {
  tasks: Task[];
  settings: Settings;
}

interface Task {
  id: string;
  content: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
  timerEndTime: string | null;
  timerDuration: number | null;
  priority: 'normal' | 'urgent';
}

interface Settings {
  theme: 'light' | 'dark' | 'system';
  windowPosition: { x: number; y: number } | null;  // 普通窗口，物理像素
  windowSize: { width: number; height: number } | null;  // 普通窗口，物理像素
  dock: DockState | null;  // 已贴边时的状态，仅 macOS 写入；旧数据没有这个字段时按 null 处理
}

// 坐标都是全局 points：原点在主屏左上角，y 轴向下
interface DockState {
  side: 'left' | 'right';  // 贴在哪一侧
  top: number;  // 悬浮球顶边的 y
  screen: { x: number; y: number; width: number; height: number };  // 悬浮球所在屏的 frame
  normalSize: { width: number; height: number };  // 贴边前普通窗口的尺寸，预览和还原都用它
}
```

## 快捷操作

| 操作 | 方式 |
|------|------|
| 添加任务 | 输入框输入后按 Enter |
| 完成/取消完成 | 单击任务 |
| 编辑任务 | 右键 → 编辑 |
| 删除任务 | 右键 → 删除 |
| 设为加急 | 右键 → 设为加急 |
| 设置提醒 | 右键 → 设置计时器 |
| 切换主题 | 点击标题栏主题图标 |
| 开机自启 | 点击标题栏电源图标 |
| 移动窗口 | 拖拽标题栏 |
| 贴边（macOS） | 把标题栏拖到屏幕左右的外侧边松手 |
| 还原 | 把悬浮球或预览的标题栏拖离边缘 |

## 开发指南

### 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/)
- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 扩展
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) 扩展
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) 扩展

### 常用命令

```bash
# 开发模式
npm run tauri dev

# 类型检查
npm run build

# 运行测试
npm test

# 构建应用
npm run tauri build

# 仅构建前端
npm run build
```

## 许可证

MIT License

## 致谢

- [Tauri](https://tauri.app/) - 现代化桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
