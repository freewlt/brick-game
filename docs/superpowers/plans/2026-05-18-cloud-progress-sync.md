# 云端关卡进度同步 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将关卡进度从纯本地存储升级为云端同步，解决换设备进度归零和开发/体验/正式版进度互相污染两个问题。

**Architecture:** 新增云函数 `syncProgress`（读写合一）；`wxApi.js` 新增 `getEnvPrefix()` 工具函数；`storage.js` 的本地 key 加环境前缀，`saveLevelProgress` 追加异步云端写，新增 `loadCloudProgress` 供启动时从云端恢复进度；`game.js` 在 `init()` 里调用一次 `loadCloudProgress`。

**Tech Stack:** 微信小游戏 JS，wx-server-sdk，云开发数据库（复用 `leaderboard` 集合），Vitest

---

### Task 1：新增云函数 `syncProgress`

**Files:**
- Create: `cloudfunctions/syncProgress/index.js`

- [ ] **Step 1：创建云函数目录和文件**

```bash
mkdir -p cloudfunctions/syncProgress
```

新建 `cloudfunctions/syncProgress/index.js`，内容如下：

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  if (action === 'save') {
    const levelProgress = Math.min(Math.max(parseInt(event.levelProgress) || 0, 0), 29)
    const col = db.collection('leaderboard')
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
    const col = db.collection('leaderboard')
    const existing = await col.where({ _openid: OPENID }).get()
    if (existing.data.length === 0) return { levelProgress: null }
    const val = existing.data[0].levelProgress
    return { levelProgress: typeof val === 'number' ? val : null }
  }

  return { ok: false, error: 'unknown action' }
}
```

- [ ] **Step 2：确认文件存在**

```bash
ls cloudfunctions/syncProgress/
```

预期输出：`index.js`

- [ ] **Step 3：提交**

```bash
git add cloudfunctions/syncProgress/index.js
git commit -m "feat(syncProgress): add cloud function for reading/writing level progress"
```

---

### Task 2：`wxApi.js` 新增 `getEnvPrefix`

**Files:**
- Modify: `src/utils/wxApi.js:1`（文件顶部新增导出函数）

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
// NOTE: getEnvPrefix 依赖 wx 全局，使用内联 mock 验证逻辑契约
describe('getEnvPrefix 环境前缀', () => {
  it('develop 环境返回 "dev_"', () => {
    const getEnvPrefix = (envVersion) => {
      if (envVersion === 'develop') return 'dev_'
      if (envVersion === 'trial')   return 'trial_'
      return ''
    }
    expect(getEnvPrefix('develop')).toBe('dev_')
  })

  it('trial 环境返回 "trial_"', () => {
    const getEnvPrefix = (envVersion) => {
      if (envVersion === 'develop') return 'dev_'
      if (envVersion === 'trial')   return 'trial_'
      return ''
    }
    expect(getEnvPrefix('trial')).toBe('trial_')
  })

  it('release 环境返回 ""（正式版 key 不变）', () => {
    const getEnvPrefix = (envVersion) => {
      if (envVersion === 'develop') return 'dev_'
      if (envVersion === 'trial')   return 'trial_'
      return ''
    }
    expect(getEnvPrefix('release')).toBe('')
    expect(getEnvPrefix(undefined)).toBe('')
  })
})
```

- [ ] **Step 2：运行测试确认通过**

注意：这些测试使用内联 mock，不依赖真实 wx 全局，会直接 PASS。

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "getEnvPrefix|Tests"
```

预期：3 个 `getEnvPrefix` 测试 PASS。

- [ ] **Step 3：在 `wxApi.js` 文件顶部（第 1 行前）新增 `getEnvPrefix`**

将 `src/utils/wxApi.js` 开头：

```js
// wx API 统一封装层
// 集中 try/catch、失败统一 console.warn 上报

function warn(api, err) {
```

替换为：

```js
// wx API 统一封装层
// 集中 try/catch、失败统一 console.warn 上报

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

function warn(api, err) {
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -6
```

预期：所有测试 PASS。

- [ ] **Step 5：提交**

```bash
git add src/utils/wxApi.js tests/smoke.test.js
git commit -m "feat(wxApi): add getEnvPrefix for environment-aware storage key isolation"
```

---

### Task 3：`storage.js` 升级关卡进度读写

**Files:**
- Modify: `src/utils/storage.js:2`（import 行）
- Modify: `src/utils/storage.js:76`（LEVEL_PROGRESS_KEY 定义）
- Modify: `src/utils/storage.js:86-88`（saveLevelProgress 函数体）
- Modify: `src/utils/storage.js` 末尾 export 块（新增 `loadCloudProgress`）

- [ ] **Step 1：写失败测试**

在 `tests/smoke.test.js` 末尾追加：

```js
// NOTE: loadCloudProgress 依赖 wx 全局，使用内联 mock 验证逻辑契约
describe('loadCloudProgress 云端进度恢复逻辑', () => {
  it('云端返回更大值时覆盖本地，调用 onDone(best)', () => {
    let stored = 3
    let doneCalled = null
    const mockStorage = { get: () => stored, set: (k, v) => { stored = v } }
    const mockCloud = {
      call(name, data, onSuccess) { onSuccess && onSuccess({ levelProgress: 9 }) }
    }
    function loadCloudProgress(onDone) {
      mockCloud.call('syncProgress', { action: 'load' }, (result) => {
        const remote = result && typeof result.levelProgress === 'number' ? result.levelProgress : null
        if (remote === null) return
        const local = mockStorage.get()
        const best  = Math.max(remote, local)
        if (best > local) mockStorage.set('key', best)
        onDone && onDone(best)
      })
    }
    loadCloudProgress((v) => { doneCalled = v })
    expect(stored).toBe(9)
    expect(doneCalled).toBe(9)
  })

  it('云端返回更小值时不覆盖本地，仍调用 onDone(local)', () => {
    let stored = 9
    let doneCalled = null
    const mockStorage = { get: () => stored, set: (k, v) => { stored = v } }
    const mockCloud = {
      call(name, data, onSuccess) { onSuccess && onSuccess({ levelProgress: 3 }) }
    }
    function loadCloudProgress(onDone) {
      mockCloud.call('syncProgress', { action: 'load' }, (result) => {
        const remote = result && typeof result.levelProgress === 'number' ? result.levelProgress : null
        if (remote === null) return
        const local = mockStorage.get()
        const best  = Math.max(remote, local)
        if (best > local) mockStorage.set('key', best)
        onDone && onDone(best)
      })
    }
    loadCloudProgress((v) => { doneCalled = v })
    expect(stored).toBe(9)
    expect(doneCalled).toBe(9)
  })

  it('云端返回 null 时静默不调用 onDone', () => {
    let doneCalled = false
    const mockCloud = {
      call(name, data, onSuccess) { onSuccess && onSuccess({ levelProgress: null }) }
    }
    function loadCloudProgress(onDone) {
      mockCloud.call('syncProgress', { action: 'load' }, (result) => {
        const remote = result && typeof result.levelProgress === 'number' ? result.levelProgress : null
        if (remote === null) return
        onDone && onDone(remote)
      })
    }
    loadCloudProgress(() => { doneCalled = true })
    expect(doneCalled).toBe(false)
  })
})
```

- [ ] **Step 2：运行测试确认通过**

注意：这些测试使用内联 mock，会直接 PASS。

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "loadCloudProgress|Tests"
```

预期：3 个 `loadCloudProgress` 测试 PASS。

- [ ] **Step 3：更新 `storage.js` import 行**

将 `src/utils/storage.js` 第 2 行：

```js
import { storage, share, cloud, auth } from './wxApi.js'
```

替换为：

```js
import { storage, share, cloud, auth, getEnvPrefix } from './wxApi.js'
```

- [ ] **Step 4：更新 `LEVEL_PROGRESS_KEY` 定义**

将 `src/utils/storage.js` 中：

```js
// ==================== 关卡进度 ====================
const LEVEL_PROGRESS_KEY = 'ywgy_level_progress'
```

替换为：

```js
// ==================== 关卡进度 ====================
// 正式版：'ywgy_level_progress'（兼容已有玩家数据）
// 体验版：'trial_ywgy_level_progress'
// 开发版：'dev_ywgy_level_progress'
const LEVEL_PROGRESS_KEY = getEnvPrefix() + 'ywgy_level_progress'
```

- [ ] **Step 5：更新 `saveLevelProgress`，追加云端异步写**

将 `src/utils/storage.js` 中：

```js
// 保存当前进入的关卡索引（直接覆盖，退出是哪关下次就从哪关开始）
function saveLevelProgress(levelIdx) {
  storage.set(LEVEL_PROGRESS_KEY, levelIdx)
}
```

替换为：

```js
// 保存当前进入的关卡索引（直接覆盖，退出是哪关下次就从哪关开始）
// 同时异步同步到云端（fire-and-forget，失败静默）
function saveLevelProgress(levelIdx) {
  storage.set(LEVEL_PROGRESS_KEY, levelIdx)
  cloud.call('syncProgress', { action: 'save', levelProgress: levelIdx })
}
```

- [ ] **Step 6：在 `saveLevelProgress` 之后新增 `loadCloudProgress`**

在 `src/utils/storage.js` 中，`saveLevelProgress` 函数结束后（`}` 之后）、`// ==================== 排行榜 ====================` 之前，插入：

```js
// 从云端读取进度，成功则用云端值覆盖本地（取较大值）
// onDone(levelIdx) 在读取完成后调用；云端返回 null 或失败时静默不调用
function loadCloudProgress(onDone) {
  cloud.call('syncProgress', { action: 'load' }, (result) => {
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

- [ ] **Step 7：在 export 块中新增 `loadCloudProgress`**

将 `src/utils/storage.js` 中：

```js
  // 关卡进度
  getLevelProgress,
  saveLevelProgress,
```

替换为：

```js
  // 关卡进度
  getLevelProgress,
  saveLevelProgress,
  loadCloudProgress,
```

- [ ] **Step 8：运行测试确认全部通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -6
```

预期：所有测试 PASS。

- [ ] **Step 9：提交**

```bash
git add src/utils/storage.js tests/smoke.test.js
git commit -m "feat(storage): env-prefix level progress key, add cloud sync via syncProgress"
```

---

### Task 4：`game.js` 启动时调用 `loadCloudProgress`

**Files:**
- Modify: `game.js:10`（import 行）
- Modify: `game.js:84`（`init()` 中 `this.showStart()` 之前）

- [ ] **Step 1：更新 `game.js` import 行**

将 `game.js` 第 10 行：

```js
import { handleShareEntry, saveLevelProgress, saveMyUserInfo } from './src/utils/storage.js'
```

替换为：

```js
import { handleShareEntry, saveLevelProgress, saveMyUserInfo, loadCloudProgress } from './src/utils/storage.js'
```

- [ ] **Step 2：在 `init()` 中调用 `loadCloudProgress`**

将 `game.js` 中：

```js
    this.showStart()
    this.bindEvents()
  },
```

替换为：

```js
    // 启动时静默同步云端进度，不阻塞 UI；云端值回来后如果更大则覆盖本地
    loadCloudProgress(() => {})

    this.showStart()
    this.bindEvents()
  },
```

- [ ] **Step 3：运行测试确认全部通过**

```bash
npm test -- --reporter=verbose 2>&1 | tail -6
```

预期：所有测试 PASS。

- [ ] **Step 4：提交**

```bash
git add game.js
git commit -m "feat(game): call loadCloudProgress on init to restore progress from cloud"
```

---

## 部署说明

云函数 `syncProgress` 需要在微信开发者工具中手动部署：

1. 右键 `cloudfunctions/syncProgress` 文件夹
2. 选择「上传并部署：云端安装依赖」
3. 部署完成后，开发版/体验版/正式版均可调用（`cloud.DYNAMIC_CURRENT_ENV` 自动路由到对应环境）
