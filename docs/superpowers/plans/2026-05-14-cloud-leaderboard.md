# 云函数全服排行榜 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用微信云开发（云函数 + 云数据库）实现全服 TOP 50 排行榜，替换现有无法获取好友数据的关系链 API。

**Architecture:** 两个云函数（`submitScore` / `getTopN`）操作云数据库集合 `leaderboard`；前端通过 `wx.cloud.callFunction` 调用；`_openid` 由云函数运行时自动注入防止伪造。现有 `LeaderboardScene` 的渲染逻辑（头像、卡片、滚动）完全保留，只替换数据来源。

**Tech Stack:** 微信云开发、wx.cloud.callFunction、云数据库、vanilla JS ES modules、vitest。

---

## File Map

| 文件 | 操作 | 说明 |
|------|------|------|
| `cloudfunctions/submitScore/index.js` | 新建 | 云函数：upsert 玩家分数 |
| `cloudfunctions/submitScore/package.json` | 新建 | 云函数依赖声明 |
| `cloudfunctions/getTopN/index.js` | 新建 | 云函数：查询 TOP N |
| `cloudfunctions/getTopN/package.json` | 新建 | 云函数依赖声明 |
| `game.json` | 修改 | 新增 `"cloud": true` |
| `game.js` | 修改 | 新增 `wx.cloud.init()`，env 占位符 |
| `src/utils/wxApi.js` | 修改 | `cloud` 对象新增 `call` 方法 |
| `src/utils/storage.js` | 修改 | `saveProgress` 改为调云函数 |
| `src/scenes/LeaderboardScene.js` | 修改 | `init` / `_loadRank` / `_build` 改为调云函数 |
| `tests/config.test.js` | 修改 | 新增云函数逻辑单测 |

---

## Task 1: 云函数 submitScore

**Files:**
- Create: `cloudfunctions/submitScore/index.js`
- Create: `cloudfunctions/submitScore/package.json`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p cloudfunctions/submitScore
```

- [ ] **Step 2: 创建 package.json**

新建 `cloudfunctions/submitScore/package.json`：

```json
{
  "name": "submitScore",
  "version": "1.0.0",
  "main": "index.js"
}
```

- [ ] **Step 3: 实现云函数**

新建 `cloudfunctions/submitScore/index.js`：

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { nickname, avatarUrl, levelsPassed } = event

  const col = db.collection('leaderboard')
  const existing = await col.where({ _openid: OPENID }).get()

  if (existing.data.length === 0) {
    await col.add({
      data: {
        _openid:      OPENID,
        nickname:     nickname     || '玩家',
        avatarUrl:    avatarUrl    || '',
        levelsPassed: levelsPassed || 0,
        updatedAt:    Date.now(),
      }
    })
  } else {
    const old = existing.data[0]
    if (levelsPassed > (old.levelsPassed || 0)) {
      await col.doc(old._id).update({
        data: {
          nickname:     nickname  || old.nickname,
          avatarUrl:    avatarUrl || old.avatarUrl,
          levelsPassed,
          updatedAt:    Date.now(),
        }
      })
    }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Commit**

```bash
git add cloudfunctions/submitScore
git commit -m "feat(cloud): submitScore cloud function"
```

---

## Task 2: 云函数 getTopN

**Files:**
- Create: `cloudfunctions/getTopN/index.js`
- Create: `cloudfunctions/getTopN/package.json`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p cloudfunctions/getTopN
```

- [ ] **Step 2: 创建 package.json**

新建 `cloudfunctions/getTopN/package.json`：

```json
{
  "name": "getTopN",
  "version": "1.0.0",
  "main": "index.js"
}
```

- [ ] **Step 3: 实现云函数**

新建 `cloudfunctions/getTopN/index.js`：

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const n = event.n || 50

  const res = await db.collection('leaderboard')
    .orderBy('levelsPassed', 'desc')
    .limit(n)
    .get()

  return res.data.map(item => ({
    nickname:     item.nickname     || '玩家',
    avatarUrl:    item.avatarUrl    || '',
    levelsPassed: item.levelsPassed || 0,
    isMe:         item._openid === OPENID,
  }))
}
```

- [ ] **Step 4: Commit**

```bash
git add cloudfunctions/getTopN
git commit -m "feat(cloud): getTopN cloud function"
```

---

## Task 3: 前端基础配置（game.json + game.js）

**Files:**
- Modify: `game.json`
- Modify: `game.js`

- [ ] **Step 1: 更新 game.json**

打开 `game.json`，将内容替换为：

```json
{
  "deviceOrientation": "portrait",
  "networkTimeout": {
    "request": 5000
  },
  "subpackages": [],
  "__usePrivacyCheck__": true,
  "cloud": true
}
```

- [ ] **Step 2: 在 game.js 初始化云开发**

打开 `game.js`，找到 `Game.init()` 方法的第一行（`AudioManager.init()` 之前），插入：

```js
  init() {
    // 初始化微信云开发（envId 在微信开发者工具→云开发控制台获取后填入）
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.init({ env: 'YOUR_ENV_ID', traceUser: true })
    }

    // 初始化音效系统（创建 WebAudioContext）
    AudioManager.init()
```

> **注意：** `YOUR_ENV_ID` 是占位符，上线前必须替换为真实的云环境 ID（格式如 `prod-xxxxxx`）。在微信开发者工具 → 云开发 → 环境 ID 处获取。

- [ ] **Step 3: 运行测试确认无回归**

```bash
cd c:/Users/esh-tech-001/.openclaw/workspace/brick-game
npx vitest run tests/config.test.js 2>&1
```

Expected: 12 tests pass.

- [ ] **Step 4: Commit**

```bash
git add game.json game.js
git commit -m "feat(cloud): init wx.cloud in game.js, enable cloud in game.json"
```

---

## Task 4: wxApi.js 新增 cloud.call

**Files:**
- Modify: `src/utils/wxApi.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: 写测试**

在 `tests/config.test.js` 末尾追加：

```js
describe('wxApi cloud.call routing logic', () => {
  it('cloud.call 方法签名存在于 cloud 对象描述中（文档测试）', () => {
    // cloud.call 在 wx 环境下运行，无法在 vitest 中直接调用
    // 此测试验证 wxApi 模块可正常导入，cloud 对象结构符合预期
    const { cloud } = require('../src/utils/wxApi.js')
    expect(typeof cloud).toBe('object')
    expect(typeof cloud.setKV).toBe('function')
    expect(typeof cloud.call).toBe('function')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/config.test.js 2>&1
```

Expected: FAIL — `cloud.call is not a function`

- [ ] **Step 3: 在 wxApi.js 的 cloud 对象中新增 call 方法**

打开 `src/utils/wxApi.js`，找到 `cloud` 对象的最后一个方法 `getMyKV` 的结尾 `},`，在其后、对象闭合 `}` 之前插入：

```js
  call(name, data, onSuccess, onFail) {
    try {
      wx.cloud.callFunction({
        name,
        data,
        success: (res) => onSuccess && onSuccess(res.result),
        fail:    (e)   => { warn('callFunction:' + name, e); onFail && onFail(e) },
      })
    } catch (e) { warn('callFunction:' + name, e); onFail && onFail(e) }
  },
```

完整的 `cloud` 对象结尾应如下：

```js
  getMyKV(keyList, onSuccess, onFail) {
    try {
      wx.getUserCloudStorage({
        keyList,
        success: (res) => onSuccess && onSuccess(res.KVDataList || []),
        fail:    (e)   => { warn('getUserCloudStorage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getUserCloudStorage', e); onFail && onFail(e) }
  },
  call(name, data, onSuccess, onFail) {
    try {
      wx.cloud.callFunction({
        name,
        data,
        success: (res) => onSuccess && onSuccess(res.result),
        fail:    (e)   => { warn('callFunction:' + name, e); onFail && onFail(e) },
      })
    } catch (e) { warn('callFunction:' + name, e); onFail && onFail(e) }
  },
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/config.test.js 2>&1
```

Expected: 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/wxApi.js tests/config.test.js
git commit -m "feat(wxApi): add cloud.call for wx.cloud.callFunction"
```

---

## Task 5: storage.js — saveProgress 改为调云函数

**Files:**
- Modify: `src/utils/storage.js`

- [ ] **Step 1: 在 storage.js 顶部引入 cloud**

打开 `src/utils/storage.js`。找到第一行：

```js
import { storage, share, cloud, auth } from './wxApi.js'
```

`cloud` 已经在导入列表中，无需修改。

- [ ] **Step 2: 替换 saveProgress 实现**

找到：

```js
function saveProgress(levelsPassed) {
  cloud.setKV([{ key: RANK_KEY, value: String(levelsPassed) }])
  storage.set(MY_PROGRESS_KEY, levelsPassed)
}
```

替换为：

```js
function saveProgress(levelsPassed) {
  // 本地备份（排行榜兜底用）
  storage.set(MY_PROGRESS_KEY, levelsPassed)
  // 上传到全服排行榜云数据库
  const myInfo = getMyUserInfo()
  cloud.call('submitScore', {
    nickname:     myInfo.nickname  || '玩家',
    avatarUrl:    myInfo.avatarUrl || '',
    levelsPassed,
  })
}
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run tests/config.test.js 2>&1
```

Expected: 13 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.js
git commit -m "feat(storage): saveProgress uploads to cloud leaderboard via submitScore"
```

---

## Task 6: LeaderboardScene — 改为调 getTopN 云函数

**Files:**
- Modify: `src/scenes/LeaderboardScene.js`

现有 `init()` 已有缓存逻辑（Task 2 of 2026-05-14-ux-fixes.md 已实现）。本任务只替换 `_loadRank` 和 `_build` 的数据来源。

- [ ] **Step 1: 替换 _loadRank 方法**

打开 `src/scenes/LeaderboardScene.js`。找到整个 `_loadRank` 方法：

```js
  _loadRank() {
    let friendData = null
    let myKV       = null
    let done       = 0

    const tryBuild = () => {
      done++
      if (done < 2) return
      this._build(friendData || [], myKV)
    }

    cloud.getFriendKV([RANK_KEY],
      (data) => { friendData = data || []; tryBuild() },
      ()     => { friendData = [];         tryBuild() }
    )

    cloud.getMyKV([RANK_KEY],
      (kvList) => {
        const kv = (kvList || []).find(k => k.key === RANK_KEY)
        myKV = kv ? (parseInt(kv.value, 10) || 0) : 0
        tryBuild()
      },
      () => { myKV = null; tryBuild() }
    )
  }
```

替换为：

```js
  _loadRank() {
    cloud.call('getTopN', { n: 50 },
      (list) => { this._buildFromCloud(list || []) },
      ()     => { this._buildFromCloud([]) }
    )
  }
```

- [ ] **Step 2: 新增 _buildFromCloud 方法**

在 `_loadRank` 方法之后、`_build` 方法之前插入：

```js
  _buildFromCloud(list) {
    const myInfo   = getMyUserInfo()
    const myLevels = getMyProgress()

    // 将云函数返回的数组转换为渲染所需格式
    const rankList = list.map(item => ({
      nickname:     item.nickname     || '玩家',
      avatarUrl:    item.avatarUrl    || '',
      levelsPassed: item.levelsPassed || 0,
      isSelf:       !!item.isMe,
      _img:         null,
    }))

    // 若自己不在榜单中（分数太低），追加到末尾
    const selfInList = rankList.some(u => u.isSelf)
    if (!selfInList) {
      rankList.push({
        nickname:     myInfo.nickname  || '我',
        avatarUrl:    myInfo.avatarUrl || '',
        levelsPassed: myLevels,
        isSelf:       true,
        _img:         null,
      })
    }

    rankList.sort((a, b) => b.levelsPassed - a.levelsPassed)
    this._rankList = rankList
    this.loading   = false
    this.game._rankCache = { list: rankList, ts: Date.now() }

    // 预加载头像
    rankList.forEach(item => {
      if (!item.avatarUrl) return
      const img = wx.createImage()
      img.onload  = () => { item._img = img }
      img.onerror = () => {}
      img.src = item.avatarUrl
    })
  }
```

- [ ] **Step 3: 更新 _silentRefresh 调用 _buildFromCloud**

找到 `_silentRefresh` 方法中的 `tryBuild` 函数，它目前调用 `this._build(friendData || [], myKV)`。将整个 `_silentRefresh` 方法替换为：

```js
  _silentRefresh() {
    cloud.call('getTopN', { n: 50 },
      (list) => {
        this._buildFromCloud(list || [])
      },
      () => {}  // 静默失败，保留现有缓存
    )
  }
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run tests/config.test.js 2>&1
```

Expected: 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/LeaderboardScene.js
git commit -m "feat(leaderboard): switch to cloud getTopN for global TOP 50 ranking"
```

---

## Task 7: 部署说明文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README.md「上线前需填写」表格中新增云开发条目**

找到：

```markdown
| 位置 | 说明 |
|------|------|
| `src/utils/storage.js` → `SHARE_CONFIG.imageUrl` | 分享封面图地址（5:4 比例，建议 1000×800px CDN 链接） |
| `src/config.js` → `AD_CONFIG.rewardedUnitId` | 填入微信流量主激励视频广告单元 ID；留空时自动降级为分享获取道具 |
```

替换为：

```markdown
| 位置 | 说明 |
|------|------|
| `src/utils/storage.js` → `SHARE_CONFIG.imageUrl` | 分享封面图地址（5:4 比例，建议 1000×800px CDN 链接） |
| `src/config.js` → `AD_CONFIG.rewardedUnitId` | 填入微信流量主激励视频广告单元 ID；留空时自动降级为分享获取道具 |
| `game.js` → `wx.cloud.init({ env: 'YOUR_ENV_ID' })` | 填入微信云开发环境 ID（开发者工具→云开发→环境 ID）；同时在云开发控制台创建集合 `leaderboard` 并部署两个云函数 `submitScore` / `getTopN` |
```

- [ ] **Step 2: 在 v1.5.0 更新日志中补充云排行榜条目**

找到 v1.5.0 条目末尾，追加一行：

```markdown
- **新增** 云函数全服排行榜（TOP 50）：通关时上传分数到云数据库，排行榜展示全服玩家头像+昵称+通关数
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add cloud leaderboard deployment notes and changelog"
```

---

## Self-Review

**Spec coverage:**
- ✅ 云函数 submitScore（upsert，分数只升不降）：Task 1
- ✅ 云函数 getTopN（TOP 50，标记 isMe）：Task 2
- ✅ game.json `cloud: true` + `wx.cloud.init`：Task 3
- ✅ `wxApi.cloud.call` 封装：Task 4
- ✅ `saveProgress` 调 submitScore：Task 5
- ✅ LeaderboardScene 改为调 getTopN：Task 6
- ✅ 部署说明：Task 7
- ✅ 好友筛选预留：现有代码保留 `getFriendKV`/`getMyKV`，未删除，后续可叠加

**Placeholder 扫描：**
- `YOUR_ENV_ID` 在 Task 3 Step 2 有明确说明如何获取，不是遗漏 ✅

**Type 一致性：**
- `cloud.call('getTopN', { n: 50 }, onSuccess, onFail)` — Task 4 定义，Task 6 使用 ✅
- `cloud.call('submitScore', { nickname, avatarUrl, levelsPassed })` — Task 4 定义，Task 5 使用 ✅
- `_buildFromCloud(list)` — Task 6 Step 2 定义，Task 6 Step 1 和 Step 3 调用 ✅
- `item.isMe` → `isSelf` 映射在 `_buildFromCloud` 中完成 ✅
