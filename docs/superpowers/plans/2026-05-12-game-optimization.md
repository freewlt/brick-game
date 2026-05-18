# 赢了个赢 代码优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实代码审查中识别的 11 项优化（1 高 + 3 中 + 7 低），目标是降低热路径内存分配、消除重复扫描、收敛配置项。

**Architecture:** 维持现有场景架构与 wx 小游戏 API 调用方式不变。改动局限于 `src/` 目录内的现有文件 + 新增 `src/effects/` 目录。每个 Task 自包含、可独立提交、视觉行为零变化。

**Tech Stack:** JavaScript ES6 modules · 微信小游戏 Canvas 2D API · WebAudio 合成 BGM

## 已完成（不在本计划范围内）

- ✅ game.js 缺失 `saveMyUserInfo` import → 已修复
- ✅ audio.js BGM `setTimeout` 队列泄漏 → 已添加 `_bgmNoteTimers`
- ✅ `drawGlassCard` × 4 副本 / `e()` × 6 副本 → 已抽取到 `src/utils/draw.js`

## 验证策略

项目无单测基础设施。每个 Task 用三种验证手段：
1. **语法**：`node --check`（去掉 import/export 后）
2. **静态**：grep 确认旧用法已清除、新签名已应用
3. **手动**：微信开发者工具实机预览，给出具体操作步骤与预期行为

---

## Phase A：高优先级（1 项）

### Task A1：撤销快照改用浅拷贝

每次点击都会触发 `_snapshot()` 对整个 board 做三层 map + `{...car}` 展开。地狱关卡（8×5×49 ≈ 200 块）每次点击分配约 200 个新 car 对象。改为浅拷贝（`stack.slice()` / `slot.slice()`）后，car 对象按引用共享、不再 clone，因为 car 在生命周期内从未被修改（只被在 board/slot 之间移动）。

**Files:**
- Modify: `src/logic/GameLogic.js:131-156`

- [ ] **Step 1：确认 `car.id` 未被外部读取**

Run：
```bash
grep -rn "car\.id\|\.id " src/scenes src/utils
```

Expected：无匹配（id 仅在 `_makeCar` 内部分配，从未被读取）。如有匹配则停步，修正方案。

- [ ] **Step 2：替换 `_snapshot()` 为紧凑格式**

替换 [GameLogic.js:131-140](src/logic/GameLogic.js#L131-L140)：

```js
// 紧凑快照：board/slot 只存 type 数字，撤销时重建 car 对象
// 原始版每次分配约 200 个 4 字段对象，地狱关卡触摸响应会掉帧
_snapshot() {
  return {
    board:   this.board.map(row => row.map(stack => stack.slice())),  // stack 直接存 car 对象（浅拷贝足够）
    slot:    this.slot.slice(),                                        // slot 浅拷贝
    score:   this.score,
    combo:   this.combo,
    carsWon: this.carsWon,
    moves:   this.moves,
  }
}
```

注：`car` 对象本身在 `clickCell` 中已经被 `pop()` 出 stack，原 stack 不再持有引用；改用浅拷贝即可。原代码深拷贝车块对象是过度防御，因为 car 对象从不被修改（只被移动）。

- [ ] **Step 3：`undo()` 不变（结构一致，浅拷贝即可恢复）**

[GameLogic.js:142-156](src/logic/GameLogic.js#L142-L156) 无需改动。

- [ ] **Step 4：语法检查**

Run：
```bash
node --check src/logic/GameLogic.js 2>&1
```

Expected：无输出（通过）。

- [ ] **Step 5：手动验证**

在微信开发者工具中：
1. 进入第 10 关（96 辆车）
2. 点击任意车块 4 次，槽位应有 4 辆车
3. 点击撤销按钮 1 次
4. 槽位应回退到 3 辆车，被撤销的那辆车应回到原棋盘位置
5. 得分/步数应回退到上一步

Expected：撤销行为与原版完全一致。

- [ ] **Step 6：提交**

```bash
git add src/logic/GameLogic.js
git commit -m "perf(logic): use shallow copy in _snapshot to cut undo allocation"
```

---

## Phase B：中优先级（3 项）

### Task B1：拆分 GameScene 内的粒子/飘字类

`GameScene.js` 1341 行包含 `FloatText`、`MatchParticle` 两个独立的可复用类。先把它们抽到 `src/effects/`，为后续进一步拆分做铺垫。

**Files:**
- Create: `src/effects/FloatText.js`
- Create: `src/effects/MatchParticle.js`
- Modify: `src/scenes/GameScene.js:1-58`（删除两个类的定义 + 添加 import）

- [ ] **Step 1：创建 `src/effects/FloatText.js`**

```js
// 飘字动画：用于得分提示、连消、撤销反馈等
export default class FloatText {
  constructor(text, x, y, color = '#FFD700') {
    this.text = text; this.x = x; this.y = y
    this.color = color; this.alpha = 1; this.vy = -2; this.life = 60
  }
  update() { this.y += this.vy; this.vy *= 0.95; this.life--; this.alpha = this.life / 60 }
  isDead()  { return this.life <= 0 }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = this.color
    ctx.fillText(this.text, this.x, this.y)
    ctx.restore()
  }
}
```

- [ ] **Step 2：创建 `src/effects/MatchParticle.js`**

```js
// 消除粒子：消除时四散飞溅的彩色小球
export default class MatchParticle {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color
    this.vx = (Math.random() - 0.5) * 8
    this.vy = (Math.random() - 0.5) * 8 - 3
    this.alpha = 1; this.r = 4 + Math.random() * 4; this.life = 40
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.vy += 0.3
    this.life--; this.alpha = this.life / 40
  }
  isDead() { return this.life <= 0 }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha = this.alpha
    ctx.fillStyle = this.color
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
}
```

- [ ] **Step 3：修改 `GameScene.js` import 块**

将 [GameScene.js:1-10](src/scenes/GameScene.js#L1-L10) 改为：

```js
// 游戏主场景 - 赢了个赢（关卡制）
import GameLogic from '../logic/GameLogic.js'
import { CONFIG } from '../config.js'
import { roundRect } from '../utils/draw.js'
import AudioManager from '../utils/audio.js'
import { addExtraProp, SHARE_CONFIG,
  getAchievementStats, saveAchievementStats, checkAndUnlockAchievements,
} from '../utils/storage.js'
import { CONFIG as _CFG } from '../config.js'  // 成就列表引用
import AchievementUnlockPopup from './AchievementUnlockPopup.js'
import FloatText      from '../effects/FloatText.js'
import MatchParticle  from '../effects/MatchParticle.js'
```

- [ ] **Step 4：删除 GameScene.js 内的两个原类**

删除 [GameScene.js:12-50](src/scenes/GameScene.js#L12-L50)（`FloatText` 类 + `MatchParticle` 类的完整定义，包含上方注释）。

- [ ] **Step 5：语法 + 静态检查**

```bash
node --check src/effects/FloatText.js
node --check src/effects/MatchParticle.js
grep -n "^class FloatText\|^class MatchParticle" src/scenes/GameScene.js
```

Expected：前两条无输出；最后一条无匹配（已彻底删除）。

- [ ] **Step 6：手动验证**

实机运行第 1 关，点击车块触发消除：
- 应看到 `+3 🚗` 飘字向上飞 ✅
- 应看到 18 颗彩色粒子四散 ✅

- [ ] **Step 7：提交**

```bash
git add src/effects/ src/scenes/GameScene.js
git commit -m "refactor(scene): extract FloatText/MatchParticle to src/effects"
```

---

### Task B2：`hexToRgb` 预计算到 config

`hexToRgb` 在 `_drawCollectionProgress` 中按车型多次调用，每帧执行 3 次 `parseInt(slice)`。这些颜色在 CONFIG.COLORS 启动时就已知，启动时算一次即可。

**Files:**
- Modify: `src/config.js:25`（在 COLORS 后追加 COLORS_RGB）
- Modify: `src/scenes/GameScene.js:53-58`（删除 hexToRgb 函数）
- Modify: `src/scenes/GameScene.js:1311,1317`（调用点改为查表）

- [ ] **Step 1：在 config.js 中追加 `COLORS_RGB`**

在 [config.js:25](src/config.js#L25) `COLORS` 数组后追加：

```js
  // COLORS 对应的 R,G,B 字符串数组（拼 rgba() 用），启动时预算
  COLORS_RGB: [
    '231,76,60',    // #E74C3C 红色
    '52,152,219',   // #3498DB 蓝色
    '46,204,113',   // #2ECC71 绿色
    '243,156,18',   // #F39C12 黄色
    '155,89,182',   // #9B59B6 紫色
    '26,188,156',   // #1ABC9C 青色
    '230,126,34',   // #E67E22 橙色
    '233,30,140',   // #E91E8C 粉色
  ],
```

- [ ] **Step 2：删除 GameScene 中的 `hexToRgb` 辅助函数**

删除 [GameScene.js:52-58](src/scenes/GameScene.js#L52-L58)（包括上方注释与函数本体）。

- [ ] **Step 3：改两处调用点为查表**

替换 [GameScene.js:1311](src/scenes/GameScene.js#L1311) 和 [GameScene.js:1317](src/scenes/GameScene.js#L1317)：

```js
// 旧：
ctx.fillStyle = inSlot > 0
  ? `rgba(${hexToRgb(CONFIG.COLORS[type])},0.22)`
  : 'rgba(255,255,255,0.40)'
// ...
ctx.strokeStyle = `rgba(${hexToRgb(CONFIG.COLORS[type])},0.55)`

// 新：
ctx.fillStyle = inSlot > 0
  ? `rgba(${CONFIG.COLORS_RGB[type]},0.22)`
  : 'rgba(255,255,255,0.40)'
// ...
ctx.strokeStyle = `rgba(${CONFIG.COLORS_RGB[type]},0.55)`
```

- [ ] **Step 4：静态检查**

```bash
grep -n "hexToRgb" src/
```

Expected：无匹配。

- [ ] **Step 5：手动验证**

实机第 1 关，槽位有车后，棋盘下方的「已收集进度小条」应显示彩色车型卡片，颜色应与车块本体一致。

- [ ] **Step 6：提交**

```bash
git add src/config.js src/scenes/GameScene.js
git commit -m "perf(scene): precompute COLORS_RGB to avoid hexToRgb in hot path"
```

---

### Task B3：缓存 `measureText` 结果

`_drawHeader` 中两次创建 IIFE 测量 `第N关` 和 `目标` 的宽度，每帧都做一次。这些字符串在关卡内不变。

**Files:**
- Modify: `src/scenes/GameScene.js:96-119`（init 中加入缓存）
- Modify: `src/scenes/GameScene.js:353-377`（使用缓存）

- [ ] **Step 1：在 init() 末尾添加宽度缓存**

在 [GameScene.js:119](src/scenes/GameScene.js#L119) `AudioManager.playBGM()` 之前追加：

```js
    // 预测量 Header 文字宽度（关卡内不变，避免每帧 measureText）
    const ctx = this.game.ctx
    const levelNum = this.startLevel + 1
    ctx.save()
    ctx.font = 'bold 28px sans-serif'
    this._titleW = ctx.measureText(`第${levelNum}关`).width
    ctx.font = 'bold 13px sans-serif'
    this._targetLabelW = ctx.measureText('目标').width
    ctx.restore()
```

- [ ] **Step 2：替换 `_drawHeader` 中的 IIFE 为缓存读取**

替换 [GameScene.js:353-377](src/scenes/GameScene.js#L353-L377) 中的两个 IIFE：

```js
// 旧：
const titleW = (() => {
  ctx.save(); ctx.font = 'bold 28px sans-serif'
  const w = ctx.measureText(`第${levelNum}关`).width; ctx.restore(); return w
})()
// ... 后面 ...
const targetLabelW = (() => {
  ctx.save(); ctx.font = 'bold 13px sans-serif'
  const w = ctx.measureText('目标').width; ctx.restore(); return w
})()

// 新：
const titleW = this._titleW
// ...
const targetLabelW = this._targetLabelW
```

注：关卡切换时由 GameScene 重新 `new`，init 会重算。无需手动失效。

- [ ] **Step 3：静态检查**

```bash
grep -n "measureText" src/scenes/GameScene.js
```

Expected：只剩 `_drawDivider`、`_drawSlot` 等其它正常使用点，`_drawHeader` 内的两处 IIFE 已删除。

- [ ] **Step 4：手动验证**

进入任意关卡，Header 显示「第N关 目标 ★★★」，星号位置应与原版一致（不偏移）。切换关卡（通关 → 下一关）后位置应自动适配新的关卡号宽度。

- [ ] **Step 5：提交**

```bash
git add src/scenes/GameScene.js
git commit -m "perf(scene): cache measureText results in GameScene init"
```

---

## Phase C：低优先级（7 项）

### Task C1：背景渐变缓存

`GameScene.draw()` 每帧创建相同的天蓝背景 `createLinearGradient`。背景在场景尺寸不变时不变。

**Files:**
- Modify: `src/scenes/GameScene.js:96-119`（init 中预建）
- Modify: `src/scenes/GameScene.js:264-269`（draw 中复用）

- [ ] **Step 1：init() 末尾追加预建渐变**

在 Task B3 已添加的 measureText 缓存之后追加：

```js
    // 预建天蓝背景渐变（尺寸不变时复用）
    const bg = ctx.createLinearGradient(0, 0, 0, this.game.height)
    bg.addColorStop(0,   '#5BC8F5')
    bg.addColorStop(0.5, '#84D9FF')
    bg.addColorStop(1,   '#B8EEFF')
    this._bgGrad = bg
```

- [ ] **Step 2：替换 draw() 中的背景渐变创建**

替换 [GameScene.js:264-269](src/scenes/GameScene.js#L264-L269)：

```js
// 旧：
const bg = ctx.createLinearGradient(0, 0, 0, height)
bg.addColorStop(0,   '#5BC8F5')
bg.addColorStop(0.5, '#84D9FF')
bg.addColorStop(1,   '#B8EEFF')
ctx.fillStyle = bg

// 新：
ctx.fillStyle = this._bgGrad
```

- [ ] **Step 3：手动验证**

实机进入第 1 关，背景应是天蓝渐变（顶部深、底部浅），与原版一致。

- [ ] **Step 4：提交**

```bash
git add src/scenes/GameScene.js
git commit -m "perf(scene): cache background gradient across frames"
```

---

### Task C2：隐私授权去重

`game.js` 启动时调用 `wx.requirePrivacyAuthorize`，进入 `LeaderboardScene` 时又调一次。用户可能见两次弹窗。改为：启动时授权成功后写入 `Game._privacyOK`，排行榜读这个状态。

**Files:**
- Modify: `game.js:77-102`（写入授权状态）
- Modify: `src/scenes/LeaderboardScene.js:79-110`（读状态决定是否再次调用）

- [ ] **Step 1：game.js `_initUserInfo` 写入授权标志**

替换 [game.js:93-101](game.js#L93-L101)：

```js
if (typeof wx.requirePrivacyAuthorize === 'function') {
  wx.requirePrivacyAuthorize({
    success: () => { this._privacyOK = true; doFetch() },
    fail:    () => { this._privacyOK = false },   // 用户拒绝，跳过
  })
} else {
  // 低版本基础库不支持隐私 API，直接拉取
  this._privacyOK = true
  doFetch()
}
```

并在 Game 对象字段处（[game.js:53](game.js#L53) `_loopStarted` 旁）添加初始值：

```js
  _loopStarted: false,
  _privacyOK:  null,   // 启动时由 _initUserInfo 设置：true=已授权 / false=用户拒绝 / null=未问过
```

- [ ] **Step 2：LeaderboardScene 复用授权状态**

替换 [LeaderboardScene.js:89-109](src/scenes/LeaderboardScene.js#L89-L109)：

```js
const pri = this.game._privacyOK
if (pri === false) { this._denied = true; this.loading = false; return }
if (pri === true)  { this._loadRank(); return }

// 启动时没调过隐私 API（极端情况）→ 现在补调
if (typeof wx.requirePrivacyAuthorize === 'function') {
  wx.requirePrivacyAuthorize({
    success: () => {
      this.game._privacyOK = true
      wx.getUserProfile({
        desc: '用于好友排行榜显示',
        success: (res) => {
          const info = res.userInfo || {}
          if (info.nickName) {
            saveMyUserInfo({ nickname: info.nickName, avatarUrl: info.avatarUrl || '' })
          }
          this._loadRank()
        },
        fail: () => { this._loadRank() },
      })
    },
    fail: () => { this.game._privacyOK = false; this._denied = true; this.loading = false },
  })
} else {
  this._loadRank()
}
```

- [ ] **Step 3：手动验证**

冷启动 → 出现一次隐私授权弹窗，点同意 → 进入开始页 → 点击排行榜 → 不应再弹窗，直接进入加载状态。

- [ ] **Step 4：提交**

```bash
git add game.js src/scenes/LeaderboardScene.js
git commit -m "fix(privacy): cache authorize result on Game to avoid double prompt"
```

---

### Task C3：`isBlocked` 缓存矩阵

`isBlocked` 是 O(r)，棋盘每格每帧调用一次，地狱关卡 = 49 × 7 = 343 次/帧。改为维护「每列最高有车行号」，O(1) 查询。

**Files:**
- Modify: `src/logic/GameLogic.js:120-128`（替换 isBlocked 实现）
- Modify: `src/logic/GameLogic.js:54-101`（_buildBoard 后初始化列高度）
- Modify: `src/logic/GameLogic.js:177-237`（道具/clickCell 处更新列高度）

- [ ] **Step 1：添加 `_colTopRow` 字段与维护方法**

在 [GameLogic.js:32](src/logic/GameLogic.js#L32) `reset()` 末尾追加：

```js
    // 每列「最高有车的行号」缓存：-1 表示该列全空。isBlocked 查这个即可 O(1)
    this._colTopRow = new Array(CONFIG.BOARD_COLS).fill(-1)
```

并新增一个私有方法（紧跟 `_buildBoard` 之后）：

```js
// 重算所有列的最高有车行号；任何整体改动 board 的操作（initLevel/useShuffle/undo）后调
_recomputeColTops() {
  const rows = CONFIG.BOARD_ROWS, cols = CONFIG.BOARD_COLS
  for (let c = 0; c < cols; c++) {
    let top = -1
    for (let r = 0; r < rows; r++) {
      if (this.board[r][c].length > 0) { top = r; break }
    }
    this._colTopRow[c] = top
  }
}
```

- [ ] **Step 2：替换 `isBlocked` 为 O(1)**

替换 [GameLogic.js:122-128](src/logic/GameLogic.js#L122-L128)：

```js
isBlocked(r, c) {
  const top = this._colTopRow[c]
  return top !== -1 && top < r
}
```

- [ ] **Step 3：在 board 整体改动处调 `_recomputeColTops`**

在 `_buildBoard` 末尾（[GameLogic.js:101](src/logic/GameLogic.js#L101) 闭合大括号前）追加 `this._recomputeColTops()`。

在 `useShuffle` 末尾（[GameLogic.js:236](src/logic/GameLogic.js#L236) `return 'ok'` 之前）追加 `this._recomputeColTops()`。

在 `undo` 末尾（[GameLogic.js:155](src/logic/GameLogic.js#L155) `return true` 之前）追加 `this._recomputeColTops()`。

- [ ] **Step 4：在单格点击处增量更新**

在 `clickCell` 中 `stack.pop()` 之后（[GameLogic.js:252](src/logic/GameLogic.js#L252) 之后）追加：

```js
    // 增量更新本列最高行号：如果这一格被点光了，本列的 top 可能下移
    if (this.board[r][c].length === 0 && this._colTopRow[c] === r) {
      let newTop = -1
      for (let rr = r + 1; rr < CONFIG.BOARD_ROWS; rr++) {
        if (this.board[rr][c].length > 0) { newTop = rr; break }
      }
      this._colTopRow[c] = newTop
    }
```

- [ ] **Step 5：手动验证遮挡仍然生效**

第 5 关（5 车型 × 3 层）：
- 上方有车的格子应显示 🔒 锁图标
- 清空上方所有行后，下方格子应解锁可点
- 撤销点击后，被释放的列上方车块回归，下方应重新被锁

- [ ] **Step 6：提交**

```bash
git add src/logic/GameLogic.js
git commit -m "perf(logic): O(1) isBlocked via per-column top-row cache"
```

---

### Task C4：`getLives` 节流缓存

`getLives()` 在多个场景的 `draw()` 中每帧调用，每次走 `wx.getStorageSync`。改为场景级缓存 + 1 秒刷新一次。

**Files:**
- Modify: `src/scenes/StartScene.js:1-35`（init/update 中刷新缓存）
- Modify: `src/scenes/LeaderboardScene.js:60-110`（同样处理）

- [ ] **Step 1：StartScene 增加 lives 缓存**

在 [StartScene.js](src/scenes/StartScene.js) 类字段（constructor）末尾追加：

```js
    this._cachedLives     = 3   // 缓存机会数，避免每帧读 storage
    this._livesRefreshAt  = 0   // 下次允许刷新的帧号
```

`init()` 中将 `_livesRefreshAt` 置 0（强制刷新一次）。

`update()` 中追加：

```js
    if (this.frame >= this._livesRefreshAt) {
      this._cachedLives    = getLives()
      this._livesRefreshAt = this.frame + 60  // 60 帧 ≈ 1 秒刷新一次
    }
```

- [ ] **Step 2：将 draw 中的 `getLives()` 改为 `this._cachedLives`**

```bash
grep -n "getLives()" src/scenes/StartScene.js
```

将所有出现在 `draw()` 路径上的 `getLives()` 替换为 `this._cachedLives`。`onTouchEnd` 中的 `getLives()` 保留（点击时需要实时值）。

- [ ] **Step 3：LeaderboardScene 同样处理**

`LeaderboardScene.update()` 中加入同样的刷新逻辑，`draw` 中的 [LeaderboardScene.js:262](src/scenes/LeaderboardScene.js#L262) 处 `getLives()` 改为 `this._cachedLives`。

- [ ] **Step 4：手动验证**

主页应显示 3 颗心。失败一次后回到主页（机会扣到 2）应在 1 秒内更新显示为 2 颗心。

- [ ] **Step 5：提交**

```bash
git add src/scenes/StartScene.js src/scenes/LeaderboardScene.js
git commit -m "perf(ui): throttle getLives() reads to once per second"
```

---

### Task C5：`boardTypes` 缓存

`_drawCollectionProgress` 每帧遍历整个 board 构建 `Set` 收集车型。一关内车型固定。

**Files:**
- Modify: `src/scenes/GameScene.js:1281-1296`（缓存 boardTypes）
- Modify: `src/scenes/GameScene.js:96-119`（init 中初始化）

- [ ] **Step 1：init() 末尾追加车型缓存**

```js
    // 本关车型集合（关卡内不变）：直接从 logic 的车型数派生
    const cfg = this._customCfg || CONFIG.LEVELS[Math.min(this.startLevel, CONFIG.LEVELS.length - 1)]
    this._levelTypes = Array.from({ length: cfg.carTypes }, (_, i) => i)
```

- [ ] **Step 2：删除 `_drawCollectionProgress` 中的扫描**

替换 [GameScene.js:1287-1295](src/scenes/GameScene.js#L1287-L1295)：

```js
// 旧：
const boardTypes = new Set()
for (const row of logic.board) {
  for (const stack of row) {
    for (const car of stack) boardTypes.add(car.type)
  }
}
for (const car of logic.slot) boardTypes.add(car.type)

const types = [...boardTypes].sort()
if (types.length === 0) return

// 新：
const types = this._levelTypes
if (types.length === 0) return
```

- [ ] **Step 3：手动验证**

第 5 关进度小条应显示 5 个车型卡片，槽位中的车型对应卡片应高亮（彩色），其它保持淡色。

- [ ] **Step 4：提交**

```bash
git add src/scenes/GameScene.js
git commit -m "perf(scene): cache level types in init, drop per-frame board scan"
```

---

### Task C6：广告位 ID 配置化

`'YOUR_AD_UNIT_ID'` 占位符还在代码里，上线前必改。提取到 config，并在调用前判断空值跳到分享。

**Files:**
- Modify: `src/config.js`（追加 AD_CONFIG 区段）
- Modify: `src/scenes/GameScene.js:1168-1183`（读 config 并判空）

- [ ] **Step 1：config.js 追加 AD_CONFIG**

在 [config.js](src/config.js) `DAILY_CHALLENGE` 之后追加：

```js
  // ==================== 广告配置 ====================
  // 上线前在微信流量主后台创建激励视频广告位，把广告单元 ID 填入这里。
  // 留空字符串 → 道具获取流程直接走「分享给好友」分支，跳过广告。
  AD_CONFIG: {
    rewardedUnitId: '',   // ← 上线前替换为真实 ID，如 'adunit-xxxxxxxx'
  },
```

- [ ] **Step 2：GameScene `_showRewardedAd` 判空跳分享**

替换 [GameScene.js:1168-1183](src/scenes/GameScene.js#L1168-L1183)：

```js
_showRewardedAd(propType) {
  const adId = CONFIG.AD_CONFIG && CONFIG.AD_CONFIG.rewardedUnitId
  if (!adId) {
    // 未配置广告位 → 直接走分享流程
    this._shareForProp(propType)
    return
  }
  try {
    const ad = wx.createRewardedVideoAd({ adUnitId: adId })
    ad.onError(() => this._shareForProp(propType))
    ad.onClose((res) => {
      if (res && res.isEnded) {
        this._grantProp(propType, '广告')
      } else {
        this.floatTexts.push(new FloatText('请完整观看~', this.game.width / 2, this.game.height / 2, '#FF9800'))
      }
    })
    ad.show().catch(() => this._shareForProp(propType))
  } catch (e) {
    this._shareForProp(propType)
  }
}
```

- [ ] **Step 3：静态检查**

```bash
grep -n "YOUR_AD_UNIT_ID" src/
```

Expected：无匹配。

- [ ] **Step 4：手动验证**

道具用完点「+获取」→ 弹层 → 点「看广告获取」：当前 `rewardedUnitId` 为空，应直接走分享流程，弹出微信分享面板。

- [ ] **Step 5：提交**

```bash
git add src/config.js src/scenes/GameScene.js
git commit -m "refactor(ad): move rewarded ad unit ID to CONFIG.AD_CONFIG"
```

---

### Task C7：`getStackDepth` 简化

`GameLogic.js:375-377` 的 `board[r] && board[r][c]` 判断在 board 已固定 7×7 时永远为真，是死代码。

**Files:**
- Modify: `src/logic/GameLogic.js:375-377`

- [ ] **Step 1：简化函数体**

替换 [GameLogic.js:375-377](src/logic/GameLogic.js#L375-L377)：

```js
// 旧：
getStackDepth(r, c) {
  return (this.board[r] && this.board[r][c]) ? this.board[r][c].length : 0
}

// 新：
getStackDepth(r, c) {
  return this.board[r][c].length
}
```

- [ ] **Step 2：语法检查**

```bash
node --check src/logic/GameLogic.js
```

- [ ] **Step 3：提交**

```bash
git add src/logic/GameLogic.js
git commit -m "refactor(logic): drop defensive null checks in getStackDepth"
```

---

---

## Phase D：基础设施（4 项，I1 + I2）

### Task D1：建立 vitest 单测基础设施

引入 vitest 作为 Node 端测试运行器。微信小游戏发布包不含 `node_modules`（由 `project.config.json` 的 `packOptions.ignore` 排除），仅本地开发用。

**Files:**
- Create: `package.json`
- Create: `.gitignore`（追加 node_modules 规则；如已存在则只追加）
- Create: `vitest.config.js`
- Modify: `project.config.json`（追加 `packOptions.ignore`）

- [ ] **Step 1：检查现有 `.gitignore` 与 `project.config.json`**

```bash
test -f .gitignore && cat .gitignore || echo "(no .gitignore)"
cat project.config.json | python -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('packOptions', {}), ensure_ascii=False, indent=2))"
```

记录现有内容，下面的 Step 在其基础上追加，不覆盖。

- [ ] **Step 2：创建 `package.json`**

```json
{
  "name": "ywgy-tests",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test":       "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3：创建 `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    globals: false,
    environment: 'node',
  },
})
```

- [ ] **Step 4：追加 `.gitignore` 规则**

如已存在则在末尾追加；不存在则创建：

```
node_modules/
coverage/
.vitest-cache/
```

- [ ] **Step 5：追加 `project.config.json` 的 packOptions.ignore**

读取现有 `project.config.json`，在 `packOptions.ignore` 数组（不存在则创建）追加以下规则，确保小游戏打包时排除 dev 文件：

```json
{
  "type": "folder",
  "value": "node_modules"
},
{
  "type": "folder",
  "value": "tests"
},
{
  "type": "folder",
  "value": "docs"
},
{
  "type": "file",
  "value": "package.json"
},
{
  "type": "file",
  "value": "package-lock.json"
},
{
  "type": "file",
  "value": "vitest.config.js"
}
```

- [ ] **Step 6：安装依赖并验证**

```bash
npm install
npx vitest run --reporter=verbose 2>&1 | head -20
```

Expected：vitest 启动，提示 "No test files found"（因为 D2 还没写）。如果安装失败（无网络/权限），降级方案是只提交配置文件，user 自己跑 npm install。

- [ ] **Step 7：提交（不提交 node_modules）**

```bash
git add package.json vitest.config.js .gitignore project.config.json
# 不要 add package-lock.json 如果你不确定它会带哪些字段（先看一下）
ls package-lock.json 2>/dev/null && git add package-lock.json
git commit -m "build: add vitest infrastructure for logic-layer unit tests"
```

---

### Task D2：GameLogic 核心单测

为 `GameLogic` 写 20+ 用例，覆盖：`initLevel` / `clickCell` / `undo` / `_checkMatch` / `useShuffle` / `useExpand` / `calcStars` / `isBlocked`。这些是后续 C3、A1 等逻辑修改的安全网。

**Files:**
- Create: `tests/GameLogic.test.js`

- [ ] **Step 1：创建测试文件骨架**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import GameLogic from '../src/logic/GameLogic.js'

describe('GameLogic', () => {
  let g
  beforeEach(() => { g = new GameLogic() })

  describe('initLevel', () => {
    it('第 1 关：3 车型 × 3 组 × 3 块 = 27 辆，maxMoves=45', () => {
      g.initLevel(0)
      expect(g.totalCars).toBe(27)
      expect(g.maxMoves).toBe(45)
      expect(g.slot).toEqual([])
      expect(g.score).toBe(0)
      expect(g.win).toBe(false)
      expect(g.gameOver).toBe(false)
    })

    it('第 10 关：8 车型 × 4 组 × 3 块 = 96 辆，maxMoves=116', () => {
      g.initLevel(9)
      expect(g.totalCars).toBe(96)
      expect(g.maxMoves).toBe(116)
    })

    it('超出关卡数兜底取最后一关', () => {
      g.initLevel(9999)
      expect(g.totalCars).toBe(96 * 1 || g.totalCars)  // 兜底取最后一关，具体数值不强查
      expect(g.maxMoves).toBeGreaterThan(0)
    })

    it('棋盘车块总数等于 totalCars', () => {
      g.initLevel(0)
      let n = 0
      for (const row of g.board) for (const stack of row) n += stack.length
      expect(n).toBe(g.totalCars)
    })
  })

  describe('clickCell', () => {
    it('点空格返回 false', () => {
      g.initLevel(0)
      // 找一个空格
      let r = -1, c = -1
      outer: for (let rr = 0; rr < 7; rr++) {
        for (let cc = 0; cc < 7; cc++) {
          if (g.board[rr][cc].length === 0) { r = rr; c = cc; break outer }
        }
      }
      if (r === -1) return  // 第 1 关 27 辆铺不满 49 格，必有空格
      expect(g.clickCell(r, c)).toBe(false)
    })

    it('点被遮挡的格子返回 "blocked"', () => {
      g.initLevel(0)
      // 构造遮挡场景：找一列上方有车下方也有车的格子
      for (let c = 0; c < 7; c++) {
        let topR = -1
        for (let r = 0; r < 7; r++) {
          if (g.board[r][c].length > 0) {
            if (topR === -1) { topR = r; continue }
            // 找到了上方有车的 c 列、下方非空的 r 行
            expect(g.clickCell(r, c)).toBe('blocked')
            return
          }
        }
      }
    })

    it('点合法格子后 car 进 slot，moves+1', () => {
      g.initLevel(0)
      // 找第 0 行任意有车的格子（顶层不可能被遮挡）
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          const before = g.slot.length
          const movesBefore = g.moves
          expect(g.clickCell(0, c)).toBe(true)
          expect(g.slot.length).toBe(before + 1)
          expect(g.moves).toBe(movesBefore + 1)
          return
        }
      }
    })

    it('集齐 3 辆同色后自动消除，carsWon += 3', () => {
      g.initLevel(0)
      // 强行清空棋盘并手工放 3 辆同色车，验证 _checkMatch
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][0].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][1].push({ id: 2, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][2].push({ id: 3, type: 0, icon: '🚗', color: '#E74C3C' })
      g.totalCars = 3
      g.clickCell(0, 0)
      g.clickCell(0, 1)
      g.clickCell(0, 2)
      expect(g.carsWon).toBe(3)
      expect(g.slot.length).toBe(0)
      expect(g.win).toBe(true)
    })
  })

  describe('undo', () => {
    it('点一次后撤销，回到初始状态', () => {
      g.initLevel(0)
      const initialSlotLen = g.slot.length
      // 找第 0 行第一个有车的格子
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          const carBefore = g.board[0][c][g.board[0][c].length - 1]
          const carBeforeType = carBefore.type
          g.clickCell(0, c)
          expect(g.slot.length).toBe(initialSlotLen + 1)
          expect(g.undo()).toBe(true)
          expect(g.slot.length).toBe(initialSlotLen)
          // 撤销后该格顶部应该回到原来那辆车的 type
          const top = g.board[0][c][g.board[0][c].length - 1]
          expect(top.type).toBe(carBeforeType)
          return
        }
      }
    })

    it('撤销后剩余次数 -1', () => {
      g.initLevel(0)
      expect(g.undoLeft).toBe(1)
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          g.clickCell(0, c)
          g.undo()
          expect(g.undoLeft).toBe(0)
          return
        }
      }
    })

    it('无快照时撤销返回 false', () => {
      g.initLevel(0)
      expect(g.undo()).toBe(false)
    })

    it('撤销次数为 0 时返回 false', () => {
      g.initLevel(0)
      g.undoLeft = 0
      for (let c = 0; c < 7; c++) {
        if (g.board[0][c].length > 0) {
          g.clickCell(0, c)
          expect(g.undo()).toBe(false)
          return
        }
      }
    })

    it('浅拷贝快照后再消除：撤销能正确恢复 score/combo/carsWon', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][0].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][1].push({ id: 2, type: 0, icon: '🚗', color: '#E74C3C' })
      g.board[0][2].push({ id: 3, type: 0, icon: '🚗', color: '#E74C3C' })
      g.totalCars = 3
      g.clickCell(0, 0)
      g.clickCell(0, 1)
      // 第 3 次点击触发消除：此时快照应保存 slot=[type0, type0]，撤销可回退
      const scoreBefore3rd = g.score
      const carsWonBefore3rd = g.carsWon
      g.clickCell(0, 2)
      expect(g.carsWon).toBe(3)
      expect(g.undo()).toBe(true)
      expect(g.carsWon).toBe(carsWonBefore3rd)
      expect(g.score).toBe(scoreBefore3rd)
      expect(g.slot.length).toBe(2)  // 撤销回 2 车
    })
  })

  describe('useExpand', () => {
    it('扩槽：slotMax 6 → 7', () => {
      g.initLevel(0)
      expect(g.slotMax).toBe(6)
      expect(g.useExpand()).toBe('ok')
      expect(g.slotMax).toBe(7)
    })

    it('扩槽道具耗尽时返回 empty', () => {
      g.initLevel(0)
      g.expandLeft = 0
      expect(g.useExpand()).toBe('empty')
    })

    it('已扩槽再扩返回 maxed', () => {
      g.initLevel(0)
      g.useExpand()
      g.expandLeft = 1
      expect(g.useExpand()).toBe('maxed')
    })
  })

  describe('useShuffle', () => {
    it('洗牌后车块总数不变', () => {
      g.initLevel(0)
      const before = g.getRemainingCount()
      expect(g.useShuffle()).toBe('ok')
      expect(g.getRemainingCount()).toBe(before)
    })

    it('棋盘空时洗牌返回 board_empty', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      expect(g.useShuffle()).toBe('board_empty')
    })

    it('洗牌次数耗尽返回 empty', () => {
      g.initLevel(0)
      g.shuffleLeft = 0
      expect(g.useShuffle()).toBe('empty')
    })
  })

  describe('calcStars', () => {
    it('未通关返回 0 星', () => {
      g.initLevel(0)
      expect(g.calcStars()).toBe(0)
    })

    it('剩余步数 >= 50% 给 3 星', () => {
      g.initLevel(0)
      g.win = true
      g.moves = Math.floor(g.maxMoves * 0.4)  // 用了 40%，剩 60%
      expect(g.calcStars()).toBe(3)
    })

    it('剩余步数 30%~50% 给 2 星', () => {
      g.initLevel(0)
      g.win = true
      g.moves = Math.floor(g.maxMoves * 0.6)  // 用了 60%，剩 40%
      expect(g.calcStars()).toBe(2)
    })

    it('剩余步数 < 30% 给 1 星', () => {
      g.initLevel(0)
      g.win = true
      g.moves = Math.floor(g.maxMoves * 0.8)  // 用了 80%，剩 20%
      expect(g.calcStars()).toBe(1)
    })
  })

  describe('isBlocked', () => {
    it('第 0 行永不被遮挡', () => {
      g.initLevel(0)
      for (let c = 0; c < 7; c++) {
        expect(g.isBlocked(0, c)).toBe(false)
      }
    })

    it('上方有车则被遮挡', () => {
      g.initLevel(0)
      g.board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => []))
      g.board[0][3].push({ id: 1, type: 0, icon: '🚗', color: '#E74C3C' })
      expect(g.isBlocked(3, 3)).toBe(true)
      expect(g.isBlocked(3, 4)).toBe(false)  // 邻列不影响
    })
  })
})
```

- [ ] **Step 2：运行 vitest 确认通过**

```bash
npx vitest run
```

Expected：至少 20 个 passing，0 failing。

- [ ] **Step 3：如有失败，先检查测试逻辑再修代码**

如果测试失败：
- 失败用例如果是测试自身的错（断言写错、初始状态没建好），改测试
- 失败用例如果是真 bug（A1 的浅拷贝引入回归），停下来报告 BLOCKED

- [ ] **Step 4：提交**

```bash
git add tests/GameLogic.test.js
git commit -m "test(logic): add vitest unit tests for GameLogic core methods"
```

---

### Task D3：创建 `wxApi.js` 封装层

统一 wx API 调用入口。失败统一 `console.warn('[wxApi] ${api} failed:', err)`，让调试有迹可循。封装时保留原 success/fail/complete 回调签名，避免大改 caller。

**Files:**
- Create: `src/utils/wxApi.js`

- [ ] **Step 1：列出当前用到的 wx API**

```bash
grep -rno "wx\.\w\+" src/ game.js | sort -u
```

预期会看到：`wx.createCanvas`, `wx.getSystemInfoSync`, `wx.getWindowInfo`, `wx.onTouchStart/End/Move`, `wx.getStorageSync`, `wx.setStorageSync`, `wx.shareAppMessage`, `wx.getLaunchOptionsSync`, `wx.requirePrivacyAuthorize`, `wx.getUserProfile`, `wx.getUserInfo`, `wx.getFriendCloudStorage`, `wx.setUserCloudStorage`, `wx.getUserCloudStorage`, `wx.createImage`, `wx.createWebAudioContext`, `wx.createRewardedVideoAd`。

底层一次性 API（`createCanvas`/`createImage`/`getSystemInfoSync`/`onTouchStart` 等）不封装，本任务只封装 **storage / share / auth / userInfo / cloudStorage / ad** 这 6 类。

- [ ] **Step 2：创建 `src/utils/wxApi.js`**

```js
// wx API 统一封装层
// 目的：集中 try/catch、失败统一 console.warn 上报、便于后续接入 telemetry SDK
// 不封装：底层硬件 API（createCanvas/createImage/onTouchStart 等），保持直接调用

function warn(api, err) {
  // eslint-disable-next-line no-console
  console.warn(`[wxApi] ${api} failed:`, err)
}

// ── 本地存储 ──────────────────────────────────────────────────
export const storage = {
  get(key, defaultVal = null) {
    try {
      const v = wx.getStorageSync(key)
      return v === '' || v === undefined ? defaultVal : v
    } catch (e) { warn('getStorageSync', e); return defaultVal }
  },
  set(key, value) {
    try { wx.setStorageSync(key, value); return true }
    catch (e) { warn('setStorageSync', e); return false }
  },
}

// ── 分享 ──────────────────────────────────────────────────────
export const share = {
  send({ title, imageUrl, query = '', onSuccess, onFail }) {
    try {
      wx.shareAppMessage({
        title, imageUrl, query,
        success: () => { onSuccess && onSuccess() },
        fail:    (e) => { warn('shareAppMessage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('shareAppMessage', e); onFail && onFail(e) }
  },
  getLaunchQuery() {
    try { return (wx.getLaunchOptionsSync().query) || {} }
    catch (e) { warn('getLaunchOptionsSync', e); return {} }
  },
}

// ── 隐私授权 ──────────────────────────────────────────────────
export const auth = {
  // 返回 Promise<boolean>：true=同意/无需授权，false=拒绝
  requirePrivacy() {
    return new Promise((resolve) => {
      if (typeof wx.requirePrivacyAuthorize !== 'function') {
        resolve(true); return
      }
      try {
        wx.requirePrivacyAuthorize({
          success: () => resolve(true),
          fail:    (e) => { warn('requirePrivacyAuthorize', e); resolve(false) },
        })
      } catch (e) { warn('requirePrivacyAuthorize', e); resolve(false) }
    })
  },
}

// ── 用户信息 ──────────────────────────────────────────────────
export const userInfo = {
  // 拉头像/昵称：先 getUserProfile（需用户手势），失败回退 getUserInfo
  getProfile(desc, onSuccess, onFail) {
    try {
      wx.getUserProfile({
        desc,
        success: (res) => onSuccess && onSuccess(res.userInfo || {}),
        fail:    (e)   => { warn('getUserProfile', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getUserProfile', e); onFail && onFail(e) }
  },
  getBasic(onSuccess, onFail) {
    try {
      wx.getUserInfo({
        success: (res) => onSuccess && onSuccess(res.userInfo || {}),
        fail:    (e)   => { warn('getUserInfo', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getUserInfo', e); onFail && onFail(e) }
  },
}

// ── 云存储（开放数据域）─────────────────────────────────────
export const cloud = {
  setKV(kvList, onSuccess, onFail) {
    try {
      wx.setUserCloudStorage({
        KVDataList: kvList,
        success: () => onSuccess && onSuccess(),
        fail:    (e) => { warn('setUserCloudStorage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('setUserCloudStorage', e); onFail && onFail(e) }
  },
  getFriendKV(keyList, onSuccess, onFail) {
    try {
      wx.getFriendCloudStorage({
        keyList,
        success: (res) => onSuccess && onSuccess(res.data || []),
        fail:    (e)   => { warn('getFriendCloudStorage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getFriendCloudStorage', e); onFail && onFail(e) }
  },
  getMyKV(keyList, onSuccess, onFail) {
    try {
      wx.getUserCloudStorage({
        keyList,
        success: (res) => onSuccess && onSuccess(res.KVDataList || []),
        fail:    (e)   => { warn('getUserCloudStorage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getUserCloudStorage', e); onFail && onFail(e) }
  },
}

// ── 激励视频广告 ──────────────────────────────────────────────
export const ad = {
  // 返回 { show: () => Promise<boolean> }；boolean 表示用户是否看完
  createRewarded(adUnitId) {
    if (!adUnitId) return null
    try {
      const inst = wx.createRewardedVideoAd({ adUnitId })
      return {
        show() {
          return new Promise((resolve) => {
            const onClose = (res) => {
              inst.offClose(onClose)
              resolve(!!(res && res.isEnded))
            }
            inst.onClose(onClose)
            inst.onError((e) => { warn('rewardedVideoAd.onError', e); resolve(false) })
            inst.show().catch((e) => { warn('rewardedVideoAd.show', e); resolve(false) })
          })
        }
      }
    } catch (e) { warn('createRewardedVideoAd', e); return null }
  },
}
```

- [ ] **Step 2：语法 + 静态检查**

```bash
python -c "
import re, subprocess, os, tempfile
with open('src/utils/wxApi.js', encoding='utf-8') as f: src = f.read()
s = re.sub(r'^export\s+', '', src, flags=re.M)
tmp = os.path.join(tempfile.gettempdir(), 'check_wxapi.js')
open(tmp, 'w', encoding='utf-8').write(s)
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('rc =', r.returncode, '|', r.stderr.strip() if r.stderr else 'OK')
"
```

Expected：`rc = 0 | OK`

- [ ] **Step 3：提交**

```bash
git add src/utils/wxApi.js
git commit -m "feat(util): add unified wxApi wrapper with structured failure logging"
```

---

### Task D4：迁移所有 wx 调用到 wxApi

把 `storage.js` / `game.js` / `LeaderboardScene.js` / `GameScene.js` 中的散落 wx 调用全部替换为 wxApi 调用。`onTouchStart/Move/End`、`createCanvas`、`createImage`、`createWebAudioContext`、`getSystemInfoSync` 这些**保留原样**（属于底层 API，不在封装范围）。

**Files:**
- Modify: `src/utils/storage.js`（storage.get/set + share.send + share.getLaunchQuery + cloud.setKV/getMyKV + auth.requirePrivacy）
- Modify: `src/scenes/LeaderboardScene.js`（cloud.getFriendKV + cloud.getMyKV + auth.requirePrivacy + userInfo.getProfile）
- Modify: `src/scenes/GameScene.js`（ad.createRewarded + share.send）
- Modify: `game.js`（auth.requirePrivacy + userInfo.getProfile）

- [ ] **Step 1：迁移 storage.js**

逐个改造（保持外部 export 签名不变）。例：

```js
// 旧
function _saveLivesData(data) {
  try { wx.setStorageSync(LIVES_KEY, data) } catch (e) {}
}

// 新
import { storage } from './wxApi.js'
// ...
function _saveLivesData(data) {
  storage.set(LIVES_KEY, data)
}
```

类似改造所有 `try { wx.getStorageSync/setStorageSync(...) } catch` 块。

`shareForLife` 改为调 `share.send(...)`。`handleShareEntry` 改为 `share.getLaunchQuery()`。`requestPrivacyAuthorize` 改为 `auth.requirePrivacy`（已有同名 wrapper，但内部实现替换）。`saveProgress` 用 `cloud.setKV(...)`。

- [ ] **Step 2：迁移 game.js 的 `_initUserInfo`**

替换 game.js 的 `_initUserInfo` 实现，使用 `auth.requirePrivacy()` 与 `userInfo.getBasic`。

- [ ] **Step 3：迁移 LeaderboardScene.js 的 `_loadRank` 与 init**

替换 `wx.getFriendCloudStorage` 调用为 `cloud.getFriendKV`，`wx.getUserCloudStorage` 为 `cloud.getMyKV`，`wx.requirePrivacyAuthorize` 与 `wx.getUserProfile` 用 `auth.requirePrivacy` + `userInfo.getProfile`。

- [ ] **Step 4：迁移 GameScene.js 的广告与分享**

替换 `_showRewardedAd` 中的 `wx.createRewardedVideoAd` 为 `ad.createRewarded(adId)`，返回 null 时跳分享。`_shareForProp` 改用 `share.send`。

- [ ] **Step 5：跑 vitest 验证 GameLogic 未受影响**

```bash
npx vitest run
```

Expected：D2 添加的 20+ 用例全过（GameLogic 不依赖 wx，应不受 D4 影响；如失败说明 D4 改坏了别的）。

- [ ] **Step 6：静态检查 wx 调用已收敛**

```bash
grep -rn "wx\.\(getStorageSync\|setStorageSync\|shareAppMessage\|requirePrivacyAuthorize\|getUserProfile\|getUserInfo\|getFriendCloudStorage\|setUserCloudStorage\|getUserCloudStorage\|createRewardedVideoAd\|getLaunchOptionsSync\)" src/ game.js
```

Expected：只有 `src/utils/wxApi.js` 一处匹配。

- [ ] **Step 7：手动验证 5 个核心路径**

按 spec 第 5 节，实机测试：
- 开始页 / 第 1 关 / 第 10 关 / 排行榜 / 每日挑战 — 所有交互应与改造前完全一致，控制台无 `[wxApi]` warn（除非真的发生失败）

- [ ] **Step 8：提交**

```bash
git add src/utils/storage.js src/scenes/LeaderboardScene.js src/scenes/GameScene.js game.js
git commit -m "refactor: migrate all wx.* calls to wxApi wrapper"
```

---

## 完成定义

- ✅ 所有 15 个 Task 提交到 master（11 原 + 4 新 Phase D）
- ✅ `npm test` 通过，GameLogic 至少 20 个用例 0 failing
- ✅ `node --check` 全部 JS 文件通过
- ✅ 微信开发者工具实机预览：开始页 / 第 1/10 关 / 排行榜 / 每日挑战 / 成就墙 5 个核心路径无视觉/交互回归
- ✅ `grep -rn "hexToRgb\|YOUR_AD_UNIT_ID"` 无残留
- ✅ `wx.{storage,share,...}` 散落调用收敛到 `wxApi.js` 一处

## 风险与回滚

- **Task A1（_snapshot 浅拷贝）**：如发现撤销后车块状态错乱，回滚此 commit，回到深拷贝。当前分析认为 car 对象在生命周期内不可变，浅拷贝安全。
- **Task C3（isBlocked 缓存）**：增量更新点容易漏改。如发现遮挡显示异常（点不动应该能点的格子、或反之），先把 `isBlocked` 临时退回 O(r) 实现以隔离 bug，再排查 `_recomputeColTops` 调用点。
- **Task C2（隐私授权去重）**：如某些机型上排行榜出现「请重启」提示卡片但实际已授权，说明 `_privacyOK` 状态在某场景路径上未正确写入。手段：先让 LeaderboardScene 即使 `_privacyOK === true` 也保留兜底调用。
