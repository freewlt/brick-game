# 设计：ResultScene 倒计时缓存 + GameScene 结算 timer 存储

**日期：** 2026-05-15
**范围：** `src/scenes/ResultScene.js`、`src/scenes/GameScene.js`

---

## 问题 3：ResultScene 每帧调用 wx.getStorageSync()

### 现状

`ResultScene.draw()` 第 395 行在每帧调用 `getRecoverSecondsLeft()`，该函数内部调用 `_loadLivesData()` → `storage.get()` → `wx.getStorageSync()`。60fps 下每秒 60 次同步 I/O，在低端安卓机上可能造成帧率抖动。

### 方案：缓存 + 1 秒 setInterval 刷新

倒计时精度 1 秒完全够用，只需每秒读一次 storage。

**`ResultScene` 新增字段（constructor）：**
```js
this._recoverSecs  = 0     // 缓存的剩余恢复秒数
this._recoverTimer = null  // 1 秒刷新句柄
```

**`init()` 改动：**
在 `this.lives <= 0` 的条件下（失败且机会耗尽时才需要倒计时），立即读一次初始值，并启动 1 秒刷新：
```js
if (this.lives <= 0) {
  this._recoverSecs = getRecoverSecondsLeft()
  this._recoverTimer = setInterval(() => {
    this._recoverSecs = getRecoverSecondsLeft()
  }, 1000)
}
```

**`draw()` 改动：**
第 395 行 `getRecoverSecondsLeft()` 替换为 `this._recoverSecs`。

**`destroy()` 改动：**
```js
if (this._recoverTimer) {
  clearInterval(this._recoverTimer)
  this._recoverTimer = null
}
```

---

## 问题 4：GameScene showResult timer 句柄未存储

### 现状

`GameScene.update()` 第 228 行 `setTimeout(showResult, 1000)` 的句柄未存储，无法在 `destroy()` 中取消。虽然 `resultShown` 守卫防止了双触发，但快速切场景时 timer 仍在后台运行。

### 方案：存句柄，destroy() 里清理

**`GameScene` 新增字段（constructor）：**
```js
this._resultTimer = null
```

**`update()` 改动：**
```js
this._resultTimer = setTimeout(showResult, 1000)
```

`showResult` 回调内执行时加一行：
```js
this._resultTimer = null
```

**`destroy()` 改动：**
```js
if (this._resultTimer) {
  clearTimeout(this._resultTimer)
  this._resultTimer = null
}
```

---

## 改动文件汇总

| 文件 | 改动内容 |
|------|----------|
| `src/scenes/ResultScene.js` | 新增 `_recoverSecs`、`_recoverTimer`；`init()` 启动 interval；`draw()` 读缓存；`destroy()` 清 interval |
| `src/scenes/GameScene.js` | 新增 `_resultTimer`；`update()` 存句柄；`showResult` 回调清空；`destroy()` 清 timer |

## 不在本次范围内

- 问题 5（BGM timer 边界）：时序上不会触发，不修
- 问题 6（云函数无错误回调）：本地有备份，不修
- 问题 7（_drawAdModal 命中区域）：实际无影响，不修
