# 设计：渲染错误自救 + 胜负音效修复

**日期：** 2026-05-15
**范围：** `game.js`、`src/utils/audio.js`

---

## 问题 A：渲染错误后用户卡死

### 现状

`_handleRenderError` 只画兜底画面，但触摸事件仍路由到崩溃的场景。用户无法操作，只能重启小程序。

### 方案：自动恢复 + 触摸恢复（A3）

首次进入错误状态时，启动 2 秒自动跳首页定时器；同时标记错误状态，让触摸事件可以立即触发恢复。

**`Game` 新增状态：**
- `_renderErrorRecoveryTimer: null` — 持有 `setTimeout` 句柄；非 null 表示当前处于错误恢复模式

**`_handleRenderError(err)` 改动：**
1. 限频日志保持不变（1 秒节流）。
2. 首次进入错误（`_renderErrorRecoveryTimer === null`）时，调度：
   ```js
   this._renderErrorRecoveryTimer = setTimeout(() => {
     this._renderErrorRecoveryTimer = null
     this.showStart()
   }, 2000)
   ```
3. 兜底画面文案改为 `"画面异常，即将返回首页"`，副文案改为 `"或点击屏幕立即返回"`。

**`bindEvents` 触摸处理改动：**
在 `onTouchStart` 路由到 `currentScene` 之前，先检查：
```js
if (this._renderErrorRecoveryTimer) {
  clearTimeout(this._renderErrorRecoveryTimer)
  this._renderErrorRecoveryTimer = null
  this.showStart()
  return
}
```

---

## 问题 B：胜负音效被 stopSFX 截断

### 现状

`playWin` 和 `playLose` 使用 `_setSfxTimeout`，`GameScene.destroy()` → `stopSFX()` 可能在 560ms 内取消这些定时器，导致音效被截断。

### 方案：胜负音效改为原生 setTimeout（B3）

`playWin` 和 `playLose` 在语义上是"播完为止"的完成音效，不应受 `stopSFX` 管控。

**改动：** 将 `playWin` 和 `playLose` 内部所有 `_setSfxTimeout` 替换为原生 `setTimeout`。

其他音效方法（`playPlace`、`playEliminate`、`playCombo`、`playSlotFull`、`playBlocked`、`playSlotExpand`、`toggle`）保持使用 `_setSfxTimeout`，仍可被场景销毁清理。

**风险：** 若用户在胜负事件后 560ms 内切走场景，音效尾部会在新场景里继续播。可接受——音频节点只产生声音，不影响游戏状态。

---

## 改动文件汇总

| 文件 | 改动内容 |
|------|----------|
| `game.js` | 新增 `_renderErrorRecoveryTimer`，更新 `_handleRenderError`，更新 `bindEvents` 触摸处理 |
| `src/utils/audio.js` | `playWin` 和 `playLose` 内部 `_setSfxTimeout` → `setTimeout` |

## 不在本次范围内

- 其他场景 `destroy()` 未调用 `stopSFX`（风险低，后续单独处理）
- 持久化渲染错误日志 / 崩溃上报
