/**
 * 用户数据目录迁移：首次运行鲸事本时，把旧 `dsh-pet` 数据复制到 `dsh-whalebook`。
 *
 * 只复制缺失项、不覆盖新目录里已有文件，也不删除旧目录；`logs.txt` 不复制（避免两代日志混在一起）。
 * 迁移失败只告警、不阻断启动：拿不到旧数据时按全新目录继续跑。
 * @module dsh-whalebook/src/host/user-dir
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoggerLike } from './log-file.ts';

/** 迁移完成标记：存在即不再重复扫描旧目录。 */
const MARKER = '.migrated-from-dsh-pet';

/**
 * 执行一次迁移（幂等）。
 *
 * @param dshHome - `$DSH_HOME`。
 * @param log - 日志出口；迁移结果只记录路径与条数，不记录用户内容。
 */
export function migrateLegacyUserRoot(dshHome: string, log: Pick<LoggerLike, 'info' | 'warn'>): void {
  const legacy = join(dshHome, 'dsh-pet');
  const current = join(dshHome, 'dsh-whalebook');
  if (existsSync(join(current, MARKER))) return;
  if (!existsSync(legacy)) return;
  try {
    mkdirSync(current, { recursive: true });
    let copied = 0;
    for (const entry of readdirSync(legacy)) {
      // 旧日志不复用：两代插件的日志格式/截断策略未必一致，混在一起只会干扰排障。
      if (entry === 'logs.txt') continue;
      try {
        cpSync(join(legacy, entry), join(current, entry), { recursive: true, force: false, errorOnExist: false });
        copied += 1;
      } catch {
        /* 单个条目失败（权限/占用）不阻断其余条目 */
      }
    }
    writeFileSync(join(current, MARKER), `migrated from ${legacy} at ${new Date().toISOString()}\n`, 'utf8');
    log.info?.(`[dsh-whalebook] 已从 dsh-pet 迁移用户数据（${copied} 项，未覆盖已有文件）`);
  } catch (error) {
    log.warn?.(
      '[dsh-whalebook] 旧数据迁移失败，按全新目录继续：' + (error instanceof Error ? error.message : String(error)),
    );
  }
}
