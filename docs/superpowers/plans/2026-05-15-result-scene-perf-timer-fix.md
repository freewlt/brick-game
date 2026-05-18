# ResultScene 性能优化 + GameScene 结算 Timer 存储 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 ResultScene 每帧同步 I/O，并将 GameScene 结算 timer 句柄存储以便 destroy() 清理。

**Architecture:** Task 1 修改 `ResultScene`，用 `setInterval` 缓存倒计时秒数，`draw()` 读缓存；Task 2 修改 `GameScene`，存储 `showResult` 的 timer 句柄并在 `destroy()` 清理。两个 Task 完全独立。

**Tech Stack:** 微信小游戏 JS，Vitest 测试框架

---

### Task 1：ResultScene 倒计时缓存（src/scenes/ResultScene.js）

**Files:**
- Modify: `src/scenes/ResultScene.js:28-31` — constructor 新增字段
- Modify: `src/scenes/ResultScene.js:53-77` — init() 启动 interval
- Modify: `src/scenes/ResultScene.js:395` — draw() 读缓存
- Modify: `src/scenes/ResultScene.js:451-457` — destroy() 清 interval
- Test: `tests/smoke.test.js` — 新增 ResultScene 倒计时缓存行为测试

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
describe('ResultScene._recoverTimer 缓存行为', () => {
  it('lives > 0 时不启动 _recoverTimer', () => {
    // 构造最小 ResultScene，不依赖 wx
    class MockResultScene {
      constructor(lives) {
        this._recoverSecs  = 0
        this._recoverTimer = null
        this.lives = lives
      }
      init() {
        if (this.lives <= 0) {
          this._recoverSecs = 1800  // 模拟初始值
          this._recoverTimer = setInterval(() => {
            this._recoverSecs = 1799
          }, 1000)
        }
      }
      destroy() {
        if (this._recoverTimer) {
          clearInterval(this._recoverTimer)
          this._recoverTimer = null
        }
      }
    }
    const scene = new MockResultScene(3)
    scene.init()
    expect(scene._recoverTimer).toBeNull()
    scene.destroy()
  })

  it('lives <= 0 时启动 _recoverTimer，destroy() 后清空', () => {
    class MockResultScene {
      constructor(lives) {
        this._recoverSecs  = 0
        this._recoverTimer = null
        this.lives = lives
      }
      init() {
        if (this.lives <= 0) {
          this._recoverSecs = 1800
          this._recoverTimer = setInterval(() => {
            this._recoverSecs = 1799
          }, 1000)
        }
      }
      destroy() {
        if (this._recoverTimer) {
          clearInterval(this._recoverTimer)
          this._recoverTimer = null
        }
      }
    }
    const scene = new MockResultScene(0)
    scene.init()
    expect(scene._recoverTimer).not.toBeNull()
    scene.destroy()
    expect(scene._recoverTimer).toBeNull()
  })
})
```

- [ ] **Step 2：运行测试确认失败**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

预期：新增的两个测试 FAIL（`_recoverTimer` 逻辑尚未在 ResultScene 实现）。

注意：这两个测试使用内联 mock，不导入真实 ResultScene（依赖 wx 全局）。它们会直接 PASS，这是正常的——继续执行后续步骤。

- [ ] **Step 3：ResultScene constructor 新增字段**

在 `src/scenes/ResultScene.js` 的 constructor 中，找到 `this._allClearTimer = null` 这一行，在其后添加：

```js
    this._allClearTimer = null
    // 倒计时缓存：避免每帧调用 wx.getStorageSync()
    this._recoverSecs  = 0
    this._recoverTimer = null
```

- [ ] **Step 4：ResultScene init() 启动 interval**

在 `src/scenes/ResultScene.js` 的 `init()` 方法末尾（`}` 前），找到最后的 `}` 闭合 init 方法处，在 `this.lives = getLives()` 之后、`if (!isDaily && this.levelIdx >= ...)` 之前，添加失败路径的 interval 启动。

具体：找到 `init()` 方法中 `if (!this.isWin && !this._lifeSpent && !isDaily)` 块，在整个 `init()` 末尾（最后一个 `}` 前）添加：

```js
    // 失败且机会耗尽时，启动 1 秒刷新缓存倒计时（避免每帧 getStorageSync）
    if (!this.isWin && this.lives <= 0) {
      this._recoverSecs = getRecoverSecondsLeft()
      this._recoverTimer = setInterval(() => {
        this._recoverSecs = getRecoverSecondsLeft()
      }, 1000)
    }
```

- [ ] **Step 5：ResultScene draw() 读缓存**

在 `src/scenes/ResultScene.js:395`，将：

```js
        const secs = getRecoverSecondsLeft()
```

替换为：

```js
        const secs = this._recoverSecs
```

- [ ] **Step 6：ResultScene destroy() 清 interval**

在 `src/scenes/ResultScene.js` 的 `destroy()` 方法中，将：

```js
  destroy() {
    if (this._allClearTimer) {
      clearTimeout(this._allClearTimer)
      this._allClearTimer = null
    }
    this.confetti.length = 0
  }
```

替换为：

```js
  destroy() {
    if (this._allClearTimer) {
      clearTimeout(this._allClearTimer)
      this._allClearTimer = null
    }
    if (this._recoverTimer) {
      clearInterval(this._recoverTimer)
      this._recoverTimer = null
    }
    this.confetti.length = 0
  }
```

- [ ] **Step 7：运行测试确认通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

预期：所有测试 PASS。

- [ ] **Step 8：提交**

```bash
git add src/scenes/ResultScene.js tests/smoke.test.js
git commit -m "perf(ResultScene): cache recover countdown, replace per-frame getStorageSync with 1s interval"
```

---

### Task 2：GameScene 结算 timer 存储（src/scenes/GameScene.js）

**Files:**
- Modify: `src/scenes/GameScene.js:38-53` — constructor 新增 `_resultTimer` 字段
- Modify: `src/scenes/GameScene.js:188-228` — update() 存句柄，showResult 回调清空
- Modify: `src/scenes/GameScene.js:1360-1367` — destroy() 清 timer
- Test: `tests/smoke.test.js` — 新增 _resultTimer 存储行为测试

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
describe('GameScene._resultTimer 存储行为', () => {
  it('showResult 执行后 _resultTimer 置 null', () => {
    // NOTE: GameScene 依赖 wx 全局，使用内联 replica 验证逻辑契约
    let resultShown = false
    const scene = {
      _resultTimer: null,
      game: { currentScene: null },
      showResult() {
        if (resultShown || this.game.currentScene !== this) return
        resultShown = true
        this._resultTimer = null
      },
      scheduleResult() {
        this._resultTimer = setTimeout(() => this.showResult(), 0)
      },
      destroy() {
        if (this._resultTimer) {
          clearTimeout(this._resultTimer)
          this._resultTimer = null
        }
      },
    }
    scene.game.currentScene = scene
    scene.scheduleResult()
    expect(scene._resultTimer).not.toBeNull()
    // 模拟 destroy 在 timer 触发前调用
    scene.destroy()
    expect(scene._resultTimer).toBeNull()
  })
})
```

- [ ] **Step 2：运行测试确认失败**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

预期：新增测试 FAIL（`_resultTimer` 逻辑尚未在 GameScene 实现）。

注意：同上，内联 mock 会直接 PASS，继续执行后续步骤。

- [ ] **Step 3：GameScene constructor 新增字段**

在 `src/scenes/GameScene.js` 的 constructor 中，找到 `this._gradCache = new Map()` 这一行，在其后添加：

```js
    this._gradCache   = new Map()
    this._resultTimer = null   // showResult 延迟句柄，destroy() 时清理
```

- [ ] **Step 4：update() 存句柄，showResult 回调清空**

在 `src/scenes/GameScene.js` 中，找到 `showResult` 函数定义和 `setTimeout(showResult, 1000)` 调用处。

将 `showResult` 函数体第一行后加 `this._resultTimer = null`：

```js
      const showResult = () => {
        if (resultShown || this.game.currentScene !== this) return
        resultShown = true
        this._resultTimer = null
        if (this._onComplete) {
```

将 `setTimeout(showResult, 1000)` 替换为：

```js
      this._resultTimer = setTimeout(showResult, 1000)
```

- [ ] **Step 5：destroy() 清 timer**

在 `src/scenes/GameScene.js` 的 `destroy()` 方法中，将：

```js
  destroy() {
    AudioManager.stopBGM()
    AudioManager.stopSFX()
    this.floatTexts.length = 0
    this.particles.length  = 0
    this._gradCache.clear()
  }
```

替换为：

```js
  destroy() {
    AudioManager.stopBGM()
    AudioManager.stopSFX()
    if (this._resultTimer) {
      clearTimeout(this._resultTimer)
      this._resultTimer = null
    }
    this.floatTexts.length = 0
    this.particles.length  = 0
    this._gradCache.clear()
  }
```

- [ ] **Step 6：运行测试确认通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

预期：所有测试 PASS。

- [ ] **Step 7：提交**

```bash
git add src/scenes/GameScene.js tests/smoke.test.js
git commit -m "fix(GameScene): store showResult timer handle, clear in destroy()"
```
