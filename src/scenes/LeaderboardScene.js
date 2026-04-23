// 排行榜场景 - 赢了个赢（天蓝玻璃主题）
import { roundRect } from '../utils/draw.js'
import { fetchFriendRank, getLives, shareForLife } from '../utils/storage.js'

function e(str) { return str.replace(/\uFE0F/g, '') }

// 四向玻璃高光卡片
function drawGlassCard(ctx, x, y, w, h, r, baseColor) {
  ctx.save()
  ctx.fillStyle = baseColor
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  const tg = ctx.createLinearGradient(x, y, x, y + h * 0.44)
  tg.addColorStop(0,   'rgba(255,255,255,0.62)')
  tg.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  tg.addColorStop(1,   'rgba(255,255,255,0.00)')
  ctx.fillStyle = tg
  roundRect(ctx, x, y, w, h * 0.44, { tl: r, tr: r, bl: 0, br: 0 }); ctx.fill()
  const lg = ctx.createLinearGradient(x, y, x + w * 0.14, y)
  lg.addColorStop(0, 'rgba(255,255,255,0.28)')
  lg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = lg
  roundRect(ctx, x, y, w * 0.14, h, { tl: r, tr: 0, bl: r, br: 0 }); ctx.fill()
  const rg = ctx.createLinearGradient(x + w, y, x + w - w * 0.10, y)
  rg.addColorStop(0, 'rgba(255,255,255,0.16)')
  rg.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = rg
  roundRect(ctx, x + w - w * 0.10, y, w * 0.10, h, { tl: 0, tr: r, bl: 0, br: r }); ctx.fill()
  const bg2 = ctx.createLinearGradient(x, y + h, x, y + h - h * 0.16)
  bg2.addColorStop(0, 'rgba(255,255,255,0.20)')
  bg2.addColorStop(1, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = bg2
  roundRect(ctx, x, y + h - h * 0.16, w, h * 0.16, { tl: 0, tr: 0, bl: r, br: r }); ctx.fill()
  ctx.strokeStyle = 'rgba(160,215,245,0.60)'
  ctx.lineWidth   = 1.2
  roundRect(ctx, x, y, w, h, r); ctx.stroke()
  ctx.restore()
}

export default class LeaderboardScene {
  constructor(game) {
    this.game     = game
    this.frame    = 0
    this.loading  = true
    this.friends  = []       // [{nickname, avatarUrl, levelsPassed, _img}]
    this.backBtn  = null
    this.shareBtn = null
    this.scrollY  = 0
    this._touchStartY = null
    this._lastY       = null
    this._velY        = 0
    this._dragging    = false
    this._loadDots    = 0
  }

  init() {
    this.loading  = true
    this.friends  = []
    this.scrollY  = 0
    this._velY    = 0
    fetchFriendRank().then(list => {
      this.friends = list.map(f => {
        const img = wx.createImage()
        img.src = f.avatarUrl
        return { ...f, _img: img }
      })
      this.loading = false
    })
  }

  update() {
    this.frame++
    if (this.frame % 18 === 0) this._loadDots = (this._loadDots + 1) % 4

    // 惯性滚动衰减
    if (!this._dragging) {
      this.scrollY += this._velY
      this._velY   *= 0.88
      if (Math.abs(this._velY) < 0.5) this._velY = 0
      // 边界弹回
      const minScroll = this._minScroll()
      if (this.scrollY > 0) {
        this.scrollY += (0 - this.scrollY) * 0.18; this._velY = 0
      }
      if (this.scrollY < minScroll) {
        this.scrollY += (minScroll - this.scrollY) * 0.18; this._velY = 0
      }
    }
  }

  _minScroll() {
    const rowH   = 76
    const listH  = this.game.height - (this.game.safeTop || 0) - 52 - 8 - 80
    return -Math.max(0, this.friends.length * rowH + 8 - listH)
  }

  draw() {
    const { ctx, width: W, height: H } = this.game
    const safeTop    = this.game.safeTop || 0
    const statusBarH = this.game.statusBarHeight || 44
    const padX       = 14
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
    const btnH0 = 32, btnW0 = 68, btnX0 = padX
    const btnY0 = capBtnY
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.55)'
    ctx.strokeStyle = 'rgba(255,255,255,0.80)'
    ctx.lineWidth   = 1
    roundRect(ctx, btnX0, btnY0, btnW0, btnH0, btnH0 / 2)
    ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a6090'
    ctx.fillText('← 返回', btnX0 + btnW0 / 2, capCenterY)
    ctx.restore()
    this._navBackBtn = { x: btnX0, y: btnY0, w: btnW0, h: btnH0 }

    // 页面标题（与胶囊垂直中心对齐）
    ctx.save()
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(e('🏆 好友排行'), W / 2, capCenterY)
    ctx.restore()

    // 右侧机会❤（与胶囊垂直中心对齐）
    const lives = getLives()
    ctx.save()
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,80,80,0.80)'
    ctx.fillText('\u2665'.repeat(lives) + '\u2661'.repeat(Math.max(0, 3 - lives)), W - padX, capCenterY)
    ctx.restore()

    // ── 列表区 ──
    const listTop  = navH + 8
    const listBotH = 80
    const listH    = H - listTop - listBotH
    const rowH     = 76

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, listTop, W, listH)
    ctx.clip()

    if (this.loading) {
      // 加载中
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '18px sans-serif'
      ctx.fillStyle = 'rgba(30,100,160,0.55)'
      ctx.fillText('加载中' + '.'.repeat(this._loadDots), W / 2, listTop + listH / 2)
      ctx.restore()
    } else if (this.friends.length === 0) {
      // 空状态
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '52px sans-serif'
      ctx.fillText(e('🚗'), W / 2, listTop + listH / 2 - 44)
      ctx.font = '16px sans-serif'
      ctx.fillStyle = 'rgba(30,100,160,0.55)'
      ctx.fillText('暂无好友数据', W / 2, listTop + listH / 2 + 12)
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(30,100,160,0.38)'
      ctx.fillText('邀请好友一起赢车！', W / 2, listTop + listH / 2 + 38)
      ctx.restore()
    } else {
      // 渲染好友列表
      const gap    = 8
      const cardW  = W - padX * 2
      let oy = listTop + this.scrollY

      this.friends.forEach((f, idx) => {
        const cy = oy + idx * (rowH + gap)
        if (cy + rowH < listTop || cy > listTop + listH) return

        // 卡片底色：前三名用淡金/银/铜，其余白蓝玻璃
        const rankBase = [
          'rgba(255,240,180,0.82)',   // 🥇 金
          'rgba(230,238,248,0.82)',   // 🥈 银
          'rgba(248,228,210,0.82)',   // 🥉 铜
        ]
        const base = idx < 3 ? rankBase[idx] : 'rgba(220,242,255,0.75)'
        drawGlassCard(ctx, padX, cy, cardW, rowH, 16, base)

        // 左侧彩色竖条（前三名）
        if (idx < 3) {
          const barColors = ['#E8A000', '#9AAEBD', '#C07840']
          ctx.save()
          ctx.fillStyle = barColors[idx]
          roundRect(ctx, padX, cy, 5, rowH, { tl: 16, tr: 0, bl: 16, br: 0 }); ctx.fill()
          ctx.restore()
        }

        // 名次
        ctx.save()
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const rankEmoji = [e('🥇'), e('🥈'), e('🥉')]
        if (idx < 3) {
          ctx.font = '22px sans-serif'
          ctx.fillText(rankEmoji[idx], padX + 24, cy + rowH / 2)
        } else {
          ctx.font = 'bold 15px sans-serif'
          ctx.fillStyle = 'rgba(40,110,160,0.55)'
          ctx.fillText(`${idx + 1}`, padX + 24, cy + rowH / 2)
        }
        ctx.restore()

        // 头像圆形
        const avatarR  = 22
        const avatarCX = padX + 58
        const avatarCY = cy + rowH / 2
        ctx.save()
        // 头像底色圆
        ctx.fillStyle = 'rgba(180,225,250,0.70)'
        ctx.beginPath()
        ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2)
        ctx.fill()
        // 圆内顶部高光
        const igHg = ctx.createLinearGradient(avatarCX, avatarCY - avatarR, avatarCX, avatarCY)
        igHg.addColorStop(0, 'rgba(255,255,255,0.55)')
        igHg.addColorStop(1, 'rgba(255,255,255,0.00)')
        ctx.fillStyle = igHg
        ctx.beginPath()
        ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2)
        ctx.fill()
        // 头像图片（clip 圆形）
        ctx.beginPath()
        ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2)
        ctx.clip()
        try {
          if (f._img && f._img.width > 0) {
            ctx.drawImage(f._img, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2)
          } else {
            ctx.font = '22px sans-serif'
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(e('🚗'), avatarCX, avatarCY)
          }
        } catch (_) {
          ctx.font = '22px sans-serif'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(e('🚗'), avatarCX, avatarCY)
        }
        ctx.restore()

        // 昵称 + 通关数
        const textX = padX + 90
        ctx.save()
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.font = 'bold 15px sans-serif'
        ctx.fillStyle = '#1a4060'
        let nick = f.nickname || '好友'
        if (nick.length > 8) nick = nick.slice(0, 7) + '…'
        ctx.fillText(nick, textX, cy + rowH / 2 - 10)
        ctx.font = '11px sans-serif'
        ctx.fillStyle = 'rgba(30,100,160,0.55)'
        ctx.fillText(`已通关 ${f.levelsPassed} 关`, textX, cy + rowH / 2 + 11)
        ctx.restore()

        // 右侧通关数大字
        ctx.save()
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.font = 'bold 22px sans-serif'
        const lvColor = idx === 0 ? '#C8860A' : idx === 1 ? '#6A8A9A' : idx === 2 ? '#A06030' : '#2a7aaa'
        ctx.fillStyle = lvColor
        ctx.fillText(`${f.levelsPassed}`, W - padX - 10, cy + rowH / 2 - 6)
        ctx.font = '10px sans-serif'
        ctx.fillStyle = 'rgba(30,100,160,0.45)'
        ctx.fillText('关', W - padX - 10, cy + rowH / 2 + 12)
        ctx.restore()
      })
    }

    ctx.restore()  // 解除 clip

    // ── 底部按钮区 ──
    const btnAreaY = H - listBotH + 12
    const btnH     = 48
    const btnR     = btnH / 2
    const bw2      = (W - padX * 2 - 12) / 2

    // 邀请好友（微信绿渐变）
    ctx.save()
    const sg = ctx.createLinearGradient(padX, btnAreaY, padX, btnAreaY + btnH)
    sg.addColorStop(0, '#2FD472'); sg.addColorStop(1, '#07C160')
    ctx.fillStyle = sg
    roundRect(ctx, padX, btnAreaY, bw2, btnH, btnR); ctx.fill()
    // 高光
    const sHg = ctx.createLinearGradient(padX, btnAreaY, padX, btnAreaY + btnH * 0.50)
    sHg.addColorStop(0, 'rgba(255,255,255,0.28)'); sHg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = sHg
    roundRect(ctx, padX, btnAreaY, bw2, btnH * 0.50, { tl: btnR, tr: btnR, bl: 0, br: 0 }); ctx.fill()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(e('📣 邀请好友'), padX + bw2 / 2, btnAreaY + btnH / 2)
    this.shareBtn = { x: padX, y: btnAreaY, w: bw2, h: btnH }
    ctx.restore()

    // 返回按钮（玻璃胶囊）
    const backBtnX = padX + bw2 + 12
    drawGlassCard(ctx, backBtnX, btnAreaY, bw2, btnH, btnR, 'rgba(220,240,255,0.70)')
    ctx.save()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a5070'
    ctx.fillText('← 返回', backBtnX + bw2 / 2, btnAreaY + btnH / 2)
    ctx.restore()
    this.backBtn = { x: backBtnX, y: btnAreaY, w: bw2, h: btnH }
  }

  onTouchStart(_x, y) {
    this._touchStartY = y
    this._lastY       = y
    this._velY        = 0
    this._dragging    = true
  }

  onTouchMove(_x, y) {
    if (!this._dragging) return
    const dy = this._lastY - y
    const minScroll = this._minScroll()
    this.scrollY = Math.max(minScroll, Math.min(0, this.scrollY - dy))
    this._velY   = -dy
    this._lastY  = y
  }

  onTouchEnd(x, y) {
    this._dragging = false
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    // 滑动超过8px不触发按钮
    if (Math.abs(y - this._touchStartY) > 8) return

    if (hit(this.shareBtn)) {
      shareForLife(() => {})
      return
    }
    if (hit(this.backBtn) || hit(this._navBackBtn)) {
      this.game.showStart()
    }
  }
}
