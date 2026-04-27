// 排行榜场景 - 赢了个赢（天蓝玻璃主题）
// 主域直接调用 wx.getFriendCloudStorage + wx.getUserCloudStorage 取数，Canvas 自渲染列表
import { roundRect } from '../utils/draw.js'
import { getLives, shareForLife, getMyUserInfo, getMyProgress, saveMyUserInfo } from '../utils/storage.js'

const RANK_KEY = 'levelsPassed'

function e(str) { return str.replace(/️/g, '') }

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
  ctx.strokeStyle = 'rgba(160,215,245,0.60)'
  ctx.lineWidth   = 1.2
  roundRect(ctx, x, y, w, h, r); ctx.stroke()
  ctx.restore()
}

function drawCircleAvatar(ctx, img, cx, cy, r) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  try { ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2) } catch (_) {}
  ctx.restore()
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.70)'
  ctx.lineWidth   = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawDefaultAvatar(ctx, name, cx, cy, r, isSelf) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = isSelf ? '#2FD472' : '#5BC8F5'
  ctx.fill()
  ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText((name || '?')[0], cx, cy)
  ctx.strokeStyle = 'rgba(255,255,255,0.70)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

const MEDALS = ['🥇', '🥈', '🥉']

export default class LeaderboardScene {
  constructor(game) {
    this.game         = game
    this.frame        = 0
    this.loading      = true
    this._denied      = false   // 本次会话已拒绝授权
    this.backBtn      = null
    this.shareBtn     = null
    this._navBackBtn  = null
    this._loadDots    = 0
    this._rankList    = []
    this.scrollY      = 0
    this._touchStartY = null
    this._lastY       = null
    this._velY        = 0
    this._dragging    = false
  }

  init() {
    this.loading   = true
    this._rankList = []
    this.scrollY   = 0
    this._velY     = 0
    this.frame     = 0

    // 本次会话已拒绝 → 直接显示提示页，不再调隐私 API
    if (this._denied) return

    if (typeof wx.requirePrivacyAuthorize === 'function') {
      wx.requirePrivacyAuthorize({
        success: () => {
          // 授权通过后先拉自己的头像/昵称并缓存，再加载排行榜
          wx.getUserProfile({
            desc: '用于好友排行榜显示',
            success: (res) => {
              const info = res.userInfo || {}
              if (info.nickName) {
                saveMyUserInfo({ nickname: info.nickName, avatarUrl: info.avatarUrl || '' })
              }
              this._loadRank()
            },
            fail: () => { this._loadRank() },  // 拉不到也继续
          })
        },
        fail: () => { this._denied = true; this.loading = false },
      })
    } else {
      this._loadRank()
    }
  }

  // ── 取数：两个 API 并行 ──────────────────────────────────────────────
  _loadRank() {
    let friendData = null
    let myKV       = null
    let done       = 0

    const tryBuild = () => {
      done++
      if (done < 2) return
      this._build(friendData || [], myKV)
    }

    try {
      wx.getFriendCloudStorage({
        keyList: [RANK_KEY],
        success: (res) => { friendData = res.data || []; tryBuild() },
        fail:    ()    => { friendData = [];             tryBuild() },
      })
    } catch (_) { friendData = []; tryBuild() }

    try {
      wx.getUserCloudStorage({
        keyList: [RANK_KEY],
        success: (res) => {
          const kv = (res.KVDataList || []).find(k => k.key === RANK_KEY)
          myKV = kv ? (parseInt(kv.value, 10) || 0) : 0
          tryBuild()
        },
        fail: () => { myKV = null; tryBuild() },
      })
    } catch (_) { myKV = null; tryBuild() }
  }

  // ── 构建列表 + 预加载头像 ────────────────────────────────────────────
  _build(friendData, myKV) {
    const myInfo   = getMyUserInfo()
    const myLevels = getMyProgress()

    let list = friendData.map(u => {
      const kv  = (u.KVDataList || []).find(k => k.key === RANK_KEY)
      const lvl = parseInt(kv ? kv.value : '0', 10) || 0
      return { nickname: u.nickname || '好友', avatarUrl: u.avatarUrl || '', levelsPassed: lvl, isSelf: false, _img: null }
    })

    let selfInserted = false
    if (myKV !== null) {
      const idx = list.findIndex(u => u.levelsPassed === myKV)
      if (idx !== -1) {
        list[idx].isSelf    = true
        list[idx].nickname  = myInfo.nickname  || list[idx].nickname
        list[idx].avatarUrl = myInfo.avatarUrl || list[idx].avatarUrl
        selfInserted = true
      }
    }
    if (!selfInserted) {
      list.push({ nickname: myInfo.nickname || '我', avatarUrl: myInfo.avatarUrl || '', levelsPassed: myLevels, isSelf: true, _img: null })
    }

    list.sort((a, b) => b.levelsPassed - a.levelsPassed)
    this._rankList = list
    this.loading   = false

    list.forEach(item => {
      if (!item.avatarUrl) return
      const img = wx.createImage()
      img.onload  = () => { item._img = img }
      img.onerror = () => {}
      img.src = item.avatarUrl
    })
  }

  // ── 滚动边界 ─────────────────────────────────────────────────────────
  _minScroll() {
    const { height: H, safeTop } = this.game
    const navH    = (safeTop || 0) + 10
    const listTop = navH + 8
    const listH   = H - listTop - 80
    const CARD_H = 64, CARD_GAP = 8, PAD = 8
    const contentH = PAD + this._rankList.length * (CARD_H + CARD_GAP) + PAD
    return -Math.max(0, contentH - listH)
  }

  // ── update ────────────────────────────────────────────────────────────
  update() {
    this.frame++
    if (this.frame % 18 === 0) this._loadDots = (this._loadDots + 1) % 4

    if (!this._dragging) {
      this.scrollY += this._velY
      this._velY   *= 0.88
      if (Math.abs(this._velY) < 0.5) this._velY = 0
      const minScroll = this._minScroll()
      if (this.scrollY > 0)         { this.scrollY += (0 - this.scrollY) * 0.18;           this._velY = 0 }
      if (this.scrollY < minScroll) { this.scrollY += (minScroll - this.scrollY) * 0.18;   this._velY = 0 }
    }
  }

  // ── draw ──────────────────────────────────────────────────────────────
  draw() {
    const { ctx, width: W, height: H } = this.game
    const safeTop    = this.game.safeTop || 0
    const statusBarH = this.game.statusBarHeight || 44
    const padX       = 14
    const capBtnY    = statusBarH + 6
    const capCenterY = statusBarH + 22

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,    '#5BC8F5')
    bg.addColorStop(0.42, '#7DD6F8')
    bg.addColorStop(0.72, '#A8E6FF')
    bg.addColorStop(1,    '#C5F0FF')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // 顶部导航栏
    const navH  = safeTop + 10
    ctx.save()
    const navBg = ctx.createLinearGradient(0, 0, 0, navH)
    navBg.addColorStop(0, 'rgba(91,200,245,0.97)')
    navBg.addColorStop(1, 'rgba(91,200,245,0.85)')
    ctx.fillStyle = navBg
    ctx.fillRect(0, 0, W, navH)
    ctx.restore()

    // 返回按钮（顶部）
    const btnH0 = 32, btnW0 = 68
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.55)'
    ctx.strokeStyle = 'rgba(255,255,255,0.80)'
    ctx.lineWidth   = 1
    roundRect(ctx, padX, capBtnY, btnW0, btnH0, btnH0 / 2)
    ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a6090'
    ctx.fillText('← 返回', padX + btnW0 / 2, capCenterY)
    ctx.restore()
    this._navBackBtn = { x: padX, y: capBtnY, w: btnW0, h: btnH0 }

    // 标题
    ctx.save()
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(e('🏆 好友排行'), W / 2, capCenterY)
    ctx.restore()

    // 右侧机会❤
    const lives = getLives()
    ctx.save()
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,80,80,0.80)'
    ctx.fillText('♥'.repeat(lives) + '♡'.repeat(Math.max(0, 3 - lives)), W - padX, capCenterY)
    ctx.restore()

    // 列表区
    const listBotH = 80
    const listTop  = navH + 8
    const listH    = H - listTop - listBotH

    if (this._denied) {
      // 用户本次会话拒绝了隐私授权 → 显示提示
      const cx = W / 2, cy = listTop + listH / 2
      drawGlassCard(ctx, padX, cy - 54, W - padX * 2, 108, 16, 'rgba(220,240,255,0.80)')
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillStyle = '#1a4060'
      ctx.fillText('需要授权才能查看排行榜', cx, cy - 20)
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(30,80,120,0.70)'
      ctx.fillText('请重启小游戏后重新授权', cx, cy + 8)
      ctx.restore()
    } else if (this.loading) {
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '18px sans-serif'
      ctx.fillStyle = 'rgba(30,100,160,0.55)'
      ctx.fillText('加载中' + '.'.repeat(this._loadDots), W / 2, listTop + listH / 2)
      ctx.restore()
    } else if (this._rankList.length === 0) {
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '15px sans-serif'
      ctx.fillStyle = 'rgba(30,100,160,0.45)'
      ctx.fillText('暂无好友数据', W / 2, listTop + listH / 2 - 12)
      ctx.font = '12px sans-serif'
      ctx.fillStyle = 'rgba(30,100,160,0.35)'
      ctx.fillText('邀请好友一起玩吧！', W / 2, listTop + listH / 2 + 14)
      ctx.restore()
    } else {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, listTop, W, listH)
      ctx.clip()
      this._drawList(ctx, W, listTop, padX)
      ctx.restore()
    }

    // 底部按钮区
    const btnAreaY = H - listBotH + 12
    const btnH     = 48
    const btnR     = btnH / 2
    const bw2      = (W - padX * 2 - 12) / 2

    // 邀请好友
    ctx.save()
    const sg = ctx.createLinearGradient(padX, btnAreaY, padX, btnAreaY + btnH)
    sg.addColorStop(0, '#2FD472'); sg.addColorStop(1, '#07C160')
    ctx.fillStyle = sg
    roundRect(ctx, padX, btnAreaY, bw2, btnH, btnR); ctx.fill()
    const sHg = ctx.createLinearGradient(padX, btnAreaY, padX, btnAreaY + btnH * 0.5)
    sHg.addColorStop(0, 'rgba(255,255,255,0.28)'); sHg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = sHg
    roundRect(ctx, padX, btnAreaY, bw2, btnH * 0.5, { tl: btnR, tr: btnR, bl: 0, br: 0 }); ctx.fill()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(e('📣 邀请好友'), padX + bw2 / 2, btnAreaY + btnH / 2)
    this.shareBtn = { x: padX, y: btnAreaY, w: bw2, h: btnH }
    ctx.restore()

    // 返回按钮（底部）
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

  // ── 绘制排行列表卡片 ─────────────────────────────────────────────────
  _drawList(ctx, W, listTop, padX) {
    const CARD_H   = 64
    const CARD_GAP = 8
    const PAD      = 8
    const AVATAR_R = 22
    const startY   = listTop + PAD + this.scrollY

    this._rankList.forEach((item, i) => {
      const cardY = startY + i * (CARD_H + CARD_GAP)
      const cardW = W - padX * 2
      const cardX = padX

      drawGlassCard(ctx, cardX, cardY, cardW, CARD_H, 12,
        item.isSelf ? 'rgba(47,212,114,0.20)' : 'rgba(220,240,255,0.65)')

      // 名次 / 奖牌
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const rankX = cardX + 28, rankY = cardY + CARD_H / 2
      if (i < 3) {
        ctx.font = '22px sans-serif'
        ctx.fillText(e(MEDALS[i]), rankX, rankY)
      } else {
        ctx.font = 'bold 16px sans-serif'
        ctx.fillStyle = '#5590aa'
        ctx.fillText(String(i + 1), rankX, rankY)
      }
      ctx.restore()

      // 头像
      const avatarCX = cardX + 62, avatarCY = cardY + CARD_H / 2
      if (item._img) {
        drawCircleAvatar(ctx, item._img, avatarCX, avatarCY, AVATAR_R)
      } else {
        drawDefaultAvatar(ctx, item.nickname, avatarCX, avatarCY, AVATAR_R, item.isSelf)
      }

      // 昵称
      const nameX = avatarCX + AVATAR_R + 10
      ctx.save()
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = item.isSelf ? '#0a6030' : '#1a4060'
      ctx.fillText(item.isSelf ? (item.nickname + ' (我)') : item.nickname,
        nameX, cardY + CARD_H / 2 - 8, cardW - (nameX - cardX) - 60)
      ctx.restore()

      // 通关数（副文字）
      ctx.save()
      ctx.font = '13px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = item.isSelf ? 'rgba(10,96,48,0.75)' : 'rgba(30,80,120,0.65)'
      ctx.fillText(`通关 ${item.levelsPassed} 关`, nameX, cardY + CARD_H / 2 + 10)
      ctx.restore()

      // 右侧分数
      ctx.save()
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillStyle = item.isSelf ? '#0a6030' : '#2a6080'
      ctx.fillText(String(item.levelsPassed), cardX + cardW - 14, cardY + CARD_H / 2)
      ctx.restore()
    })
  }

  // ── 触摸事件 ──────────────────────────────────────────────────────────
  onTouchStart(_x, y) {
    this._touchStartY = y
    this._lastY       = y
    this._velY        = 0
    this._dragging    = true
  }

  onTouchMove(_x, y) {
    if (!this._dragging) return
    const dy        = this._lastY - y
    const minScroll = this._minScroll()
    this.scrollY = Math.max(minScroll, Math.min(0, this.scrollY - dy))
    this._velY   = -dy
    this._lastY  = y
  }

  onTouchEnd(x, y) {
    this._dragging = false
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    if (Math.abs(y - this._touchStartY) > 8) return

    if (hit(this.shareBtn)) { shareForLife(() => {}); return }
    if (hit(this.backBtn) || hit(this._navBackBtn)) { this.game.showStart() }
  }
}
