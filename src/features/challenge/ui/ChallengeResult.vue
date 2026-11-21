<script setup lang="ts">
import { computed } from "vue";
import type { Game } from "../../../shared/types";
import { totals } from "../../ledger/lib/totals";
import { getLevel } from "../model/store";

const props = defineProps<{ game: Game }>();
const emit = defineEmits<{ retry: []; lobby: [] }>();

const ctx = computed(() => props.game.challenge);
const result = computed(() => ctx.value?.result ?? null);
const displayNet = computed(() => totals(props.game).net);
const newerVersion = computed(() => {
  const c = ctx.value;
  if (!c) return 0;
  const latest = getLevel(c.levelId);
  return latest && latest.version > c.version ? latest.version : 0;
});
</script>

<template>
  <div v-if="ctx && result" class="overlay">
    <section class="result settlement">
      <span class="eyebrow">CHALLENGE SETTLEMENT</span>
      <div class="settle-head">
        <span class="pill" :class="ctx.mode === 'practice' ? 'soft-pill' : 'official-pill'">
          {{ ctx.mode === "practice" ? "预演 · 不计入纪录" : "正式挑战" }}
        </span>
        <span class="pill">版本 v{{ ctx.version }}</span>
      </div>
      <h2>{{ ctx.levelName }} · {{ result.passed ? "挑战成功" : "未达标" }}</h2>
      <p v-if="newerVersion" class="muted">
        本局按开局快照 v{{ ctx.version }} 结算；已保存的新版本 v{{ newerVersion }} 将在下次挑战生效。
      </p>
      <p v-if="ctx.mode === 'practice'" class="muted">
        预演成绩不刷新纪录、不消耗正式挑战次数。
      </p>

      <div class="settle-grid">
        <div><small>交付流水</small><b>¥{{ result.sales }}</b><span>{{ result.served }} 单交付</span></div>
        <div><small>食材消耗</small><b>{{ result.prepares }} 份</b><span>采购 {{ result.supplyQty }} 份 · ¥{{ result.supplyCost }}</span></div>
        <div><small>火候</small><b>{{ result.avgQuality }}</b><span>{{ result.lifts }} 次起锅平均品质</span></div>
        <div><small>浪费</small><b class="red">¥{{ result.wasteCost }}</b><span>丢弃与剩余折价</span></div>
        <div><small>订单</small><b>{{ result.served }} / {{ result.missed }}</b><span>交付 / 离店 · 流失 ¥{{ result.missCost }}</span></div>
        <div><small>满意度</small><b>{{ result.satisfaction }}%</b><span>按上菜品质与离店折算</span></div>
      </div>

      <div class="goal-list">
        <div v-for="g in result.goals" :key="g.key" class="goal-row" :class="{ fail: !g.ok }">
          <span class="goal-mark">{{ g.ok ? "✓" : "✗" }}</span>
          <div>
            <b>{{ g.label }}：{{ g.key === "minSatisfaction" ? `${g.actual}% / 目标 ${g.target}%` : `¥${g.actual} / 目标 ¥${g.target}` }}</b>
            <small>{{ g.detail }}</small>
          </div>
        </div>
      </div>

      <p class="recompute-note">
        账面显示 ¥{{ displayNet }} · 流水重算 <b>¥{{ result.net }}</b>（以此为准）——
        成绩由实际订单、食材消耗、火候与交付流水重算，仅修改显示分无法过关。
      </p>

      <div class="settle-actions">
        <button @click="emit('retry')">再来一次（相同来客）</button>
        <button class="outline" @click="emit('lobby')">返回赛事大厅</button>
      </div>
    </section>
  </div>
</template>
