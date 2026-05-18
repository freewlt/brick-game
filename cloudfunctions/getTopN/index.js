const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function getLeaderboardCollectionName(envVersion) {
  if (envVersion === 'develop') return 'leaderboard_dev'
  if (envVersion === 'trial') return 'leaderboard_trial'
  if (envVersion === 'release') return 'leaderboard'
  if (!envVersion) console.warn('[getTopN] missing envVersion, fallback to leaderboard')
  else console.warn(`[getTopN] unknown envVersion "${envVersion}", fallback to leaderboard`)
  return 'leaderboard'
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const n = Math.min(Math.max(parseInt(event.n, 10) || 50, 1), 200)

  const res = await db.collection(getLeaderboardCollectionName(event.envVersion))
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
