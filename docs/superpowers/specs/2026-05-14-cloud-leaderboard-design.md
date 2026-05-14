# 云函数全服排行榜 Design

## 目标

用微信云开发（云函数 + 云数据库）替换现有的 `wx.getFriendCloudStorage` 关系链排行榜，实现全服 TOP 50 排行榜，个人开发者可用，免费额度内运行。

## 架构

```
小程序端                        云端
─────────────────────────────────────────────
通关时                          云函数 submitScore
  → wx.cloud.callFunction  →    按 _openid upsert leaderboard 集合
    { nickname, avatarUrl,       仅在 levelsPassed 提升时更新
      levelsPassed }             返回 { ok: true }

排行榜页                        云函数 getTopN
  → wx.cloud.callFunction  →    查 leaderboard 集合
    { n: 50 }                    按 levelsPassed 降序，limit 50
                                 标记 isMe（_openid 匹配当前用户）
                                 返回 Array<RankItem>
```

## 云数据库数据模型

集合名：`leaderboard`

```json
{
  "_id":          "自动生成",
  "_openid":      "用户openid（云函数运行时自动注入，不可伪造）",
  "nickname":     "张三",
  "avatarUrl":    "https://...",
  "levelsPassed": 12,
  "updatedAt":    1715000000000
}
```

索引：`_openid`（唯一），`levelsPassed`（降序，用于排行查询）。

## 云函数

### submitScore（`cloudfunctions/submitScore/index.js`）

- 入参：`{ nickname, avatarUrl, levelsPassed }`
- 逻辑：按 `_openid` 查找已有记录；若不存在则插入；若存在且新分数 > 旧分数则更新
- 出参：`{ ok: true }`

### getTopN（`cloudfunctions/getTopN/index.js`）

- 入参：`{ n }` （默认 50）
- 逻辑：查 `leaderboard` 集合，按 `levelsPassed` 降序，limit n；标记 `isMe`（`_openid === event.userInfo.openId`）
- 出参：`Array<{ nickname, avatarUrl, levelsPassed, isMe }>`

## 前端改动

### `game.json`
新增 `"cloud": true`。

### `game.js`
在 `Game.init()` 最前面调用：
```js
wx.cloud.init({ env: 'YOUR_ENV_ID', traceUser: true })
```
`YOUR_ENV_ID` 在微信开发者工具 → 云开发控制台获取，上线前必填。

### `src/utils/wxApi.js`
在 `cloud` 对象新增 `call` 方法：
```js
call(name, data, onSuccess, onFail) {
  try {
    wx.cloud.callFunction({
      name, data,
      success: (res) => onSuccess && onSuccess(res.result),
      fail:    (e)   => { warn('callFunction:' + name, e); onFail && onFail(e) },
    })
  } catch (e) { warn('callFunction:' + name, e); onFail && onFail(e) }
}
```

### `src/utils/storage.js`
`saveProgress` 在写本地备份的同时，调 `cloud.call('submitScore', ...)` 上传到云端：
```js
function saveProgress(levelsPassed) {
  storage.set(MY_PROGRESS_KEY, levelsPassed)
  const myInfo = getMyUserInfo()
  cloud.call('submitScore', {
    nickname:     myInfo.nickname  || '玩家',
    avatarUrl:    myInfo.avatarUrl || '',
    levelsPassed,
  })
}
```

### `src/scenes/LeaderboardScene.js`
`_loadRank` 改为调 `cloud.call('getTopN', { n: 50 }, ...)` 替换原来的 `getFriendKV` + `getMyKV` 双并行请求。`_build` 数据结构不变（`nickname`, `avatarUrl`, `levelsPassed`, `isSelf`），`isMe` 字段映射到 `isSelf`。

## 错误处理

- `submitScore` 失败：静默忽略（不影响游戏流程，下次通关会重试）
- `getTopN` 失败：显示本地战绩兜底（现有 `_drawMyStats` 逻辑）
- 云环境未初始化（`env` 未填）：`wx.cloud.callFunction` 会 fail，走 onFail 兜底

## 部署步骤（上线前必做）

1. 微信开发者工具 → 云开发 → 新建环境，记录 `envId`
2. 填入 `game.js` 的 `wx.cloud.init({ env: 'envId' })`
3. 在云开发控制台创建集合 `leaderboard`，权限设为「仅创建者可读写」
4. 右键 `cloudfunctions/submitScore` → 上传并部署
5. 右键 `cloudfunctions/getTopN` → 上传并部署

## 不在本次范围内

- 好友筛选（等申请到关系链权限后叠加）
- 分页加载（TOP 50 够用，不需要）
- 防刷限流（免费额度内 DAU 不会触发问题）
