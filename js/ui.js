/**
 * 扫雷 — 视图层（SDS 第 4 节）
 *
 * 职责：渲染棋盘与状态栏、绑定交互事件、驱动动画类名。
 * 依赖：window.MINESWEEPER_CORE（core.js）、window.MINESWEEPER_CONFIG（config.js）
 */
(function (global) {
  "use strict";

  var CORE = global.MINESWEEPER_CORE;
  var CONFIG = global.MINESWEEPER_CONFIG;
  var AUDIO = global.MINESWEEPER_AUDIO;

  var els = {};
  var state = null;        // 当前 core 游戏状态
  var currentDiff = "beginner";
  var customCfg = null;    // 已应用的自定义难度
  var timerId = null;
  var hitPos = null;       // 踩雷格坐标（失败高亮）
  var cells = [];          // button 元素二维数组
  var prevStates = null;   // 上一帧格子状态快照（用于动画类名）

  /* ---------------- 工具 ---------------- */

  function pad3(n) {
    return n < 0 ? "-" + String(-n).padStart(2, "0") : String(n).padStart(3, "0");
  }

  /* ---------------- 生命周期 ---------------- */

  function init() {
    els.board = document.getElementById("board");
    els.mines = document.getElementById("mines-left");
    els.timer = document.getElementById("timer");
    els.face = document.getElementById("face-btn");
    els.diffBtns = Array.prototype.slice.call(document.querySelectorAll(".diff-btn"));
    els.dialog = document.getElementById("custom-dialog");
    els.form = document.getElementById("custom-form");
    els.error = document.getElementById("custom-error");
    els.inputRows = document.getElementById("custom-rows");
    els.inputCols = document.getElementById("custom-cols");
    els.inputMines = document.getElementById("custom-mines");
    els.cancel = document.getElementById("custom-cancel");
    els.muteBtn = document.getElementById("mute-btn");

    els.face.addEventListener("click", restart);
    els.diffBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectDifficulty(btn.dataset.diff);
      });
    });
    els.cancel.addEventListener("click", function () {
      els.dialog.close();
    });
    els.form.addEventListener("submit", onSubmitCustom);
    els.muteBtn.addEventListener("click", function () {
      AUDIO.toggleMute();
      updateMuteBtn();
    });
    window.addEventListener("resize", onResize);

    updateMuteBtn();
    newGame(getConfig("beginner"));
  }

  /** 按难度名取配置；自定义取已应用的自定义值 */
  function getConfig(diff) {
    if (diff === "custom") return customCfg;
    var d = CONFIG.difficulties[diff];
    return { rows: d.rows, cols: d.cols, mines: d.mines };
  }

  /** 难度按钮点击（FR-12 / FR-13） */
  function selectDifficulty(diff) {
    if (diff === "custom") {
      openCustomDialog();
      return;
    }
    currentDiff = diff;
    markActive();
    newGame(getConfig(diff));
  }

  function restart() {
    newGame(getConfig(currentDiff));
  }

  /** 用给定配置新建一局（FR-12） */
  function newGame(cfg) {
    if (!cfg) return;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    state = CORE.createGame(cfg.rows, cfg.cols, cfg.mines);
    hitPos = null;
    prevStates = null;
    buildCells();
    renderAll();
  }

  /* ---------------- 棋盘构建与渲染 ---------------- */

  function computeCellSize() {
    var maxW = Math.min(window.innerWidth * 0.85, 860) - 40;
    var maxH = window.innerHeight * 0.85 - 150;
    var w = Math.floor((maxW - 16 - 2 * (state.cols - 1)) / state.cols);
    var h = Math.floor((maxH - 16 - 2 * (state.rows - 1)) / state.rows);
    return Math.max(14, Math.min(42, w, h));
  }

  function buildCells() {
    var px = computeCellSize();
    els.board.style.setProperty("--cell-size", px + "px");
    els.board.style.gridTemplateColumns = "repeat(" + state.cols + ", " + px + "px)";
    els.board.innerHTML = "";
    cells = [];
    for (var r = 0; r < state.rows; r++) {
      var rowEls = [];
      for (var c = 0; c < state.cols; c++) {
        (function (rr, cc) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cell";
          btn.addEventListener("click", function () {
            onCellClick(rr, cc);
          });
          btn.addEventListener("contextmenu", function (e) {
            onCellContextMenu(e, rr, cc);
          });
          els.board.appendChild(btn);
          rowEls.push(btn);
        })(r, c);
      }
      cells.push(rowEls);
    }
  }

  /** 全量重绘（SDS 4.2：DOM 复用 + 类名切换） */
  function renderAll() {
    if (!state) return;
    var over = state.status === "won" || state.status === "lost";
    var was = prevStates;
    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        var cell = state.board[r][c];
        var el = cells[r][c];
        var cls = "cell";
        var txt = "";
        var prev = was ? was[r][c] : null;

        if (cell.state === "flagged") {
          cls += " flagged";
          if (prev !== "flagged") cls += " just-flagged";
        } else if (cell.state === "question") {
          cls += " question";
          if (prev !== "question") cls += " just-question";
        } else if (cell.state === "revealed") {
          cls += " revealed";
          if (prev !== "revealed") cls += " just-revealed";
          if (cell.neighborMines > 0) {
            cls += " n" + cell.neighborMines;
            txt = String(cell.neighborMines);
          }
        }

        if (state.status === "lost") {
          if (cell.isMine) {
            cls = "cell" + (hitPos && hitPos.row === r && hitPos.col === c ? " mine-hit" : " mine-shown");
            txt = hitPos && hitPos.row === r && hitPos.col === c ? "💥" : "";
          } else if (cell.state === "flagged") {
            cls = "cell flagged flag-wrong";
          }
        } else if (state.status === "won") {
          if (cell.isMine) cls = "cell flagged"; // 自动补旗（FR-08）
        }

        el.className = cls;
        el.textContent = txt;
        el.disabled = over;
      }
    }
    // 快照当前状态，供下一帧做"刚翻开/刚插旗"动画
    prevStates = state.board.map(function (row) {
      return row.map(function (c2) {
        return c2.state;
      });
    });
    els.board.classList.toggle("win-glow", state.status === "won");
    renderStatus();
    updateFace();
    syncTimer();
  }

  /* ---------------- 交互 ---------------- */

  function onCellClick(r, c) {
    if (!state || state.status === "won" || state.status === "lost") return;
    var cell = state.board[r][c];
    var ev;
    if (cell.state === "revealed") {
      ev = CORE.chord(state, r, c); // 双击数字格 → Chord（FR-07）
    } else {
      ev = CORE.reveal(state, r, c); // 左键翻开（FR-04）
    }
    if (ev.type === "won") {
      AUDIO.playWin(); // 胜利喜庆音效（FR-14）
    } else if (ev.type === "lost") {
      AUDIO.playLose(); // 踩雷遗憾音效（FR-14）
    } else if (ev.type !== "none") {
      AUDIO.playClick(); // 翻开/Chord 轻音效（FR-14）
    }
    if (ev.type === "lost") hitPos = ev.hit || { row: r, col: c };
    renderAll();
  }

  function onCellContextMenu(e, r, c) {
    e.preventDefault();
    if (!state || state.status === "won" || state.status === "lost") return;
    var ev = CORE.toggleMark(state, r, c); // 右键标记循环（FR-06）
    if (ev.type === "mark") AUDIO.playFlag(); // 标记轻音效（FR-14）
    renderAll();
  }

  /* ---------------- 状态栏 ---------------- */

  function renderStatus() {
    els.mines.textContent = pad3(state.mines - state.flagCount); // 剩余雷数（FR-10）
  }

  function updateFace() {
    var newFace =
      state.status === "won" ? "😎" : state.status === "lost" ? "😵" : "😊"; // FR-11
    if (els.face.textContent !== newFace) {
      els.face.textContent = newFace;
      els.face.classList.remove("bounce");
      void els.face.offsetWidth; // 重启动画
      els.face.classList.add("bounce");
    }
  }

  function updateTimer() {
    els.timer.textContent = CORE.formatTime(CORE.getElapsed(state)); // FR-09
  }

  function syncTimer() {
    if (state.status === "playing") {
      if (!timerId) timerId = setInterval(updateTimer, 250);
    } else if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    updateTimer();
  }

  /* ---------------- 静音开关（FR-15） ---------------- */

  function updateMuteBtn() {
    var muted = AUDIO.isMuted();
    els.muteBtn.textContent = muted ? "🔇" : "🔊";
    els.muteBtn.title = "音效：" + (muted ? "关" : "开");
    els.muteBtn.setAttribute("aria-label", "音效开关（当前" + (muted ? "关" : "开") + "）");
  }

  /* ---------------- 自定义难度对话框（FR-13） ---------------- */

  function openCustomDialog() {
    els.error.textContent = "";
    var base = customCfg || CONFIG.difficulties.intermediate;
    els.inputRows.value = base.rows;
    els.inputCols.value = base.cols;
    els.inputMines.value = base.mines;
    els.dialog.showModal();
  }

  function onSubmitCustom(e) {
    e.preventDefault();
    var res = CONFIG.validateCustom(
      parseInt(els.inputRows.value, 10),
      parseInt(els.inputCols.value, 10),
      parseInt(els.inputMines.value, 10)
    );
    if (!res.ok) {
      els.error.textContent = res.error;
      return;
    }
    customCfg = res.value;
    currentDiff = "custom";
    els.dialog.close();
    markActive();
    newGame(customCfg);
  }

  /* ---------------- 其他 ---------------- */

  function markActive() {
    els.diffBtns.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.diff === currentDiff);
    });
  }

  function onResize() {
    if (state) buildCells(); // 重算格子尺寸后重建
  }

  global.MINESWEEPER_UI = { init: init };
  init();
})(window);
