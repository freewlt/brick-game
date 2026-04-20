// 排行榜场景 - 好友通关数排行
import { roundRect } from '../utils/draw.js'
import { fetchFriendRank, getLives, shareForLife } from '../utils/storage.js'

export default class LeaderboardScene {
  constructor(game) {
    this.game     = game
    this.frame    = 0
    this.loading  = true
    this.friends  = []       // [{nickname, avatarUrl, levelsPassed, _img}]
    this.backBtn  = null
    this.shareBtn = null
    this.scrollY  = 0        // 列表滚动偏移
    this._touchStartY = null
    this._loadDots = 0
  }

  init() {
    this.loading = true
    this.friends = []
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
  }

  draw() {
    const { ctx, width, height } = this.game
    const W = width, H = height

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0d1b2a')
    bg.addColorStop(1, '#1b263b')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ===== 顶栏 =====
    const headerH = this.game.safeTop
    ctx.save()
    ctx.fillStyle = 'rgba(10,20,35,0.97)'
    ctx.fillRect(0, 0, W, headerH)
    ctx.strokeStyle = 'rgba(255,215,0,0.2)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, headerH); ctx.lineTo(W, headerH); ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const hg = ctx.createLinearGradient(W/2 - 80, 0, W/2 + 80, 0)
    hg.addColorStop(0, '#FFD700'); hg.addColorStop(1, '#FFA500')
    ctx.fillStyle = hg
    ctx.fillText('🏆 好友排行榜', W / 2, headerH / 2)
    ctx.restore()

    // 机会提示
    const lives = getLives()
    ctx.save()
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,120,120,0.75)'
    ctx.fillText('❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives)), W - 16, headerH / 2)
    ctx.restore()

    // ===== 列表区域 =====
    const listTop  = headerH + 8
    const listBotH = 80           // 底部按钮区高度
    const listH    = H - listTop - listBotH
    const rowH     = 72

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, listTop, W, listH)
    ctx.clip()

    if (this.loading) {
      // 加载中动画
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '18px sans-serif'
      ctx.fillStyle = 'rgba(200,220,255,0.6)'
      ctx.fillText('加载中' + '.'.repeat(this._loadDots), W / 2, listTop + listH / 2)
    } else if (this.friends.length === 0) {
      // 无好友数据
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '48px sans-serif'
      ctx.fillText('🚗', W / 2, listTop + listH / 2 - 40)
      ctx.font = '16px sans-serif'
      ctx.fillStyle = 'rgba(200,220,255,0.55)'
      ctx.fillText('暂无好友数据', W / 2, listTop + listH / 2 + 10)
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(160,200,255,0.4)'
      ctx.fillText('邀请好友一起赢车！', W / 2, listTop + listH / 2 + 36)
    } else {
      // 渲染好友列表
      const offsetY = listTop + this.scrollY
      this.friends.forEach((f, idx) => {
        const y = offsetY + idx * rowH
        if (y + rowH < listTop || y > listTop + listH) return  // 视口裁剪

        // 行背景
        ctx.save()
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'
        ctx.fillRect(0, y, W, rowH)

        // 前三名高亮边框
        if (idx < 3) {
          const rankColors = ['rgba(255,215,0,0.3)', 'rgba(192,192,192,0.3)', 'rgba(205,127,50,0.3)']
          ctx.fillStyle = rankColors[idx]
          ctx.fillRect(0, y, 4, rowH)
        }

        // 名次
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const rankEmoji = ['🥇', '🥈', '🥉']
        if (idx < 3) {
          ctx.font = '22px sans-serif'
          ctx.fillText(rankEmoji[idx], 26, y + rowH / 2)
        } else {
          ctx.font = 'bold 16px sans-serif'
          ctx.fillStyle = 'rgba(200,220,255,0.45)'
          ctx.fillText(`${idx + 1}`, 26, y + rowH / 2)
        }

        // 头像（圆形）
        const avatarX = 50, avatarY = y + (rowH - 44) / 2, avatarSize = 44
        ctx.save()
        ctx.beginPath()
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
        ctx.clip()
        try {
          if (f._img && f._img.width > 0) {
            ctx.drawImage(f._img, avatarX, avatarY, avatarSize, avatarSize)
          } else {
            ctx.fillStyle = '#2a4a6a'
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)
            ctx.font = '22px sans-serif'
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText('🚗', avatarX + avatarSize / 2, avatarY + avatarSize / 2)
          }
        } catch(e) {
          ctx.fillStyle = '#2a4a6a'
          ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)
        }
        ctx.restore()

        // 昵称
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.font = 'bold 15px sans-serif'
        ctx.fillStyle = '#e8f0ff'
        // 截断过长昵称
        let nick = f.nickname || '好友'
        if (nick.length > 8) nick = nick.slice(0, 7) + '…'
        ctx.fillText(nick, 104, y + rowH / 2 - 10)

        // 通关数
        ctx.font = '13px sans-serif'
        ctx.fillStyle = 'rgba(160,216,239,0.75)'
        ctx.fillText(`已通关 ${f.levelsPassed} 关`, 104, y + rowH / 2 + 12)

        // 右侧分数标注
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.font = 'bold 20px sans-serif'
        const lvColor = idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#7eb8d4'
        ctx.fillStyle = lvColor
        ctx.fillText(`${f.levelsPassed}`, W - 16, y + rowH / 2)

        ctx.restore()

        // 分割线
        ctx.save()
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(16, y + rowH - 0.5)
        ctx.lineTo(W - 16, y + rowH - 0.5)
        ctx.stroke()
        ctx.restore()
      })
    }

    ctx.restore()  // 解除列表clip

    // ===== 底部按钮区 =====
    const btnAreaY = H - listBotH + 8
    const btnH = 48, btnR = 24
    const bw2  = (W - 48) / 2

    // 分享按钮
    ctx.save()
    const sg = ctx.createLinearGradient(16, btnAreaY, 16, btnAreaY + btnH)
    sg.addColorStop(0, '#07C160'); sg.addColorStop(1, '#06a353')
    ctx.fillStyle = sg
    roundRect(ctx, 16, btnAreaY, bw2, btnH, btnR)
    ctx.fill()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText('📣 邀请好友', 16 + bw2 / 2, btnAreaY + btnH / 2)
    this.shareBtn = { x: 16, y: btnAreaY, w: bw2, h: btnH }
    ctx.restore()

    // 返回按钮
    const backX = 16 + bw2 + 16
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.08)'
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5
    roundRect(ctx, backX, btnAreaY, bw2, btnH, btnR)
    ctx.fill(); ctx.stroke()
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
    ctx.fillText('← 返回', backX + bw2 / 2, btnAreaY + btnH / 2)
    this.backBtn = { x: backX, y: btnAreaY, w: bw2, h: btnH }
    ctx.restore()
  }

  // 触摸滚动
  onTouchStart(x, y) {
    this._touchStartY = y
  }

  onTouchMove(x, y) {
    if (this._touchStartY === null) return
    const delta = y - this._touchStartY
    this._touchStartY = y
    const rowH    = 72
    const maxScroll = 0
    const minScroll = -Math.max(0, this.friends.length * rowH - (this.game.height - this.game.safeTop - 80))
    this.scrollY = Math.max(minScroll, Math.min(maxScroll, this.scrollY + delta))
  }

  onTouchEnd(x, y) {
    this._touchStartY = null
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    if (hit(this.shareBtn)) {
      shareForLife(() => {})
      return
    }
    if (hit(this.backBtn)) {
      this.game.showStart()
    }
  }
}
