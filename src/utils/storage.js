// 存储工具 - 机会系统 + 排行榜 + 分享

// ==================== 机会系统 ====================
const LIVES_KEY  = 'ywgy_lives'
const LIVES_MAX  = 3
const RECOVER_MS = 30 * 60 * 1000  // 30分钟恢复1次

function _loadLivesData() {
  try {
    const raw = wx.getStorageSync(LIVES_KEY)
    if (raw && typeof raw === 'object') return raw
  } catch (e) {}
  return { count: LIVES_MAX, lastRecover: Date.now(), lastSpend: 0 }
}

function _saveLivesData(data) {
  try { wx.setStorageSync(LIVES_KEY, data) } catch (e) {}
}

// 计算自动恢复后的机会数
function getLives() {
  const data = _loadLivesData()
  if (data.count >= LIVES_MAX) return LIVES_MAX

  const elapsed  = Date.now() - (data.lastRecover || Date.now())
  const recovered = Math.floor(elapsed / RECOVER_MS)
  if (recovered > 0) {
    const newCount = Math.min(LIVES_MAX, data.count + recovered)
    const newData  = {
      count:       newCount,
      lastRecover: data.lastRecover + recovered * RECOVER_MS,
      lastSpend:   data.lastSpend,
    }
    _saveLivesData(newData)
    return newCount
  }
  return data.count
}

// 扣除1次机会；返回扣后剩余数
function spendLife() {
  const cur = getLives()
  const data = _loadLivesData()
  const next = Math.max(0, cur - 1)
  const now  = Date.now()
  _saveLivesData({
    count:       next,
    lastRecover: cur >= LIVES_MAX ? now : (data.lastRecover || now),
    lastSpend:   now,
  })
  return next
}

// 增加机会（分享/好友解锁）
function addLife(n = 1) {
  const cur = getLives()
  const data = _loadLivesData()
  const next = Math.min(LIVES_MAX, cur + n)
  _saveLivesData({
    count:       next,
    lastRecover: data.lastRecover || Date.now(),
    lastSpend:   data.lastSpend || 0,
  })
  return next
}

// 距下次恢复剩余秒数（0=已满/已可恢复）
function getRecoverSecondsLeft() {
  const data = _loadLivesData()
  if (data.count >= LIVES_MAX) return 0
  const elapsed = Date.now() - (data.lastRecover || Date.now())
  const remain  = RECOVER_MS - (elapsed % RECOVER_MS)
  return Math.ceil(remain / 1000)
}

// ==================== 排行榜 ====================
const RANK_KEY = 'levelsPassed'

// 上传通关数（通关时调用）
function saveProgress(levelsPassed) {
  try {
    wx.setUserCloudStorage({
      KVDataList: [{ key: RANK_KEY, value: String(levelsPassed) }],
      success: () => {},
      fail: () => {},
    })
  } catch (e) {}
}

// 拉取好友排行数据，返回 Promise<Array<{nickname, avatarUrl, levelsPassed}>>
function fetchFriendRank() {
  return new Promise((resolve) => {
    try {
      wx.getFriendCloudStorage({
        keyList: [RANK_KEY],
        success: (res) => {
          const list = (res.data || []).map(item => {
            const kv = (item.KVDataList || []).find(k => k.key === RANK_KEY)
            return {
              nickname:     item.nickname   || '好友',
              avatarUrl:    item.avatarUrl  || '',
              levelsPassed: parseInt(kv ? kv.value : '0', 10) || 0,
            }
          })
          list.sort((a, b) => b.levelsPassed - a.levelsPassed)
          resolve(list)
        },
        fail: () => resolve([]),
      })
    } catch (e) {
      resolve([])
    }
  })
}

// ==================== 分享 ====================

// 分享给好友并立即给自己+1机会（乐观更新）
function shareForLife(cb) {
  wx.shareAppMessage({
    title: '我在赢了个赢里消消乐，三消赢豪车！来挑战我！',
    imageUrl: '',          // 可填自定义封面图路径
    query: 'from=share',
    success: () => {
      const next = addLife(1)
      if (cb) cb(next)
    },
    fail: () => {
      if (cb) cb(null)
    },
  })
}

// 启动时检测分享入口（在 game.js 初始化时调用）
function handleShareEntry() {
  try {
    const opts  = wx.getLaunchOptionsSync()
    const query = opts.query || {}
    if (query.from === 'share') {
      addLife(1)
      return true  // 返回 true 表示本次是好友分享进来的
    }
  } catch (e) {}
  return false
}

export {
  // 机会
  getLives,
  spendLife,
  addLife,
  getRecoverSecondsLeft,
  // 排行榜
  saveProgress,
  fetchFriendRank,
  // 分享
  shareForLife,
  handleShareEntry,
}
