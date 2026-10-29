/**
 * 待办面板定位的单元测试：优先上下、放不下换左右、正常位置不遮挡宠物。
 *
 * 跑法：node --experimental-strip-types --test src/shared/todo/position.test.ts
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { placeTodoPanel, type Placement, type PanelSize, type AnchorRect } from './position.ts';

/** 视口：1000×800。 */
const VIEWPORT = { width: 1000, height: 800 };
/** 面板：300×400。 */
const PANEL: PanelSize = { width: 300, height: 400 };

/** 正常落点是否盖住了命中区：用于断言「不遮挡宠物」。 */
function overlaps(placement: Placement, panel: PanelSize, anchor: AnchorRect): boolean {
  return !(
    placement.left + panel.width <= anchor.left ||
    placement.left >= anchor.right ||
    placement.top + panel.height <= anchor.top ||
    placement.top >= anchor.bottom
  );
}

describe('placeTodoPanel —— 落点与避让', () => {
  test('上方放得下：居中放在上方，且不遮宠物', () => {
    const anchor = { left: 400, top: 600, right: 600, bottom: 700 };
    const point = placeTodoPanel(anchor, PANEL, VIEWPORT);
    assert.equal(point.side, 'above');
    assert.equal(point.left, 350);
    assert.equal(point.top, 188);
    assert.equal(overlaps(point, PANEL, anchor), false);
  });

  test('上方放不下、下方放得下：翻到下方', () => {
    const anchor = { left: 400, top: 100, right: 600, bottom: 200 };
    const point = placeTodoPanel(anchor, PANEL, VIEWPORT);
    assert.equal(point.side, 'below');
    assert.equal(point.top, 212);
    assert.equal(overlaps(point, PANEL, anchor), false);
  });

  test('上下都放不下：挪到右侧并避开命中区', () => {
    const anchor = { left: 400, top: 300, right: 600, bottom: 500 };
    const point = placeTodoPanel(anchor, PANEL, VIEWPORT);
    assert.equal(point.side, 'right');
    assert.equal(point.left, 612);
    assert.equal(point.top, 200);
    assert.equal(overlaps(point, PANEL, anchor), false);
  });

  test('右侧也放不下：挪到左侧', () => {
    const anchor = { left: 800, top: 300, right: 980, bottom: 500 };
    const point = placeTodoPanel(anchor, PANEL, VIEWPORT);
    assert.equal(point.side, 'left');
    assert.equal(point.left, 488);
    assert.equal(overlaps(point, PANEL, anchor), false);
  });

  test('靠左 / 靠右时水平夹进视口', () => {
    const leftEdge = placeTodoPanel({ left: 0, top: 600, right: 100, bottom: 700 }, PANEL, VIEWPORT);
    assert.equal(leftEdge.left, 8);
    const rightEdge = placeTodoPanel({ left: 950, top: 600, right: 990, bottom: 700 }, PANEL, VIEWPORT);
    assert.equal(rightEdge.left, VIEWPORT.width - PANEL.width - 8);
  });

  test('极小视口：四个方向都放不下时才兜底（标记 overlap）', () => {
    const point = placeTodoPanel({ left: 120, top: 100, right: 200, bottom: 160 }, PANEL, { width: 320, height: 240 });
    assert.equal(point.side, 'overlap');
    assert.ok(Number.isFinite(point.left) && Number.isFinite(point.top));
  });
});
