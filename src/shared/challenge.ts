import type { RecipeId, Ingredient } from "./types";

/** 挑战模式：预演不计入纪录，正式挑战消耗次数并参与解锁 */
export type RunMode = "practice" | "official";

/** 来客表中的一行：到店时刻、菜品、客人与耐心，全部由关卡定义固定 */
export interface CustomerPlan {
  time: number;
  recipe: RecipeId;
  guest: string;
  patience: number;
}

/** 关卡事件：与来客表一样写入关卡定义，重复开局必然重现 */
export type EventPlan =
  | { time: number; kind: "notice"; text: string }
  | {
      time: number;
      kind: "surge";
      recipe: RecipeId;
      guest: string;
      patience: number;
    };

/** 组合目标：限时营业 + 净收益下限 + 浪费上限 + 满意度下限 */
export interface LevelGoals {
  timeLimit: number;
  minNet: number;
  maxWaste: number;
  minSatisfaction: number;
}

/** 一关的完整配置快照（开局时深拷贝冻结，之后编辑只影响下一局） */
export interface LevelSpec {
  stock: Record<Ingredient, number>;
  stoves: Array<"pan" | "pot">;
  customers: CustomerPlan[];
  events: EventPlan[];
  restockAllowed: boolean;
  seed: number;
  goals: LevelGoals;
}

export interface Level {
  id: string;
  name: string;
  builtin: boolean;
  /** 每次保存编辑 +1，结算按开局时的版本号标记 */
  version: number;
  spec: LevelSpec;
  /** 多条前置路线：任意一条路线内全部通关即解锁 */
  unlock: { routes: string[][] };
}

/** 结构化流水：正式成绩只由这些事件重算，与界面显示分无关 */
export type RunEvent =
  | { t: number; type: "prepare"; recipe: RecipeId; ingredient: Ingredient }
  | {
      t: number;
      type: "supply";
      ingredient: Ingredient;
      qty: number;
      amount: number;
    }
  | { t: number; type: "lift"; recipe: RecipeId; quality: number; elapsed: number }
  | {
      t: number;
      type: "serve";
      orderId: number;
      guest: string;
      recipe: RecipeId;
      quality: number;
      amount: number;
      combo: number;
    }
  | { t: number; type: "miss"; orderId: number; guest: string; amount: number }
  | { t: number; type: "waste"; label: string; amount: number }
  | { t: number; type: "leftover"; label: string; amount: number };

export interface GoalCheck {
  key: "minNet" | "maxWaste" | "minSatisfaction";
  label: string;
  target: number;
  actual: number;
  ok: boolean;
  /** 达成依据：由哪几笔流水推出结论 */
  detail: string;
}

/** 结算结果：全部字段由 recomputeResult 从流水重算得出 */
export interface RunResult {
  net: number;
  sales: number;
  supplyCost: number;
  wasteCost: number;
  missCost: number;
  served: number;
  missed: number;
  prepares: number;
  supplyQty: number;
  lifts: number;
  avgQuality: number;
  satisfaction: number;
  goals: GoalCheck[];
  passed: boolean;
}

/** 挂在 Game 上的挑战上下文：关卡快照 + 追加式流水 */
export interface ChallengeCtx {
  levelId: string;
  levelName: string;
  version: number;
  mode: RunMode;
  spec: LevelSpec;
  log: RunEvent[];
  nextCustomer: number;
  nextEvent: number;
  result: RunResult | null;
}
