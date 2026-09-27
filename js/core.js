/**
 * 扫雷 — 核心逻辑层（SDS 第 3 节）
 *
 * 纯逻辑模块：不依赖任何 DOM / 浏览器 API，可在 Node 中直接加载测试。
 * 导出方式（UMD）：
 *   - 浏览器：window.MINESWEEPER_CORE
 *   - Node：module.exports
 *
 * 游戏状态机（SDS 2.3）：
 *   ready ──首击(布雷+起表)──► playing ──翻开雷──► lost
 *                                     └──全非雷翻开──► won
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MINESWEEPER_CORE = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- 工具 ---------------- */

  function forEachNeighbor(state, r, c, fn) {
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nr = r + dr;
        var nc = c + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
          fn(nr, nc);
        }
      }
    }
  }

  function stopTimer(state) {
    if (state.timer.startTime !== null && state.timer.stoppedAt === null) {
      state.timer.stoppedAt = Date.now();
    }
  }

  /* ---------------- 创建游戏（SDS 2.2 / 3.1） ---------------- */

  /**
   * @param {number} rows
   * @param {number} cols
   * @param {number} mines
   * @param {object} [opts]
   * @param {function} [opts.rng] 随机函数，默认 Math.random（可注入固定种子便于测试）
   * @param {Array<[number, number]>} [opts.initialMines] 测试用：直接指定雷的位置（跳过首击安全）
   */
  function createGame(rows, cols, mines, opts) {
    opts = opts || {};
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 1) {
      throw new Error("棋盘尺寸必须为正整数");
    }
    if (!Number.isInteger(mines) || mines < 1 || mines >= rows * cols) {
      throw new Error("雷数必须为 1 ~ rows*cols-1 的整数");
    }

    var state = {
      rows: rows,
      cols: cols,
      mines: mines,
      board: [],
      status: "ready", // ready | playing | won | lost
      flagCount: 0,
      revealedCount: 0,
      minesPlanted: false,
      rng: opts.rng || Math.random,
      timer: { started: false, startTime: null, stoppedAt: null }
    };

    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          neighborMines: 0,
          state: "hidden" // hidden | revealed | flagged | question
        });
      }
      state.board.push(row);
    }

    if (opts.initialMines) {
      if (opts.initialMines.length !== mines) {
        throw new Error("initialMines 数量必须等于 mines");
      }
      for (var i = 0; i < opts.initialMines.length; i++) {
        var p = opts.initialMines[i];
        state.board[p[0]][p[1]].isMine = true;
      }
      state.minesPlanted = true;
      computeNeighbors(state);
    }

    return state;
  }

  /* ---------------- 布雷（SDS 3.1，首击后执行） ---------------- */

  function plantMines(state, r, c) {
    var total = state.rows * state.cols;
    // 禁区：以 (r,c) 为中心的 3×3 邻域（越界已由 forEachNeighbor 裁剪）
    var excluded = {};
    forEachNeighbor(state, r, c, function (nr, nc) {
      excluded[nr * state.cols + nc] = true;
    });
    excluded[r * state.cols + c] = true;

    var candidates = [];
    for (var i = 0; i < total; i++) {
      if (!excluded[i]) candidates.push(i);
    }
    if (state.mines > candidates.length) {
      throw new Error("雷数超过首击后可用格子数");
    }

    // 部分 Fisher-Yates：用注入的 rng 从前 candidates 中选出 mines 个
    var rng = state.rng;
    for (var k = 0; k < state.mines; k++) {
      var j = k + Math.floor(rng() * (candidates.length - k));
      var tmp = candidates[k];
      candidates[k] = candidates[j];
      candidates[j] = tmp;
    }
    for (var m = 0; m < state.mines; m++) {
      var idx = candidates[m];
      var rr = Math.floor(idx / state.cols);
      var cc = idx % state.cols;
      state.board[rr][cc].isMine = true;
    }
    computeNeighbors(state);
  }

  /* ---------------- 邻雷计数（SDS 3.1 第 6 步） ---------------- */

  function computeNeighbors(state) {
    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        var count = 0;
        var self = state.board[r][c];
        forEachNeighbor(state, r, c, function (nr, nc) {
          if (state.board[nr][nc].isMine) count++;
        });
        self.neighborMines = count;
      }
    }
  }

  /* ---------------- 翻开核心（含洪泛，SDS 3.2） ---------------- */

  /**
   * 翻开单个格子（含 0 格洪泛 BFS）。返回 { result: 'revealed'|'won'|'lost'|'none', hit? }
   */
  function openCell(state, r, c) {
    if (state.status === "won" || state.status === "lost") {
      return { result: "none" };
    }
    var cell = state.board[r][c];
    if (cell.state === "revealed" || cell.state === "flagged") {
      return { result: "none" };
    }
    if (cell.isMine) {
      state.status = "lost";
      stopTimer(state);
      return { result: "lost", hit: { row: r, col: c } };
    }

    var queue = [{ row: r, col: c }];
    while (queue.length > 0) {
      var cur = queue.shift();
      var curCell = state.board[cur.row][cur.col];
      if (curCell.state === "revealed" || curCell.state === "flagged") continue;
      if (curCell.isMine) {
        state.status = "lost";
        stopTimer(state);
        return { result: "lost", hit: { row: cur.row, col: cur.col } };
      }
      curCell.state = "revealed";
      state.revealedCount++;
      if (curCell.neighborMines === 0) {
        forEachNeighbor(state, cur.row, cur.col, function (nr, nc) {
          var n = state.board[nr][nc];
          if (n.state !== "revealed" && n.state !== "flagged") {
            queue.push({ row: nr, col: nc });
          }
        });
      }
    }

    if (state.revealedCount === state.rows * state.cols - state.mines) {
      state.status = "won";
      stopTimer(state);
      return { result: "won" };
    }
    return { result: "revealed" };
  }

  /* ---------------- 公开接口 ---------------- */

  /**
   * 左键翻开（FR-04 / FR-05 / FR-03 首击逻辑在此触发）
   * @returns {{type: 'reveal'|'won'|'lost'|'none', first?: boolean, hit?: {row,col}}}
   */
  function reveal(state, r, c) {
    if (state.status === "won" || state.status === "lost") return { type: "none" };
    var cell = state.board[r][c];
    if (cell.state === "revealed" || cell.state === "flagged") return { type: "none" };

    var first = false;
    // 首次点击：启动计时、进入 playing（无论雷是随机布还是 initialMines 注入）
    if (!state.timer.started) {
      state.timer.started = true;
      state.timer.startTime = Date.now();
      state.status = "playing";
      first = true;
    }
    if (!state.minesPlanted) {
      plantMines(state, r, c);
      state.minesPlanted = true;
    }

    var res = openCell(state, r, c);
    var ev = { type: res.result === "lost" ? "lost" : res.result === "won" ? "won" : "reveal" };
    if (first) ev.first = true;
    if (res.hit) ev.hit = res.hit;
    return ev;
  }

  /**
   * 右键标记循环（FR-06）：hidden → flagged → question → hidden
   * @returns {{type: 'mark'|'none', mark?: string, flagCount?: number}}
   */
  function toggleMark(state, r, c) {
    if (state.status === "won" || state.status === "lost") return { type: "none" };
    var cell = state.board[r][c];
    if (cell.state === "revealed") return { type: "none" };

    if (cell.state === "hidden") {
      cell.state = "flagged";
      state.flagCount++;
    } else if (cell.state === "flagged") {
      cell.state = "question";
      state.flagCount--;
    } else {
      cell.state = "hidden";
    }
    return { type: "mark", mark: cell.state, flagCount: state.flagCount };
  }

  /**
   * Chord 快速展开（FR-07 / SDS 3.3）
   * @returns {{type: 'chord'|'won'|'lost'|'none', hit?: {row,col}}}
   */
  function chord(state, r, c) {
    if (state.status === "won" || state.status === "lost") return { type: "none" };
    var cell = state.board[r][c];
    if (cell.state !== "revealed" || cell.neighborMines === 0) return { type: "none" };

    var flagAround = 0;
    var targets = [];
    forEachNeighbor(state, r, c, function (nr, nc) {
      var n = state.board[nr][nc];
      if (n.state === "flagged") {
        flagAround++;
      } else if (n.state === "hidden" || n.state === "question") {
        targets.push({ row: nr, col: nc });
      }
    });
    if (flagAround !== cell.neighborMines) return { type: "none" };

    var anyOpen = false;
    for (var i = 0; i < targets.length; i++) {
      var res = openCell(state, targets[i].row, targets[i].col);
      if (res.result === "lost") {
        return { type: "lost", hit: res.hit };
      }
      if (res.result === "won") {
        return { type: "won" };
      }
      if (res.result === "revealed") anyOpen = true;
    }
    return anyOpen ? { type: "chord" } : { type: "none" };
  }

  /** 已过时间（ms）。未开始为 0；结束后定格（FR-09 / TC-11） */
  function getElapsed(state) {
    if (state.timer.startTime === null) return 0;
    var end = state.timer.stoppedAt !== null ? state.timer.stoppedAt : Date.now();
    return end - state.timer.startTime;
  }

  /** 格式化 mm:ss，上限 99:59（FR-09） */
  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    if (totalSec > 5999) totalSec = 5999; // 99:59
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    function pad(n) {
      return n < 10 ? "0" + n : String(n);
    }
    return pad(m) + ":" + pad(s);
  }

  /** 全部雷的位置（失败/胜利展示用，FR-08）。未布雷时返回 [] */
  function getMinePositions(state) {
    var list = [];
    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        if (state.board[r][c].isMine) list.push({ row: r, col: c });
      }
    }
    return list;
  }

  function isMinesPlanted(state) {
    return state.minesPlanted;
  }

  return {
    createGame: createGame,
    reveal: reveal,
    toggleMark: toggleMark,
    chord: chord,
    getElapsed: getElapsed,
    formatTime: formatTime,
    getMinePositions: getMinePositions,
    isMinesPlanted: isMinesPlanted
  };
});
