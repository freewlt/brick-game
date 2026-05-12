# 赢了个赢 代码优化 Spec

**Date:** 2026-05-12
**Author:** 协作产出（代码审查阶段识别）
**Plan:** [docs/superpowers/plans/2026-05-12-game-optimization.md](../plans/2026-05-12-game-optimization.md)
**Status:** Approved，执行中

---

## 1. Goal

对「赢了个赢」（微信小游戏，三消玩法）进行一次系统性代码审查，识别影响**正确性 / 性能 / 可维护性**的问题，按优先级分级，并以可独立提交的小任务形式落实修复。

## 2. Scope

- **包含**：
  - `src/` 与 `game.js` 现有代码的性能/可维护性修复（15 项 H/M/L）
  - **建立 vitest 单测基础设施**，覆盖 `GameLogic` 核心方法（保护后续逻辑层重构）
  - **统一 wx API 调用层**，集中 try/catch 与失败上报（console.warn 结构化日志）
- **不包含**：
  - 游戏玩法/数值平衡调整（产品决策，非代码优化）
  - 新功能（成就/关卡/广告等）
  - 完整重构 GameScene 拆分（拆分 `_drawHeader`/`_drawBoard`/`_drawSlot` 等私有方法，留待后续）

## 3. 现状评估

| 维度 | 当前状态 |
|------|----------|
| 代码量 | ~6100 行 JS，15 个文件 |
| 最大文件 | `src/scenes/GameScene.js` 1341 行（明显偏胖） |
| 公共代码 | `drawGlassCard` × 4 副本、`function e(str)` × 6 副本 |
| 渲染 | 每帧 requestAnimationFrame 重绘全场景，无脏区/缓存 |
| 热路径分配 | 每帧创建大量 `createLinearGradient` 对象、`new Set` 扫描棋盘 |
| 测试 | 无单测基础设施，纯人工验证（本 plan 将引入 vitest + GameLogic 单测） |
| 错误处理 | wx API 调用普遍 try/catch + 静默失败，无统一上报（本 plan 将引入 wxApi 封装层） |

## 4. 识别的问题（共 17 项：15 项代码缺陷 + 2 项基础设施）

### 4.1 🔴 高优先级 — 影响功能/稳定性

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| H1 | `saveMyUserInfo` 未导入但被调用 | [game.js:83](../../../game.js#L83) | 隐私授权成功后抛 ReferenceError |
| H2 | BGM `setTimeout` 队列在 `stopBGM` 后未清理 | [src/utils/audio.js:315-322](../../../src/utils/audio.js#L315-L322) | 离开场景后仍有 ~16 个 timer 在跑（无声但占调度），多次进出会累积 |
| H3 | 撤销快照对 board 三层 map + 对象展开 | [src/logic/GameLogic.js:131-140](../../../src/logic/GameLogic.js#L131-L140) | 地狱关卡每次点击分配 ~200 个车块对象，触摸响应可能掉帧 |

### 4.2 🟡 中优先级 — 影响可维护性/可读性

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| M1 | `drawGlassCard` 在 4 个场景重复定义 | Result/Daily/Leaderboard/AchievementUnlockPopup | 改样式需同步 4 处，易漂移 |
| M2 | `function e(str)` 在 6 个场景重复定义 | 多场景文件头 | 同 M1；LeaderboardScene 的正则与其它略有差异 |
| M3 | `GameScene.js` 1341 行，职责膨胀 | [src/scenes/GameScene.js](../../../src/scenes/GameScene.js) | 单文件含粒子类/飘字类/渲染/触摸/道具/广告/成就，难以局部理解 |
| M4 | `hexToRgb` 在渲染循环中按车型多次调用 | [GameScene.js:1311,1317](../../../src/scenes/GameScene.js#L1311) | 每帧 ~3 次 `parseInt(slice)`，本可预计算 |
| M5 | `measureText` 在 `_drawHeader` 每帧测两次 | [GameScene.js:353-377](../../../src/scenes/GameScene.js#L353) | 测的是「第N关」「目标」这种关卡内不变的字符串 |

### 4.3 🟢 低优先级 — 微优化/收尾

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| L1 | 背景渐变每帧重建 | [GameScene.js:264-269](../../../src/scenes/GameScene.js#L264) | 1 个渐变对象/帧的浪费 |
| L2 | `wx.requirePrivacyAuthorize` 在启动与排行榜两处分别调用 | game.js + LeaderboardScene.js | 用户可能见两次授权弹窗 |
| L3 | `isBlocked` 是 O(r)，每帧 ~49 次调用 | [GameLogic.js:122-128](../../../src/logic/GameLogic.js#L122) | 可降为 O(1) |
| L4 | `getLives()` 在 draw 路径调用，触发 `wx.getStorageSync` | storage.js + 多场景 | 每帧读 storage，可节流到 1Hz |
| L5 | `_drawCollectionProgress` 每帧 `new Set` 扫描棋盘 | [GameScene.js:1287-1295](../../../src/scenes/GameScene.js#L1287) | 关卡内车型固定，可预算 |
| L6 | `YOUR_AD_UNIT_ID` 占位符仍在代码 | [GameScene.js:1170](../../../src/scenes/GameScene.js#L1170) | 上线前必改，且应提到 config |
| L7 | `getStackDepth` 过度防御性判断 | [GameLogic.js:375-377](../../../src/logic/GameLogic.js#L375) | board 已固定 7×7，条件永真，是死代码 |

### 4.4 ⚙️ 基础设施 — 工具链与可观测性

| # | 问题 | 当前状态 | 影响 | 期望 |
|---|------|---------|------|------|
| I1 | 项目无单测基础设施 | 无 `package.json` 中的 test 脚本、无 vitest/jest/mocha | 逻辑变更只能靠人工验证，A1/C3 等核心逻辑修改风险大 | 引入 vitest，覆盖 `GameLogic` 核心方法（initLevel/clickCell/undo/_checkMatch/useShuffle/calcStars），后续逻辑层修改先跑测试 |
| I2 | wx API 调用散落各处，失败静默 | `try { wx.setStorageSync(...) } catch (e) {}` 这种模式遍布 storage.js / LeaderboardScene / game.js / GameScene | 出问题无线索，调试只能靠 console.log；隐私授权失败、storage 配额超限等都无感知 | 统一 `src/utils/wxApi.js` 封装层：`storage.get/set` / `ad.showRewarded` / `share.send` / `auth.requirePrivacy` / `userInfo.get`，失败统一 `console.warn('[wxApi] ${api} failed:', err)` |

## 5. 验收标准

- ✅ 所有 H/M/L + I 项都有对应 Task 修复（已落实于 plan）
- ✅ 每个 Task 一个独立 commit，commit message 与 plan 一致
- ✅ 修复后所有文件通过 node --check 语法验证
- ✅ 微信开发者工具实机验证 5 个核心路径无回归：
  - 开始页（机会数、按钮、云朵动画）
  - 第 1 关游戏（点击/撤销/消除/通关）
  - 第 10 关游戏（地狱难度撤销性能）
  - 排行榜（隐私授权、好友列表、邀请）
  - 每日挑战 + 成就墙
- ✅ `grep -rn "hexToRgb\|YOUR_AD_UNIT_ID" src/` 无残留
- ✅ `drawGlassCard` 和 `function e(str)` 仅在 `src/utils/draw.js` 出现一次
- ✅ `npm test` 通过，至少 20 个用例覆盖 `GameLogic` 关键方法
- ✅ `grep -rn "wx\.\(getStorageSync\|setStorageSync\|shareAppMessage\|requirePrivacyAuthorize\|getUserProfile\|createRewardedVideoAd\)" src/` 仅在 `src/utils/wxApi.js` 出现

## 6. 非目标（明确不做）

- **不做完整 GameScene 拆分**：plan 中 B1 只抽出 `FloatText`/`MatchParticle`，不动 `_drawHeader`/`_drawBoard`/`_drawSlot` 等私有方法。这些方法虽然胖但耦合棋盘状态，拆分需要架构决策，不在本次范围。
- **不引入构建工具/打包**：保持微信开发者工具直接打开的开发体验。`package.json` 仅作为 vitest 入口，`node_modules` 由 `.gitignore` 排除，不影响小游戏发布包。
- **不引入 TypeScript**：纯 JS 项目，本次不做语言层升级。
- **不为渲染层（场景）写单测**：单测只覆盖 `GameLogic` 与 `src/utils/storage.js` 等纯逻辑模块；Canvas/wx API 涉及的场景层不在本次单测范围。
- **不接入第三方 telemetry SDK**：wxApi 失败上报只走 `console.warn`，不引入 Sentry/友盟等。

## 7. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 浅拷贝快照在某种边界条件下导致撤销错乱 | 低 | 高（撤销错乱是游戏卡死风险） | 自检 `_checkMatch`/`useShuffle` 是否会变异 car 对象；plan 中保留回滚到深拷贝的方案；I1 引入的单测会覆盖 |
| `isBlocked` 缓存增量更新点漏改 | 中 | 中（遮挡显示错） | plan 中所有 board 整体改动点（init/shuffle/undo/click pop）都列了维护调用；I1 引入的单测会覆盖 |
| 隐私授权状态共享后某场景未触发兜底 | 低 | 中（无法看排行榜） | LeaderboardScene 仍保留「未问过 → 当场调一次」的分支 |
| commit 拆分太细导致 PR 噪音 | 中 | 低 | 每 commit 一个 Task 不可再拆；接受这个噪音换取可回滚性 |
| wxApi 封装引入回归（参数/回调签名错） | 中 | 中 | 封装层只做转发，保留原 success/fail 回调形态；I1 的单测无法覆盖 wxApi（依赖 wx 全局），用人工实机验证 5 个核心路径 |
| `node_modules` 误打包进小游戏发布包 | 低 | 中（包体积爆） | `.gitignore` 与微信开发者工具的 `miniprogramRoot`/`packOptions.ignore` 双重排除 |

## 8. 后续工作（不在本 spec 范围）

- `GameScene` 完整拆分：按职责拆 5 个文件（`renderHeader.js`/`renderBoard.js`/`renderSlot.js`/`renderProps.js`/`touchHandler.js`）
- 离屏 canvas 预渲染车块图块，棋盘渲染从「每帧 49 格 × 4 渐变」降为「49 次 drawImage」
- 用 prompt 形式将「赢了个赢」中所有 UI 文案抽到 `src/i18n.js`，为多语言版本铺路
- 接入第三方 telemetry SDK（Sentry / 友盟），把 wxApi 的 `console.warn` 升级为线上上报
- 扩大单测覆盖：场景层用 mock-canvas 测试触摸命中区域与状态机
