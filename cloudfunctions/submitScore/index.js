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
