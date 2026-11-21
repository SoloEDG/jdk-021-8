<script setup lang="ts">
import { ref } from "vue";
import { useSession } from "./session";
import { dispatch } from "./commands";
import { OrdersPanel } from "../features/orders";
import { PantryPanel } from "../features/pantry";
import { KitchenPanel } from "../features/kitchen";
import { ServicePanel } from "../features/service";
import { LedgerPanel, ResultOverlay, totals } from "../features/ledger";
import {
  ChallengeLobby,
  LevelEditor,
  ChallengeResult,
  saveLevel,
} from "../features/challenge";
import type { Level, RunMode } from "../shared/challenge";
const { game, toggle, pause, restart, startChallenge, exitChallenge } =
  useSession();
const view = ref<"kitchen" | "lobby" | "editor">("kitchen");
const editSource = ref<Level | null>(null);
const editKeepId = ref(false);
function go(v: "kitchen" | "lobby") {
  if (v !== "kitchen") pause();
  view.value = v;
}
function beginRun(level: Level, mode: RunMode) {
  startChallenge(level, mode);
  view.value = "kitchen";
}
function openEditor(source: Level | null, keepId: boolean) {
  pause();
  editSource.value = source;
  editKeepId.value = keepId;
  view.value = "editor";
}
function saveDraft(draft: Level) {
  saveLevel(draft);
  view.value = "lobby";
}
function quitRun() {
  exitChallenge();
  view.value = "lobby";
}
</script>
<template>
  <div class="app-shell">
    <aside class="rail">
      <a class="brand" href="#" aria-label="午市厨房">午<span>市</span></a>
      <div class="rail-line"></div>
      <button
        class="rail-item"
        :class="{ active: view === 'kitchen' }"
        @click="go('kitchen')"
      >
        <span class="rail-icon">♨</span><span class="rail-label">厨房</span>
      </button>
      <button
        class="rail-item"
        :class="{ active: view === 'lobby' || view === 'editor' }"
        @click="go('lobby')"
      >
        <span class="rail-icon">🏆</span><span class="rail-label">赛事</span>
      </button>
      <div class="rail-bottom">
        LUNCH<br />RUSH<br /><small>EST. 2026</small>
      </div>
    </aside>
    <main v-if="view === 'lobby'">
      <ChallengeLobby
        @run="beginRun"
        @edit="(l) => openEditor(l, true)"
        @copy="(l) => openEditor(l, false)"
        @create="openEditor(null, false)"
      />
    </main>
    <main v-else-if="view === 'editor'">
      <LevelEditor
        :source="editSource"
        :keep-id="editKeepId"
        @save="saveDraft"
        @cancel="view = 'lobby'"
      />
    </main>
    <main v-else>
      <header>
        <div>
          <div class="eyebrow">LUNCH RUSH / A LITTLE KITCHEN, A BIG DREAM</div>
          <h1>午市厨房<span>一餐一味，分秒必争。</span></h1>
        </div>
        <div class="header-actions">
          <span class="open-dot"></span
          ><span>{{
            game.running ? "正在营业" : game.ended ? "今日打烊" : "准备开门"
          }}</span
          ><button class="outline" @click="restart">
            {{ game.challenge ? "重开本关" : "重新开局" }}
          </button>
        </div>
      </header>
      <div v-if="game.challenge" class="challenge-banner">
        <div>
          <b>{{ game.challenge.levelName }}</b>
          <span class="pill">v{{ game.challenge.version }}</span>
          <span
            class="pill"
            :class="
              game.challenge.mode === 'practice' ? 'soft-pill' : 'official-pill'
            "
            >{{ game.challenge.mode === "practice" ? "预演" : "正式挑战" }}</span
          >
        </div>
        <span class="muted">
          目标：净收益≥¥{{ game.challenge.spec.goals.minNet }} · 浪费≤¥{{
            game.challenge.spec.goals.maxWaste
          }}
          · 满意度≥{{ game.challenge.spec.goals.minSatisfaction }}%
          {{ game.challenge.spec.restockAllowed ? "" : " · 禁止采购" }}
        </span>
        <button class="tiny soft" @click="quitRun">放弃并返回大厅</button>
      </div>
      <div class="hero">
        <div>
          <span class="eyebrow">THE LUNCH SHIFT</span>
          <h2>把忙碌，做成美味。</h2>
          <p>备好食材，掌握火候，让每一位客人带着满足离开。</p>
          <button class="start-button" @click="toggle" :disabled="game.ended">
            {{
              game.running
                ? "Ⅱ 暂停营业"
                : game.time
                  ? "▶ 继续营业"
                  : "↗ 开始营业"
            }}
          </button>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="herb">✦</div>
          <div class="plate-art"><span>🥩</span><i>🥬</i><b>🍅</b></div>
          <span class="art-tag">FRESHLY MADE<br /><b>WITH LOVE</b></span>
        </div>
        <div class="hero-metrics">
          <div>
            <small>本场净收益</small><strong>¥{{ totals(game).net }}</strong>
          </div>
          <div>
            <small>距打烊还有</small
            ><strong
              >{{
                String(Math.floor((game.duration - game.time) / 60)).padStart(
                  2,
                  "0",
                )
              }}<em>:</em
              >{{
                String(Math.floor((game.duration - game.time) % 60)).padStart(
                  2,
                  "0",
                )
              }}</strong
            >
          </div>
          <span
            >连续交付 <b>{{ game.combo }}</b> 单</span
          >
        </div>
      </div>
      <OrdersPanel :game="game" @command="(c) => dispatch(game, c)" />
      <div class="workspace">
        <PantryPanel
          :game="game"
          @command="(c) => dispatch(game, c)"
        /><KitchenPanel
          :game="game"
          @command="(c) => dispatch(game, c)"
        /><ServicePanel :game="game" @command="(c) => dispatch(game, c)" />
      </div>
      <div class="notice" role="status">
        <span>✦ 主厨提示</span>{{ game.notice }}
      </div>
      <LedgerPanel :game="game" />
      <footer>
        好食材，好火候，好心情。<span
          >午市厨房 / LUNCH RUSH · {{ game.duration }} 秒的小小餐厅</span
        >
      </footer>
    </main>
    <ResultOverlay v-if="!game.challenge" :game="game" @restart="restart" />
    <ChallengeResult
      v-if="game.challenge"
      :game="game"
      @retry="restart"
      @lobby="quitRun"
    />
  </div>
</template>
