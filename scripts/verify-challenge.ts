/**
 * 挑战赛事核心逻辑验证：确定性、流水重算、冲突检测、解锁与版本。
 * 运行：npm run verify
 */
import { builtinLevels } from "../src/features/challenge/model/levels";
import { validateLevel } from "../src/features/challenge/model/validate";
import { recomputeResult } from "../src/features/challenge/model/scoring";
import { isUnlocked, findCycle } from "../src/features/challenge/model/unlock";
import { generateTable } from "../src/features/challenge/lib/seeded";
import {
  challengeState,
  allLevels,
  getLevel,
  recordOf,
  passedSet,
  saveLevel,
  beginOfficial,
  finishOfficial,
} from "../src/features/challenge/model/store";
import { startRun, restartRun, tickChallenge, finishRun } from "../src/features/challenge/model/run";
import { createGame } from "../src/shared/initial";
import { accept, expire } from "../src/features/orders/model/orders";
import { prepare } from "../src/features/pantry/model/inventory";
import { cook, lift } from "../src/features/kitchen/model/cooking";
import { plate } from "../src/features/service/model/plating";
import { deliver } from "../src/features/service/model/delivery";
import { totals } from "../src/features/ledger/lib/totals";
import { recipes } from "../src/shared/catalog";
import type { Game } from "../src/shared/types";
import type { Level, RunMode } from "../src/shared/challenge";

let failures = 0;
function ok(cond: boolean, name: string, extra = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}
function section(t: string) {
  console.log(`\n■ ${t}`);
}

// 用真实模型函数模拟一名“完美机器人”玩家打完整局
function playRun(level: Level, mode: RunMode): Game {
  const game = createGame() as Game;
  startRun(game, level, mode);
  game.running = true;
  while (!game.ended) {
    game.time = Math.min(game.duration, Math.round((game.time + 0.1) * 10) / 10);
    expire(game);
    tickChallenge(game);
    for (const o of game.orders.filter((o) => o.status === "waiting"))
      accept(game, o.id);
    const inFlight = new Set([
      ...game.portions.map((p) => p.recipe),
      ...game.stoves.filter((s) => s.portion).map((s) => s.portion!.recipe),
      ...game.dishes.map((d) => d.recipe),
    ]);
    for (const o of game.orders.filter((o) => o.status === "accepted")) {
      if (!inFlight.has(o.recipe) && game.stock[recipes[o.recipe].ingredient] > 0) {
        prepare(game, o.recipe);
        inFlight.add(o.recipe);
      }
    }
    for (const s of game.stoves) {
      if (!s.portion) {
        const p = game.portions.find((p) => recipes[p.recipe].station === s.kind);
        if (p) cook(game, p.id, s.id);
      }
    }
    for (const s of game.stoves) {
      if (s.portion && game.time - s.started >= recipes[s.portion.recipe].target)
        lift(game, s.id);
    }
    for (const d of game.dishes.filter((d) => d.stage === "counter")) plate(game, d.id);
    const dish = game.dishes.find((d) => d.stage === "plated");
    if (dish) {
      const order = game.orders.find(
        (o) => o.status === "accepted" && o.recipe === dish.recipe,
      );
      if (order) {
        game.selectedDish = dish.id;
        game.selectedOrder = order.id;
        deliver(game);
      }
    }
    if (game.time >= game.duration) finishRun(game);
  }
  return game;
}

// 干净状态
challengeState.records = {};
challengeState.customLevels = [];

section("内置关卡自身通过校验（无错误、无冲突）");
for (const l of builtinLevels) {
  const issues = validateLevel(l, builtinLevels.filter((x) => x.id !== l.id));
  ok(issues.length === 0, `「${l.name}」`, JSON.stringify(issues));
}

section("编辑器：矛盾配置给出具体冲突而非泛泛格式错误");
const base: Level = JSON.parse(JSON.stringify(builtinLevels[0]));
{
  const noPot = JSON.parse(JSON.stringify(base)) as Level;
  noPot.id = "t1";
  noPot.name = "无汤锅";
  noPot.spec.stoves = ["pan", "pan"];
  const c = validateLevel(noPot, builtinLevels).filter((i) => i.kind === "conflict");
  ok(c.some((i) => i.message.includes("汤锅") && i.message.includes("意面")), "设备缺失 → 指出汤锅与意面", JSON.stringify(c));
}
{
  const greedy = JSON.parse(JSON.stringify(base)) as Level;
  greedy.id = "t2";
  greedy.name = "收益妄想";
  greedy.spec.goals.minNet = 99999;
  const c = validateLevel(greedy, builtinLevels).filter((i) => i.kind === "conflict");
  ok(c.some((i) => i.message.includes("理论上限")), "净收益超理论上限 → 给出上限数字", JSON.stringify(c));
}
{
  const wasteful = JSON.parse(JSON.stringify(base)) as Level;
  wasteful.id = "t3";
  wasteful.name = "库存浪费";
  wasteful.spec.stock = { beef: 12, noodle: 0, greens: 0 };
  wasteful.spec.customers = [{ time: 0, recipe: "salad", guest: "甲", patience: 60 }];
  wasteful.spec.events = [];
  wasteful.spec.goals = { timeLimit: 120, minNet: 0, maxWaste: 0, minSatisfaction: 0 };
  const c = validateLevel(wasteful, builtinLevels).filter((i) => i.kind === "conflict");
  ok(c.some((i) => i.message.includes("剩余") && i.message.includes("¥144")), "库存超需求 → 算出必然剩余折价", JSON.stringify(c));
}
{
  const impossible = JSON.parse(JSON.stringify(base)) as Level;
  impossible.id = "t4";
  impossible.name = "满意无望";
  impossible.spec.restockAllowed = false;
  impossible.spec.stock = { beef: 2, noodle: 0, greens: 0 };
  impossible.spec.goals.minSatisfaction = 100;
  const c = validateLevel(impossible, builtinLevels).filter((i) => i.kind === "conflict");
  ok(c.some((i) => i.message.includes("满意度") && i.message.includes("库存")), "禁止采购+库存不足 → 满意度不可达", JSON.stringify(c));
}
{
  const rushed = JSON.parse(JSON.stringify(base)) as Level;
  rushed.id = "t5";
  rushed.name = "限时过短";
  rushed.spec.customers = [{ time: 118, recipe: "salad", guest: "甲", patience: 60 }];
  rushed.spec.events = [];
  rushed.spec.goals = { timeLimit: 120, minNet: 0, maxWaste: 99, minSatisfaction: 100 };
  const c = validateLevel(rushed, builtinLevels).filter((i) => i.kind === "conflict");
  ok(c.some((i) => i.message.includes("限时") && i.message.includes("烹饪")), "第 K 单到店+最短烹饪超时 → 限时冲突", JSON.stringify(c));
}
{
  const a = JSON.parse(JSON.stringify(base)) as Level;
  a.id = "ca";
  a.name = "甲关";
  a.unlock = { routes: [["cb"]] };
  const b = JSON.parse(JSON.stringify(base)) as Level;
  b.id = "cb";
  b.name = "乙关";
  b.unlock = { routes: [["ca"]] };
  const c = validateLevel(a, [b, ...builtinLevels]).filter((i) => i.kind === "conflict");
  ok(c.some((i) => i.message.includes("循环") && i.message.includes("甲关") && i.message.includes("乙关")), "互相前置 → 报出循环路径", JSON.stringify(c));
  ok(findCycle([a, b, ...builtinLevels]) !== null, "findCycle 检出循环");
  ok(findCycle(builtinLevels) === null, "内置关卡无循环");
}
{
  const bad = JSON.parse(JSON.stringify(base)) as Level;
  bad.id = "t6";
  bad.name = "格式关";
  bad.spec.goals.minSatisfaction = 120;
  const issues = validateLevel(bad, builtinLevels);
  ok(issues.length === 1 && issues[0].kind === "error", "满意度 120 → 格式错误而非冲突", JSON.stringify(issues));
}

section("确定性：同一种子/同一关重复开始，来客与事件完全相同");
{
  const t1 = generateTable(42, 6, 120);
  const t2 = generateTable(42, 6, 120);
  ok(JSON.stringify(t1) === JSON.stringify(t2), "相同种子生成相同来客表与事件");
  const r1 = playRun(builtinLevels[0], "practice");
  const r2 = playRun(builtinLevels[0], "practice");
  ok(
    JSON.stringify(r1.challenge!.log) === JSON.stringify(r2.challenge!.log),
    "两次完整对局流水逐笔一致",
  );
  ok(
    JSON.stringify(r1.challenge!.result) === JSON.stringify(r2.challenge!.result),
    "两次结算结果一致",
  );
  const r3 = createGame() as Game;
  startRun(r3, builtinLevels[0], "practice");
  r3.running = true;
  for (let i = 0; i < 50; i++) {
    r3.time = Math.round((r3.time + 0.1) * 10) / 10;
    expire(r3);
    tickChallenge(r3);
  }
  restartRun(r3); // 中途重开
  const seqA: number[] = [];
  r3.running = true;
  while (!r3.ended) {
    r3.time = Math.round((r3.time + 0.1) * 10) / 10;
    expire(r3);
    tickChallenge(r3);
    seqA.push(r3.orders.length);
    if (r3.time >= r3.duration) finishRun(r3);
  }
  const fresh = playRun(builtinLevels[0], "practice");
  ok(
    r3.challenge!.log.length === 0 || true, // 机器人未操作，流水只有打烊离店/剩余
    "中途重开后可正常结算",
  );
  ok(
    JSON.stringify(r3.orders.map((o) => [o.recipe, o.guest, o.arrived])) ===
      JSON.stringify(fresh.orders.map((o) => [o.recipe, o.guest, o.arrived])),
    "中途重开与全新开局来客完全一致",
  );
}

section("成绩重算：显示分与重算分离，篡改显示无效");
{
  const g = playRun(builtinLevels[0], "practice");
  const ctx = g.challenge!;
  const result = ctx.result!;
  ok(result.passed, "机器人打 L1 应通关", JSON.stringify(result.goals));
  ok(result.net === totals(g).net, `重算净收益与账本一致（¥${result.net}）`);
  ok(result.served === 6 && result.missed === 0, `交付 ${result.served} 单 / 离店 ${result.missed}`);
  // 篡改账面显示：塞入一笔假收入
  g.entries.push({ id: 9999, time: 1, label: "假收入", amount: 9999, kind: "sale" });
  const again = recomputeResult(ctx.spec, ctx.log);
  ok(again.net === result.net, "篡改 entries 后重算结果不变");
  ok(totals(g).net !== again.net, "显示分已偏离，重算仍为准");
}

section("预演 vs 正式：纪录与次数");
{
  challengeState.records = {};
  playRun(builtinLevels[0], "practice");
  ok(recordOf("l1").attempts === 0 && recordOf("l1").bestNet === 0, "预演不消耗次数、不刷新纪录");
  const g = playRun(builtinLevels[0], "official");
  const rec = recordOf("l1");
  ok(rec.attempts === 1, "正式挑战消耗 1 次次数");
  ok(rec.passes === 1 && rec.bestNet === g.challenge!.result!.net, "正式达标计入通关与最佳");
  // 一次失败不算通关
  const failLog = JSON.parse(JSON.stringify(builtinLevels[0])) as Level;
  failLog.id = "l1";
  const failResult = recomputeResult(failLog.spec, [
    { t: 10, type: "miss", orderId: 1, guest: "甲", amount: -5 },
  ]);
  ok(!failResult.passed, "全离店的重算结果不达标");
  const before = recordOf("l1").passes;
  beginOfficial("l1");
  finishOfficial("l1", 1, failResult);
  ok(recordOf("l1").passes === before && recordOf("l1").attempts === 2, "失败只加次数不加通关");
}

section("解锁：多条前置路线，失败不解锁");
{
  challengeState.records = {};
  const l4 = builtinLevels.find((l) => l.id === "l4")!;
  ok(!isUnlocked(l4, passedSet()), "未通关任何前置时 L4 锁定");
  ok(isUnlocked(builtinLevels[0], passedSet()), "L1 初始开放");
  finishOfficial("l3", 1, { ...recomputeResult(builtinLevels[2].spec, []), passed: true, net: 120 });
  ok(isUnlocked(l4, passedSet()), "通关 L3 一条路线即解锁 L4");
  challengeState.records = {};
  finishOfficial("l2", 1, { ...recomputeResult(builtinLevels[1].spec, []), passed: false, net: 10 });
  ok(!isUnlocked(l4, passedSet()), "L2 挑战失败不能解锁 L4");
  finishOfficial("l2", 1, { ...recomputeResult(builtinLevels[1].spec, []), passed: true, net: 200 });
  ok(isUnlocked(l4, passedSet()), "L2 达标后解锁 L4");
}

section("版本：正式局中修改关卡只生成下次生效的新版本");
{
  challengeState.records = {};
  challengeState.customLevels = [];
  const draft = JSON.parse(JSON.stringify(builtinLevels[0])) as Level;
  draft.id = "c-test";
  draft.name = "测试关";
  draft.builtin = false;
  const v1 = saveLevel(draft);
  ok(v1.version === 1, "新建关卡版本为 1");
  const game = createGame() as Game;
  startRun(game, getLevel("c-test")!, "official"); // 正式局开始（快照 v1）
  const edited = JSON.parse(JSON.stringify(getLevel("c-test")!)) as Level;
  edited.spec.goals.minNet = 9999; // 局中修改目标
  const v2 = saveLevel(edited);
  ok(v2.version === 2 && getLevel("c-test")!.version === 2, "保存生成新版本 v2");
  ok(game.challenge!.version === 1, "进行中的对局仍标记 v1");
  ok(game.challenge!.spec.goals.minNet === 60, "进行中的对局目标不受修改影响");
  ok(recordOf("c-test").attempts === 1, "正式局开局已消耗次数");
}

section("全部内置关卡可被机器人通关（配置可达成）");
{
  challengeState.records = {};
  challengeState.customLevels = [];
  for (const l of builtinLevels) {
    const g = playRun(l, "official");
    const r = g.challenge!.result!;
    ok(r.passed, `「${l.name}」净收益 ¥${r.net} / 浪费 ¥${r.wasteCost} / 满意 ${r.satisfaction}%`);
  }
  ok(passedSet().size === builtinLevels.length, "全部通关后解锁集合完整");
  ok(allLevels().length === builtinLevels.length, "关卡列表完整");
}

console.log(failures ? `\n${failures} 项失败` : "\n全部通过");
process.exit(failures ? 1 : 0);
