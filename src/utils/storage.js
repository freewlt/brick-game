// 存储工具 - 机会系统 + 排行榜 + 分享
import { storage, share, cloud, auth } from './wxApi.js'

// ==================== 机会系统 ====================
const LIVES_KEY  = 'ywgy_lives'
const LIVES_MAX  = 3
const RECOVER_MS = 30 * 60 * 1000  // 30分钟恢复1次

function _loadLivesData() {
  const raw = storage.get(LIVES_KEY)
  if (raw && typeof raw === 'object') return raw
  return { count: LIVES_MAX, lastRecover: Date.now(), lastSpend: 0 }
}

function _saveLivesData(data) {
  storage.set(LIVES_KEY, data)
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
  const raw = storage.get(LEVEL_PROGRESS_KEY)
  if (typeof raw === 'number' && raw >= 0) return raw
  return 0
}

// 保存当前进入的关卡索引（直接覆盖，退出是哪关下次就从哪关开始）
function saveLevelProgress(levelIdx) {
  storage.set(LEVEL_PROGRESS_KEY, levelIdx)
}

// ==================== 排行榜 ====================
const RANK_KEY        = 'levelsPassed'
const MY_PROGRESS_KEY = 'ywgy_my_progress'

// 上传通关数（通关时调用）并本地备份（排行榜显示自己用）
function saveProgress(levelsPassed) {
  cloud.setKV([{ key: RANK_KEY, value: String(levelsPassed) }])
  storage.set(MY_PROGRESS_KEY, levelsPassed)
}

// 读取本地缓存的自己通关数
function getMyProgress() {
  const v = storage.get(MY_PROGRESS_KEY)
  return typeof v === 'number' ? v : 0
}

// ==================== 我的用户信息缓存 ====================
const MY_USERINFO_KEY = 'ywgy_my_userinfo'

// 保存自己的头像和昵称（game.js init 时调用）
function saveMyUserInfo(info) {
  storage.set(MY_USERINFO_KEY, info)
}

// 读取缓存的自己头像/昵称；无则返回默认值
function getMyUserInfo() {
  const raw = storage.get(MY_USERINFO_KEY)
  if (raw && raw.nickname) return raw
  return { nickname: '我', avatarUrl: '' }
}

// 拉取好友排行数据，返回 Promise<Array<{nickname, avatarUrl, levelsPassed}>>
function fetchFriendRank() {
  return new Promise((resolve) => {
    cloud.getFriendKV([RANK_KEY],
      (data) => {
        const list = (data || []).map(item => {
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
      () => resolve([])
    )
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
  share.send({
    title:    SHARE_CONFIG.title,
    imageUrl: SHARE_CONFIG.imageUrl,
    query:    'from=share',
    onSuccess: () => { const next = addLife(1); if (cb) cb(next) },
    onFail:    () => { if (cb) cb(null) },
  })
}

// 启动时检测分享入口（在 game.js 初始化时调用）
function handleShareEntry() {
  const query = share.getLaunchQuery()
  if (query.from === 'share') {
    addLife(1)
    return true
  }
  return false
}

// ==================== 道具持久化 ====================
const PROPS_EXTRA_KEY = 'ywgy_props_extra'

function _loadPropsExtra() {
  const raw = storage.get(PROPS_EXTRA_KEY)
  if (raw && typeof raw === 'object') return raw
  return { expand: 0, shuffle: 0 }
}

function _savePropsExtra(data) {
  storage.set(PROPS_EXTRA_KEY, data)
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
  const raw = storage.get(ACHIEVEMENT_STATS_KEY)
  if (raw && typeof raw === 'object') {
    return { ..._defaultStats(), ...raw }
  }
  return _defaultStats()
}

// 保存累计统计
function saveAchievementStats(stats) {
  storage.set(ACHIEVEMENT_STATS_KEY, stats)
}

// 读取已解锁成就集合（返回 Set<string>）
function getUnlockedAchievements() {
  const raw = storage.get(ACHIEVEMENT_UNLOCK_KEY)
  if (Array.isArray(raw)) return new Set(raw)
  return new Set()
}

// 解锁一个成就（持久化）
function unlockAchievement(id) {
  const set = getUnlockedAchievements()
  if (set.has(id)) return false
  set.add(id)
  storage.set(ACHIEVEMENT_UNLOCK_KEY, [...set])
  return true
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

// ==================== 隐私授权 ====================
function requestPrivacyAuthorize() {
  return auth.requirePrivacy()
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
  const raw = storage.get(DAILY_KEY)
  if (raw && typeof raw === 'object') {
    if (raw.date !== _todayStr()) {
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
  return { date: _todayStr(), played: false, won: false, streak: 0, dailyWins: 0, lastWonDate: '' }
}

// 保存每日挑战状态
function saveDailyState(state) {
  storage.set(DAILY_KEY, state)
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
  getMyProgress,
  saveMyUserInfo,
  getMyUserInfo,
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
  // 隐私授权
  requestPrivacyAuthorize,
}
