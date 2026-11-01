//! 贴边（只做 macOS）：读屏幕布局、一次设好窗口尺寸和位置、跟踪鼠标按下到松手。
//!
//! 和前端之间的坐标都是全局 points：原点在主屏左上角，y 轴向下。
//! Cocoa 的 y 轴向上、原点在主屏左下角，进出 AppKit 时用 `flip` 换算。
//! 不用 tao 的 position/size：它们按各自屏幕的 scaleFactor 换算，混合 DPI 时不在同一个坐标系里。

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use objc2::MainThreadMarker;
use objc2_app_kit::{NSEvent, NSScreen, NSWindow};
use serde::{Deserialize, Serialize};
use tauri::{LogicalSize, Manager, WebviewWindow};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenInfo {
    frame: Rect,
    visible_frame: Rect,
}

/// 一次按下到松手的结果。`moved` 为 false 时按点击处理
#[derive(Debug, Clone, Copy, Serialize)]
pub struct PressEnd {
    moved: bool,
    pointer: Point,
    frame: Rect,
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DockMode {
    Normal,
    Ball,
    Preview,
}

/// 每次设置窗口或开始跟踪鼠标都加一，旧的后台线程看到它变了就退出
static GENERATION: AtomicU64 = AtomicU64::new(0);

/// 按下后移动不超过这个距离（points）按点击处理
const CLICK_SLOP: f64 = 4.0;
/// 轮询鼠标的间隔（约 120Hz）
const POLL: Duration = Duration::from_millis(8);
/// 贴边后守住悬浮球位置的时长：macOS 15 起松手时可能触发系统平铺，平铺动画会在我们设好位置之后才落定
const HOLD: Duration = Duration::from_millis(600);

/// Cocoa 坐标（y 向上）和左上角坐标（y 向下）互相换算，换算两次回到原值
fn flip(r: Rect, primary_height: f64) -> Rect {
    Rect {
        y: primary_height - r.y - r.height,
        ..r
    }
}

fn moved_beyond_slop(start: Point, now: Point) -> bool {
    (now.x - start.x).powi(2) + (now.y - start.y).powi(2) > CLICK_SLOP * CLICK_SLOP
}

fn same_frame(a: Rect, b: Rect) -> bool {
    (a.x - b.x).abs() < 0.5
        && (a.y - b.y).abs() < 0.5
        && (a.width - b.width).abs() < 0.5
        && (a.height - b.height).abs() < 0.5
}

// NSRect 是 objc2-foundation 的类型，不为它多加一个直接依赖，按字段读出来
macro_rules! rect {
    ($ns:expr) => {{
        let r = $ns;
        Rect {
            x: r.origin.x,
            y: r.origin.y,
            width: r.size.width,
            height: r.size.height,
        }
    }};
}

/// 主屏（菜单栏所在的屏，screens 的第一个）的高度，Cocoa 全局坐标以它的左下角为原点
fn primary_height(mtm: MainThreadMarker) -> f64 {
    NSScreen::screens(mtm)
        .to_vec()
        .first()
        .map_or(0.0, |s| s.frame().size.height)
}

fn read_screens(mtm: MainThreadMarker) -> Vec<ScreenInfo> {
    let height = primary_height(mtm);
    NSScreen::screens(mtm)
        .to_vec()
        .iter()
        .map(|s| ScreenInfo {
            frame: flip(rect!(s.frame()), height),
            visible_frame: flip(rect!(s.visibleFrame()), height),
        })
        .collect()
}

/// 指针位置。NSEvent 的这两个类方法可以在任意线程调用
fn pointer(primary_height: f64) -> Point {
    let p = NSEvent::mouseLocation();
    Point {
        x: p.x,
        y: primary_height - p.y,
    }
}

fn left_button_down() -> bool {
    NSEvent::pressedMouseButtons() & 1 != 0
}

/// 在主线程上执行并等结果。已经在主线程时 tauri 会直接执行
fn on_main<T, F>(w: &WebviewWindow, f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(MainThreadMarker, &NSWindow) -> T + Send + 'static,
{
    let (tx, rx) = mpsc::channel();
    let win = w.clone();
    w.run_on_main_thread(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let Ok(ptr) = win.ns_window() else {
            return;
        };
        // SAFETY: ns_window 返回这个窗口的 NSWindow 指针，窗口存活期间有效，且这里在主线程
        let ns_window = unsafe { &*ptr.cast::<NSWindow>() };
        let _ = tx.send(f(mtm, ns_window));
    })
    .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())
}

fn read_frame(ns_window: &NSWindow, primary_height: f64) -> Rect {
    flip(rect!(ns_window.frame()), primary_height)
}

/// 用 setFrame:display: 一次设好尺寸和位置，避免分两次设置露出中间帧
fn apply_frame(ns_window: &NSWindow, frame: Rect, primary_height: f64) {
    let cocoa = flip(frame, primary_height);
    let mut r = ns_window.frame();
    r.origin.x = cocoa.x;
    r.origin.y = cocoa.y;
    r.size.width = cocoa.width;
    r.size.height = cocoa.height;
    ns_window.setFrame_display(r, true);
    // 缩放后可能留下旧的阴影（tauri#4243）
    ns_window.invalidateShadow();
}

/// tauri.conf.json 里主窗口的最小尺寸
fn configured_min_size(w: &WebviewWindow) -> Option<LogicalSize<f64>> {
    let config = w
        .config()
        .app
        .windows
        .iter()
        .find(|c| c.label == w.label())?;
    Some(LogicalSize::new(config.min_width?, config.min_height?))
}

/// 贴边后的一小段时间里，位置被系统改掉（平铺）就改回来
fn hold_frame(w: WebviewWindow, frame: Rect, generation: u64) {
    std::thread::spawn(move || {
        let deadline = Instant::now() + HOLD;
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(16));
            let result = on_main(&w, move |mtm, ns_window| {
                if GENERATION.load(Ordering::SeqCst) != generation {
                    return false;
                }
                let height = primary_height(mtm);
                if !same_frame(read_frame(ns_window, height), frame) {
                    apply_frame(ns_window, frame, height);
                }
                true
            });
            if !matches!(result, Ok(true)) {
                break;
            }
        }
    });
}

/// 当前平台支不支持贴边
#[tauri::command]
pub fn dock_supported() -> bool {
    true
}

#[tauri::command]
pub fn dock_screens(window: WebviewWindow) -> Result<Vec<ScreenInfo>, String> {
    on_main(&window, |mtm, _| read_screens(mtm))
}

/// 切换窗口形态并设好位置。`hold` 为 true 时守住位置一小段时间，用来盖掉系统平铺的结果
#[tauri::command]
pub fn dock_set_frame(
    window: WebviewWindow,
    mode: DockMode,
    frame: Rect,
    hold: bool,
) -> Result<(), String> {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let docked = mode != DockMode::Normal;

    // 悬浮球和预览不能改大小；贴边时在所有 Space 都显示
    window.set_resizable(!docked).map_err(|e| e.to_string())?;
    window
        .set_visible_on_all_workspaces(docked)
        .map_err(|e| e.to_string())?;
    // 要缩到最小尺寸以下，得先清掉最小尺寸
    if docked {
        window
            .set_min_size(None::<LogicalSize<f64>>)
            .map_err(|e| e.to_string())?;
    }

    on_main(&window, move |mtm, ns_window| {
        apply_frame(ns_window, frame, primary_height(mtm));
    })?;

    // 尺寸已经恢复后再设回最小尺寸，免得 tao 先把小窗口撑大一次
    if !docked {
        window
            .set_min_size(configured_min_size(&window))
            .map_err(|e| e.to_string())?;
    }
    // 预览打开后要成为 key window，失焦时才会收到 blur
    if mode == DockMode::Preview {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    if hold {
        hold_frame(window, frame, generation);
    }
    Ok(())
}

/// 悬浮球和预览标题栏：按下后跟踪鼠标，移动超过阈值就手动拖动窗口，松手时返回结果。
/// 不用原生拖动，它不会告诉我们什么时候松手，而且会触发系统平铺。
#[tauri::command]
pub async fn dock_track_press(window: WebviewWindow) -> Result<PressEnd, String> {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || track_press(&window))
        .await
        .map_err(|e| e.to_string())?
}

fn track_press(w: &WebviewWindow) -> Result<PressEnd, String> {
    let (start_frame, height) = on_main(w, |mtm, ns_window| {
        let height = primary_height(mtm);
        (read_frame(ns_window, height), height)
    })?;
    let start = pointer(height);
    let mut moved = false;
    let mut frame = start_frame;

    while left_button_down() {
        let now = pointer(height);
        if !moved && moved_beyond_slop(start, now) {
            moved = true;
        }
        if moved {
            let next = Rect {
                x: start_frame.x + now.x - start.x,
                y: start_frame.y + now.y - start.y,
                ..start_frame
            };
            if !same_frame(next, frame) {
                frame = next;
                on_main(w, move |_, ns_window| apply_frame(ns_window, next, height))?;
            }
        }
        std::thread::sleep(POLL);
    }

    Ok(PressEnd {
        moved,
        pointer: pointer(height),
        frame,
    })
}

/// 普通窗口标题栏：data-tauri-drag-region 开始原生拖动后，等到松手返回结果
#[tauri::command]
pub async fn dock_watch_drag(window: WebviewWindow) -> Result<PressEnd, String> {
    tauri::async_runtime::spawn_blocking(move || watch_drag(&window))
        .await
        .map_err(|e| e.to_string())?
}

fn watch_drag(w: &WebviewWindow) -> Result<PressEnd, String> {
    let sample = |w: &WebviewWindow| {
        on_main(w, |mtm, ns_window| {
            let height = primary_height(mtm);
            (read_frame(ns_window, height), height)
        })
    };
    let (start_frame, height) = sample(w)?;
    // 用松手前最后一次读到的位置：松手后系统平铺可能已经开始改窗口
    let mut frame = start_frame;

    while left_button_down() {
        frame = sample(w)?.0;
        std::thread::sleep(POLL);
    }

    Ok(PressEnd {
        moved: !same_frame(frame, start_frame),
        pointer: pointer(height),
        frame,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAIN_HEIGHT: f64 = 900.0;

    #[test]
    fn flip_converts_between_cocoa_and_top_left() {
        // 主屏本身
        let main = Rect {
            x: 0.0,
            y: 0.0,
            width: 1440.0,
            height: 900.0,
        };
        assert_eq!(flip(main, MAIN_HEIGHT), main);
        // 主屏左下角往上 100 处、高 48 的窗口，顶边在 y = 900 - 148
        let ball = Rect {
            x: 1392.0,
            y: 100.0,
            width: 48.0,
            height: 48.0,
        };
        assert_eq!(flip(ball, MAIN_HEIGHT), Rect { y: 752.0, ..ball });
        // 主屏上方的屏
        let above = Rect {
            x: 0.0,
            y: 900.0,
            width: 1440.0,
            height: 900.0,
        };
        assert_eq!(flip(above, MAIN_HEIGHT), Rect { y: -900.0, ..above });
        // 换算两次回到原值
        assert_eq!(flip(flip(ball, MAIN_HEIGHT), MAIN_HEIGHT), ball);
    }

    #[test]
    fn small_moves_count_as_click() {
        let start = Point { x: 100.0, y: 100.0 };
        assert!(!moved_beyond_slop(start, Point { x: 102.0, y: 101.0 }));
        assert!(moved_beyond_slop(start, Point { x: 105.0, y: 100.0 }));
    }
}
