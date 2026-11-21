import type { Level } from "../../../shared/challenge";

/**
 * 多条前置路线：routes 中任意一条路线内的关卡全部通关即解锁。
 * 空路线数组表示初始开放；空路线（[]）视为无效并跳过。
 */
export function isUnlocked(level: Level, passed: ReadonlySet<string>): boolean {
  const routes = level.unlock.routes.filter((r) => r.length > 0);
  if (routes.length === 0) return true;
  return routes.some((route) => route.every((id) => passed.has(id)));
}

/** 每条路线的达成情况，供界面逐条展示 */
export function routeStatus(level: Level, passed: ReadonlySet<string>) {
  return level.unlock.routes
    .filter((r) => r.length > 0)
    .map((route) => ({
      ids: route,
      done: route.every((id) => passed.has(id)),
      missing: route.filter((id) => !passed.has(id)),
    }));
}

/**
 * 检测解锁关系中的循环依赖，返回构成循环的关卡 id 路径。
 * 只有「通关」才计入解锁，失败不会写入 passed，因此不会误判。
 */
export function findCycle(levels: Level[]): string[] | null {
  const map = new Map(levels.map((l) => [l.id, l]));
  const state = new Map<string, 1 | 2>(); // 1=访问中 2=已完成
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) {
      const at = stack.indexOf(id);
      return [...stack.slice(at), id];
    }
    const level = map.get(id);
    if (!level) return null;
    state.set(id, 1);
    stack.push(id);
    for (const next of level.unlock.routes.flat()) {
      if (!map.has(next)) continue;
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const l of levels) {
    const cycle = visit(l.id);
    if (cycle) return cycle;
  }
  return null;
}
