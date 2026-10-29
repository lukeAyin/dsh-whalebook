/**
 * 待办面板的定位：优先贴在宠物上方/下方，放不下再挪到左右侧，尽量不遮住宠物。
 *
 * 纯计算，不读 DOM：调用方传入命中区矩形、面板尺寸与视口尺寸，测试可直接断言落点。
 * 优先返回与命中区不相交的位置；四个方向都放不下时返回 `side: 'overlap'` 的兜底位置。
 * @module dsh-whalebook/src/shared/todo/position
 */

/** 命中区矩形的四个边（视口坐标 px）。 */
export interface AnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 面板尺寸（px）。 */
export interface PanelSize {
  width: number;
  height: number;
}

/** 视口尺寸（px）。 */
export interface ViewportSize {
  width: number;
  height: number;
}

/** 面板落在命中区的哪一侧；`overlap` 表示四个方向都放不下、只能兜底。 */
export type PanelSide = 'above' | 'below' | 'right' | 'left' | 'overlap';

/** 面板落点（左上角，视口坐标 px）与所在侧。 */
export interface Placement {
  left: number;
  top: number;
  side: PanelSide;
}

/** 面板与命中区的间距（px）。 */
export const PANEL_GAP_PX = 12;

/** 面板与视口边缘的最小留白（px）。 */
export const VIEWPORT_MARGIN_PX = 8;

/** 把值夹进 [min, max]；max 小于 min 时取 min（面板比视口还大时至少露出左上角）。 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * 计算面板落点。
 *
 * 依次尝试：上方、下方、右侧、左侧。上/下方要求整块面板放得下，水平居中并夹进视口；
 * 侧边要求高度放得下，垂直居中并夹进视口。都没有空间时才返回会与命中区相交的兜底位置。
 *
 * @param anchor - 宠物命中区矩形。
 * @param panel - 面板实际尺寸（已挂载后测得）。
 * @param viewport - 视口尺寸。
 * @returns 左上角坐标与所在侧，供调用方写 style / 调试。
 */
export function placeTodoPanel(anchor: AnchorRect, panel: PanelSize, viewport: ViewportSize): Placement {
  const maxLeft = viewport.width - panel.width - VIEWPORT_MARGIN_PX;
  const centeredLeft = clamp((anchor.left + anchor.right) / 2 - panel.width / 2, VIEWPORT_MARGIN_PX, maxLeft);

  const aboveTop = anchor.top - panel.height - PANEL_GAP_PX;
  if (aboveTop >= VIEWPORT_MARGIN_PX) return { left: centeredLeft, top: aboveTop, side: 'above' };

  const belowTop = anchor.bottom + PANEL_GAP_PX;
  if (belowTop + panel.height <= viewport.height - VIEWPORT_MARGIN_PX) {
    return { left: centeredLeft, top: belowTop, side: 'below' };
  }

  // 侧边：高度必须放得下，否则贴左/右也还是会被视口裁掉。
  const maxTop = viewport.height - panel.height - VIEWPORT_MARGIN_PX;
  if (maxTop >= VIEWPORT_MARGIN_PX) {
    const centeredTop = clamp((anchor.top + anchor.bottom) / 2 - panel.height / 2, VIEWPORT_MARGIN_PX, maxTop);
    const rightLeft = anchor.right + PANEL_GAP_PX;
    if (rightLeft + panel.width <= viewport.width - VIEWPORT_MARGIN_PX) {
      return { left: rightLeft, top: centeredTop, side: 'right' };
    }
    const leftLeft = anchor.left - PANEL_GAP_PX - panel.width;
    if (leftLeft >= VIEWPORT_MARGIN_PX) return { left: leftLeft, top: centeredTop, side: 'left' };
  }

  // 兜底：四个方向都放不下（极小视口/桌面窗口），只能夹回视口内；此时可能盖住宠物。
  return {
    left: centeredLeft,
    top: clamp(belowTop, VIEWPORT_MARGIN_PX, Math.max(VIEWPORT_MARGIN_PX, maxTop)),
    side: 'overlap',
  };
}
