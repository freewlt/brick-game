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

## 完成定义

- ✅ 所有 11 个 Task 提交到 master
- ✅ `node --check` 全部通过
- ✅ 微信开发者工具实机预览：开始页 / 第 1/10 关 / 排行榜 / 每日挑战 / 成就墙 5 个核心路径无视觉/交互回归
- ✅ `grep -rn "hexToRgb\|YOUR_AD_UNIT_ID"` 无残留

## 风险与回滚

- **Task A1（_snapshot 浅拷贝）**：如发现撤销后车块状态错乱，回滚此 commit，回到深拷贝。当前分析认为 car 对象在生命周期内不可变，浅拷贝安全。
- **Task C3（isBlocked 缓存）**：增量更新点容易漏改。如发现遮挡显示异常（点不动应该能点的格子、或反之），先把 `isBlocked` 临时退回 O(r) 实现以隔离 bug，再排查 `_recomputeColTops` 调用点。
- **Task C2（隐私授权去重）**：如某些机型上排行榜出现「请重启」提示卡片但实际已授权，说明 `_privacyOK` 状态在某场景路径上未正确写入。手段：先让 LeaderboardScene 即使 `_privacyOK === true` 也保留兜底调用。
