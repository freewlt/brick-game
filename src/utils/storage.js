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

// ==================== 关卡进度 ====================
const LEVEL_PROGRESS_KEY = 'ywgy_level_progress'

// 读取已解锁的最高关卡索引（0-based）；首次返回 0
function getLevelProgress() {
  try {
    const raw = wx.getStorageSync(LEVEL_PROGRESS_KEY)
    if (typeof raw === 'number' && raw >= 0) return raw
  } catch (e) {}
  return 0
}

// 保存当前进入的关卡索引（直接覆盖，退出是哪关下次就从哪关开始）
function saveLevelProgress(levelIdx) {
  try {
    wx.setStorageSync(LEVEL_PROGRESS_KEY, levelIdx)
  } catch (e) {}
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

// ⚙️ 分享配置 — 上线前在这里填入你的封面图地址即可
// 封面图要求：微信要求 5:4 比例，建议 1000×800px，CDN 直链（https://）
// 也可以填小游戏内的本地路径，如 'images/share_cover.jpg'
const SHARE_CONFIG = {
  title:    '我在「赢了个赢」里三消赢豪车，来挑战我！',
  imageUrl: 'images/share_cover.jpg',   // ← 填入封面图 URL，留空则微信自动截屏
}

// 分享给好友并立即给自己+1机会（乐观更新）
function shareForLife(cb) {
  wx.shareAppMessage({
    title:    SHARE_CONFIG.title,
    imageUrl: SHARE_CONFIG.imageUrl,
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

// ==================== 道具持久化 ====================
const PROPS_EXTRA_KEY = 'ywgy_props_extra'

function _loadPropsExtra() {
  try {
    const raw = wx.getStorageSync(PROPS_EXTRA_KEY)
    if (raw && typeof raw === 'object') return raw
  } catch (e) {}
  return { expand: 0, shuffle: 0 }
}

function _savePropsExtra(data) {
  try { wx.setStorageSync(PROPS_EXTRA_KEY, data) } catch (e) {}
}

// 读取额外道具存量
function getExtraProps() {
  return _loadPropsExtra()
}

// 消耗1个额外道具（type: 'expand'|'shuffle'），返回是否成功
function spendExtraProp(type, n = 1) {
  const data = _loadPropsExtra()
  if ((data[type] || 0) < n) return false
  data[type] = data[type] - n
  _savePropsExtra(data)
  return true
}

// 增加额外道具（广告/分享成功后调用）
function addExtraProp(type, n = 1) {
  const data = _loadPropsExtra()
  data[type] = (data[type] || 0) + n
  _savePropsExtra(data)
  return data[type]
}

// ==================== 成就系统 ====================
const ACHIEVEMENT_STATS_KEY   = 'ywgy_ach_stats'    // 累计统计数据
const ACHIEVEMENT_UNLOCK_KEY  = 'ywgy_ach_unlocked'  // 已解锁成就 ID 集合

// 默认统计结构
function _defaultStats() {
  return {
    levelsPassed:  0,   // 累计通关关数
    totalCarsWon:  0,   // 累计赢车数
    maxCombo:      0,   // 历史最高连消
    threeStarCount: 0,  // 累计 3 星次数
    totalUndos:    0,   // 累计撤销次数
    totalShuffles: 0,   // 累计洗牌次数
    totalShares:   0,   // 累计分享次数
  }
}

// 读取累计统计
function getAchievementStats() {
  try {
    const raw = wx.getStorageSync(ACHIEVEMENT_STATS_KEY)
    if (raw && typeof raw === 'object') {
      return { ..._defaultStats(), ...raw }
    }
  } catch (e) {}
  return _defaultStats()
}

// 保存累计统计
function saveAchievementStats(stats) {
  try { wx.setStorageSync(ACHIEVEMENT_STATS_KEY, stats) } catch (e) {}
}

// 读取已解锁成就集合（返回 Set<string>）
function getUnlockedAchievements() {
  try {
    const raw = wx.getStorageSync(ACHIEVEMENT_UNLOCK_KEY)
    if (Array.isArray(raw)) return new Set(raw)
  } catch (e) {}
  return new Set()
}

// 解锁一个成就（持久化）
function unlockAchievement(id) {
  const set = getUnlockedAchievements()
  if (set.has(id)) return false   // 已解锁，不重复
  set.add(id)
  try { wx.setStorageSync(ACHIEVEMENT_UNLOCK_KEY, [...set]) } catch (e) {}
  return true   // 返回 true 表示是新解锁
}

// 批量检测并解锁成就；返回本次新解锁的成就数组（可能为空）
// achievements = CONFIG.ACHIEVEMENTS，stats = 当前统计对象
function checkAndUnlockAchievements(achievements, stats) {
  const unlocked = getUnlockedAchievements()
  const newlyUnlocked = []
  for (const ach of achievements) {
    if (!unlocked.has(ach.id) && ach.check(stats)) {
      const isNew = unlockAchievement(ach.id)
      if (isNew) newlyUnlocked.push(ach)
    }
  }
  return newlyUnlocked
}

// ==================== 每日挑战 ====================
const DAILY_KEY = 'ywgy_daily'

// 今天日期字符串 YYYYMMDD（本地时间）
function _todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// 昨天日期字符串
function _yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// 读取每日挑战状态
// 返回 { date, played, won, streak, dailyWins }
function getDailyState() {
  try {
    const raw = wx.getStorageSync(DAILY_KEY)
    if (raw && typeof raw === 'object') {
      // 若存储日期不是今天，保留 streak/dailyWins，重置 played/won
      if (raw.date !== _todayStr()) {
        // 若上次玩的是昨天且赢了，streak 连续保留（completeDailyChallenge 才递增，这里不动）
        return {
          date:      _todayStr(),
          played:    false,
          won:       false,
          streak:    raw.streak    || 0,
          dailyWins: raw.dailyWins || 0,
          lastWonDate: raw.won ? raw.date : (raw.lastWonDate || ''),
        }
      }
      return { streak: 0, dailyWins: 0, lastWonDate: '', ...raw }
    }
  } catch (e) {}
  return { date: _todayStr(), played: false, won: false, streak: 0, dailyWins: 0, lastWonDate: '' }
}

// 保存每日挑战状态
function saveDailyState(state) {
  try { wx.setStorageSync(DAILY_KEY, state) } catch (e) {}
}

// 每日挑战结束时调用（won: 是否通关）
// 返回更新后的 state
function completeDailyChallenge(won) {
  const state = getDailyState()
  if (state.played) return state   // 今天已完成，不重复计算

  const today = _todayStr()
  const yesterday = _yesterdayStr()

  let newStreak    = state.streak    || 0
  let newDailyWins = state.dailyWins || 0
  let newLastWonDate = state.lastWonDate || ''

  if (won) {
    // 连续天数：昨天也赢了 → streak+1；否则从 1 开始
    if (newLastWonDate === yesterday) {
      newStreak = newStreak + 1
    } else {
      newStreak = 1
    }
    newDailyWins    = newDailyWins + 1
    newLastWonDate  = today
  } else {
    // 失败：连击中断（streak 清 0）
    newStreak = 0
  }

  const newState = {
    date:        today,
    played:      true,
    won,
    streak:      newStreak,
    dailyWins:   newDailyWins,
    lastWonDate: newLastWonDate,
  }
  saveDailyState(newState)
  return newState
}

export {
  // 分享配置（供其他场景复用）
  SHARE_CONFIG,
  // 机会
  getLives,
  spendLife,
  addLife,
  getRecoverSecondsLeft,
  // 关卡进度
  getLevelProgress,
  saveLevelProgress,
  // 排行榜
  saveProgress,
  fetchFriendRank,
  // 分享
  shareForLife,
  handleShareEntry,
  // 道具
  getExtraProps,
  spendExtraProp,
  addExtraProp,
  // 成就
  getAchievementStats,
  saveAchievementStats,
  getUnlockedAchievements,
  unlockAchievement,
  checkAndUnlockAchievements,
  // 每日挑战
  getDailyState,
  saveDailyState,
  completeDailyChallenge,
}
