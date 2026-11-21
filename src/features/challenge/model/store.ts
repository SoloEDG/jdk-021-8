import { reactive } from "vue";
import type { Level, RunResult } from "../../../shared/challenge";
import { builtinLevels } from "./levels";

/** 每个关卡的正式挑战纪录；预演不会写入这里 */
export interface LevelRecord {
  attempts: number;
  passes: number;
  bestNet: number;
  bestVersion: number;
}

const RECORDS_KEY = "lunch-rush-challenge-records";
const LEVELS_KEY = "lunch-rush-challenge-levels";

function loadRecords(): Record<string, LevelRecord> {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadCustomLevels(): Level[] {
  try {
    const raw = localStorage.getItem(LEVELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const challengeState = reactive({
  records: loadRecords() as Record<string, LevelRecord>,
  customLevels: loadCustomLevels() as Level[],
});

function persistRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(challengeState.records));
  } catch {
    /* 存储不可用时本局数据仍然有效 */
  }
}

function persistLevels() {
  try {
    localStorage.setItem(LEVELS_KEY, JSON.stringify(challengeState.customLevels));
  } catch {
    /* 同上 */
  }
}

export function allLevels(): Level[] {
  return [...builtinLevels, ...challengeState.customLevels];
}

export function getLevel(id: string): Level | undefined {
  return allLevels().find((l) => l.id === id);
}

export function recordOf(id: string): LevelRecord {
  return (
    challengeState.records[id] ?? {
      attempts: 0,
      passes: 0,
      bestNet: 0,
      bestVersion: 0,
    }
  );
}

/** 已通关关卡集合：只有正式挑战且重算达标才计入，失败不会误入 */
export function passedSet(): Set<string> {
  const set = new Set<string>();
  for (const [id, r] of Object.entries(challengeState.records)) {
    if (r.passes > 0) set.add(id);
  }
  return set;
}

/** 正式挑战开局即消耗一次次数；预演不调用本函数 */
export function beginOfficial(levelId: string) {
  const r = recordOf(levelId);
  challengeState.records[levelId] = { ...r, attempts: r.attempts + 1 };
  persistRecords();
}

/** 正式挑战结算：只有重算达标才算通关并可能刷新纪录 */
export function finishOfficial(levelId: string, version: number, result: RunResult) {
  const r = recordOf(levelId);
  challengeState.records[levelId] = {
    attempts: r.attempts,
    passes: r.passes + (result.passed ? 1 : 0),
    bestNet: Math.max(r.bestNet, result.net),
    bestVersion: result.net > r.bestNet ? version : r.bestVersion || version,
  };
  persistRecords();
}

/**
 * 保存关卡：已存在则版本号 +1 生成下次生效的新版本，
 * 进行中的挑战仍使用开局时的快照，不受影响。
 */
export function saveLevel(draft: Level): Level {
  const idx = challengeState.customLevels.findIndex((l) => l.id === draft.id);
  const existing = idx >= 0 ? challengeState.customLevels[idx] : undefined;
  const saved: Level = {
    ...draft,
    builtin: false,
    version: existing ? existing.version + 1 : 1,
  };
  if (existing) challengeState.customLevels.splice(idx, 1, saved);
  else challengeState.customLevels.push(saved);
  persistLevels();
  return saved;
}

export function deleteLevel(id: string) {
  const idx = challengeState.customLevels.findIndex((l) => l.id === id);
  if (idx >= 0) {
    challengeState.customLevels.splice(idx, 1);
    persistLevels();
  }
}
