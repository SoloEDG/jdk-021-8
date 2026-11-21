import type { Level, LevelSpec } from "../../../shared/challenge";
import type { RecipeId, Ingredient } from "../../../shared/types";
import { recipes, ingredients } from "../../../shared/catalog";
import { findCycle } from "./unlock";

export interface Issue {
  kind: "error" | "conflict";
  message: string;
}

const RECIPE_IDS: RecipeId[] = ["steak", "pasta", "salad"];
const MIN_COOK = Math.min(...RECIPE_IDS.map((r) => recipes[r].target));

/** 连击奖励上限：第 i 单（1 起）奖励 min(10, (i-1)*2) */
function maxComboSum(n: number) {
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += Math.min(10, (i - 1) * 2);
  return sum;
}

/** 来客表 + 加单事件中的全部客人 */
function allGuests(spec: LevelSpec) {
  const surge = spec.events
    .filter((e) => e.kind === "surge")
    .map((e) => ({ time: e.time, recipe: (e as { recipe: RecipeId }).recipe }));
  return [
    ...spec.customers.map((c) => ({ time: c.time, recipe: c.recipe })),
    ...surge,
  ];
}

/**
 * 校验关卡：先报格式错误，再做资源/逻辑推演给出具体冲突。
 * 冲突信息必须指出哪项目标、缺什么资源、差多少，而不是一句“不合法”。
 */
export function validateLevel(draft: Level, others: Level[]): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ kind: "error", message });
  const conflict = (message: string) => issues.push({ kind: "conflict", message });
  const { spec } = draft;
  const { goals } = spec;

  // ---- 格式错误 ----
  if (!draft.name.trim()) err("关卡名称不能为空");
  if (!Number.isFinite(goals.timeLimit) || goals.timeLimit < 30)
    err("营业限时至少 30 秒");
  for (const key of ["beef", "noodle", "greens"] as const) {
    const v = spec.stock[key];
    if (!Number.isInteger(v) || v < 0) err(`初始库存「${ingredients[key].name}」必须是非负整数`);
    else if (v > 12) err(`初始库存「${ingredients[key].name}」超过上限 12 份`);
  }
  const pans = spec.stoves.filter((s) => s === "pan").length;
  const pots = spec.stoves.filter((s) => s === "pot").length;
  if (pans + pots === 0) err("至少需要一台设备（煎锅或汤锅）");
  if (pans + pots > 4) err("设备总数最多 4 台，厨房放不下更多");
  if (goals.minNet < 0) err("净收益目标不能为负");
  if (!Number.isInteger(goals.maxWaste) || goals.maxWaste < 0)
    err("浪费上限必须是非负整数");
  if (goals.minSatisfaction < 0 || goals.minSatisfaction > 100)
    err("满意度目标必须在 0–100 之间");
  spec.customers.forEach((c, i) => {
    if (!RECIPE_IDS.includes(c.recipe)) err(`来客表第 ${i + 1} 行菜品未知`);
    if (c.time < 0 || c.time >= goals.timeLimit)
      err(`来客表第 ${i + 1} 行（${c.guest}）${c.time} 秒到店，但 ${goals.timeLimit} 秒已打烊，永远无法出餐`);
    if (c.patience < 15) err(`来客表第 ${i + 1} 行客人耐心至少 15 秒，否则无人能完成`);
    if (!c.guest.trim()) err(`来客表第 ${i + 1} 行缺少客人称呼`);
  });
  for (const e of spec.events) {
    if (e.time < 0 || e.time >= goals.timeLimit)
      err(`事件（${e.time} 秒）排在营业限时之外，永远不会触发`);
  }
  const known = new Set(others.map((l) => l.id));
  draft.unlock.routes.forEach((route, i) => {
    if (route.length === 0) err(`第 ${i + 1} 条解锁路线为空，请至少选择一个前置关卡`);
    for (const id of route) {
      if (id === draft.id) err(`第 ${i + 1} 条解锁路线包含关卡自身`);
      else if (!known.has(id)) err(`第 ${i + 1} 条解锁路线引用了不存在的关卡 ${id}`);
    }
  });
  if (issues.length) return issues; // 格式都站不住时，资源推演没有意义

  // ---- 资源 / 逻辑冲突 ----
  const guests = allGuests(spec);
  const total = guests.length;
  if (total === 0) {
    if (goals.minNet > 0 || goals.minSatisfaction > 0)
      conflict("来客表为空，却要求净收益或满意度目标——没有客人就没有任何收入来源");
    return issues;
  }

  // 设备冲突：某道菜没有任何对应设备
  const stationCount = { pan: pans, pot: pots };
  const unservable = new Map<RecipeId, number>();
  for (const g of guests) {
    const st = recipes[g.recipe].station;
    if (stationCount[st] === 0)
      unservable.set(g.recipe, (unservable.get(g.recipe) ?? 0) + 1);
  }
  for (const [r, n] of unservable) {
    conflict(
      `来客表中有 ${n} 位客人点「${recipes[r].name}」，但设备中没有${recipes[r].station === "pan" ? "煎锅" : "汤锅"}，这些订单永远无法出餐`,
    );
  }
  const servableGuests = guests.filter(
    (g) => stationCount[recipes[g.recipe].station] > 0,
  );

  // 食材需求与库存
  const need: Record<Ingredient, number> = { beef: 0, noodle: 0, greens: 0 };
  for (const g of servableGuests) need[recipes[g.recipe].ingredient]++;
  const ingredientKeys: Ingredient[] = ["beef", "noodle", "greens"];

  // 理论最高净收益：全部可出餐客人按满品质交付 + 连击上限 − 必要采购
  let serveCount = servableGuests.length;
  let maxSales = 0;
  let supplyCost = 0;
  if (spec.restockAllowed) {
    maxSales = servableGuests.reduce((s, g) => s + recipes[g.recipe].price, 0);
    for (const key of ingredientKeys) {
      supplyCost +=
        Math.max(0, need[key] - spec.stock[key]) * ingredients[key].cost;
    }
  } else {
    // 禁止采购：按库存贪心挑选售价最高的订单
    const left = { ...spec.stock };
    const priced = [...servableGuests].sort(
      (a, b) => recipes[b.recipe].price - recipes[a.recipe].price,
    );
    serveCount = 0;
    for (const g of priced) {
      const ing = recipes[g.recipe].ingredient;
      if (left[ing] > 0) {
        left[ing]--;
        serveCount++;
        maxSales += recipes[g.recipe].price;
      }
    }
  }
  const maxNet = maxSales + maxComboSum(serveCount) - supplyCost;
  if (goals.minNet > maxNet) {
    const why = spec.restockAllowed
      ? `满客交付 ¥${maxSales} + 连击上限 ¥${maxComboSum(serveCount)} − 补足食材采购 ¥${supplyCost}`
      : `禁止采购，初始库存最多支撑 ${serveCount} 单，满品质交付 ¥${maxSales} + 连击上限 ¥${maxComboSum(serveCount)}`;
    conflict(
      `净收益目标 ¥${goals.minNet} 超过理论上限 ¥${maxNet}（${why}），任何操作都无法达成`,
    );
  }

  // 浪费下限：库存超出来客需求的部分打烊时必然剩余
  let minWaste = 0;
  const leftoverParts: string[] = [];
  for (const key of ingredientKeys) {
    const excess = spec.stock[key] - need[key];
    if (excess > 0) {
      minWaste += excess * ingredients[key].cost;
      leftoverParts.push(`${ingredients[key].name}×${excess}`);
    }
  }
  if (minWaste > goals.maxWaste) {
    conflict(
      `初始库存超出来客需求（${leftoverParts.join("、")}），打烊至少剩余折价 ¥${minWaste}，超过浪费上限 ¥${goals.maxWaste}——请减少初始库存或放宽浪费目标`,
    );
  }

  // 满意度可达性：需要 K 单满品质交付
  const needServe = Math.ceil((goals.minSatisfaction / 100) * total);
  if (serveCount < needServe) {
    const stockSum = spec.stock.beef + spec.stock.noodle + spec.stock.greens;
    const bottleneck = spec.restockAllowed
      ? `设备可出餐的订单只有 ${serveCount} 单`
      : `禁止采购且初始库存仅 ${stockSum} 份，最多出餐 ${serveCount} 单`;
    conflict(
      `满意度 ${goals.minSatisfaction}% 要求 ${total} 位客人中至少交付 ${needServe} 单，但${bottleneck}`,
    );
  } else {
    // 时间可达性：第 K 位可出餐客人到店 + 最短烹饪时间，不能超过打烊
    const arrivals = servableGuests.map((g) => g.time).sort((a, b) => a - b);
    const kth = arrivals[needServe - 1];
    if (kth !== undefined && kth + MIN_COOK > goals.timeLimit) {
      conflict(
        `限时 ${goals.timeLimit} 秒过短：达成满意度所需的第 ${needServe} 单最早 ${kth} 秒才到店，加上最短烹饪 ${MIN_COOK} 秒必然超时`,
      );
    }
  }

  // 解锁循环
  const cycle = findCycle([draft, ...others]);
  if (cycle) {
    const name = (id: string) =>
      [draft, ...others].find((l) => l.id === id)?.name ?? id;
    conflict(`解锁关系存在循环：${cycle.map(name).join(" → ")}，这些关卡将永远无法解锁`);
  }
  return issues;
}
