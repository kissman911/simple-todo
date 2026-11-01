import { describe, it, expect } from 'vitest';
import type { DockState, ScreenInfo } from '../types/dock';
import {
  badgeText,
  isOuterEdge,
  dockTargetOnRelease,
  dockTargetNear,
  dockTop,
  ballFrame,
  previewFrame,
  relocateDock,
} from './dockLayout';

// 主屏 1440×900，菜单栏 25
const MAIN: ScreenInfo = {
  frame: { x: 0, y: 0, width: 1440, height: 900 },
  visibleFrame: { x: 0, y: 25, width: 1440, height: 875 },
};

// 外接屏在主屏右边，比主屏高，往上错开 100：它的左边只有中间一段挨着主屏
const EXT: ScreenInfo = {
  frame: { x: 1440, y: -100, width: 1920, height: 1080 },
  visibleFrame: { x: 1440, y: -75, width: 1920, height: 1055 },
};

// 主屏上方的屏
const TOP: ScreenInfo = {
  frame: { x: 0, y: -900, width: 1440, height: 900 },
  visibleFrame: { x: 0, y: -875, width: 1440, height: 875 },
};

// Dock 放在左侧（宽 70）的主屏
const DOCK_LEFT: ScreenInfo = {
  frame: { x: 0, y: 0, width: 1440, height: 900 },
  visibleFrame: { x: 70, y: 25, width: 1370, height: 875 },
};

const NORMAL = { width: 280, height: 360 };

function win(x: number, y: number) {
  return { x, y, ...NORMAL };
}

function ball(x: number, y: number) {
  return { x, y, width: 48, height: 48 };
}

describe('badgeText', () => {
  it('0 时不显示，超过 99 显示 99+', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(1)).toBe('1');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
    expect(badgeText(250)).toBe('99+');
  });
});

describe('isOuterEdge', () => {
  it('只有一块屏时左右两边都是外侧边', () => {
    expect(isOuterEdge([MAIN], MAIN, 'left', 450)).toBe(true);
    expect(isOuterEdge([MAIN], MAIN, 'right', 450)).toBe(true);
  });

  it('两块屏挨着的那条边不是外侧边', () => {
    expect(isOuterEdge([MAIN, EXT], MAIN, 'right', 450)).toBe(false);
    expect(isOuterEdge([MAIN, EXT], MAIN, 'left', 450)).toBe(true);
    expect(isOuterEdge([MAIN, EXT], EXT, 'right', 450)).toBe(true);
  });

  it('一条边只有一段挨着别的屏时，其余那段仍算外侧边', () => {
    expect(isOuterEdge([MAIN, EXT], EXT, 'left', -50)).toBe(true);
    expect(isOuterEdge([MAIN, EXT], EXT, 'left', 450)).toBe(false);
    expect(isOuterEdge([MAIN, EXT], EXT, 'left', 950)).toBe(true);
  });

  it('上下摞着的屏不影响左右外侧边', () => {
    expect(isOuterEdge([MAIN, TOP], MAIN, 'left', 450)).toBe(true);
    expect(isOuterEdge([MAIN, TOP], TOP, 'right', -450)).toBe(true);
  });
});

describe('dockTargetOnRelease（普通窗口松手）', () => {
  it('指针碰到外侧边缘就贴边', () => {
    expect(dockTargetOnRelease({ x: 0, y: 300 }, win(-100, 290), [MAIN])).toEqual({ side: 'left', screen: MAIN });
    expect(dockTargetOnRelease({ x: 1439, y: 300 }, win(1300, 290), [MAIN])).toEqual({ side: 'right', screen: MAIN });
  });

  it('窗口越过外侧边约 1/4 宽度就贴边', () => {
    expect(dockTargetOnRelease({ x: 40, y: 300 }, win(-75, 290), [MAIN])).toEqual({ side: 'left', screen: MAIN });
    expect(dockTargetOnRelease({ x: 1400, y: 300 }, win(1235, 290), [MAIN])).toEqual({ side: 'right', screen: MAIN });
  });

  it('越过不到 1/4、指针也没碰到边缘，仍是普通窗口', () => {
    expect(dockTargetOnRelease({ x: 40, y: 300 }, win(-60, 290), [MAIN])).toBeNull();
  });

  it('只是靠边放，仍是普通窗口', () => {
    expect(dockTargetOnRelease({ x: 100, y: 300 }, win(0, 290), [MAIN])).toBeNull();
    expect(dockTargetOnRelease({ x: 1300, y: 300 }, win(1160, 290), [MAIN])).toBeNull();
  });

  it('两块屏之间的边不能贴', () => {
    expect(dockTargetOnRelease({ x: 1439, y: 300 }, win(1300, 290), [MAIN, EXT])).toBeNull();
    expect(dockTargetOnRelease({ x: 1440, y: 300 }, win(1400, 290), [MAIN, EXT])).toBeNull();
  });

  it('按松手时的高度判断外侧边', () => {
    expect(dockTargetOnRelease({ x: 1440, y: -50 }, win(1400, -60), [MAIN, EXT])).toEqual({ side: 'left', screen: EXT });
  });
});

describe('dockTargetNear（悬浮球和预览松手）', () => {
  it('离外侧边不超过约 48px 就继续贴边', () => {
    expect(dockTargetNear({ x: 1410, y: 320 }, ball(1392, 300), [MAIN])).toEqual({ side: 'right', screen: MAIN });
    expect(dockTargetNear({ x: 1370, y: 320 }, ball(1350, 300), [MAIN])).toEqual({ side: 'right', screen: MAIN });
  });

  it('离得更远就还原', () => {
    expect(dockTargetNear({ x: 1320, y: 320 }, ball(1300, 300), [MAIN])).toBeNull();
  });

  it('可以换到另一侧的外侧边', () => {
    expect(dockTargetNear({ x: 50, y: 320 }, ball(30, 300), [MAIN])).toEqual({ side: 'left', screen: MAIN });
  });

  it('预览的标题栏用同一条规则', () => {
    expect(dockTargetNear({ x: 1250, y: 310 }, win(1150, 300), [MAIN])).toEqual({ side: 'right', screen: MAIN });
    expect(dockTargetNear({ x: 1100, y: 310 }, win(1000, 300), [MAIN])).toBeNull();
  });

  it('Dock 在侧边时按 Dock 内侧量距离', () => {
    expect(dockTargetNear({ x: 120, y: 320 }, ball(100, 300), [DOCK_LEFT])).toEqual({ side: 'left', screen: DOCK_LEFT });
    expect(dockTargetNear({ x: 150, y: 320 }, ball(130, 300), [DOCK_LEFT])).toBeNull();
  });

  it('两块屏之间的边不能贴', () => {
    expect(dockTargetNear({ x: 1410, y: 320 }, ball(1392, 300), [MAIN, EXT])).toBeNull();
    expect(dockTargetNear({ x: 1470, y: 320 }, ball(1450, 300), [MAIN, EXT])).toBeNull();
  });
});

describe('悬浮球与预览的位置', () => {
  it('悬浮球贴在可用区域的边上，停在松手时的高度', () => {
    expect(ballFrame(MAIN, 'right', 300)).toEqual(ball(1392, 300));
    expect(ballFrame(MAIN, 'left', 300)).toEqual(ball(0, 300));
    expect(ballFrame(DOCK_LEFT, 'left', 300)).toEqual(ball(70, 300));
  });

  it('高度收进可用区域', () => {
    expect(dockTop([MAIN], MAIN, 'right', 300)).toBe(300);
    expect(dockTop([MAIN], MAIN, 'right', 0)).toBe(25);
    expect(dockTop([MAIN], MAIN, 'right', 880)).toBe(852);
  });

  it('外侧边只有一段时，高度收进那一段', () => {
    expect(dockTop([MAIN, EXT], EXT, 'left', -60)).toBe(-60);
    expect(dockTop([MAIN, EXT], EXT, 'left', 920)).toBe(920);
    expect(dockTop([MAIN, EXT], EXT, 'left', 500)).toBe(900);
  });

  it('预览从悬浮球那一侧展开，顶部和悬浮球对齐', () => {
    expect(previewFrame(MAIN, 'right', 300, NORMAL)).toEqual(win(1160, 300));
    expect(previewFrame(MAIN, 'left', 300, NORMAL)).toEqual(win(0, 300));
  });

  it('预览放不下就往屏幕里挪', () => {
    expect(previewFrame(MAIN, 'right', 800, NORMAL)).toEqual(win(1160, 540));
    expect(previewFrame(MAIN, 'right', 300, { width: 280, height: 1000 })).toEqual({ x: 1160, y: 25, width: 280, height: 1000 });
  });
});

describe('relocateDock（悬浮球所在的屏变了）', () => {
  function dock(side: 'left' | 'right', top: number, screen: ScreenInfo): DockState {
    return { side, top, screen: screen.frame, normalSize: NORMAL };
  }

  it('屏还在、外侧边也还在，就不动', () => {
    const d = dock('right', 300, MAIN);
    const r = relocateDock(d, [MAIN])!;

    expect(r.dock).toEqual(d);
    expect(r.screen).toBe(MAIN);
  });

  it('Dock 挪到底部后，高度收进新的可用区域', () => {
    const shrunk: ScreenInfo = { frame: MAIN.frame, visibleFrame: { x: 0, y: 25, width: 1440, height: 800 } };
    const r = relocateDock(dock('right', 820, MAIN), [shrunk])!;

    expect(r.dock.top).toBe(777);
    expect(r.screen).toBe(shrunk);
  });

  it('拔掉外接屏后，贴到剩下的屏里最近的外侧边，高度按原来的比例', () => {
    const r = relocateDock(dock('right', 440, EXT), [MAIN])!;

    expect(r.screen).toBe(MAIN);
    expect(r.dock).toEqual({ side: 'right', top: 450, screen: MAIN.frame, normalSize: NORMAL });
  });

  it('改了分辨率，高度按原来的比例', () => {
    const scaled: ScreenInfo = {
      frame: { x: 0, y: 0, width: 1680, height: 1050 },
      visibleFrame: { x: 0, y: 25, width: 1680, height: 1025 },
    };
    const r = relocateDock(dock('right', 450, MAIN), [scaled])!;

    expect(r.screen).toBe(scaled);
    expect(r.dock).toEqual({ side: 'right', top: 525, screen: scaled.frame, normalSize: NORMAL });
  });

  it('按比例算出的高度放不下，就收进屏幕内', () => {
    const small: ScreenInfo = {
      frame: { x: 0, y: 0, width: 1280, height: 800 },
      visibleFrame: { x: 0, y: 25, width: 1280, height: 775 },
    };
    const r = relocateDock(dock('right', 852, MAIN), [small])!;

    expect(r.dock.side).toBe('right');
    expect(r.dock.top).toBe(752);
  });

  it('原来那条边变成两块屏之间的边时，移到外侧边上', () => {
    const r = relocateDock(dock('right', 450, MAIN), [MAIN, EXT])!;

    expect(isOuterEdge([MAIN, EXT], r.screen, r.dock.side, r.dock.top)).toBe(true);
  });
});
