// 成就墙场景 - 赢了个赢（竖向列表，玻璃果冻卡片，惯性滚动）
import { roundRect } from '../utils/draw.js'
import { getUnlockedAchievements } from '../utils/storage.js'
import { CONFIG } from '../config.js'

function e(str) { return str.replace(/\uFE0F/g, '') }

export default class AchievementScene {
  constructor(game) {
    this.game        = game
    this.frame       = 0
    this._backBtn    = null
    this._unlocked   = new Set()
    // 惯性滚动
    this._scrollY    = 0
    this._maxScrollY = 0
    this._touchStartY = 0
    this._lastY       = 0
    this._velY        = 0
    this._dragging    = false
  }

  init() {
    this._unlocked = getUnlockedAchievements()
    this._scrollY  = 0
    this._velY     = 0
    this._dragging = false
    this.frame     = 0
  }

  update() {
    this.frame++
    // 惯性衰减
    if (!this._dragging) {
      this._scrollY += this._velY
      this._velY    *= 0.88
      if (Math.abs(this._velY) < 0.5) this._velY = 0
      // 边界弹回
      if (this._scrollY < 0) {
        this._scrollY += (0 - this._scrollY) * 0.18
        this._velY = 0
      }
      if (this._scrollY > this._maxScrollY) {
        this._scrollY += (this._maxScrollY - this._scrollY) * 0.18
        this._velY = 0
      }
    }
  }

  draw() {
    const { ctx, width: W, height: H } = this.game
    const safeTop    = this.game.safeTop || 0
    const statusBarH = this.game.statusBarHeight || 44
    const achievements = CONFIG.ACHIEVEMENTS
    const unlocked     = this._unlocked
    const capBtnY    = statusBarH + 6
    const capCenterY = statusBarH + 22

    // ── 背景：天蓝渐变 ──
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,    '#5BC8F5')
    bg.addColorStop(0.42, '#7DD6F8')
    bg.addColorStop(0.72, '#A8E6FF')
    bg.addColorStop(1,    '#C5F0FF')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ── 顶部导航栏 ──
    const navH  = safeTop + 10
    const navBg = ctx.createLinearGradient(0, 0, 0, navH)
    navBg.addColorStop(0, 'rgba(91,200,245,0.97)')
    navBg.addColorStop(1, 'rgba(91,200,245,0.85)')
    ctx.save()
    ctx.fillStyle = navBg
    ctx.fillRect(0, 0, W, navH)
    ctx.restore()

    // 返回按钮（与微信胶囊同高）
    const btnH = 32, btnW = 68, btnX = 16
    const btnY = capBtnY
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.55)'
    ctx.strokeStyle = 'rgba(255,255,255,0.80)'
    ctx.lineWidth   = 1
    roundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2)
    ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a6090'
    ctx.fillText('← 返回', btnX + btnW / 2, capCenterY)
    ctx.restore()
    this._backBtn = { x: btnX, y: btnY, w: btnW, h: btnH }

    // 页面标题（居中，与胶囊垂直中心对齐）
    const unlockCount = unlocked.size
    const total       = achievements.length
    ctx.save()
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(e('🏅 成就'), W / 2, capCenterY)
    ctx.restore()

    // 右侧计数徽章（与胶囊垂直中心对齐）
    ctx.save()
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(`${unlockCount} / ${total}`, W - 16, capCenterY)
    ctx.restore()

    // ── 滚动列表区域 ──
    const padX   = 14
    const cardW  = W - padX * 2
    const rowH   = 72
    const gap    = 10
    const listTopY = navH + 10

    // 计算最大滚动
    const totalH     = achievements.length * (rowH + gap) - gap + 20
    const viewH      = H - listTopY
    this._maxScrollY = Math.max(0, totalH - viewH)

    // clip 滚动区
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, listTopY, W, viewH)
    ctx.clip()

    let cy = listTopY - this._scrollY

    for (let i = 0; i < achievements.length; i++) {
      const ach      = achievements[i]
      const isUnlocked = unlocked.has(ach.id)
      const ry       = cy + i * (rowH + gap)

      // 只渲染可见部分
      if (ry + rowH < listTopY || ry > H) continue

      this._drawAchCard(ctx, ach, isUnlocked, padX, ry, cardW, rowH)
    }

    // 全部解锁时底部彩色提示
    if (unlockCount === total) {
      const tyY = cy + achievements.length * (rowH + gap) + 4
      if (tyY < H) {
        ctx.save()
        ctx.font = 'bold 13px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(26,90,140,0.60)'
        ctx.fillText(e('🎉 全部成就已解锁，你太厉害了！'), W / 2, tyY + 14)
        ctx.restore()
      }
    }

    ctx.restore() // end clip
  }

  // 单张成就卡片（玻璃果冻，四向高光）
  _drawAchCard(ctx, ach, isUnlocked, x, y, w, h) {
    const r = 16

    // ── 卡片底色 ──
    if (isUnlocked) {
      // 已解锁：亮白蓝底 + 左侧彩色竖条
      ctx.save()
      ctx.fillStyle = 'rgba(225,245,255,0.88)'
      roundRect(ctx, x, y, w, h, r); ctx.fill()

      // 左侧彩色竖条（成就主题色）
      const barW = 5
      ctx.fillStyle = ach.color || '#2BAEE0'
      roundRect(ctx, x, y, barW, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()
    } else {
      // 未解锁：半透明淡底
      ctx.save()
      ctx.fillStyle = 'rgba(200,228,248,0.50)'
      roundRect(ctx, x, y, w, h, r); ctx.fill()
    }

    // ── 四向玻璃高光 ──
    // 顶部
    const tg = ctx.createLinearGradient(x, y, x, y + h * 0.48)
    tg.addColorStop(0,   'rgba(255,255,255,0.62)')
    tg.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    tg.addColorStop(1,   'rgba(255,255,255,0.00)')
    ctx.fillStyle = tg
    roundRect(ctx, x, y, w, h * 0.48, { tl: r, tr: r, bl: 0, br: 0 }); ctx.fill()
    // 左侧
    const lg = ctx.createLinearGradient(x, y, x + w * 0.14, y)
    lg.addColorStop(0, 'rgba(255,255,255,0.28)')
    lg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = lg
    roundRect(ctx, x, y, w * 0.14, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()
    // 右侧
    const rg = ctx.createLinearGradient(x + w, y, x + w - w * 0.10, y)
    rg.addColorStop(0, 'rgba(255,255,255,0.16)')
    rg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = rg
    roundRect(ctx, x + w - w * 0.10, y, w * 0.10, h, { tl: 0, tr: r, bl: 0, br: r }); ctx.fill()
    // 底部
    const bg2 = ctx.createLinearGradient(x, y + h, x, y + h - h * 0.18)
    bg2.addColorStop(0, 'rgba(255,255,255,0.20)')
    bg2.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = bg2
    roundRect(ctx, x, y + h - h * 0.18, w, h * 0.18, { tl: 0, tr: 0, bl: r, br: r }); ctx.fill()

    // ── 细边框 ──
    ctx.strokeStyle = 'rgba(170,220,248,0.65)'
    ctx.lineWidth   = 1.2
    roundRect(ctx, x, y, w, h, r); ctx.stroke()

    ctx.restore()

    // ── 图标圆 ──
    const iconCX = x + 38
    const iconCY = y + h / 2
    ctx.save()
    // 圆底色（亮蓝白）
    ctx.fillStyle = isUnlocked
      ? (ach.color ? ach.color + '33' : 'rgba(180,230,255,0.75)')
      : 'rgba(190,215,235,0.40)'
    ctx.beginPath()
    ctx.arc(iconCX, iconCY, 24, 0, Math.PI * 2)
    ctx.fill()
    // 圆内顶部高光
    const igHg = ctx.createLinearGradient(iconCX, iconCY - 24, iconCX, iconCY)
    igHg.addColorStop(0, 'rgba(255,255,255,0.60)')
    igHg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = igHg
    ctx.beginPath()
    ctx.arc(iconCX, iconCY, 24, 0, Math.PI * 2)
    ctx.fill()
    // 图标
    ctx.globalAlpha = isUnlocked ? 1 : 0.25
    ctx.font = '26px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(e(ach.icon), iconCX, iconCY)
    ctx.restore()

    // 未解锁：锁图标叠加
    if (!isUnlocked) {
      ctx.save()
      ctx.globalAlpha = 0.38
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(e('🔒'), iconCX, iconCY)
      ctx.restore()
    }

    // ── 文字区：主标题 + 描述 ──
    const textX = x + 74
    ctx.save()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    // 成就名称
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = isUnlocked ? '#1a4060' : 'rgba(60,110,160,0.45)'
    ctx.fillText(ach.name, textX, y + h / 2 - 10)
    // 描述
    ctx.font = '11px sans-serif'
    ctx.fillStyle = isUnlocked ? 'rgba(30,90,140,0.65)' : 'rgba(60,110,160,0.32)'
    ctx.fillText(ach.desc, textX, y + h / 2 + 10)
    ctx.restore()

    // ── 右侧状态标志 ──
    ctx.save()
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    if (isUnlocked) {
      ctx.fillText(e('✅'), x + w - 14, y + h / 2)
    } else {
      ctx.globalAlpha = 0.28
      ctx.font = '15px sans-serif'
      ctx.fillText(e('🔒'), x + w - 14, y + h / 2)
    }
    ctx.restore()
  }

  onTouchStart(_x, y) {
    this._touchStartY = y
    this._lastY       = y
    this._velY        = 0
    this._dragging    = true
  }

  onTouchMove(_x, y) {
    if (!this._dragging) return
    const dy      = this._lastY - y
    this._scrollY = Math.max(0, Math.min(this._maxScrollY, this._scrollY + dy))
    this._velY    = dy
    this._lastY   = y
  }

  onTouchEnd(x, y) {
    this._dragging = false
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    // 滑动距离大则不触发返回
    if (Math.abs(y - this._touchStartY) > 8) return

    if (hit(this._backBtn)) {
      this.game.showStart()
    }
  }
}
