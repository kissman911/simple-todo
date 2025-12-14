import { ref } from 'vue';

export type Theme = 'light' | 'dark' | 'system';

// 全局主题状态
const currentTheme = ref<Theme>('system');
const actualTheme = ref<'light' | 'dark'>('light');

// 获取系统主题
function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 应用主题到 DOM
function applyTheme(theme: Theme) {
  const actual = theme === 'system' ? getSystemTheme() : theme;
  actualTheme.value = actual;
  document.documentElement.setAttribute('data-theme', actual);
}

// 监听系统主题变化
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

function setupSystemThemeListener() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // 移除旧的监听器
  if (mediaQueryListener) {
    mediaQuery.removeEventListener('change', mediaQueryListener);
  }

  // 添加新的监听器
  mediaQueryListener = () => {
    if (currentTheme.value === 'system') {
      applyTheme('system');
    }
  };

  mediaQuery.addEventListener('change', mediaQueryListener);
}

export function useTheme() {
  // 设置主题
  function setTheme(theme: Theme) {
    currentTheme.value = theme;
    applyTheme(theme);
  }

  // 初始化
  function init(savedTheme?: Theme) {
    if (savedTheme) {
      currentTheme.value = savedTheme;
    }
    applyTheme(currentTheme.value);
    setupSystemThemeListener();
  }

  // 循环切换主题
  function cycleTheme() {
    const themes: Theme[] = ['system', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme.value);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  }

  // 获取主题显示名称
  function getThemeLabel(theme: Theme): string {
    const labels: Record<Theme, string> = {
      system: '跟随系统',
      light: '浅色',
      dark: '深色',
    };
    return labels[theme];
  }

  return {
    theme: currentTheme,
    actualTheme,
    setTheme,
    cycleTheme,
    getThemeLabel,
    init,
  };
}
