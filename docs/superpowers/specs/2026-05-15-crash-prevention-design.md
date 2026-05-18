# 防闪退方案设计：渐变缓存 + 场景销毁钩子

**日期：** 2026-05-15  
**目标：** 在不改变任何视觉效果的前提下，消除微信小游戏长时间运行后因内存积累被系统强杀的问题。

---

## 问题分析

### 根本原因

长时间运行后内存持续增长，最终触发微信小游戏的内存限制被强杀。有两个独立的来源：

**来源 1：每帧大量创建短命 GC 对象（主因）**

`drawGlassCard`（`src/utils/draw.js`）每次调用创建 4-5 个 `LinearGradient` 对象。棋盘有 49 个格子，每帧调用 49 次，60fps 下每秒产生约 14,000 个短命对象。GC 持续高压导致内存碎片化，长时间运行后堆内存无法有效回收。

Header 区域的金色标题渐变、星星渐变也在每帧重建，但频率相对低。

**来源 2：场景切换时旧场景无法被 GC 回收（次因）**

场景切换时，旧场景可能持有活跃的 `setTimeout` 链（BGM timer、结算延迟 timer）。这些 timer 的回调持有 `this`（scene 实例引用），导致旧 scene 对象无法被 GC 回收，内存随关卡数线性增长。

---

## 方案 A：渐变对象缓存

### 目标

消除热路径上每帧重复创建 `LinearGradient` 的行为，改为首次创建后缓存复用。

### 实现

**`src/utils/draw.js` — `drawGlassCard` 增加 `cache` 参数**

```js
// 新签名（向后兼容，cache 可选）
export function drawGlassCard(ctx, x, y, w, h, r, baseColor, opts = {}, cache = null)
```

内部每个 `createLinearGradient` 调用前先查 cache，key 格式为 `"grad|{type}|{x}|{y}|{w}|{h}|{color}"`。命中则复用，miss 才创建并写入 cache。

**`src/scenes/GameScene.js` — 持有渐变缓存 Map**

- 构造函数：`this._gradCache = new Map()`
- `init()` 时：`this._gradCache.clear()`（关卡切换时尺寸可能变化，需清空）
- `_drawBoard`、`_drawSlot`、`_drawHeader` 调用 `drawGlassCard` 时传入 `this._gradCache`

**缓存 key 设计原则**

- key 包含坐标和尺寸，确保布局变化时不复用错误渐变
- key 包含 baseColor，确保不同颜色格子不互相污染
- 不缓存动画相关渐变（如 `_levelFlash`、`_undoFlash` 的全屏叠色，这些本身不是 LinearGradient）

### 预期收益

每帧 `LinearGradient` 创建数从 ~200 降至 0（稳定后全部命中缓存），GC 压力大幅降低。

---

## 方案 B：场景销毁钩子

### 目标

场景切换时显式释放旧场景持有的资源，确保旧场景对象可被 GC 回收。

### 实现

**各 Scene 类加 `destroy()` 方法**

| 场景 | `destroy()` 职责 |
|------|-----------------|
| `GameScene` | `AudioManager.stopBGM()`，清空 `floatTexts`、`particles`、`_gradCache` |
| `ResultScene` | 清空 `confetti` 数组 |
| `StartScene`、`LeaderboardScene`、`SettingsScene`、`AllClearScene`、`AchievementScene`、`DailyScene` | 空实现（统一接口，防御性） |

**`game.js` — 加 `_switchScene(newScene)` 内部方法**

```js
_switchScene(newScene) {
  if (this.currentScene && typeof this.currentScene.destroy === 'function') {
    this.currentScene.destroy()
  }
  this.currentScene = newScene
  newScene.init()
}
```

将现有所有 `showXxx()` 方法中的：
```js
this.currentScene = new XxxScene(...)
this.currentScene.init()
```
替换为：
```js
this._switchScene(new XxxScene(...))
```

**特殊情况：`showGame` 和 `showDailyGame`**

这两个方法目前已改为先 `scene.init()` 再赋值 `currentScene`（防止 init 期间 BGM 检测到错误场景）。改造后改为：先构造，再通过 `_switchScene` 统一处理，`_switchScene` 内部先 destroy 旧场景，再赋值，再 init。

`GameScene.init()` 里的 BGM 延迟检测（`setTimeout(() => { if (this.game.currentScene === this) ... })`）保持不变，仍然有效。

### 预期收益

每次关卡切换后旧 GameScene 对象（含 49 格棋盘数据、floatTexts、particles、gradCache）可被 GC 完整回收，内存不随关卡数线性增长。

---

## 改动文件清单

| 文件 | 改动类型 |
|------|---------|
| `src/utils/draw.js` | `drawGlassCard` 增加可选 `cache` 参数 |
| `src/scenes/GameScene.js` | 加 `_gradCache`，传 cache 给 `drawGlassCard`，加 `destroy()` |
| `src/scenes/ResultScene.js` | 加 `destroy()` |
| `src/scenes/StartScene.js` | 加空 `destroy()` |
| `src/scenes/LeaderboardScene.js` | 加空 `destroy()` |
| `src/scenes/SettingsScene.js` | 加空 `destroy()` |
| `src/scenes/AllClearScene.js` | 加空 `destroy()` |
| `src/scenes/AchievementScene.js` | 加空 `destroy()` |
| `src/scenes/DailyScene.js` | 加空 `destroy()` |
| `game.js` | 加 `_switchScene()`，所有 `showXxx` 改用它 |

---

## 不在本次范围内

- 离屏 Canvas 缓存棋盘绘制（方案 C，留作后续）
- 音频节点 `onended` 清理（已在 working tree 中完成）
- DPR 限制到 2（已在 working tree 中完成）
- 粒子上限（已在 working tree 中完成）
