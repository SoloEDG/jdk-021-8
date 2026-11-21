<script setup lang="ts">
import { computed } from "vue";
import type { Level, RunMode } from "../../../shared/challenge";
import {
  allLevels,
  challengeState,
  recordOf,
  passedSet,
  deleteLevel,
} from "../model/store";
import { isUnlocked, routeStatus, findCycle } from "../model/unlock";

const emit = defineEmits<{
  run: [level: Level, mode: RunMode];
  edit: [level: Level];
  copy: [level: Level];
  create: [];
}>();

const levels = computed(() => allLevels());
const passed = computed(() => {
  void challengeState.records; // 依赖响应式记录
  return passedSet();
});
const cycle = computed(() => findCycle(levels.value));
const nameOf = (id: string) => levels.value.find((l) => l.id === id)?.name ?? id;

function goalsText(l: Level) {
  const g = l.spec.goals;
  return `限时 ${g.timeLimit}s · 净收益≥¥${g.minNet} · 浪费≤¥${g.maxWaste} · 满意度≥${g.minSatisfaction}%`;
}
function setupText(l: Level) {
  const pans = l.spec.stoves.filter((s) => s === "pan").length;
  const pots = l.spec.stoves.filter((s) => s === "pot").length;
  const stock = l.spec.stock;
  return `煎锅×${pans} 汤锅×${pots} · 库存 ${stock.beef}/${stock.noodle}/${stock.greens} · ${l.spec.customers.length} 位来客${l.spec.restockAllowed ? "" : " · 禁止采购"}`;
}
</script>

<template>
  <section class="lobby">
    <div class="section-heading">
      <div>
        <span class="eyebrow">CHALLENGE CIRCUIT</span>
        <h2>本地挑战赛事</h2>
      </div>
      <button class="outline" @click="emit('create')">＋ 新建关卡</button>
    </div>
    <p class="muted">
      每关限定初始库存、来客表、设备与胜利条件；可先预演再正式挑战。正式成绩由订单、食材、火候与交付流水重算，重复开局来客与事件完全相同。
    </p>
    <div v-if="cycle" class="cycle-warning">
      ⚠ 解锁关系存在循环：{{ cycle.map(nameOf).join(" → ") }}，相关关卡无法解锁，请在编辑器中修正。
    </div>
    <div class="level-grid">
      <article
        v-for="l in levels"
        :key="l.id"
        class="level-card"
        :class="{ locked: !isUnlocked(l, passed) }"
      >
        <div class="level-head">
          <b>{{ l.name }}</b>
          <span class="pill">v{{ l.version }}</span>
          <span class="pill soft-pill">{{ l.builtin ? "内置" : "自定义" }}</span>
        </div>
        <p class="muted">{{ goalsText(l) }}</p>
        <p class="muted">{{ setupText(l) }}</p>
        <div class="record-row">
          <template v-if="recordOf(l.id).attempts">
            最佳 <b>¥{{ recordOf(l.id).bestNet }}</b>（v{{ recordOf(l.id).bestVersion }}）·
            正式 {{ recordOf(l.id).attempts }} 次 · 通关 {{ recordOf(l.id).passes }} 次
          </template>
          <template v-else>尚无正式挑战纪录</template>
        </div>
        <div v-if="!isUnlocked(l, passed)" class="lock-routes">
          <span>🔒 解锁路线：</span>
          <span
            v-for="(r, i) in routeStatus(l, passed)"
            :key="i"
            class="route"
            :class="{ done: r.done }"
          >
            {{ r.ids.map(nameOf).join(" + ") }}
          </span>
        </div>
        <div v-else-if="l.unlock.routes.length" class="lock-routes open">
          ✓ 已解锁（{{ routeStatus(l, passed).filter((r) => r.done).length || 1 }} 条路线可达）
        </div>
        <div class="level-actions">
          <button
            class="soft"
            :disabled="!isUnlocked(l, passed)"
            @click="emit('run', l, 'practice')"
          >
            预演
          </button>
          <button
            :disabled="!isUnlocked(l, passed)"
            @click="emit('run', l, 'official')"
          >
            正式挑战
          </button>
          <button v-if="l.builtin" class="outline" @click="emit('copy', l)">
            复制编辑
          </button>
          <button v-else class="outline" @click="emit('edit', l)">编辑</button>
          <button
            v-if="!l.builtin"
            class="trash"
            aria-label="删除关卡"
            @click="deleteLevel(l.id)"
          >
            ×
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
