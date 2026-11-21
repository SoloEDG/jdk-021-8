import type { Game } from "../../../shared/types";
import type { Level, RunMode } from "../../../shared/challenge";
import { createGame } from "../../../shared/initial";
import { readBest } from "../../ledger/model/shift";
import { ingredients, recipes } from "../../../shared/catalog";
import { recomputeResult } from "./scoring";
import { beginOfficial, finishOfficial } from "./store";

type LevelRef = Pick<Level, "id" | "name" | "version" | "spec">;

function cloneSpec(spec: Level["spec"]): Level["spec"] {
  // 关卡可能来自响应式状态，JSON 深拷贝得到纯净快照
  return JSON.parse(JSON.stringify(spec));
}

/**
 * 开始一局挑战：把关卡定义深拷贝为快照挂在 game.challenge 上。
 * 之后无论在编辑器里怎么改，本局来客、事件、目标都不变；
 * 修改只以新版本号在下一局生效。
 */
export function startRun(game: Game, level: LevelRef, mode: RunMode) {
  const spec = cloneSpec(level.spec);
  Object.assign(game, createGame(readBest()));
  game.duration = spec.goals.timeLimit;
  game.orders = [];
  game.nextId = 1;
  game.stock = { ...spec.stock };
  game.stoves = spec.stoves.map((kind, i) => ({
    id: i + 1,
    kind,
    portion: null,
    started: 0,
  }));
  game.challenge = {
    levelId: level.id,
    levelName: level.name,
    version: level.version,
    mode,
    spec,
    log: [],
    nextCustomer: 0,
    nextEvent: 0,
    result: null,
  };
  game.notice =
    mode === "practice"
      ? `预演「${level.name}」：成绩不计入纪录，放心练手。`
      : `正式挑战「${level.name}」v${level.version}：成绩将按流水重算并计入纪录。`;
  if (mode === "official") beginOfficial(level.id);
}

/** 重复开始同一关：使用同一份快照，来客与事件完全相同 */
export function restartRun(game: Game) {
  const ctx = game.challenge;
  if (!ctx) return;
  startRun(
    game,
    { id: ctx.levelId, name: ctx.levelName, version: ctx.version, spec: ctx.spec },
    ctx.mode,
  );
}

/** 每个时钟步：按来客表与事件表放行进店，顺序完全由关卡定义决定 */
export function tickChallenge(game: Game) {
  const ctx = game.challenge;
  if (!ctx) return;
  const { customers, events } = ctx.spec;
  while (
    ctx.nextCustomer < customers.length &&
    customers[ctx.nextCustomer].time <= game.time
  ) {
    const c = customers[ctx.nextCustomer++];
    game.orders.push({
      id: game.nextId++,
      recipe: c.recipe,
      guest: c.guest,
      arrived: game.time,
      deadline: game.time + c.patience,
      status: "waiting",
    });
  }
  while (
    ctx.nextEvent < events.length &&
    events[ctx.nextEvent].time <= game.time
  ) {
    const ev = events[ctx.nextEvent++];
    if (ev.kind === "notice") {
      game.notice = ev.text;
    } else {
      game.orders.push({
        id: game.nextId++,
        recipe: ev.recipe,
        guest: ev.guest,
        arrived: game.time,
        deadline: game.time + ev.patience,
        status: "waiting",
      });
      game.notice = `${ev.guest} 临时加单！`;
    }
  }
}

/**
 * 打烊结算：未结订单按离店处理，剩余食材折价计入浪费，
 * 然后只根据流水重算成绩——界面显示分不参与判定。
 */
export function finishRun(game: Game) {
  const ctx = game.challenge;
  if (!ctx || ctx.result) return;
  for (const o of game.orders) {
    if (o.status === "waiting" || o.status === "accepted") {
      o.status = "left";
      game.missed++;
      game.combo = 0;
      game.entries.push({
        id: game.nextId++,
        time: game.time,
        label: `${o.guest} 打烊离店`,
        amount: -5,
        kind: "miss",
      });
      ctx.log.push({ t: game.time, type: "miss", orderId: o.id, guest: o.guest, amount: -5 });
    }
  }
  const leftover = (label: string, amount: number) => {
    game.entries.push({ id: game.nextId++, time: game.time, label, amount, kind: "waste" });
    ctx.log.push({ t: game.time, type: "leftover", label, amount });
  };
  for (const key of ["beef", "noodle", "greens"] as const) {
    const qty = game.stock[key];
    if (qty > 0) leftover(`剩余${ingredients[key].name}×${qty}`, -qty * ingredients[key].cost);
  }
  if (game.portions.length) {
    const cost = game.portions.reduce(
      (s, p) => s + ingredients[recipes[p.recipe].ingredient].cost,
      0,
    );
    leftover(`未下锅备料×${game.portions.length}`, -cost);
  }
  if (game.dishes.length) {
    const cost = game.dishes.reduce(
      (s, d) => s + ingredients[recipes[d.recipe].ingredient].cost,
      0,
    );
    leftover(`未出餐菜品×${game.dishes.length}`, -cost);
  }
  game.portions = [];
  game.dishes = [];
  game.stoves.forEach((s) => (s.portion = null));
  ctx.result = recomputeResult(ctx.spec, ctx.log);
  if (ctx.mode === "official") finishOfficial(ctx.levelId, ctx.version, ctx.result);
  game.running = false;
  game.ended = true;
  game.notice = ctx.result.passed
    ? `挑战成功！净收益 ¥${ctx.result.net}，全部目标达成。`
    : "挑战结束，仍有目标未达成，查看结算明细。";
}
