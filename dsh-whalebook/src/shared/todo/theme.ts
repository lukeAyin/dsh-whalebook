/**
 * 待办面板的主题：跟随 DSH 的亮/暗色设置与系统偏好，并把 `--dsw-alias-*` token 解析成具体颜色。
 *
 * DSH 在 `body` 上定义主题 token；`body[data-ds-dark-theme]` 表示暗色。面板挂在 body 下，
 * 但会主动把关键颜色写进内联样式（带 !important），避免被宿主/主题的全局规则覆盖——
 * 之前就出现过「输入框是白底、面板根却是黑底、文字还是黑字」的覆盖问题。
 * @module dsh-whalebook/src/shared/todo/theme
 */

/** 面板主题。 */
export type TodoTheme = 'light' | 'dark';

/** 主题取色：全部用具体颜色，供内联变量与 CSS 兜底。 */
export interface TodoPalette {
  bg: string;
  surface: string;
  label: string;
  muted: string;
  faint: string;
  border: string;
  hover: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  danger: string;
  warn: string;
  info: string;
}

/** 主题判定（纯函数，便于测试）：DSH 的暗色标记优先，其次跟随系统。 */
export function resolveTodoTheme(bodyHasDark: boolean, prefersDark: boolean): TodoTheme {
  return bodyHasDark || prefersDark ? 'dark' : 'light';
}

/** 读取当前主题。 */
export function detectTodoTheme(doc: Document = document): TodoTheme {
  const bodyHasDark = doc.body?.hasAttribute('data-ds-dark-theme') ?? false;
  const prefersDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  return resolveTodoTheme(bodyHasDark, prefersDark);
}

/** 没有 DSH token 时的兜底配色（浅色 / 深色）。 */
const FALLBACK: Record<TodoTheme, TodoPalette> = {
  light: {
    bg: '#ffffff',
    surface: '#f5f6f8',
    label: '#1f2329',
    muted: '#5c6370',
    faint: '#8a919c',
    border: 'rgba(0, 0, 0, .12)',
    hover: 'rgba(0, 0, 0, .05)',
    accent: '#4a7dff',
    accentHover: '#3a6ce8',
    onAccent: '#ffffff',
    danger: '#d94f3d',
    warn: '#c9761b',
    info: '#3f6fd8',
  },
  dark: {
    bg: '#26282d',
    surface: '#33363c',
    label: '#f2f3f5',
    muted: '#b6bcc6',
    faint: '#8f96a2',
    border: 'rgba(255, 255, 255, .14)',
    hover: 'rgba(255, 255, 255, .08)',
    accent: '#5b8cff',
    accentHover: '#7aa2ff',
    onAccent: '#0b0d12',
    danger: '#ff7a6a',
    warn: '#f0a45a',
    info: '#8fb4ff',
  },
};

/** 解析 CSS 颜色为 [r, g, b, a]；只接受 #rgb/#rrggbb/#rrggbbaa 与 rgb()/rgba()，解析不了返回 null。 */
function parseColor(color: string): [number, number, number, number] | null {
  const value = color.trim();
  if (value.toLowerCase() === 'transparent') return [0, 0, 0, 0];
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex !== null) {
    const digits = hex[1];
    const expand = (part: string): number => parseInt(part.length === 1 ? part + part : part, 16);
    if (digits.length === 3) return [expand(digits[0]), expand(digits[1]), expand(digits[2]), 1];
    if (digits.length === 6)
      return [expand(digits.slice(0, 2)), expand(digits.slice(2, 4)), expand(digits.slice(4, 6)), 1];
    if (digits.length === 8) {
      return [
        expand(digits.slice(0, 2)),
        expand(digits.slice(2, 4)),
        expand(digits.slice(4, 6)),
        expand(digits.slice(6, 8)) / 255,
      ];
    }
    return null;
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
  if (rgb === null) return null;
  const alpha =
    rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number.parseFloat(rgb[4]) / 100 : Number.parseFloat(rgb[4]);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
}

/**
 * 把带透明度的颜色叠到实底上，得到不透明颜色。
 * 用于 `bg-overlay` 这类半透明 token：面板需要跟随主题，但不能透出桌面/聊天背景。
 */
export function compositeOpaque(color: string, base: string): string {
  const fg = parseColor(color);
  if (fg === null) return color;
  if (fg[3] >= 1) return `rgb(${fg[0]}, ${fg[1]}, ${fg[2]})`;
  const solid = parseColor(base);
  if (solid === null) return color;
  const alpha = fg[3];
  const mix = (front: number, back: number): number => Math.round(front * alpha + back * (1 - alpha));
  return `rgb(${mix(fg[0], solid[0])}, ${mix(fg[1], solid[1])}, ${mix(fg[2], solid[2])})`;
}

/** 把 DSH token 解析成具体颜色；token 缺失或透明时用兜底值。 */
function colorOf(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.body).getPropertyValue(token).trim();
  if (raw === '' || raw === 'initial' || raw === 'unset') return fallback;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color === '' || color === 'rgba(0, 0, 0, 0)' ? fallback : color;
}

/** 读取一套主题色：优先 DSH token，缺什么补什么。 */
export function readTodoPalette(theme: TodoTheme): TodoPalette {
  const fallback = FALLBACK[theme];
  // 面板必须不透明：先把主题色叠到 DSH 的实底 bg-base 上，再使用。
  const base = compositeOpaque(colorOf('--dsw-alias-bg-base', fallback.bg), fallback.bg);
  return {
    bg: compositeOpaque(colorOf('--dsw-alias-bg-layer-1', colorOf('--dsw-alias-bg-overlay', fallback.bg)), base),
    surface: compositeOpaque(colorOf('--dsw-alias-bg-layer-2', fallback.surface), base),
    label: colorOf('--dsw-alias-label-primary', fallback.label),
    muted: colorOf('--dsw-alias-label-secondary', fallback.muted),
    faint: colorOf('--dsw-alias-label-tertiary', fallback.faint),
    border: colorOf('--dsw-alias-border-l2', fallback.border),
    hover: colorOf('--dsw-alias-interactive-bg-hover', fallback.hover),
    accent: colorOf('--dsw-alias-button-info-fill', fallback.accent),
    accentHover: colorOf('--dsw-alias-button-info-hover', fallback.accentHover),
    onAccent: colorOf('--dsw-alias-label-primary-foreground', fallback.onAccent),
    danger: colorOf('--dsw-alias-state-error-primary', fallback.danger),
    warn: colorOf('--dsw-alias-state-warn-primary', fallback.warn),
    info: colorOf('--dsw-alias-state-info-primary', fallback.info),
  };
}

/**
 * 把当前主题写进面板根节点：内联 CSS 变量 + 内联关键样式（!important），并监听主题切换。
 *
 * @param root - 待办面板根节点（必须已在文档中）。
 * @returns 取消监听的清理函数。
 */
export function applyTodoTheme(root: HTMLElement): () => void {
  let disposed = false;

  const sync = (): void => {
    if (disposed) return;
    const theme = detectTodoTheme();
    const palette = readTodoPalette(theme);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    // 变量供子元素 CSS 使用；具体色值不依赖 token 是否在页面上生效。
    root.style.setProperty('--wb-bg', palette.bg);
    root.style.setProperty('--wb-surface', palette.surface);
    root.style.setProperty('--wb-label', palette.label);
    root.style.setProperty('--wb-muted', palette.muted);
    root.style.setProperty('--wb-faint', palette.faint);
    root.style.setProperty('--wb-border', palette.border);
    root.style.setProperty('--wb-hover', palette.hover);
    root.style.setProperty('--wb-accent', palette.accent);
    root.style.setProperty('--wb-accent-hover', palette.accentHover);
    root.style.setProperty('--wb-on-accent', palette.onAccent);
    root.style.setProperty('--wb-danger', palette.danger);
    root.style.setProperty('--wb-warn', palette.warn);
    root.style.setProperty('--wb-info', palette.info);
    // 根节点的背景/文字用内联 important 锁死，避免被宿主全局 dialog 样式盖掉。
    root.style.setProperty('background', palette.bg, 'important');
    root.style.setProperty('color', palette.label, 'important');
    root.style.setProperty('border-color', palette.border, 'important');
  };

  sync();
  if (typeof MutationObserver === 'undefined') return () => undefined;
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class'] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class'] });
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
  media?.addEventListener?.('change', sync);
  return () => {
    disposed = true;
    observer.disconnect();
    media?.removeEventListener?.('change', sync);
  };
}
