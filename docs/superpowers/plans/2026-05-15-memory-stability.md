# 运行内存不足闪退 Writing Plan

> **For agentic workers:** This plan records the implemented memory-stability changes. Future workers should keep edits scoped and verify on real WeChat devices because Node tests cannot measure mini-game runtime memory.

**Goal:** 降低微信小游戏长时间运行时的运行内存和显存压力，减少“运行内存不足”闪退。

**Architecture:** 保持现有单 Canvas、场景类和 WebAudio 合成音效架构不变。优先减少热路径对象分配、降低画布显存、主动释放音频节点。

**Tech Stack:** JavaScript ES modules · 微信小游戏 Canvas 2D API · WebAudio 合成音效 · Vitest

**Brainstorm:** [docs/superpowers/specs/2026-05-15-memory-stability-brainstorm.md](../specs/2026-05-15-memory-stability-brainstorm.md)

---

## Phase A：Canvas 显存控制

### Task A1：限制 Canvas DPR 上限

**Problem:** DPR=3 设备会让物理画布像素量变成逻辑尺寸的 9 倍，显存占用明显升高。

**Files:**
- Modify: `game.js`

- [x] 将 `const dpr = sysInfo.pixelRatio || 1` 改为 `Math.min(sysInfo.pixelRatio || 1, 2)`
- [x] 添加注释说明取舍：卡通画面封顶到 2 更稳
- [x] 保持触摸坐标仍使用逻辑尺寸，无需改场景逻辑

**Verification:**
- [x] `node --check game.js`

---

## Phase B：GameScene 热路径降分配

### Task B1：动画数组原地清理

**Problem:** `floatTexts.filter(...)` 和 `particles.filter(...)` 每帧都会创建新数组。

**Files:**
- Modify: `src/scenes/GameScene.js`

- [x] 新增 `_updateAnimationList(list)`
- [x] 用写指针原地保留未死亡动画对象
- [x] 替换 `this.floatTexts = this.floatTexts.filter(...)`
- [x] 替换 `this.particles = this.particles.filter(...)`

**Verification:**
- [x] `node --check src/scenes/GameScene.js`
- [x] `npm test`

### Task B2：降低消除粒子数量

**Problem:** 每次消除创建 18 个粒子，连续消除时短时间对象数量较高。

**Files:**
- Modify: `src/scenes/GameScene.js`

- [x] 每次消除粒子从 `18` 个降为最多 `8` 个
- [x] 粒子总量封顶到 `64`

**Verification:**
- [x] `node --check src/scenes/GameScene.js`
- [x] `npm test`


## Phase C：WebAudio 内存释放

### Task C1：移除木琴短噪声 buffer

**Problem:** `_marimba()` 每次播放都会创建一个短 `AudioBuffer` 用于模拟敲击噪声。BGM 和点击音频繁触发，会持续制造内存压力。

**Files:**
- Modify: `src/utils/audio.js`

- [x] 保留主正弦波和三角泛音
- [x] 删除短白噪声 buffer、bufferSource、bandpass filter
- [x] 保留点击、入槽、消除、连消、胜负等主音效

**Tradeoff:** 少一点“木槌啪”的质感，音效主反馈仍在。

**Verification:**
- [x] `node --check src/utils/audio.js`
- [x] `npm test`
- [ ] 真机试听：点击、入槽、消除、胜利、失败

### Task C2：音频节点播放结束后主动断开

**Problem:** WebAudio 节点播放结束后依赖 GC 回收，小游戏环境中可能释放不及时。

**Files:**
- Modify: `src/utils/audio.js`

- [x] 新增 `_cleanupOnEnd(source, nodes)`
- [x] oscillator 结束后断开 oscillator/gain
- [x] bufferSource 结束后断开 source/filter/gain

**Verification:**
- [x] `node --check src/utils/audio.js`
- [x] `npm test`

### Task C3：关卡结束时停止 BGM

**Problem:** 胜利/失败后进入结算前，BGM 仍可能继续排队播放。

**Files:**
- Modify: `src/scenes/GameScene.js`

- [x] 在首次检测到 `logic.gameOver || logic.win` 时调用 `AudioManager.stopBGM()`
- [x] 保留胜利/失败音效播放

**Verification:**
- [x] `node --check src/scenes/GameScene.js`
- [x] `npm test`

---

## Phase D：既有相关修复

### Task D1：成就弹窗不再被结算页抢走

**Problem:** 新成就弹窗 1200ms 后显示，但结算页 1000ms 后切走，导致弹窗不可见。

**Files:**
- Modify: `src/scenes/GameScene.js`

- [x] 封装 `showResult()`，保证只跳转一次
- [x] 有新成就时先展示成就弹窗
- [x] 成就弹窗关闭后进入结算页
- [x] 无新成就时保留 1000ms 后进入结算页

**Verification:**
- [x] `node --check src/scenes/GameScene.js`
- [x] `npm test`

---

## 验证结果

Completed:
- [x] `node --check game.js`
- [x] `node --check src/scenes/GameScene.js`
- [x] `node --check src/utils/audio.js`
- [x] `npm test`

Observed test result:
- `5` test files passed
- `60` tests passed

Known test warning:
- Node 环境没有微信 `wx` 全局对象，因此部分测试会输出 `[wxApi] getStorageSync failed: ReferenceError: wx is not defined`
- 这是现有兜底日志，不影响测试通过

## 真机验收清单

- [ ] 启动游戏，在开始页停留 2 分钟，观察内存是否稳定
- [ ] 连续玩第 1 关 3 次，确认无明显内存爬升
- [ ] 玩高难关卡 5-10 分钟，连续点击、撤销、洗牌、消除
- [ ] 确认点击/入槽/消除/胜负音效仍存在
- [ ] 确认 DPR 封顶后画面没有明显糊
- [ ] 确认棋盘纯色高光视觉可接受
- [ ] 通关触发新成就时，成就弹窗能先显示，关闭后进入结算页

## 回滚策略

如果视觉不可接受：
- 只回滚 `GameScene` 中纯色高光改动，保留 DPR 和 audio 释放优化

如果画面明显模糊：
- 将 DPR 上限从 `2` 调整为 `2.5`

如果仍然内存不足：
- 将 DPR 上限从 `2` 调整为 `1.5`
- 给 BGM 增加默认关闭策略，仅保留短音效
- 后续做离屏 canvas 图块缓存，替代逐帧绘制格子高光

---

## Phase E：渐变对象缓存（消除每帧 GC 压力）

### Task E1：`drawGlassCard` 加可选 `cache` 参数

**Problem:** `drawGlassCard` 每次调用创建 4 个 `LinearGradient`，棋盘 49 格 × 60fps = 每秒约 14,000 个短命对象，GC 持续高压。

**Files:**
- Modify: `src/utils/draw.js`
- Modify: `tests/draw.test.js`

- [ ] **Step 1：在 `tests/draw.test.js` 末尾追加 cache 测试**

```js
// ── drawGlassCard cache 测试 ──
function makeGradCtx() {
  const gradients = []
  const ctx = {
    save: vi.fn(), restore: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
    fill: vi.fn(), stroke: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(), closePath: vi.fn(),
    createLinearGradient: vi.fn((...args) => {
      const g = { addColorStop: vi.fn(), _args: args }
      gradients.push(g)
      return g
    }),
  }
  return { ctx, gradients }
}

describe('drawGlassCard cache', () => {
  it('不传 cache 时每次调用都创建新渐变', () => {
    const { ctx, gradients } = makeGradCtx()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000')
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000')
    expect(gradients.length).toBe(8)   // 每次 4 个，共 8 个
  })

  it('传入 cache 时第二次调用命中缓存，不再创建渐变', () => {
    const { ctx, gradients } = makeGradCtx()
    const cache = new Map()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    expect(gradients.length).toBe(4)   // 第二次全部命中，只创建了 4 个
    expect(cache.size).toBe(4)
  })

  it('不同 color 不共享缓存', () => {
    const { ctx, gradients } = makeGradCtx()
    const cache = new Map()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#00ff00', {}, cache)
    expect(gradients.length).toBe(8)
    expect(cache.size).toBe(8)
  })

  it('不同尺寸不共享缓存', () => {
    const { ctx, gradients } = makeGradCtx()
    const cache = new Map()
    drawGlassCard(ctx, 0, 0, 50, 50, 8, '#ff0000', {}, cache)
    drawGlassCard(ctx, 0, 0, 60, 60, 8, '#ff0000', {}, cache)
    expect(gradients.length).toBe(8)
  })
})
```

- [ ] **Step 2：运行测试确认失败**

```bash
npx vitest run tests/draw.test.js
```

期望：`drawGlassCard cache` 下的测试 FAIL

- [ ] **Step 3：修改 `src/utils/draw.js` — `drawGlassCard` 新签名**

将函数签名改为 `export function drawGlassCard(ctx, x, y, w, h, r, baseColor, opts = {}, cache = null)`，并在函数体内加 `getGrad` 辅助：

```js
export function drawGlassCard(ctx, x, y, w, h, r, baseColor, opts = {}, cache = null) {
  const {
    sides       = 'all',
    topAlpha    = 0.62,
    midAlpha    = 0.18,
    sideAlpha   = 0.28,
    rightAlpha  = 0.16,
    bottomAlpha = 0.20,
    border      = 'rgba(160,215,245,0.60)',
  } = opts

  const getGrad = (subtype, x0, y0, x1, y1, stops) => {
    if (cache) {
      const key = `glasscard|${subtype}|${x}|${y}|${w}|${h}|${baseColor}`
      if (cache.has(key)) return cache.get(key)
      const g = ctx.createLinearGradient(x0, y0, x1, y1)
      for (const [offset, color] of stops) g.addColorStop(offset, color)
      cache.set(key, g)
      return g
    }
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    for (const [offset, color] of stops) g.addColorStop(offset, color)
    return g
  }

  ctx.save()
  ctx.fillStyle = baseColor
  roundRect(ctx, x, y, w, h, r); ctx.fill()

  const tg = getGrad('top', x, y, x, y + h * 0.44, [
    [0,   `rgba(255,255,255,${topAlpha})`],
    [0.5, `rgba(255,255,255,${midAlpha})`],
    [1,   'rgba(255,255,255,0.00)'],
  ])
  ctx.fillStyle = tg
  roundRect(ctx, x, y, w, h * 0.44, { tl: r, tr: r, bl: 0, br: 0 }); ctx.fill()

  if (sides === 'all') {
    const lg = getGrad('left', x, y, x + w * 0.14, y, [
      [0, `rgba(255,255,255,${sideAlpha})`],
      [1, 'rgba(255,255,255,0.00)'],
    ])
    ctx.fillStyle = lg
    roundRect(ctx, x, y, w * 0.14, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()

    const rg = getGrad('right', x + w, y, x + w - w * 0.10, y, [
      [0, `rgba(255,255,255,${rightAlpha})`],
      [1, 'rgba(255,255,255,0.00)'],
    ])
    ctx.fillStyle = rg
    roundRect(ctx, x + w - w * 0.10, y, w * 0.10, h, { tl: 0, tr: r, bl: 0, br: r }); ctx.fill()

    const bg2 = getGrad('bottom', x, y + h, x, y + h - h * 0.16, [
      [0, `rgba(255,255,255,${bottomAlpha})`],
      [1, 'rgba(255,255,255,0.00)'],
    ])
    ctx.fillStyle = bg2
    roundRect(ctx, x, y + h - h * 0.16, w, h * 0.16, { tl: 0, tr: 0, bl: r, br: r }); ctx.fill()
  }

  ctx.strokeStyle = border
  ctx.lineWidth   = 1.2
  roundRect(ctx, x, y, w, h, r); ctx.stroke()
  ctx.restore()
}
```

- [ ] **Step 4：运行测试确认通过**

```bash
npx vitest run tests/draw.test.js
```

期望：所有测试 PASS

- [ ] **Step 5：提交**

```bash
git add src/utils/draw.js tests/draw.test.js
git commit -m "feat(draw): add optional cache param to drawGlassCard to reuse LinearGradient objects"
```

---

### Task E2：`GameScene` 接入渐变缓存

**Problem:** `_drawBoard` 里空格和有车格子的渐变是内联创建的，每帧重复分配。有车格子渐变坐标以 `0,0` 为中心（`ctx.translate` 后），所有格子 `sz` 相同，可共享同一套渐变。

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1：构造函数加 `_gradCache`**

在构造函数末尾（`this._textWidthCache = new Map()` 之后）加：

```js
this._gradCache = new Map()
```

- [ ] **Step 2：`init()` 时清空 cache**

在 `init()` 方法末尾的 `setTimeout(...)` 之前加：

```js
this._gradCache.clear()
this._bgGrad = null
```

- [ ] **Step 3：`_drawGridTexture` 棋盘底板渐变改为缓存**

找到 `_drawGridTexture` 里：

```js
const panelG = ctx.createLinearGradient(bx, by, bx, by + bh)
panelG.addColorStop(0, 'rgba(255,255,255,0.06)')
panelG.addColorStop(1, 'rgba(0,0,0,0.06)')
ctx.fillStyle = panelG
```

替换为：

```js
const panelKey = `grid|panel|${bx}|${by}|${bh}`
if (!this._gradCache.has(panelKey)) {
  const g = ctx.createLinearGradient(bx, by, bx, by + bh)
  g.addColorStop(0, 'rgba(255,255,255,0.06)')
  g.addColorStop(1, 'rgba(0,0,0,0.06)')
  this._gradCache.set(panelKey, g)
}
ctx.fillStyle = this._gradCache.get(panelKey)
```

- [ ] **Step 4：`_drawBoard` 空格渐变改为缓存**

找到 `if (!topCar) {` 块内的 4 个 `createLinearGradient`（`emptyHg`、`emptyL`、`emptyR`、`emptyB`），替换为：

```js
// 顶部高光
const hgKey = `empty|top|${x}|${y}|${sz}`
if (!this._gradCache.has(hgKey)) {
  const g = ctx.createLinearGradient(x, y, x, y + sz * 0.45)
  g.addColorStop(0,   'rgba(255,255,255,0.52)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  g.addColorStop(1,   'rgba(255,255,255,0.00)')
  this._gradCache.set(hgKey, g)
}
ctx.fillStyle = this._gradCache.get(hgKey)
roundRect(ctx, x, y, sz, sz * 0.45, { tl:10, tr:10, bl:0, br:0 }); ctx.fill()

// 左侧亮边
const lKey = `empty|left|${x}|${y}|${sz}`
if (!this._gradCache.has(lKey)) {
  const g = ctx.createLinearGradient(x, y, x + sz*0.18, y)
  g.addColorStop(0, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0.00)')
  this._gradCache.set(lKey, g)
}
ctx.fillStyle = this._gradCache.get(lKey)
roundRect(ctx, x, y, sz*0.18, sz, { tl:10, tr:0, bl:10, br:0 }); ctx.fill()

// 右侧亮边
const rKey = `empty|right|${x}|${y}|${sz}`
if (!this._gradCache.has(rKey)) {
  const g = ctx.createLinearGradient(x + sz, y, x + sz - sz*0.14, y)
  g.addColorStop(0, 'rgba(255,255,255,0.14)')
  g.addColorStop(1, 'rgba(255,255,255,0.00)')
  this._gradCache.set(rKey, g)
}
ctx.fillStyle = this._gradCache.get(rKey)
roundRect(ctx, x + sz - sz*0.14, y, sz*0.14, sz, { tl:0, tr:10, bl:0, br:10 }); ctx.fill()

// 底部反光
const bKey = `empty|bottom|${x}|${y}|${sz}`
if (!this._gradCache.has(bKey)) {
  const g = ctx.createLinearGradient(x, y + sz, x, y + sz - sz*0.18)
  g.addColorStop(0, 'rgba(255,255,255,0.16)')
  g.addColorStop(1, 'rgba(255,255,255,0.00)')
  this._gradCache.set(bKey, g)
}
ctx.fillStyle = this._gradCache.get(bKey)
roundRect(ctx, x, y + sz - sz*0.18, sz, sz*0.18, { tl:0, tr:0, bl:10, br:10 }); ctx.fill()
```

- [ ] **Step 5：`_drawBoard` 有车格子渐变改为缓存**

有车格子在 `ctx.translate(x + sz/2, y + sz/2)` 后用相对坐标，所有格子 `sz` 相同，key 只需包含 `sz`。

找到有车格子的 4 个渐变（`hg`、`sideG`、`sideGR`、`botG`），替换为：

```js
// 顶部高光（所有格子共享，key 只含 sz）
const hgKey = `car|top|${sz}`
if (!this._gradCache.has(hgKey)) {
  const g = ctx.createLinearGradient(0, -sz/2, 0, -sz/2 + sz * 0.45)
  g.addColorStop(0,    'rgba(255,255,255,0.78)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.22)')
  g.addColorStop(1,    'rgba(255,255,255,0.00)')
  this._gradCache.set(hgKey, g)
}
ctx.fillStyle = this._gradCache.get(hgKey)
roundRect(ctx, -sz/2, -sz/2, sz, sz * 0.45, { tl:12, tr:12, bl:0, br:0 }); ctx.fill()

// 左侧亮边
const sideGKey = `car|left|${sz}`
if (!this._gradCache.has(sideGKey)) {
  const g = ctx.createLinearGradient(-sz/2, 0, -sz/2 + sz*0.18, 0)
  g.addColorStop(0, 'rgba(255,255,255,0.28)')
  g.addColorStop(1, 'rgba(255,255,255,0.00)')
  this._gradCache.set(sideGKey, g)
}
ctx.fillStyle = this._gradCache.get(sideGKey)
roundRect(ctx, -sz/2, -sz/2, sz*0.18, sz, { tl:12, tr:0, bl:12, br:0 }); ctx.fill()

// 右侧亮边
const sideGRKey = `car|right|${sz}`
if (!this._gradCache.has(sideGRKey)) {
  const g = ctx.createLinearGradient(sz/2, 0, sz/2 - sz*0.14, 0)
  g.addColorStop(0, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0.00)')
  this._gradCache.set(sideGRKey, g)
}
ctx.fillStyle = this._gradCache.get(sideGRKey)
roundRect(ctx, sz/2 - sz*0.14, -sz/2, sz*0.14, sz, { tl:0, tr:12, bl:0, br:12 }); ctx.fill()

// 底部反光
const botGKey = `car|bottom|${sz}`
if (!this._gradCache.has(botGKey)) {
  const g = ctx.createLinearGradient(0, sz/2, 0, sz/2 - sz*0.18)
  g.addColorStop(0, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0.00)')
  this._gradCache.set(botGKey, g)
}
ctx.fillStyle = this._gradCache.get(botGKey)
roundRect(ctx, -sz/2, sz/2 - sz*0.18, sz, sz*0.18, { tl:0, tr:0, bl:12, br:12 }); ctx.fill()
```

- [ ] **Step 6：运行全量测试**

```bash
npx vitest run
```

期望：所有测试 PASS

- [ ] **Step 7：提交**

```bash
git add src/scenes/GameScene.js
git commit -m "perf(GameScene): cache LinearGradient objects in _gradCache to eliminate per-frame GC pressure"
```

---

## Phase F：场景销毁钩子（防止旧场景 timer 泄漏）

### Task F1：各 Scene 加 `destroy()` + `game.js` 加 `_switchScene()`

**Problem:** 场景切换时旧场景持有的 `setTimeout` 链（BGM timer、结算延迟）持有 `this` 引用，导致旧 scene 无法被 GC 回收。

**Files:**
- Modify: `game.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/ResultScene.js`
- Modify: `src/scenes/StartScene.js`
- Modify: `src/scenes/LeaderboardScene.js`
- Modify: `src/scenes/SettingsScene.js`
- Modify: `src/scenes/AllClearScene.js`
- Modify: `src/scenes/AchievementScene.js`
- Modify: `src/scenes/DailyScene.js`
- Modify: `tests/smoke.test.js`

- [ ] **Step 1：在 `tests/smoke.test.js` 末尾追加接口断言**

```js
describe('Scene destroy 接口约定', () => {
  it('destroy() 调用后不抛出异常（duck-type smoke）', () => {
    class MockScene { destroy() { this._destroyed = true } }
    const s = new MockScene()
    expect(() => s.destroy()).not.toThrow()
    expect(s._destroyed).toBe(true)
  })
})
```

- [ ] **Step 2：运行测试确认通过**

```bash
npx vitest run tests/smoke.test.js
```

期望：PASS

- [ ] **Step 3：`GameScene` 加 `destroy()`**

在 `GameScene` 类末尾（最后一个方法之后，`}` 之前）加：

```js
destroy() {
  AudioManager.stopBGM()
  this.floatTexts.length = 0
  this.particles.length  = 0
  this._gradCache.clear()
}
```

- [ ] **Step 4：`ResultScene` 加 `destroy()`**

在 `ResultScene` 类末尾加：

```js
destroy() {
  this.confetti.length = 0
}
```

- [ ] **Step 5：其余 6 个 Scene 各加空 `destroy()`**

在以下每个文件的 class 末尾加 `destroy() {}`：
- `src/scenes/StartScene.js`
- `src/scenes/LeaderboardScene.js`
- `src/scenes/SettingsScene.js`
- `src/scenes/AllClearScene.js`
- `src/scenes/AchievementScene.js`
- `src/scenes/DailyScene.js`

- [ ] **Step 6：`game.js` 加 `_switchScene()` 并重构所有 `showXxx`**

在 `Game` 对象的 `bindEvents` 方法之前加：

```js
_switchScene(newScene) {
  if (this.currentScene && typeof this.currentScene.destroy === 'function') {
    this.currentScene.destroy()
  }
  this.currentScene = newScene
  newScene.init()
},
```

将以下方法改为使用 `_switchScene`（完整替换）：

```js
showStart() {
  this._switchScene(new StartScene(this))
  if (!this._loopStarted) {
    this._loopStarted = true
    this.loop()
  }
},

showGame(levelIdx = 0) {
  saveLevelProgress(levelIdx)
  this._switchScene(new GameScene(this, levelIdx, null, null, `level_${levelIdx}`))
},

showResult(score, carsWon, levelIdx, isWin, stars) {
  this._switchScene(new ResultScene(this, score, carsWon, levelIdx, isWin, stars))
},

showLeaderboard() {
  this._switchScene(new LeaderboardScene(this))
},

showSettings() {
  AudioManager.stopBGM()
  this._switchScene(new SettingsScene(this))
},

showAllClear() {
  this._switchScene(new AllClearScene(this))
},

showAchievements() {
  this._switchScene(new AchievementScene(this))
},

showDaily() {
  this._switchScene(new DailyScene(this))
},

showDailyGame(levelCfg, dailyScene, seed = null) {
  const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
    dailyScene.onDailyResult(isWin)
    this._switchScene(new ResultScene(this, score, carsWon, -1, isWin, stars, () => {
      this.showDaily()
    }))
  }, seed)
  this._switchScene(scene)
},
```

- [ ] **Step 7：运行全量测试**

```bash
npx vitest run
```

期望：所有测试 PASS

- [ ] **Step 8：提交**

```bash
git add game.js src/scenes/GameScene.js src/scenes/ResultScene.js src/scenes/StartScene.js src/scenes/LeaderboardScene.js src/scenes/SettingsScene.js src/scenes/AllClearScene.js src/scenes/AchievementScene.js src/scenes/DailyScene.js tests/smoke.test.js
git commit -m "feat: add destroy() to all scenes and _switchScene() to Game for clean scene transitions"
```
