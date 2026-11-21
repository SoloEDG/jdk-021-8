import type { Level } from "../../../shared/challenge";

/**
 * 内置赛事。来客表与事件全部写死在关卡定义里，
 * 同一关重复开始必然得到相同来客和事件。
 */
export const builtinLevels: Level[] = [
  {
    id: "l1",
    name: "开门小考",
    builtin: true,
    version: 1,
    unlock: { routes: [] },
    spec: {
      stock: { beef: 3, noodle: 3, greens: 3 },
      stoves: ["pan", "pan", "pot"],
      restockAllowed: true,
      seed: 101,
      customers: [
        { time: 0, recipe: "steak", guest: "林小姐", patience: 65 },
        { time: 0, recipe: "salad", guest: "小陈", patience: 60 },
        { time: 15, recipe: "pasta", guest: "周先生", patience: 60 },
        { time: 30, recipe: "salad", guest: "晓晴", patience: 55 },
        { time: 45, recipe: "steak", guest: "阿宁", patience: 60 },
        { time: 60, recipe: "pasta", guest: "许小姐", patience: 65 },
      ],
      events: [
        { time: 50, kind: "notice", text: "午市高峰将至，提前备料！" },
      ],
      goals: { timeLimit: 120, minNet: 60, maxWaste: 40, minSatisfaction: 50 },
    },
  },
  {
    id: "l2",
    name: "火候试炼",
    builtin: true,
    version: 1,
    unlock: { routes: [["l1"]] },
    spec: {
      stock: { beef: 4, noodle: 3, greens: 4 },
      stoves: ["pan", "pan", "pot"],
      restockAllowed: true,
      seed: 202,
      customers: [
        { time: 0, recipe: "steak", guest: "老吴", patience: 60 },
        { time: 10, recipe: "pasta", guest: "林小姐", patience: 60 },
        { time: 20, recipe: "salad", guest: "小陈", patience: 55 },
        { time: 35, recipe: "steak", guest: "周先生", patience: 60 },
        { time: 50, recipe: "pasta", guest: "晓晴", patience: 60 },
        { time: 65, recipe: "salad", guest: "阿宁", patience: 55 },
        { time: 80, recipe: "steak", guest: "许小姐", patience: 60 },
        { time: 95, recipe: "pasta", guest: "赵先生", patience: 65 },
      ],
      events: [
        { time: 60, kind: "notice", text: "客流高峰，注意火候！" },
        { time: 100, kind: "surge", recipe: "salad", guest: "老主顾", patience: 55 },
      ],
      goals: { timeLimit: 150, minNet: 150, maxWaste: 30, minSatisfaction: 60 },
    },
  },
  {
    id: "l3",
    name: "精打细算",
    builtin: true,
    version: 1,
    unlock: { routes: [["l1"]] },
    spec: {
      stock: { beef: 2, noodle: 3, greens: 1 },
      stoves: ["pan", "pot"],
      restockAllowed: false,
      seed: 303,
      customers: [
        { time: 0, recipe: "steak", guest: "林小姐", patience: 65 },
        { time: 15, recipe: "pasta", guest: "周先生", patience: 60 },
        { time: 25, recipe: "salad", guest: "小陈", patience: 55 },
        { time: 40, recipe: "pasta", guest: "阿宁", patience: 60 },
        { time: 55, recipe: "steak", guest: "许小姐", patience: 60 },
        { time: 70, recipe: "pasta", guest: "晓晴", patience: 65 },
      ],
      events: [
        { time: 40, kind: "notice", text: "本关禁止采购，省着点用！" },
      ],
      goals: { timeLimit: 120, minNet: 100, maxWaste: 10, minSatisfaction: 60 },
    },
  },
  {
    id: "l4",
    name: "午市大满贯",
    builtin: true,
    version: 1,
    // 多条前置路线：通关「火候试炼」或「精打细算」任一即可解锁
    unlock: { routes: [["l2"], ["l3"]] },
    spec: {
      stock: { beef: 5, noodle: 5, greens: 6 },
      stoves: ["pan", "pan", "pot", "pot"],
      restockAllowed: true,
      seed: 404,
      customers: [
        { time: 0, recipe: "steak", guest: "老吴", patience: 60 },
        { time: 12, recipe: "pasta", guest: "林小姐", patience: 60 },
        { time: 24, recipe: "salad", guest: "小陈", patience: 55 },
        { time: 36, recipe: "steak", guest: "周先生", patience: 60 },
        { time: 48, recipe: "pasta", guest: "晓晴", patience: 60 },
        { time: 60, recipe: "salad", guest: "阿宁", patience: 55 },
        { time: 75, recipe: "steak", guest: "许小姐", patience: 60 },
        { time: 90, recipe: "pasta", guest: "赵先生", patience: 65 },
        { time: 105, recipe: "salad", guest: "晓晴", patience: 55 },
        { time: 120, recipe: "steak", guest: "老主顾", patience: 60 },
      ],
      events: [
        { time: 55, kind: "notice", text: "大满贯高峰，全线开火！" },
        { time: 135, kind: "surge", recipe: "pasta", guest: "美食评论家", patience: 60 },
        { time: 150, kind: "surge", recipe: "salad", guest: "路过的旅人", patience: 55 },
      ],
      goals: { timeLimit: 180, minNet: 260, maxWaste: 45, minSatisfaction: 70 },
    },
  },
];
