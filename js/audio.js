/**
 * 扫雷 — 音效层（SDS 第 6 节）
 *
 * Web Audio API 程序化合成，零外部音频文件、零依赖（FR-14）。
 * 评分数据为纯数据，可在 Node 中直接验收（TC-12~14）。
 *
 * 导出方式（UMD）：
 *   - 浏览器：window.MINESWEEPER_AUDIO
 *   - Node：module.exports
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MINESWEEPER_AUDIO = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- 评分数据（SDS 6.3，纯数据） ----------------
   * 音符字段：f 起始频率Hz | t 相对起点s | d 时长s | type 波形
   *           g 峰值增益 | glideTo 可选滑音目标频率
   * ------------------------------------------------------------ */
  var SCORES = {
    // 翻开/Chord：极短促轻"嗒"声
    click: [{ f: 900, t: 0, d: 0.05, type: "sine", g: 0.12 }],

    // 右键标记：双音轻"啵"声
    flag: [
      { f: 650, t: 0, d: 0.06, type: "triangle", g: 0.15 },
      { f: 950, t: 0.06, d: 0.06, type: "triangle", g: 0.12 }
    ],

    // 胜利：喜庆上行琶音 C5-E5-G5-C6，尾音渐强收尾
    win: [
      { f: 523.25, t: 0, d: 0.16, type: "triangle", g: 0.2 },
      { f: 659.25, t: 0.14, d: 0.16, type: "triangle", g: 0.2 },
      { f: 783.99, t: 0.28, d: 0.16, type: "triangle", g: 0.22 },
      { f: 1046.5, t: 0.42, d: 0.5, type: "triangle", g: 0.26 }
    ],

    // 失败：遗憾下行滑音三连坠（392→311→233→174），低沉缓慢
    lose: [
      { f: 392, t: 0, d: 0.4, type: "triangle", g: 0.2, glideTo: 311 },
      { f: 311, t: 0.4, d: 0.4, type: "triangle", g: 0.18, glideTo: 233 },
      { f: 233, t: 0.8, d: 0.65, type: "triangle", g: 0.16, glideTo: 174 }
    ]
  };

  /* ---------------- 音频上下文（懒初始化，SDS 6.4） ---------------- */
  var ctx = null;
  var muted = false;

  function ensureCtx() {
    if (ctx) {
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      return ctx;
    }
    var AC =
      typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  /* ---------------- 播放（SDS 6.5） ---------------- */
  function playScore(score) {
    if (muted || !score || !score.length) return; // 静音 / 无环境 → 静默返回
    var ac = ensureCtx();
    if (!ac) return;
    var t0 = ac.currentTime;
    score.forEach(function (n) {
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      var start = t0 + n.t;
      osc.type = n.type || "sine";
      osc.frequency.setValueAtTime(n.f, start);
      if (n.glideTo) {
        osc.frequency.exponentialRampToValueAtTime(n.glideTo, start + n.d);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(n.g, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(start);
      osc.stop(start + n.d + 0.05);
    });
  }

  function playClick() {
    playScore(SCORES.click);
  }

  function playFlag() {
    playScore(SCORES.flag);
  }

  function playWin() {
    playScore(SCORES.win);
  }

  function playLose() {
    playScore(SCORES.lose);
  }

  /* ---------------- 静音（FR-15，内存态） ---------------- */
  function isMuted() {
    return muted;
  }

  function setMuted(v) {
    muted = !!v;
    return muted;
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return {
    playClick: playClick,
    playFlag: playFlag,
    playWin: playWin,
    playLose: playLose,
    isMuted: isMuted,
    setMuted: setMuted,
    toggleMute: toggleMute,
    // 测试钩子：评分数据 / 注入 mock 上下文（TC-12~14）
    _getScore: function (name) {
      return SCORES[name] || null;
    },
    _useContext: function (mock) {
      ctx = mock;
    }
  };
});
