import { reactive, onUnmounted } from "vue";
import { createGame } from "../shared/initial";
import { expire, arrive } from "../features/orders";
import { closeShift, saveBest, readBest } from "../features/ledger";
import { startRun, restartRun, tickChallenge, finishRun } from "../features/challenge";
import type { Level, RunMode } from "../shared/challenge";
export function useSession() {
  const game = reactive(createGame(readBest()));
  let last = performance.now(),
    carry = 0;
  const timer = setInterval(() => {
    const now = performance.now(),
      dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    if (!game.running) return;
    carry += dt;
    while (carry >= 0.1 && game.running) {
      carry -= 0.1;
      game.time = Math.min(
        game.duration,
        Math.round((game.time + 0.1) * 10) / 10,
      );
      expire(game);
      if (game.challenge) {
        tickChallenge(game);
        if (game.time >= game.duration) finishRun(game);
      } else {
        if (Math.round(game.time * 10) % 180 === 0) arrive(game);
        if (game.time >= game.duration) {
          closeShift(game);
          saveBest(game);
        }
      }
    }
  }, 50);
  onUnmounted(() => clearInterval(timer));
  function toggle() {
    if (game.ended) return;
    carry = 0;
    last = performance.now();
    game.running = !game.running;
    game.notice = game.running
      ? "营业中，客人已经入座。"
      : "已暂停，所有厨房计时冻结。";
  }
  function pause() {
    if (game.running) toggle();
  }
  function restart() {
    if (game.challenge) {
      // 同一关重复开始：同一份快照，来客与事件完全相同
      restartRun(game);
    } else {
      Object.assign(game, createGame(game.best));
    }
    carry = 0;
    last = performance.now();
  }
  function startChallenge(level: Level, mode: RunMode) {
    startRun(game, level, mode);
    carry = 0;
    last = performance.now();
  }
  function exitChallenge() {
    Object.assign(game, createGame(readBest()));
    carry = 0;
    last = performance.now();
  }
  return { game, toggle, pause, restart, startChallenge, exitChallenge };
}
