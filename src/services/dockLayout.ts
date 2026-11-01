import type { DockSide, DockState, Point, Rect, ScreenInfo, Size } from '../types/dock';

// 悬浮球边长（points）
export const BALL_SIZE = 48;

// 悬浮球和预览松手时离外侧边不超过这个距离，就继续贴边
export const STAY_DOCKED_DISTANCE = 48;

// 指针离屏幕边缘不超过这个距离，算碰到边缘（屏幕最外一列像素的坐标是 maxX - 1）
const EDGE_TOUCH = 2;

// 浮点误差
const EPS = 0.5;

// 角标文字：0 时不显示，超过 99 显示 99+
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function sameRect(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < EPS &&
    Math.abs(a.y - b.y) < EPS &&
    Math.abs(a.width - b.width) < EPS &&
    Math.abs(a.height - b.height) < EPS
  );
}

// 屏幕布局是否没变（拔屏、改分辨率、挪 Dock 都会让它变）
export function sameScreens(a: ScreenInfo[], b: ScreenInfo[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => sameRect(s.frame, b[i].frame) && sameRect(s.visibleFrame, b[i].visibleFrame))
  );
}

// 屏幕某一侧的外侧边：从整条边里扣掉往外还有别的屏的那几段，剩下的 [起点 y, 终点 y] 区间
function outerSegments(screens: ScreenInfo[], screen: ScreenInfo, side: DockSide): [number, number][] {
  const { frame } = screen;
  const blocked = screens
    .map((s) => s.frame)
    .filter((f) => !sameRect(f, frame))
    .filter((f) => (side === 'left' ? f.x + f.width <= frame.x + EPS : f.x >= frame.x + frame.width - EPS))
    .map((f): [number, number] => [Math.max(f.y, frame.y), Math.min(f.y + f.height, frame.y + frame.height)])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  const segments: [number, number][] = [];
  let cursor = frame.y;
  for (const [start, end] of blocked) {
    if (start > cursor) segments.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < frame.y + frame.height) segments.push([cursor, frame.y + frame.height]);
  return segments;
}

// 在高度 y 处，这块屏的这一侧是不是外侧边
export function isOuterEdge(screens: ScreenInfo[], screen: ScreenInfo, side: DockSide, y: number): boolean {
  return outerSegments(screens, screen, side).some(([start, end]) => y >= start && y <= end);
}

// 点到矩形的距离（在矩形内为 0）
function distanceToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

// 指针所在的屏；指针在屏幕外时取最近的一块
function screenAt(screens: ScreenInfo[], p: Point): ScreenInfo | null {
  const inside = screens.find(
    ({ frame: f }) => p.x >= f.x && p.x < f.x + f.width && p.y >= f.y && p.y < f.y + f.height
  );
  if (inside) return inside;
  let nearest: ScreenInfo | null = null;
  for (const s of screens) {
    if (!nearest || distanceToRect(p, s.frame) < distanceToRect(p, nearest.frame)) nearest = s;
  }
  return nearest;
}

export interface DockTarget {
  side: DockSide;
  screen: ScreenInfo;
}

// 普通窗口松手：指针碰到外侧边缘，或窗口越过外侧边约 1/4 宽度，就贴边
export function dockTargetOnRelease(pointer: Point, frame: Rect, screens: ScreenInfo[]): DockTarget | null {
  const screen = screenAt(screens, pointer);
  if (!screen) return null;
  const f = screen.frame;
  const quarter = frame.width / 4;

  const left = pointer.x - f.x <= EDGE_TOUCH || f.x - frame.x >= quarter;
  if (left && isOuterEdge(screens, screen, 'left', pointer.y)) return { side: 'left', screen };

  const right = f.x + f.width - pointer.x <= EDGE_TOUCH || frame.x + frame.width - (f.x + f.width) >= quarter;
  if (right && isOuterEdge(screens, screen, 'right', pointer.y)) return { side: 'right', screen };

  return null;
}

// 悬浮球和预览松手：离外侧边（可用区域的边）不超过约 48px 就继续贴边，也可以换到另一侧
export function dockTargetNear(pointer: Point, frame: Rect, screens: ScreenInfo[]): DockTarget | null {
  const screen = screenAt(screens, pointer);
  if (!screen) return null;
  const v = screen.visibleFrame;

  const candidates: { side: DockSide; gap: number }[] = [
    { side: 'left', gap: Math.max(0, frame.x - v.x) },
    { side: 'right', gap: Math.max(0, v.x + v.width - (frame.x + frame.width)) },
  ];
  const hit = candidates
    .filter(({ side, gap }) => gap <= STAY_DOCKED_DISTANCE && isOuterEdge(screens, screen, side, pointer.y))
    .sort((a, b) => a.gap - b.gap)[0];
  return hit ? { side: hit.side, screen } : null;
}

// 悬浮球顶边的高度：先收进最近的一段外侧边，再收进可用区域
export function dockTop(screens: ScreenInfo[], screen: ScreenInfo, side: DockSide, y: number): number {
  const segments = outerSegments(screens, screen, side);
  let top = y;
  if (segments.length > 0) {
    const nearest = segments.reduce((best, seg) => {
      const d = (s: [number, number]) => Math.max(s[0] - y, 0, y - (s[1] - BALL_SIZE));
      return d(seg) < d(best) ? seg : best;
    });
    top = clamp(y, nearest[0], nearest[1] - BALL_SIZE);
  }
  const v = screen.visibleFrame;
  return clamp(top, v.y, v.y + v.height - BALL_SIZE);
}

// 悬浮球的窗口位置：贴在可用区域的边上，Dock 在侧边时就贴在 Dock 内侧
export function ballFrame(screen: ScreenInfo, side: DockSide, top: number): Rect {
  const v = screen.visibleFrame;
  const x = side === 'left' ? v.x : v.x + v.width - BALL_SIZE;
  return { x, y: top, width: BALL_SIZE, height: BALL_SIZE };
}

// 预览的窗口位置：从悬浮球那一侧展开，顶部和悬浮球对齐，放不下就往屏幕里挪
export function previewFrame(screen: ScreenInfo, side: DockSide, top: number, size: Size): Rect {
  const v = screen.visibleFrame;
  const x = side === 'left' ? v.x : v.x + v.width - size.width;
  return {
    x: clamp(x, v.x, v.x + v.width - size.width),
    y: clamp(top, v.y, v.y + v.height - size.height),
    ...size,
  };
}

export interface DockPlacement {
  dock: DockState;
  screen: ScreenInfo;
}

// 按当前的屏幕布局重新确定悬浮球的位置。
// 屏还在、那一侧也还有外侧边：只把高度收进去。
// 屏不在了（拔屏、改分辨率）或那一侧没有外侧边了：贴到最近的外侧边，高度按原来的比例。
export function relocateDock(dock: DockState, screens: ScreenInfo[]): DockPlacement | null {
  if (screens.length === 0) return null;
  const same = screens.find((s) => sameRect(s.frame, dock.screen));
  if (same && outerSegments(screens, same, dock.side).length > 0) {
    return { dock: { ...dock, top: dockTop(screens, same, dock.side, dock.top) }, screen: same };
  }

  // 悬浮球原来的中心点
  const old = {
    x: dock.side === 'left' ? dock.screen.x + BALL_SIZE / 2 : dock.screen.x + dock.screen.width - BALL_SIZE / 2,
    y: dock.top + BALL_SIZE / 2,
  };
  let best: { screen: ScreenInfo; side: DockSide; distance: number } | null = null;
  for (const screen of screens) {
    for (const side of ['left', 'right'] as const) {
      const x = side === 'left' ? screen.frame.x : screen.frame.x + screen.frame.width;
      for (const [start, end] of outerSegments(screens, screen, side)) {
        const distance = Math.hypot(old.x - x, Math.max(start - old.y, 0, old.y - end));
        if (!best || distance < best.distance) best = { screen, side, distance };
      }
    }
  }
  if (!best) return null;

  const ratio = (dock.top - dock.screen.y) / dock.screen.height;
  const f = best.screen.frame;
  const top = dockTop(screens, best.screen, best.side, f.y + ratio * f.height);
  return { dock: { ...dock, side: best.side, top, screen: f }, screen: best.screen };
}
