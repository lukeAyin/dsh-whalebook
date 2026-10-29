/**
 * 用户数据迁移的单元测试：旧 dsh-pet 目录 → dsh-whalebook，只复制缺失项、跳过旧日志、幂等。
 *
 * 跑法：node --experimental-strip-types --test src/host/user-dir.test.ts
 */
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { migrateLegacyUserRoot } from './user-dir.ts';

const log = { info: () => undefined, warn: () => undefined };
let home = '';

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dsh-whalebook-migrate-'));
});

after(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('migrateLegacyUserRoot —— 旧数据复制', () => {
  test('复制配置/待办/素材目录，跳过旧 logs.txt，并写标记', () => {
    const legacy = join(home, 'dsh-pet');
    mkdirSync(join(legacy, 'memes'), { recursive: true });
    writeFileSync(join(legacy, 'main-config.jsonc'), '{"pets":[]}', 'utf8');
    writeFileSync(join(legacy, 'todos.json'), '{"version":1,"todos":[]}', 'utf8');
    writeFileSync(join(legacy, 'logs.txt'), 'old logs', 'utf8');
    writeFileSync(join(legacy, 'memes', 'a.png'), 'png', 'utf8');

    migrateLegacyUserRoot(home, log);
    const current = join(home, 'dsh-whalebook');
    assert.equal(readFileSync(join(current, 'main-config.jsonc'), 'utf8'), '{"pets":[]}');
    assert.equal(readFileSync(join(current, 'todos.json'), 'utf8'), '{"version":1,"todos":[]}');
    assert.equal(readFileSync(join(current, 'memes', 'a.png'), 'utf8'), 'png');
    assert.equal(existsSync(join(current, 'logs.txt')), false, '旧日志不复制');
    assert.equal(existsSync(join(current, '.migrated-from-dsh-pet')), true);
  });

  test('不覆盖新目录已有文件；标记存在后不再迁移', () => {
    const legacy = join(home, 'dsh-pet');
    const current = join(home, 'dsh-whalebook');
    mkdirSync(legacy, { recursive: true });
    mkdirSync(current, { recursive: true });
    writeFileSync(join(legacy, 'main-config.jsonc'), 'old', 'utf8');
    writeFileSync(join(current, 'main-config.jsonc'), 'new', 'utf8');

    migrateLegacyUserRoot(home, log);
    assert.equal(readFileSync(join(current, 'main-config.jsonc'), 'utf8'), 'new');

    writeFileSync(join(legacy, 'todos.json'), 'late', 'utf8');
    migrateLegacyUserRoot(home, log);
    assert.equal(existsSync(join(current, 'todos.json')), false, '已迁移过就不再扫描');
  });

  test('没有旧目录 → 什么都不做', () => {
    migrateLegacyUserRoot(home, log);
    assert.equal(existsSync(join(home, 'dsh-whalebook')), false);
  });
});
