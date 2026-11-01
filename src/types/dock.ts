// 贴边相关的几何类型。坐标都是全局 points：原点在主屏左上角，y 轴向下（由 Rust 侧从 Cocoa 坐标换算而来）

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

// 一块屏幕：frame 是整块屏，visibleFrame 是扣掉菜单栏和 Dock 后的可用区域
export interface ScreenInfo {
  frame: Rect;
  visibleFrame: Rect;
}

// 窗口形态：普通窗口 / 悬浮球 / 预览
export type DockMode = 'normal' | 'ball' | 'preview';

// 只能贴在左右两条外侧边上
export type DockSide = 'left' | 'right';

// 已贴边时持久化的状态
export interface DockState {
  side: DockSide;
  // 悬浮球顶边的全局 y
  top: number;
  // 悬浮球所在屏的 frame，用来判断这块屏还在不在
  screen: Rect;
  // 贴边前普通窗口的尺寸（points），还原和预览都用它
  normalSize: Size;
}
