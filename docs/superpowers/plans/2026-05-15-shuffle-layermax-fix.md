# Shuffle layerMax Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复每日挑战模式下洗牌错误使用普通第 1 关 `layerMax` 的 bug，改为使用当前关卡实际配置。

**Architecture:** `GameLogic.reset()` 新增 `this._cfg = null`，`initLevel()` 解析完 `cfg` 后存入 `this._cfg`，`useShuffle()` 直接用 `this._cfg` 替换原来的 `CONFIG.LEVELS[...]` 查表。普通关卡行为不变（`this._cfg` 就是 `CONFIG.LEVELS[levelIdx]`）。

**Tech Stack:** JavaScript ES Modules，Vitest

---

## 文件清单

| 文件 | 操作 |
|------|------|
| `src/logic/GameLogic.js` | 修改：`reset()`、`initLevel()`、`useShuffle()` |
| `tests/GameLogic.test.js` | 修改：在 `useShuffle` describe 块内新增测试 |

---

### Task 1：修复 `useShuffle` 使用正确的 `layerMax`

**Files:**
- Modify: `src/logic/GameLogic.js`
- Modify: `tests/GameLogic.test.js`

- [ ] **Step 1：写失败测试**

在 `tests/GameLogic.test.js` 的 `describe('useShuffle', ...)` 块末尾（第 209 行 `})` 之前）追加：

```js
it('每日挑战模式：洗牌后每格堆叠不超过 customCfg.layerMax', () => {
  const customCfg = { carTypes: 6, layerMax: 4, setCount: 5, maxMoves: 100 }
  g.initLevel(0, customCfg)
  expect(g.useShuffle()).toBe('ok')
  for (const row of g.board) {
    for (const stack of row) {
      expect(stack.length).toBeLessThanOrEqual(customCfg.layerMax)
    }
  }
})
```

- [ ] **Step 2：运行测试确认失败**

```bash
npx vitest run tests/GameLogic.test.js
```

期望：新增测试 FAIL（洗牌后某格 `stack.length > 4`，因为当前用了 `layerMax=2`）

注意：`carTypes=6, setCount=5` 总车块 = 6×5×3 = 90 辆，49 格 × 2 = 98 ≥ 90，实际上可能不触发强塞。如果测试意外通过，手动将 `customCfg` 改为 `{ carTypes: 8, layerMax: 5, setCount: 6, maxMoves: 150 }`（总车块 144 辆，49×2=98 < 144，必然强塞），确认失败后再改回 `layerMax: 4` 版本继续。

- [ ] **Step 3：修改 `src/logic/GameLogic.js` — `reset()` 加 `_cfg`**

找到 `reset()` 方法末尾（`this._colTopRow = ...` 之后），加一行：

```js
this._cfg = null
```

- [ ] **Step 4：修改 `initLevel()` — 存入 `_cfg`**

找到 `initLevel()` 里：

```js
const cfg = customCfg || CONFIG.LEVELS[Math.min(levelIdx, CONFIG.LEVELS.length - 1)]
this.maxMoves = cfg.maxMoves || 0
```

在 `this.maxMoves = cfg.maxMoves || 0` 之后加一行：

```js
this._cfg = cfg
```

- [ ] **Step 5：修改 `useShuffle()` — 用 `this._cfg` 替换查表**

找到 `useShuffle()` 里（约第 244-246 行）：

```js
// 重新铺放（遵循当前关卡 layerMax）
const cfg      = CONFIG.LEVELS[Math.min(this.level, CONFIG.LEVELS.length - 1)]
const layerMax = cfg.layerMax
```

替换为：

```js
// 重新铺放（遵循当前关卡 layerMax，每日挑战用 customCfg）
const layerMax = this._cfg.layerMax
```

- [ ] **Step 6：运行测试确认通过**

```bash
npx vitest run tests/GameLogic.test.js
```

期望：所有测试 PASS

- [ ] **Step 7：运行全量测试**

```bash
npx vitest run
```

期望：所有测试 PASS（65 个）

- [ ] **Step 8：提交**

```bash
git add src/logic/GameLogic.js tests/GameLogic.test.js
git commit -m "fix(GameLogic): useShuffle uses this._cfg.layerMax instead of hardcoded LEVELS[0]"
```

---

## Self-Review

**Spec coverage：**
- ✅ `reset()` 加 `this._cfg = null` → Step 3
- ✅ `initLevel()` 存 `this._cfg = cfg` → Step 4
- ✅ `useShuffle()` 用 `this._cfg.layerMax` → Step 5
- ✅ 测试：customCfg layerMax 约束验证 → Step 1

**Placeholder 扫描：** 无。

**类型一致性：** `this._cfg` 在 Step 3 初始化为 null，Step 4 赋值为 cfg 对象，Step 5 读取 `.layerMax`。`initLevel` 在 `useShuffle` 之前必然被调用（否则棋盘为空，`useShuffle` 会提前返回 `board_empty`），所以 `this._cfg` 在 Step 5 使用时不会为 null。
