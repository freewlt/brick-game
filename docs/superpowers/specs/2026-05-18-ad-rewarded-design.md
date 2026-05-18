# 分享得机会 → 看广告得机会 设计文档

**目标：** 将结算页"分享得机会"按钮替换为"看广告得机会"，广告未接入时直接送机会（降级保底），上线时只需填写一个配置项即可切换到真实广告。

**架构：** 三处改动完全独立——config 加配置项、wxApi 加广告封装方法、ResultScene 替换按钮逻辑。`shareForLife` 及相关 import 一并清理。

**Tech Stack:** 微信小游戏 JS，wx.createRewardedVideoAd

---

## 改动一：`src/config.js`

在 `SLOT_MAX_EXPANDED` 之后新增：

```js
// 激励视频广告单元 ID（微信后台获取）
// 留空时点击"看广告"直接送机会，方便未接入广告时测试
AD_UNIT_ID: '',
```

---

## 改动二：`src/utils/wxApi.js`

现有 `ad.createRewarded(adUnitId)` 返回广告实例或 null，调用方需自己处理 null。

新增 `ad.showRewarded(adUnitId, onSuccess, onFail)`，封装完整流程：

```js
showRewarded(adUnitId, onSuccess, onFail) {
  // 未配置广告 ID → 直接成功（降级保底）
  if (!adUnitId) { onSuccess && onSuccess(); return }
  const inst = this.createRewarded(adUnitId)
  // 广告创建失败 → 直接成功（降级保底）
  if (!inst) { onSuccess && onSuccess(); return }
  inst.show().then((isEnded) => {
    if (isEnded) { onSuccess && onSuccess() }
    else         { onFail   && onFail()    }
  })
},
```

---

## 改动三：`src/scenes/ResultScene.js`

**import 行：** 移除 `shareForLife`，新增 `addLife`；新增 `import { ad } from '../utils/wxApi.js'`。

**constructor：** `this.shareBtn` 字段保留（已有），无需改动。

**draw() 失败分支：** 按钮文案从 `'📣 分享得机会'` 改为 `'📺 看广告得机会'`。

**onTouchEnd()：** 将 `shareForLife` 回调替换为 `ad.showRewarded`：

```js
if (hit(this.shareBtn)) {
  ad.showRewarded(CONFIG.AD_UNIT_ID, () => {
    const next = addLife(1)
    this.lives    = next
    if (this._recoverTimer) {
      clearInterval(this._recoverTimer)
      this._recoverTimer = null
    }
    this.shareBtn = null   // 切换回"再试一次"按钮
  }, null)
  return
}
```

---

## 不在本次范围内

- 广告加载预热（`adUnitId` 填入后的性能优化）
- 每日广告次数上限
- 广告失败时的 Toast 提示
