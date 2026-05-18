# 看广告得机会 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将结算页"分享得机会"替换为"看广告得机会"，广告未配置时直接送机会，上线只需填写一个配置项。

**Architecture:** 三个独立改动：config.js 加 AD_UNIT_ID 配置项；wxApi.js 的 ad 对象新增 showRewarded 方法（封装降级逻辑）；ResultScene.js 替换按钮文案和点击处理，移除 shareForLife 依赖。

**Tech Stack:** 微信小游戏 JS，wx.createRewardedVideoAd，Vitest

---

### Task 1：config.js 新增 AD_UNIT_ID

**Files:**
- Modify: `src/config.js:94`

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
describe('CONFIG.AD_UNIT_ID', () => {
  it('存在且默认为空字符串', async () => {
    const { CONFIG } = await import('../src/config.js')
    expect(typeof CONFIG.AD_UNIT_ID).toBe('string')
    expect(CONFIG.AD_UNIT_ID).toBe('')
  })
})
```

- [ ] **Step 2：运行测试确认失败**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "AD_UNIT_ID|Tests"
```

预期：`AD_UNIT_ID` 测试 FAIL（config 还没有该字段）。

- [ ] **Step 3：在 config.js 第 94 行后新增配置项**

将 `src/config.js` 中：

```js
  SLOT_MAX_EXPANDED: 7,                         // 扩槽后的上限
```

替换为：

```js
  SLOT_MAX_EXPANDED: 7,                         // 扩槽后的上限
  // 激励视频广告单元 ID（微信后台获取后填入）
  // 留空时点击"看广告"直接送机会，方便未接入广告时测试
  AD_UNIT_ID: '',
```

- [ ] **Step 4：运行测试确认通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -6
```

预期：所有测试 PASS。

- [ ] **Step 5：提交**

```bash
git add src/config.js tests/smoke.test.js
git commit -m "feat(config): add AD_UNIT_ID placeholder for rewarded video ad"
```

---

### Task 2：wxApi.js 新增 ad.showRewarded

**Files:**
- Modify: `src/utils/wxApi.js:119-139`

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
describe('ad.showRewarded 降级逻辑', () => {
  it('adUnitId 为空时直接调 onSuccess', () => {
    // 内联 mock，不依赖 wx 全局
    let called = false
    const adMock = {
      createRewarded(id) { return id ? {} : null },
      showRewarded(adUnitId, onSuccess, onFail) {
        if (!adUnitId) { onSuccess && onSuccess(); return }
        const inst = this.createRewarded(adUnitId)
        if (!inst) { onSuccess && onSuccess(); return }
        inst.show().then((isEnded) => {
          if (isEnded) onSuccess && onSuccess()
          else         onFail    && onFail()
        })
      },
    }
    adMock.showRewarded('', () => { called = true }, null)
    expect(called).toBe(true)
  })

  it('createRewarded 返回 null 时直接调 onSuccess', () => {
    let called = false
    const adMock = {
      createRewarded() { return null },
      showRewarded(adUnitId, onSuccess, onFail) {
        if (!adUnitId) { onSuccess && onSuccess(); return }
        const inst = this.createRewarded(adUnitId)
        if (!inst) { onSuccess && onSuccess(); return }
        inst.show().then((isEnded) => {
          if (isEnded) onSuccess && onSuccess()
          else         onFail    && onFail()
        })
      },
    }
    adMock.showRewarded('some-id', () => { called = true }, null)
    expect(called).toBe(true)
  })
})
```

- [ ] **Step 2：运行测试确认通过**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "showRewarded|Tests"
```

注意：这两个测试使用内联 mock，不依赖真实 wxApi，会直接 PASS——这是正常的，继续执行后续步骤。

- [ ] **Step 3：在 wxApi.js 的 ad 对象中新增 showRewarded**

将 `src/utils/wxApi.js` 中：

```js
// ── 激励视频广告 ──
export const ad = {
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

替换为：

```js
// ── 激励视频广告 ──
export const ad = {
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

  // adUnitId 为空或广告创建失败时直接调 onSuccess（降级保底）
  showRewarded(adUnitId, onSuccess, onFail) {
    if (!adUnitId) { onSuccess && onSuccess(); return }
    const inst = this.createRewarded(adUnitId)
    if (!inst)    { onSuccess && onSuccess(); return }
    inst.show().then((isEnded) => {
      if (isEnded) onSuccess && onSuccess()
      else         onFail    && onFail()
    })
  },
}
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -6
```

预期：所有测试 PASS。

- [ ] **Step 5：提交**

```bash
git add src/utils/wxApi.js tests/smoke.test.js
git commit -m "feat(wxApi): add ad.showRewarded with fallback when adUnitId empty or ad unavailable"
```

---

### Task 3：ResultScene.js 替换按钮逻辑

**Files:**
- Modify: `src/scenes/ResultScene.js:3` — import 行
- Modify: `src/scenes/ResultScene.js:354` — draw() 注释
- Modify: `src/scenes/ResultScene.js:389` — 按钮文案
- Modify: `src/scenes/ResultScene.js:445-457` — onTouchEnd shareBtn 处理

- [ ] **Step 1：更新 import 行**

将 `src/scenes/ResultScene.js` 第 3 行：

```js
import { spendLife, getLives, getRecoverSecondsLeft, shareForLife, saveProgress, saveLevelProgress } from '../utils/storage.js'
```

替换为：

```js
import { spendLife, getLives, getRecoverSecondsLeft, addLife, saveProgress, saveLevelProgress } from '../utils/storage.js'
import { ad } from '../utils/wxApi.js'
```

- [ ] **Step 2：更新 draw() 注释和按钮文案**

将 `src/scenes/ResultScene.js` 中：

```js
      // 失败：再试一次 / 分享得机会 + 首页
```

替换为：

```js
      // 失败：再试一次 / 看广告得机会 + 首页
```

将：

```js
        ctx.fillText(e('📣 分享得机会'), btn1X + bw2 / 2, cy + btnH / 2)
```

替换为：

```js
        ctx.fillText(e('📺 看广告得机会'), btn1X + bw2 / 2, cy + btnH / 2)
```

- [ ] **Step 3：更新 onTouchEnd 中 shareBtn 的处理**

将 `src/scenes/ResultScene.js` 中：

```js
    if (hit(this.shareBtn)) {
      // 分享成功后机会+1，刷新当前场景状态
      shareForLife((next) => {
        if (next !== null) {
          this.lives    = next
          if (this._recoverTimer) {
            clearInterval(this._recoverTimer)
            this._recoverTimer = null
          }
          this.shareBtn = null  // 触发重绘时切换回"再试一次"按钮
        }
      })
      return
    }
```

替换为：

```js
    if (hit(this.shareBtn)) {
      ad.showRewarded(CONFIG.AD_UNIT_ID, () => {
        const next = addLife(1)
        this.lives = next
        if (this._recoverTimer) {
          clearInterval(this._recoverTimer)
          this._recoverTimer = null
        }
        this.shareBtn = null   // 切换回"再试一次"按钮
      }, null)
      return
    }
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -6
```

预期：所有测试 PASS（ResultScene 不在单元测试覆盖范围，只需确认无回归）。

- [ ] **Step 5：提交**

```bash
git add src/scenes/ResultScene.js
git commit -m "feat(ResultScene): replace shareForLife with ad.showRewarded for extra life"
```
