# 关卡难度重设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/config.js` 的 30 关参数替换为经模拟验证的手工精调数据，删除 phase1/phase2/phase3 算法生成逻辑，使难度曲线符合"前 10 关轻松入门、11-20 关明显变难、21-30 关极难"的三段式设计。

**Architecture:** 只修改 `src/config.js` 中 `LEVELS` 的 IIFE 内容——把现有的 `hand`（10 条）+ `generated`（20 条算法生成）替换为一个包含全部 30 条固定参数的数组，直接 `return` 该数组。同步更新 `tests/GameLogic.test.js` 中第 10 关的断言（totalCars 96→84，maxMoves 120→118）。

**Tech Stack:** 微信小游戏 JS，Vitest 测试框架

---

### Task 1：更新第 10 关测试断言（先写失败测试）

**Files:**
- Modify: `tests/GameLogic.test.js:19-23`

- [ ] **Step 1：写失败测试**

将 `tests/GameLogic.test.js` 第 19-23 行：

```js
    it('第 10 关：8 车型 × 4 组 × 3 块 = 96 辆，maxMoves=120', () => {
      g.initLevel(9)
      expect(g.totalCars).toBe(96)
      expect(g.maxMoves).toBe(120)
    })
```

替换为：

```js
    it('第 10 关：7 车型 × 4 组 × 3 块 = 84 辆，maxMoves=118', () => {
      g.initLevel(9)
      expect(g.totalCars).toBe(84)
      expect(g.maxMoves).toBe(118)
    })
```

- [ ] **Step 2：运行测试确认失败**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "第 10 关|Tests"
```

预期：`第 10 关` 测试 FAIL（config 还没改，totalCars 仍是 96）。

---

### Task 2：替换 LEVELS 数组

**Files:**
- Modify: `src/config.js:48-106`

- [ ] **Step 3：替换 LEVELS IIFE**

将 `src/config.js` 第 48-106 行（从 `LEVELS: (() => {` 到 `})(),`）整体替换为：

```js
  LEVELS: [
    // ── 第一段：轻松入门（1-6 关）AI 通关率 87-100% ──
    { carTypes: 3, layerMax: 2, setCount: 3, maxMoves:  45 }, // 1：27辆 密0.55 步均1.67
    { carTypes: 4, layerMax: 2, setCount: 3, maxMoves:  50 }, // 2：36辆 密0.73 步均1.39
    { carTypes: 4, layerMax: 3, setCount: 3, maxMoves:  52 }, // 3：36辆 密0.73 步均1.44
    { carTypes: 5, layerMax: 2, setCount: 3, maxMoves:  52 }, // 4：45辆 密0.92 步均1.16
    { carTypes: 5, layerMax: 3, setCount: 3, maxMoves:  56 }, // 5：45辆 密0.92 步均1.24
    { carTypes: 5, layerMax: 3, setCount: 4, maxMoves:  75 }, // 6：60辆 密1.22 步均1.25

    // ── 第二段：第一道门槛（7-10 关）AI 通关率 10-52% ──
    { carTypes: 6, layerMax: 2, setCount: 3, maxMoves:  72 }, // 7：54辆 密1.10 步均1.33
    { carTypes: 6, layerMax: 3, setCount: 3, maxMoves:  75 }, // 8：54辆 密1.10 步均1.39
    { carTypes: 7, layerMax: 3, setCount: 3, maxMoves:  88 }, // 9：63辆 密1.29 步均1.40
    { carTypes: 7, layerMax: 3, setCount: 4, maxMoves: 118 }, // 10：84辆 密1.71 步均1.40

    // ── 第三段：进阶（11-20 关）AI 通关率 0-38%，喘息-挑战交替 ──
    { carTypes: 6, layerMax: 3, setCount: 4, maxMoves: 100 }, // 11：72辆 密1.47 喘息
    { carTypes: 7, layerMax: 3, setCount: 3, maxMoves:  92 }, // 12：63辆 密1.29 喘息
    { carTypes: 7, layerMax: 3, setCount: 4, maxMoves: 118 }, // 13：84辆 密1.71 挑战
    { carTypes: 8, layerMax: 3, setCount: 3, maxMoves: 108 }, // 14：72辆 密1.47 挑战（8种车型首次）
    { carTypes: 8, layerMax: 3, setCount: 4, maxMoves: 140 }, // 15：96辆 密1.96 极限
    { carTypes: 7, layerMax: 4, setCount: 3, maxMoves:  92 }, // 16：63辆 密1.29 喘息
    { carTypes: 7, layerMax: 4, setCount: 4, maxMoves: 122 }, // 17：84辆 密1.71 挑战
    { carTypes: 8, layerMax: 4, setCount: 3, maxMoves: 110 }, // 18：72辆 密1.47 挑战
    { carTypes: 8, layerMax: 4, setCount: 4, maxMoves: 142 }, // 19：96辆 密1.96 极限
    { carTypes: 8, layerMax: 4, setCount: 4, maxMoves: 138 }, // 20：96辆 密1.96 极限

    // ── 第四段：极难（21-30 关）AI 通关率 0%，人类高手配合道具约 5-15% ──
    { carTypes: 8, layerMax: 4, setCount: 5, maxMoves: 172 }, // 21：120辆 密2.45
    { carTypes: 8, layerMax: 4, setCount: 5, maxMoves: 168 }, // 22：120辆 密2.45
    { carTypes: 8, layerMax: 5, setCount: 4, maxMoves: 142 }, // 23：96辆  密1.96
    { carTypes: 8, layerMax: 5, setCount: 5, maxMoves: 172 }, // 24：120辆 密2.45
    { carTypes: 8, layerMax: 5, setCount: 5, maxMoves: 168 }, // 25：120辆 密2.45
    { carTypes: 8, layerMax: 5, setCount: 5, maxMoves: 165 }, // 26：120辆 密2.45
    { carTypes: 8, layerMax: 5, setCount: 6, maxMoves: 200 }, // 27：144辆 密2.94
    { carTypes: 8, layerMax: 5, setCount: 6, maxMoves: 196 }, // 28：144辆 密2.94
    { carTypes: 8, layerMax: 5, setCount: 6, maxMoves: 192 }, // 29：144辆 密2.94
    { carTypes: 8, layerMax: 5, setCount: 7, maxMoves: 228 }, // 30：168辆 密3.43
  ],
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -8
```

预期：`94 passed`，无 FAIL。

- [ ] **Step 5：提交**

```bash
git add src/config.js tests/GameLogic.test.js
git commit -m "fix(config): redesign 30-level difficulty curve based on Monte Carlo simulation

Replace phase-based generated levels with 30 hand-tuned entries.
Density is the primary difficulty driver; step ratio kept at 1.33-1.50.
Levels 7-10: AI win rate 10-52% (first gate).
Levels 11-20: alternating rest/challenge, AI 0-38%.
Levels 21-30: extreme, AI 0%, human ~5-15% with tools."
```
