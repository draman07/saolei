# 网页版扫雷（Minesweeper Web）

基于 **SDD（Specification-Driven Development，规范驱动开发）** 开发的经典扫雷游戏。
纯原生 HTML/CSS/JS，零依赖、无构建，双击 `index.html` 即可运行。

功能：经典扫雷玩法（首击安全 / 洪泛展开 / 旗与问号 / Chord）、三档难度 + 自定义、
计时与剩余雷数、现代视觉与动画，以及 **Web Audio 程序化合成音效**（点击/插旗轻音效、
胜利喜庆琶音、踩雷遗憾滑音）与静音开关。

## 规范文档（先于代码）
| 文档 | 内容 |
| --- | --- |
| [specs/01-需求规格说明书.md](specs/01-需求规格说明书.md) | 功能需求 FR-01~15、非功能需求 NFR-01~07、术语表 |
| [specs/02-设计规格说明书.md](specs/02-设计规格说明书.md) | 分层架构、数据模型、核心算法、UI 设计、音效模块设计、ADR |
| [specs/03-验收测试规格说明书.md](specs/03-验收测试规格说明书.md) | 自动化用例 TC-01~14、手动验收清单 M-01~23 |

## 开发流程（依赖顺序）
```
规范文档（SRS → SDS → ATS）
   ↓
T1 项目骨架（index.html + style.css 基础结构）
   ↓
T2 配置层 config.js（难度参数）
   ↓
T3 逻辑层 core.js（UMD，纯逻辑：布雷/翻开/洪泛/标记/Chord/胜负/计时）
   ↓
T4 自动化验收测试 tests/acceptance.test.js（对照 ATS TC-01~11 执行）
   ↓
T5 视图层 ui.js — 棋盘渲染与交互（翻开/标记/Chord）
   ↓
T6 视图层 ui.js — 状态栏（雷数/计时/表情/重开/难度切换）
   ↓
T7 自定义难度对话框
   ↓
T8 视觉美化与动画（圆角/渐变/翻开/失败/胜利动效）
   ↓
T9 集成验收（对照 ATS 手动清单 M-01~18）
   ↓
T10 音效扩展（SRS v1.1：audio.js 合成音效 + 静音开关，TC-12~14）
```

## 运行方式
- 开发期验收：`node tests/acceptance.test.js`（需 Node.js）
- 游玩：直接用浏览器打开 `index.html`

## 验收状态
见 [specs/03-验收测试规格说明书.md](specs/03-验收测试规格说明书.md) 第 4 节记录表。
