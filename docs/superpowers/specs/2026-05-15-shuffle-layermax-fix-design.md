# 每日挑战洗牌 layerMax 修复设计

**日期：** 2026-05-15

**Goal:** 修复每日挑战模式下洗牌（useShuffle）错误使用普通第 1 关 layerMax 的 bug。

---

## 问题

`GameLogic.useShuffle()` 第 245 行硬编码查 `CONFIG.LEVELS[Math.min(this.level, CONFIG.LEVELS.length - 1)]` 获取 `layerMax`。每日挑战时 `this.level = 0`，取到普通第 1 关的 `layerMax = 2`，而每日挑战的 `layerMax` 最低 3、最高 5。车块总数超过 `49 × 2 = 98` 时触发 fallback 强塞，堆叠层数失控，遮挡关系错乱。

## 方案

`GameLogic` 在 `initLevel` 时记住解析后的 `cfg` 对象（`this._cfg`），`useShuffle` 直接用 `this._cfg.layerMax`。

## 改动（仅 `src/logic/GameLogic.js`）

| 位置 | 改动 |
|------|------|
| `reset()` | 加 `this._cfg = null` |
| `initLevel()` | 解析 cfg 后加 `this._cfg = cfg` |
| `useShuffle()` 第 245 行 | `CONFIG.LEVELS[Math.min(...)]` → `this._cfg` |

## 测试

在 `tests/GameLogic.test.js` 新增用例：

- 用 `customCfg = { carTypes: 6, layerMax: 4, setCount: 5, maxMoves: 100 }` 调用 `initLevel(0, customCfg)`
- 调用 `useShuffle()`
- 断言棋盘上每格 `stack.length <= 4`（即 `<= customCfg.layerMax`）

## 不在范围内

- 普通关卡洗牌行为不变（`this._cfg` 就是 `CONFIG.LEVELS[levelIdx]`，结果一致）
- 不改 `GameScene`、`DailyScene` 或其他文件
