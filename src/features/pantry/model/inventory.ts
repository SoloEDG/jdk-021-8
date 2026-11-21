import type { Game, RecipeId, Ingredient } from "../../../shared/types";
import { recipes, ingredients } from "../../../shared/catalog";
import { preparationIssue } from "../lib/availability";
export function prepare(g: Game, r: RecipeId) {
  const issue = preparationIssue(g, r);
  if (issue) {
    g.notice = issue;
    return;
  }
  g.stock[recipes[r].ingredient]--;
  g.portions.push({ id: g.nextId++, recipe: r, preparedAt: g.time });
  g.challenge?.log.push({
    t: g.time,
    type: "prepare",
    recipe: r,
    ingredient: recipes[r].ingredient,
  });
  g.notice = `${recipes[r].name} 备料完成，可送入灶台`;
}
export function restock(g: Game, i: Ingredient) {
  if (g.challenge && !g.challenge.spec.restockAllowed) {
    g.notice = "本关禁止采购，只能使用初始库存";
    return;
  }
  if (g.stock[i] >= 12) {
    g.notice = "库存充足，上限12份";
    return;
  }
  g.stock[i] = Math.min(12, g.stock[i] + 3);
  g.entries.push({
    id: g.nextId++,
    time: g.time,
    label: `采购${ingredients[i].name} ×3`,
    amount: -ingredients[i].cost * 3,
    kind: "supply",
  });
  g.challenge?.log.push({
    t: g.time,
    type: "supply",
    ingredient: i,
    qty: 3,
    amount: -ingredients[i].cost * 3,
  });
  g.notice = "已购入3份食材，费用计入账本";
}
