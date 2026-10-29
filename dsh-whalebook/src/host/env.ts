/**
 * 插件环境变量：新前缀 `DSH_WHALEBOOK_*`，并兼容一版旧前缀 `DSH_PET_*`。
 *
 * 迁移自 dsh-pet 的用户可能仍在 shell / 启动器里用旧变量名；插件启动时把旧名复制到新名
 * （新名优先、已存在不覆盖），之后所有代码只读新前缀。幂等，可在每个入口安全调用。
 * @module dsh-whalebook/src/host/env
 */

const PREFIX = 'DSH_WHALEBOOK_';
const LEGACY_PREFIX = 'DSH_PET_';

/**
 * 把旧前缀环境变量映射到新前缀。
 *
 * @param env - 目标环境对象；默认 `process.env`，测试可注入。
 */
export function adoptLegacyEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of Object.keys(env)) {
    if (!key.startsWith(LEGACY_PREFIX)) continue;
    const next = PREFIX + key.slice(LEGACY_PREFIX.length);
    if (env[next] === undefined) env[next] = env[key];
  }
}
