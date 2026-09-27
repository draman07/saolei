/**
 * 扫雷 — 配置层（SDS 第 5 节）
 * 难度参数与自定义范围校验。
 * 仅浏览器使用，挂载到 window.MINESWEEPER_CONFIG。
 */
(function (global) {
  "use strict";

  var CONFIG = {
    difficulties: {
      beginner: { rows: 9, cols: 9, mines: 10, label: "初级" },
      intermediate: { rows: 16, cols: 16, mines: 40, label: "中级" },
      expert: { rows: 30, cols: 16, mines: 99, label: "高级" },
      custom: { rows: null, cols: null, mines: null, label: "自定义" }
    },
    limits: {
      minRows: 9,
      maxRows: 40,
      minCols: 9,
      maxCols: 60
    }
  };

  /**
   * 校验自定义难度参数（FR-02 / TC-09）
   * @param {number} rows
   * @param {number} cols
   * @param {number} mines
   * @returns {{ ok: boolean, error?: string, value?: {rows, cols, mines} }}
   */
  function validateCustom(rows, cols, mines) {
    var L = CONFIG.limits;
    if (!Number.isInteger(rows) || rows < L.minRows || rows > L.maxRows) {
      return { ok: false, error: "行数需为 " + L.minRows + " ~ " + L.maxRows + " 的整数" };
    }
    if (!Number.isInteger(cols) || cols < L.minCols || cols > L.maxCols) {
      return { ok: false, error: "列数需为 " + L.minCols + " ~ " + L.maxCols + " 的整数" };
    }
    var maxMines = rows * cols - 9;
    if (!Number.isInteger(mines) || mines < 1 || mines > maxMines) {
      return { ok: false, error: "雷数需为 1 ~ " + maxMines + " 的整数" };
    }
    return { ok: true, value: { rows: rows, cols: cols, mines: mines } };
  }

  CONFIG.validateCustom = validateCustom;

  global.MINESWEEPER_CONFIG = CONFIG;
})(typeof window !== "undefined" ? window : this);
