# Daily Challenge Seeded Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily challenge board deterministic — exiting and re-entering on the same day always produces the identical board layout.

**Architecture:** Add an optional `seed` string to `GameLogic.initLevel()`. When present, `_buildBoard` uses a seeded Fisher-Yates shuffle (LCG) instead of `Math.random()`. `DailyScene` passes today's date string (`YYYYMMDD`) as the seed through `game.showDailyGame()` → `GameScene` → `GameLogic`. Normal levels are unaffected (no seed = existing random behavior).

**Tech Stack:** Vanilla JS ES modules, vitest for tests.

---

## File Map

| File | Change |
|------|--------|
| `src/logic/GameLogic.js` | Add `_seededShuffle(arr, rng)`, accept `seed` in `initLevel()`, use seeded shuffle in `_buildBoard` when seed present |
| `src/scenes/DailyScene.js` | Pass `this.dateStr` as seed to `game.showDailyGame()` |
| `game.js` | Thread `seed` param through `showDailyGame()` → `GameScene` constructor |
| `src/scenes/GameScene.js` | Accept `seed` in constructor, pass to `logic.initLevel()` |
| `tests/config.test.js` | Add determinism tests for seeded board |

---

## Task 1: Add seeded shuffle + seed param to GameLogic

**Files:**
- Modify: `src/logic/GameLogic.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/config.test.js`:

```js
import GameLogic from '../src/logic/GameLogic.js'

describe('GameLogic seeded board', () => {
  it('same seed produces identical board layout', () => {
    const cfg = { carTypes: 5, layerMax: 3, setCount: 3, maxMoves: 60 }

    const a = new GameLogic()
    a.initLevel(0, cfg, '20260514')

    const b = new GameLogic()
    b.initLevel(0, cfg, '20260514')

    // Serialize board: for each cell, list car types top-to-bottom
    const serialize = (logic) =>
      logic.board.map(row => row.map(stack => stack.map(c => c.type).join(','))).join('|')

    expect(serialize(a)).toBe(serialize(b))
  })

  it('different seeds produce different boards (with overwhelming probability)', () => {
    const cfg = { carTypes: 5, layerMax: 3, setCount: 3, maxMoves: 60 }

    const a = new GameLogic()
    a.initLevel(0, cfg, '20260514')

    const b = new GameLogic()
    b.initLevel(0, cfg, '20260515')

    const serialize = (logic) =>
      logic.board.map(row => row.map(stack => stack.map(c => c.type).join(','))).join('|')

    expect(serialize(a)).not.toBe(serialize(b))
  })

  it('no seed still works (random board)', () => {
    const cfg = { carTypes: 4, layerMax: 2, setCount: 3, maxMoves: 40 }
    const logic = new GameLogic()
    expect(() => logic.initLevel(0, cfg)).not.toThrow()
    expect(logic.totalCars).toBe(4 * 3 * 3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd c:/Users/esh-tech-001/.openclaw/workspace/brick-game
npx vitest run tests/config.test.js 2>&1
```

Expected: FAIL — `initLevel` does not accept a third argument yet.

- [ ] **Step 3: Add `_seededShuffle` and update `initLevel` + `_buildBoard` in GameLogic.js**

Open `src/logic/GameLogic.js`.

**3a.** Find the `_shuffle` method and add `_seededShuffle` right after it:

```js
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // Deterministic Fisher-Yates using an LCG seeded from a string
  _seededShuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // LCG pseudo-random generator seeded from a string
  _makeRng(seed) {
    let s = 0
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 0xFFFFFFFF
    }
  }
```

**3b.** Update `initLevel` signature to accept an optional `seed`:

Find:
```js
  initLevel(levelIdx, customCfg = null) {
    this.reset()
    this.level = levelIdx
    const cfg = customCfg || CONFIG.LEVELS[Math.min(levelIdx, CONFIG.LEVELS.length - 1)]
    this.maxMoves = cfg.maxMoves || 0
    this.undoLeft = 1

    // 每关固定配发 + Storage 里的额外存量
    const extra = getExtraProps()
    this.expandLeft  = CONFIG.PROPS_PER_LEVEL.expand  + (extra.expand  || 0)
    this.shuffleLeft = CONFIG.PROPS_PER_LEVEL.shuffle + (extra.shuffle || 0)
    // 额外量已合并进内存，清掉 Storage（避免下关重复叠加）
    if (extra.expand  > 0) spendExtraProp('expand',  extra.expand)
    if (extra.shuffle > 0) spendExtraProp('shuffle', extra.shuffle)

    this._buildBoard(cfg)
  }
```

Replace with:
```js
  initLevel(levelIdx, customCfg = null, seed = null) {
    this.reset()
    this.level = levelIdx
    const cfg = customCfg || CONFIG.LEVELS[Math.min(levelIdx, CONFIG.LEVELS.length - 1)]
    this.maxMoves = cfg.maxMoves || 0
    this.undoLeft = 1

    // 每关固定配发 + Storage 里的额外存量
    const extra = getExtraProps()
    this.expandLeft  = CONFIG.PROPS_PER_LEVEL.expand  + (extra.expand  || 0)
    this.shuffleLeft = CONFIG.PROPS_PER_LEVEL.shuffle + (extra.shuffle || 0)
    // 额外量已合并进内存，清掉 Storage（避免下关重复叠加）
    if (extra.expand  > 0) spendExtraProp('expand',  extra.expand)
    if (extra.shuffle > 0) spendExtraProp('shuffle', extra.shuffle)

    this._buildBoard(cfg, seed)
  }
```

**3c.** Update `_buildBoard` to accept and use the seed:

Find:
```js
  _buildBoard(cfg) {
```

Replace with:
```js
  _buildBoard(cfg, seed = null) {
    const shuffle = seed ? (arr) => this._seededShuffle(arr, this._makeRng(seed + arr.length)) : (arr) => this._shuffle(arr)
```

Then replace the two `this._shuffle(` calls inside `_buildBoard`:

Find:
```js
    this.totalCars = types.length
    this._shuffle(types)
```
Replace with:
```js
    this.totalCars = types.length
    shuffle(types)
```

Find:
```js
    this._shuffle(positions)
```
Replace with:
```js
    shuffle(positions)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/config.test.js 2>&1
```

Expected: all tests pass including the 3 new seeded-board tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/GameLogic.js tests/config.test.js
git commit -m "feat(logic): seeded board generation for daily challenge"
```

---

## Task 2: Thread seed through GameScene and game.js

**Files:**
- Modify: `src/scenes/GameScene.js:19` — accept `seed` in constructor
- Modify: `src/scenes/GameScene.js:55` — pass seed to `logic.initLevel()`
- Modify: `game.js:143` — accept and pass seed in `showDailyGame()`

- [ ] **Step 1: Update GameScene constructor to accept seed**

Open `src/scenes/GameScene.js`. Find:

```js
  constructor(game, levelIdx = 0, customCfg = null, onComplete = null) {
    this.game = game
    this.startLevel = levelIdx
    this._customCfg  = customCfg    // 每日挑战自定义参数
    this._onComplete = onComplete   // 每日挑战完成回调
```

Replace with:

```js
  constructor(game, levelIdx = 0, customCfg = null, onComplete = null, seed = null) {
    this.game = game
    this.startLevel = levelIdx
    this._customCfg  = customCfg    // 每日挑战自定义参数
    this._onComplete = onComplete   // 每日挑战完成回调
    this._seed       = seed         // 每日挑战棋盘种子（日期字符串）
```

- [ ] **Step 2: Pass seed to logic.initLevel() in GameScene.init()**

Find:

```js
    this.logic.initLevel(this.startLevel, this._customCfg)
```

Replace with:

```js
    this.logic.initLevel(this.startLevel, this._customCfg, this._seed)
```

- [ ] **Step 3: Update showDailyGame in game.js to accept and pass seed**

Open `game.js`. Find:

```js
  showDailyGame(levelCfg, dailyScene) {
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
```

Replace with:

```js
  showDailyGame(levelCfg, dailyScene, seed = null) {
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
```

Then find the `new GameScene(` call inside `showDailyGame` and add the seed:

Find:
```js
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
```

Replace with:
```js
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
```

And find where `scene` is constructed (the full constructor call ends with `})`). The fifth argument needs to be added. The full replacement:

Find:
```js
  showDailyGame(levelCfg, dailyScene, seed = null) {
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
      // 先让 DailyScene 处理统计/成就
      dailyScene.onDailyResult(isWin)
      // 再展示结算卡片，结算"下一步"返回每日挑战页
      this.currentScene = new ResultScene(this, score, carsWon, -1, isWin, stars, () => {
        this.showDaily()
      })
      this.currentScene.init()
    })
```

Replace with:
```js
  showDailyGame(levelCfg, dailyScene, seed = null) {
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
      // 先让 DailyScene 处理统计/成就
      dailyScene.onDailyResult(isWin)
      // 再展示结算卡片，结算"下一步"返回每日挑战页
      this.currentScene = new ResultScene(this, score, carsWon, -1, isWin, stars, () => {
        this.showDaily()
      })
      this.currentScene.init()
    }, seed)
```

- [ ] **Step 4: Update DailyScene to pass dateStr as seed**

Open `src/scenes/DailyScene.js`. Find:

```js
    if (hit(this.startBtn)) {
      this.game.showDailyGame(this.levelCfg, this)
      return
    }
```

Replace with:

```js
    if (hit(this.startBtn)) {
      this.game.showDailyGame(this.levelCfg, this, this.dateStr)
      return
    }
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/config.test.js 2>&1
```

Expected: all 12 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.js game.js src/scenes/DailyScene.js
git commit -m "feat(daily): pass date seed through to board generation for deterministic layout"
```

---

## Self-Review

**Spec coverage:**
- ✅ Same day, exit and re-enter → identical board: Task 1 makes `_buildBoard` deterministic when seed provided; Task 2 wires the date string as seed end-to-end
- ✅ Normal levels unaffected: `seed = null` default preserves existing `Math.random()` path
- ✅ Different days → different boards: different date strings → different LCG sequences

**Placeholder scan:** No TBDs. All code is complete.

**Type consistency:**
- `seed` is `string | null` throughout — `initLevel(levelIdx, customCfg, seed)`, `_buildBoard(cfg, seed)`, `GameScene(game, levelIdx, customCfg, onComplete, seed)`, `showDailyGame(levelCfg, dailyScene, seed)` — all consistent
- `_makeRng(seed)` called with `seed + arr.length` to produce two independent sequences for types and positions shuffles — avoids both arrays getting the same shuffle order

**One subtlety:** `_makeRng` is called twice per `_buildBoard` call (once for types, once for positions). Appending `arr.length` to the seed string makes the two RNG instances start from different states, so types and positions are shuffled independently. This is correct.
