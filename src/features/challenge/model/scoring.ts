import type { LevelSpec, RunEvent, RunResult, GoalCheck } from "../../../shared/challenge";

/**
 * 正式成绩唯一来源：从结构化流水（订单、食材消耗、火候、交付记录）重算。
 * 界面上的显示分不参与判定，修改显示分无法通过本函数。
 */
export function recomputeResult(spec: LevelSpec, log: RunEvent[]): RunResult {
  let sales = 0,
    supplyCost = 0,
    wasteCost = 0,
    missCost = 0,
    served = 0,
    missed = 0,
    prepares = 0,
    supplyQty = 0,
    lifts = 0,
    qualitySum = 0,
    serveQualitySum = 0;
  for (const e of log) {
    switch (e.type) {
      case "serve":
        sales += e.amount;
        served++;
        serveQualitySum += e.quality;
        break;
      case "supply":
        supplyCost -= e.amount;
        supplyQty += e.qty;
        break;
      case "waste":
      case "leftover":
        wasteCost -= e.amount;
        break;
      case "miss":
        missCost -= e.amount;
        missed++;
        break;
      case "prepare":
        prepares++;
        break;
      case "lift":
        lifts++;
        qualitySum += e.quality;
        break;
    }
  }
  const net = sales - supplyCost - wasteCost - missCost;
  const resolved = served + missed;
  // 满意度：已交付客人按上菜时品质计分，离店客人计 0
  const satisfaction = resolved ? Math.round(serveQualitySum / resolved) : 100;
  const avgQuality = lifts ? Math.round(qualitySum / lifts) : 0;
  const { goals } = spec;
  const checks: GoalCheck[] = [
    {
      key: "minNet",
      label: "净收益",
      target: goals.minNet,
      actual: net,
      ok: net >= goals.minNet,
      detail: `交付流水 ¥${sales} − 采购 ¥${supplyCost} − 浪费 ¥${wasteCost} − 流失 ¥${missCost} = ¥${net}`,
    },
    {
      key: "maxWaste",
      label: "浪费上限",
      target: goals.maxWaste,
      actual: wasteCost,
      ok: wasteCost <= goals.maxWaste,
      detail: `丢弃菜品与打烊剩余食材折价合计 ¥${wasteCost}`,
    },
    {
      key: "minSatisfaction",
      label: "满意度",
      target: goals.minSatisfaction,
      actual: satisfaction,
      ok: satisfaction >= goals.minSatisfaction,
      detail: `${served} 单按上菜品质计分、${missed} 位离店计 0，平均 ${satisfaction}%`,
    },
  ];
  return {
    net,
    sales,
    supplyCost,
    wasteCost,
    missCost,
    served,
    missed,
    prepares,
    supplyQty,
    lifts,
    avgQuality,
    satisfaction,
    goals: checks,
    passed: checks.every((c) => c.ok),
  };
}
