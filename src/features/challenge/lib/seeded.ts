import type { CustomerPlan, EventPlan } from "../../../shared/challenge";
import type { RecipeId } from "../../../shared/types";

/** mulberry32：同一种子必然得到同一序列，用于编辑器生成可复现的来客表 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GUESTS = ["阿宁", "许小姐", "赵先生", "晓晴", "林小姐", "周先生", "小陈", "老吴"];
const RECIPES: RecipeId[] = ["steak", "pasta", "salad"];

/**
 * 由种子确定性生成来客表与事件。
 * 相同 (seed, count, duration) 永远得到相同结果，生成后写入关卡定义。
 */
export function generateTable(seed: number, count: number, duration: number) {
  const rand = mulberry32(seed);
  const customers: CustomerPlan[] = [];
  const span = Math.max(30, duration * 0.72);
  for (let i = 0; i < count; i++) {
    const time = Math.round((i * span) / Math.max(1, count) + rand() * 8);
    customers.push({
      time,
      recipe: RECIPES[Math.floor(rand() * RECIPES.length)],
      guest: GUESTS[Math.floor(rand() * GUESTS.length)],
      patience: 50 + Math.floor(rand() * 25),
    });
  }
  customers.sort((a, b) => a.time - b.time);
  const events: EventPlan[] = [
    { time: Math.round(duration * 0.4), kind: "notice", text: "午市高峰将至，提前备料！" },
  ];
  if (count >= 4) {
    events.push({
      time: Math.round(duration * 0.62),
      kind: "surge",
      recipe: RECIPES[Math.floor(rand() * RECIPES.length)],
      guest: GUESTS[Math.floor(rand() * GUESTS.length)],
      patience: 55,
    });
  }
  return { customers, events };
}
