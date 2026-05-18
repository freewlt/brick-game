const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function getLeaderboardCollectionName(envVersion) {
  if (envVersion === 'develop') return 'leaderboard_dev'
  if (envVersion === 'trial') return 'leaderboard_trial'
  if (envVersion === 'release') return 'leaderboard'
  if (!envVersion) console.warn('[submitScore] missing envVersion, fallback to leaderboard')
  else console.warn(`[submitScore] unknown envVersion "${envVersion}", fallback to leaderboard`)
  return 'leaderboard'
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { nickname, avatarUrl } = event
  const levelsPassed = Math.min(Math.max(parseInt(event.levelsPassed) || 0, 0), 30)

  const col = db.collection(getLeaderboardCollectionName(event.envVersion))
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
