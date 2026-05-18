# 渲染错误自救 + 胜负音效修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复渲染崩溃后用户卡死无法操作的问题，以及胜负音效被 stopSFX 截断的问题。

**Architecture:** Task 1 修改 `game.js`，在 `_handleRenderError` 中加入自动/触摸恢复逻辑；Task 2 修改 `src/utils/audio.js`，将 `playWin`/`playLose` 内部的 `_setSfxTimeout` 改为原生 `setTimeout`。两个 Task 完全独立，可按任意顺序执行。

**Tech Stack:** 微信小游戏 JS，Vitest 测试框架

---

### Task 1：渲染错误自救（game.js）

**Files:**
- Modify: `game.js:62` — 新增 `_renderErrorRecoveryTimer` 状态字段
- Modify: `game.js:171-189` — 更新 `_handleRenderError`
- Modify: `game.js:226-231` — 更新 `bindEvents` 的 `onTouchStart` 处理
- Test: `tests/smoke.test.js` — 新增渲染错误恢复行为测试

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
describe('Game._handleRenderError 恢复逻辑', () => {
  it('首次调用后 _renderErrorRecoveryTimer 非 null', () => {
    // 构造最小 Game 对象，不依赖 wx
    const fakeCtx = {
      save: () => {}, restore: () => {},
      fillStyle: '', font: '', textAlign: '', textBaseline: '',
      fillRect: () => {}, fillText: () => {},
    }
    const game = {
      _lastRenderErrorAt: 0,
      _renderErrorRecoveryTimer: null,
      showStart() { this._startShown = true },
      _handleRenderError(err) {
        const now = Date.now()
        if (now - this._lastRenderErrorAt > 1000) {
          this._lastRenderErrorAt = now
        }
        if (this._renderErrorRecoveryTimer === null) {
          this._renderErrorRecoveryTimer = setTimeout(() => {
            this._renderErrorRecoveryTimer = null
            this.showStart()
          }, 2000)
        }
      },
    }
    game._handleRenderError(new Error('test'))
    expect(game._renderErrorRecoveryTimer).not.toBeNull()
    clearTimeout(game._renderErrorRecoveryTimer)
  })

  it('重复调用不重置 timer（只调度一次）', () => {
    const game = {
      _lastRenderErrorAt: 0,
      _renderErrorRecoveryTimer: null,
      showStart() {},
      _handleRenderError(err) {
        if (this._renderErrorRecoveryTimer === null) {
          this._renderErrorRecoveryTimer = setTimeout(() => {
            this._renderErrorRecoveryTimer = null
            this.showStart()
          }, 2000)
        }
      },
    }
    game._handleRenderError(new Error('a'))
    const first = game._renderErrorRecoveryTimer
    game._handleRenderError(new Error('b'))
    expect(game._renderErrorRecoveryTimer).toBe(first)
    clearTimeout(first)
  })
})
```

- [ ] **Step 2：运行测试确认失败**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

预期：新增的两个测试 FAIL（`_renderErrorRecoveryTimer` 相关逻辑尚未在 game.js 实现）。

- [ ] **Step 3：在 game.js 新增状态字段**

在 `game.js:62`，`_lastRenderErrorAt: 0,` 后面加一行：

```js
  _lastRenderErrorAt: 0,
  _renderErrorRecoveryTimer: null,
```

- [ ] **Step 4：更新 _handleRenderError**

将 `game.js` 中的 `_handleRenderError` 方法替换为：

```js
  _handleRenderError(err) {
    const now = Date.now()
    if (now - this._lastRenderErrorAt > 1000) {
      this._lastRenderErrorAt = now
      try { console.error('[Game] render failed', err) } catch (e) {}
    }

    if (this._renderErrorRecoveryTimer === null) {
      this._renderErrorRecoveryTimer = setTimeout(() => {
        this._renderErrorRecoveryTimer = null
        this.showStart()
      }, 2000)
    }

    ctx.save()
    ctx.fillStyle = '#5BC8F5'
    ctx.fillRect(0, 0, logicWidth, logicHeight)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('画面异常，即将返回首页', logicWidth / 2, logicHeight / 2 - 12)
    ctx.font = '13px sans-serif'
    ctx.fillText('或点击屏幕立即返回', logicWidth / 2, logicHeight / 2 + 18)
    ctx.restore()
  },
```

- [ ] **Step 5：更新 bindEvents 的 onTouchStart**

将 `game.js` 中的 `onTouchStart` 处理替换为：

```js
    wx.onTouchStart((e) => {
      const touch = e.touches[0]
      if (this._renderErrorRecoveryTimer) {
        clearTimeout(this._renderErrorRecoveryTimer)
        this._renderErrorRecoveryTimer = null
        this.showStart()
        return
      }
      if (this.currentScene && this.currentScene.onTouchStart) {
        this.currentScene.onTouchStart(touch.clientX, touch.clientY)
      }
    })
```

- [ ] **Step 6：运行测试确认通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

预期：所有测试 PASS，包括新增的两个。

- [ ] **Step 7：提交**

```bash
git add game.js tests/smoke.test.js
git commit -m "fix(game): render error auto-recovery and touch-to-recover"
```

---

### Task 2：playWin/playLose 改为原生 setTimeout（src/utils/audio.js）

**Files:**
- Modify: `src/utils/audio.js:259-264` — `playWin` 内部 `_setSfxTimeout` → `setTimeout`
- Modify: `src/utils/audio.js:278-299` — `playLose` 内部 `_setSfxTimeout` → `setTimeout`
- Test: `tests/smoke.test.js` — 新增 playWin/playLose 不注册到 _sfxTimers 的测试

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
describe('AudioManager.playWin / playLose 不注册到 _sfxTimers', () => {
  it('playWin 调用后 _sfxTimers 长度不变', async () => {
    // AudioManager 是单例，直接 import
    const { default: AudioManager } = await import('../src/utils/audio.js')
    // 不初始化 _ctx，让内部音频调用静默失败
    AudioManager._enabled = false
    const before = AudioManager._sfxTimers.length
    AudioManager.playWin()
    expect(AudioManager._sfxTimers.length).toBe(before)
  })

  it('playLose 调用后 _sfxTimers 长度不变', async () => {
    const { default: AudioManager } = await import('../src/utils/audio.js')
    AudioManager._enabled = false
    const before = AudioManager._sfxTimers.length
    AudioManager.playLose()
    expect(AudioManager._sfxTimers.length).toBe(before)
  })
})
```

- [ ] **Step 2：运行测试确认失败**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

预期：新增的两个测试 FAIL（`playWin`/`playLose` 目前仍用 `_setSfxTimeout`，会增加 `_sfxTimers` 长度）。

- [ ] **Step 3：修改 playWin**

将 `src/utils/audio.js` 中 `playWin` 方法的三处 `_setSfxTimeout` 替换为 `setTimeout`：

```js
  playWin() {
    // C5-E5-G5-C6 上行，然后 E6-G6 收尾，欢快活泼
    const notes = [
      { freq: 523,  dur: 0.18, vol: 0.42 },  // C5
      { freq: 659,  dur: 0.18, vol: 0.45 },  // E5
      { freq: 784,  dur: 0.18, vol: 0.48 },  // G5
      { freq: 1047, dur: 0.24, vol: 0.52 },  // C6
      { freq: 1319, dur: 0.20, vol: 0.50 },  // E6
      { freq: 1568, dur: 0.35, vol: 0.55 },  // G6
    ]
    this._playNotes(notes, 95)
    // 铃声叠加，营造庆祝感（fire-and-forget，不受 stopSFX 管控）
    setTimeout(() => this._bell(2093, 0.7, 0.28), 480)  // C7 高铃
    setTimeout(() => this._bell(1568, 0.9, 0.22), 560)  // G6 铃
    // 气泡连串
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this._pop(0.15 + Math.random() * 0.1), i * 80 + 50)
    }
  },
```

- [ ] **Step 4：修改 playLose**

将 `src/utils/audio.js` 中 `playLose` 方法的两处 `_setSfxTimeout` 替换为 `setTimeout`：

```js
  playLose() {
    // G4→E4→C4→A3，逐渐低沉
    const notes = [
      { freq: 392, dur: 0.22, vol: 0.38 },  // G4
      { freq: 330, dur: 0.24, vol: 0.35 },  // E4
      { freq: 262, dur: 0.26, vol: 0.32 },  // C4
      { freq: 220, dur: 0.35, vol: 0.28 },  // A3
    ]
    this._playNotes(notes, 130)
    // 结尾加一个低沉滑落（fire-and-forget，不受 stopSFX 管控）
    setTimeout(() => this._sweep(220, 130, 'triangle', 0.35, 0.2), 520)
    // 低频噪声，增加"沮丧"质感
    setTimeout(() => {
      if (!this._enabled || !this._ctx) return
      try {
        const ctx = this._ctx
        const bufSize = Math.floor(ctx.sampleRate * 0.35)
        const buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
        const src = ctx.createBufferSource()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'; filter.frequency.value = 280
        src.buffer = buf
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
        this._cleanupOnEnd(src, [src, filter, gain])
        src.start(); src.stop(ctx.currentTime + 0.36)
      } catch (e) {}
    }, 540)
  },
```

- [ ] **Step 5：运行测试确认通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

预期：所有测试 PASS，包括新增的两个。

- [ ] **Step 6：提交**

```bash
git add src/utils/audio.js tests/smoke.test.js
git commit -m "fix(audio): playWin/playLose use native setTimeout, not stopSFX-managed"
```
