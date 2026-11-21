<script setup lang="ts">
import { reactive, computed, ref } from "vue";
import type { Level, CustomerPlan } from "../../../shared/challenge";
import type { RecipeId } from "../../../shared/types";
import { recipeList } from "../../../shared/catalog";
import { allLevels } from "../model/store";
import { validateLevel } from "../model/validate";
import { generateTable } from "../lib/seeded";

const props = defineProps<{ source: Level | null; keepId: boolean }>();
const emit = defineEmits<{ save: [draft: Level]; cancel: [] }>();

function blankLevel(): Level {
  return {
    id: `c${Date.now()}`,
    name: "",
    builtin: false,
    version: 1,
    unlock: { routes: [] },
    spec: {
      stock: { beef: 3, noodle: 3, greens: 3 },
      stoves: ["pan", "pan", "pot"],
      customers: [],
      events: [],
      restockAllowed: true,
      seed: Math.floor(Math.random() * 9000) + 1000,
      goals: { timeLimit: 120, minNet: 60, maxWaste: 40, minSatisfaction: 50 },
    },
  };
}

const draft: Level = reactive(
  props.source
    ? (JSON.parse(JSON.stringify(props.source)) as Level)
    : blankLevel(),
);
if (!props.keepId) draft.id = `c${Date.now()}`;
// 自定义关卡之间才允许设置前置；内置关卡永远初始开放或固定路线
const others = computed(() => allLevels().filter((l) => l.id !== draft.id));

const panCount = computed({
  get: () => draft.spec.stoves.filter((s) => s === "pan").length,
  set: (n: number) => setStoves(n, potCount.value),
});
const potCount = computed({
  get: () => draft.spec.stoves.filter((s) => s === "pot").length,
  set: (n: number) => setStoves(panCount.value, n),
});
function setStoves(pans: number, pots: number) {
  const clamp = (v: number) => Math.max(0, Math.min(3, Math.floor(v) || 0));
  draft.spec.stoves = [
    ...Array<"pan">(clamp(pans)).fill("pan"),
    ...Array<"pot">(clamp(pots)).fill("pot"),
  ];
}

const genSeed = ref(draft.spec.seed);
const genCount = ref(6);
function regenerate() {
  const { customers, events } = generateTable(
    Math.floor(genSeed.value) || 1,
    Math.max(1, Math.min(14, Math.floor(genCount.value) || 1)),
    draft.spec.goals.timeLimit,
  );
  draft.spec.customers = customers;
  draft.spec.events = events;
  draft.spec.seed = Math.floor(genSeed.value) || 1;
}

function addCustomer() {
  draft.spec.customers.push({
    time: 0,
    recipe: "steak",
    guest: "新客人",
    patience: 60,
  });
}
function removeCustomer(i: number) {
  draft.spec.customers.splice(i, 1);
}
function sortCustomers() {
  draft.spec.customers.sort((a, b) => a.time - b.time);
}
const recipes_ = recipeList;
const recipeIds = recipes_.map((r) => r.id) as RecipeId[];

function toggleRouteMember(route: string[], id: string) {
  const i = route.indexOf(id);
  if (i >= 0) route.splice(i, 1);
  else route.push(id);
}

const issues = computed(() => validateLevel(draft, others.value));
const errors = computed(() => issues.value.filter((i) => i.kind === "error"));
const conflicts = computed(() => issues.value.filter((i) => i.kind === "conflict"));

const customerTrack = (c: CustomerPlan, i: number) => `${i}-${c.guest}-${c.time}`;
</script>

<template>
  <section class="editor">
    <div class="section-heading">
      <div>
        <span class="eyebrow">LEVEL EDITOR</span>
        <h2>
          {{ keepId ? `编辑「${draft.name}」` : source ? `基于「${source.name}」新建` : "新建关卡" }}
        </h2>
      </div>
      <button class="outline" @click="emit('cancel')">返回大厅</button>
    </div>
    <p class="muted">
      保存后生成新版本（当前 v{{ draft.version }}），只影响之后的挑战；进行中的对局仍按开局快照结算。
    </p>

    <div class="editor-grid">
      <div class="panel">
        <h3>基础与设备</h3>
        <label class="field">
          关卡名称
          <input v-model="draft.name" placeholder="例如：周末大考" />
        </label>
        <label class="field">
          营业限时（秒）
          <input v-model.number="draft.spec.goals.timeLimit" type="number" min="30" step="10" />
        </label>
        <div class="field-row">
          <label class="field">煎锅数量<input v-model.number="panCount" type="number" min="0" max="3" /></label>
          <label class="field">汤锅数量<input v-model.number="potCount" type="number" min="0" max="3" /></label>
        </div>
        <label class="field check">
          <input v-model="draft.spec.restockAllowed" type="checkbox" />
          允许营业中采购食材
        </label>
        <h3>初始库存</h3>
        <div class="field-row">
          <label class="field">🥩 牛肉<input v-model.number="draft.spec.stock.beef" type="number" min="0" max="12" /></label>
          <label class="field">🍜 面条<input v-model.number="draft.spec.stock.noodle" type="number" min="0" max="12" /></label>
          <label class="field">🥬 时蔬<input v-model.number="draft.spec.stock.greens" type="number" min="0" max="12" /></label>
        </div>
        <h3>组合目标</h3>
        <div class="field-row">
          <label class="field">净收益 ≥ ¥<input v-model.number="draft.spec.goals.minNet" type="number" min="0" step="10" /></label>
          <label class="field">浪费 ≤ ¥<input v-model.number="draft.spec.goals.maxWaste" type="number" min="0" step="5" /></label>
          <label class="field">满意度 ≥ %<input v-model.number="draft.spec.goals.minSatisfaction" type="number" min="0" max="100" step="5" /></label>
        </div>
      </div>

      <div class="panel">
        <div class="section-heading">
          <h3>来客表（{{ draft.spec.customers.length }} 位）</h3>
          <button class="tiny soft" @click="sortCustomers">按时间排序</button>
        </div>
        <div class="gen-row">
          <label>种子 <input v-model.number="genSeed" type="number" /></label>
          <label>人数 <input v-model.number="genCount" type="number" min="1" max="14" /></label>
          <button class="tiny" @click="regenerate">按种子生成</button>
          <button class="tiny soft" @click="addCustomer">＋ 手动加客</button>
        </div>
        <p class="muted">同一种子生成的来客与事件完全相同，正式与预演共用此表。</p>
        <div class="customer-table">
          <div v-for="(c, i) in draft.spec.customers" :key="customerTrack(c, i)" class="customer-row">
            <input v-model.number="c.time" type="number" min="0" title="到店秒数" />
            <select v-model="c.recipe">
              <option v-for="r in recipeIds" :key="r" :value="r">
                {{ recipes_.find((x) => x.id === r)?.name }}
              </option>
            </select>
            <input v-model="c.guest" placeholder="称呼" />
            <input v-model.number="c.patience" type="number" min="15" title="耐心秒数" />
            <button class="trash" aria-label="删除客人" @click="removeCustomer(i)">×</button>
          </div>
          <p v-if="!draft.spec.customers.length" class="muted">还没有客人，用种子生成或手动添加。</p>
        </div>
        <h3>事件（{{ draft.spec.events.length }}）</h3>
        <div class="event-list">
          <span v-for="(e, i) in draft.spec.events" :key="i" class="event-chip">
            {{ e.time }}s · {{ e.kind === "notice" ? e.text : `加单：${e.guest}` }}
            <button class="trash" aria-label="删除事件" @click="draft.spec.events.splice(i, 1)">×</button>
          </span>
          <span v-if="!draft.spec.events.length" class="muted">无事件，可用种子生成。</span>
        </div>
      </div>

      <div class="panel">
        <h3>解锁路线</h3>
        <p class="muted">任意一条路线内的关卡全部通关即解锁；留空表示初始开放。</p>
        <div v-for="(route, ri) in draft.unlock.routes" :key="ri" class="route-box">
          <div class="route-head">
            路线 {{ ri + 1 }}
            <button class="trash" aria-label="删除路线" @click="draft.unlock.routes.splice(ri, 1)">×</button>
          </div>
          <label v-for="l in others" :key="l.id" class="check">
            <input
              type="checkbox"
              :checked="route.includes(l.id)"
              @change="toggleRouteMember(route, l.id)"
            />
            {{ l.name }} <span class="muted">v{{ l.version }}</span>
          </label>
        </div>
        <button class="tiny soft" @click="draft.unlock.routes.push([])">＋ 添加一条路线</button>

        <h3>校验</h3>
        <div v-if="!issues.length" class="ok-box">✓ 配置可达成，没有发现冲突</div>
        <div v-if="errors.length" class="issue-box">
          <b>格式错误（{{ errors.length }}）</b>
          <p v-for="(e, i) in errors" :key="i">· {{ e.message }}</p>
        </div>
        <div v-if="conflicts.length" class="issue-box conflict">
          <b>目标冲突（{{ conflicts.length }}）</b>
          <p v-for="(c, i) in conflicts" :key="i">· {{ c.message }}</p>
        </div>
      </div>
    </div>

    <div class="editor-actions">
      <button :disabled="issues.length > 0" @click="emit('save', draft)">
        保存为新版本
      </button>
      <span v-if="issues.length" class="muted">请先解决左侧列出的错误与冲突</span>
    </div>
  </section>
</template>
