const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event
  const col = db.collection('leaderboard')

  if (action === 'save') {
    const levelProgress = Math.min(Math.max(parseInt(event.levelProgress, 10) || 0, 0), 29)
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
    const existing = await col.where({ _openid: OPENID }).get()
    if (existing.data.length === 0) return { levelProgress: null }
    const val = existing.data[0].levelProgress
    return { levelProgress: typeof val === 'number' ? val : null }
  }

  return { ok: false, error: 'unknown action' }
}
