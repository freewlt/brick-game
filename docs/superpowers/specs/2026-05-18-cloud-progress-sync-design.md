# 云端关卡进度同步 设计文档

**目标：** 将关卡进度（resume-point）从纯本地存储升级为云端同步，解决两个问题：换设备进度归零；开发/体验/正式版共用同一本地 key 导致进度互相污染。

**架构：** 三处独立改动——新增云函数 `syncProgress`（读写合一）；`wxApi.js` 加 `cloud.call` 封装；`storage.js` 的 `saveLevelProgress` / `getLevelProgress` 改为云端优先、本地兜底，并加环境前缀隔离本地 key。开发版、体验版、正式版调用同一套云函数和同一云环境，因此云端数据隔离不能依赖 `cloud.DYNAMIC_CURRENT_ENV`；客户端必须传 `envVersion`。排行榜继续路由到 `leaderboard` / `leaderboard_trial` / `leaderboard_dev`，关卡进度路由到 `progress` / `progress_trial` / `progress_dev`，避免进度文档污染榜单。

**Tech Stack:** 微信小游戏 JS，wx-server-sdk，云开发数据库（排行榜：`leaderboard` / `leaderboard_trial` / `leaderboard_dev`；进度：`progress` / `progress_trial` / `progress_dev`），Vitest

---

## 数据模型

排行榜继续使用 `leaderboard` / `leaderboard_trial` / `leaderboard_dev`。关卡进度独立使用 `progress` / `progress_trial` / `progress_dev`，避免仅同步进度的玩家污染排行榜集合。

```
progress 文档：
{
  _openid:       "...",          // 已有，服务端从 getWXContext() 取
  levelProgress: 9,              // 当前进度 0-based 索引
  updatedAt:     1716000000000
}
```

`levelProgress` 服务端只允许前进（新值 > 旧值才更新），防止客户端传入低值覆盖云端进度。

---

## 改动一：新增云函数 `syncProgress`

**文件：** `cloudfunctions/syncProgress/index.js`（新建）

一个函数处理读和写，减少云函数数量。

### 写（action: 'save'）

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  if (action === 'save') {
    const levelProgress = Math.min(Math.max(parseInt(event.levelProgress) || 0, 0), 29)
    const col = db.collection(getLeaderboardCollectionName(event.envVersion))
    const existing = await col.where({ _openid: OPENID }).get()
    if (existing.data.length === 0) {
      await col.add({ data: { _openid: OPENID, levelProgress, updatedAt: Date.now() } })
    } else {
      const old = existing.data[0]
      if (levelProgress > (old.levelProgress || 0)) {
        await col.doc(old._id).update({ data: { levelProgress, updatedAt: Date.now() } })
      }
    }
    return { ok: true }
  }

  if (action === 'load') {
    const col = db.collection(getLeaderboardCollectionName(event.envVersion))
    const existing = await col.where({ _openid: OPENID }).get()
    if (existing.data.length === 0) return { levelProgress: null }
    return { levelProgress: existing.data[0].levelProgress ?? null }
  }

  return { ok: false, error: 'unknown action' }
}
```

- openid 始终从 `cloud.getWXContext()` 取，客户端不传
- `levelProgress` 服务端 clamp 到 `[0, 29]`，防止伪造
- 只允许前进（`levelProgress > old.levelProgress`）
- `cloud.DYNAMIC_CURRENT_ENV` 只表示云函数部署所在的云环境；开发版、体验版、正式版如果共用同一套云函数，就不会自动隔离数据
- 客户端需传 `envVersion`；集合按 `progress_dev` / `progress_trial` / `progress` 路由

---

## 改动二：`wxApi.js` 加环境前缀工具函数

**文件：** `src/utils/wxApi.js`

在文件顶部新增：

```js
// 返回当前运行环境前缀，用于隔离本地 storage key
// develop → 'dev_'，trial → 'trial_'，release → ''（正式版 key 不变，兼容已有玩家数据）
export function getEnvPrefix() {
  try {
    const { envVersion } = wx.getAccountInfoSync().miniProgram
    if (envVersion === 'develop') return 'dev_'
    if (envVersion === 'trial')   return 'trial_'
  } catch (e) {}
  return ''
}
```

正式版前缀为空字符串，已有玩家的本地进度数据零迁移成本。

---

## 改动三：`storage.js` 升级 `saveLevelProgress` / `getLevelProgress`

**文件：** `src/utils/storage.js`

### 本地 key 加环境前缀

```js
import { getEnvPrefix } from './wxApi.js'

// 正式版：'ywgy_level_progress'（兼容已有数据）
// 体验版：'trial_ywgy_level_progress'
// 开发版：'dev_ywgy_level_progress'
const LEVEL_PROGRESS_KEY = getEnvPrefix() + 'ywgy_level_progress'
```

### `saveLevelProgress`：本地写 + 云端异步同步

```js
function saveLevelProgress(levelIdx) {
  storage.set(LEVEL_PROGRESS_KEY, levelIdx)
  // 异步 fire-and-forget，失败静默
  cloud.call('syncProgress', { action: 'save', levelProgress: levelIdx, envVersion: ENV_VERSION })
}
```

### 新增 `loadCloudProgress`：启动时从云端恢复

```js
// 从云端读取进度，成功则用云端值覆盖本地（取较大值）
// onDone(levelIdx) 在读取完成后调用；失败时不调用（调用方继续用本地值）
function loadCloudProgress(onDone) {
  cloud.call('syncProgress', { action: 'load', envVersion: ENV_VERSION }, (result) => {
    const remote = result && typeof result.levelProgress === 'number'
      ? result.levelProgress
      : null
    if (remote === null) return
    const local = getLevelProgress()
    const best  = Math.max(remote, local)
    if (best > local) storage.set(LEVEL_PROGRESS_KEY, best)
    onDone && onDone(best)
  })
}
```

`getLevelProgress` 本身不变（仍读本地），`loadCloudProgress` 是异步补丁，在 `game.js` 初始化后调用一次。

### `game.js` 启动时调用

在 `game.js` 的 `showStart()` 或初始化完成后调用：

```js
import { loadCloudProgress } from './src/utils/storage.js'

// 启动时静默同步云端进度，不阻塞 UI
loadCloudProgress(() => {
  // 云端进度已写入本地，下次点"开始赢车"自动读到最新值
})
```

---

## 不在本次范围内

- 云端进度的实时监听（玩家同时在两台设备上玩）
- `levelsPassed`（通关总数）的云端同步（已由 `submitScore` 处理）

## 已决策：不做的事

**进度回滚保护**（玩家清本地缓存后云端恢复）：已由 `loadCloudProgress` 覆盖。启动时从云端读取，若本地为 0 而云端有进度，自动用云端值覆盖本地，无需额外处理。

**云函数错误重试机制**：`saveLevelProgress` 在通关和进入关卡时均会调用，网络抖动丢一次写，下次正常游戏自动补写，云端进度最多落后一次操作。重试机制收益极小但引入定时器管理复杂度，保持 fire-and-forget 即可。`loadCloudProgress` 读失败静默使用本地值，下次启动重试，同样不需要主动重试逻辑。

---

## 测试策略

云函数逻辑用内联 mock 在 `tests/smoke.test.js` 验证：
- `loadCloudProgress`：云端返回更大值时覆盖本地
- `loadCloudProgress`：云端返回更小值时不覆盖本地
- `loadCloudProgress`：云端返回 null 时静默不调用 onDone
- `saveLevelProgress`：本地写入正确 key（含环境前缀）
- `getEnvPrefix`：develop/trial/release 各返回正确前缀
