// 开始场景 - 赢了个赢
import { roundRect } from '../utils/draw.js'
import { getLives, getRecoverSecondsLeft, shareForLife } from '../utils/storage.js'

export default class StartScene {
  constructor(game) {
    this.game          = game
    this.btnRect       = null
    this.rankBtnRect   = null
    this.livesBtnRect  = null
    this.settingsBtnRect = null
    this.logoAlpha     = 0
    this.btnScale      = 1
    this.frame         = 0
    this.carAnimX      = -80
    this.carList       = ['🏎️', '🚗', '🚙', '🛻', '🚕']
    this.carY          = [120, 160, 100, 140, 110]
    // 弹出"机会不足"提示层
    this._livesPopup   = false
    this._popupShareBtn = null
    this._popupCloseBtn = null
  }

  init() {
    this._livesPopup = false
  }

  update() {
    this.frame++
    this.logoAlpha = Math.min(1, this.logoAlpha + 0.03)
    this.btnScale  = 1 + Math.sin(this.frame * 0.06) * 0.04
    this.carAnimX += 2.5
    if (this.carAnimX > this.game.width + 100) {
      this.carAnimX = -80
    }
  }

  draw() {
    const { ctx, width, height } = this.game
    const H = height, W = width

    // 渐变背景
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#12042a')
    bg.addColorStop(0.5, '#0d0a2e')
    bg.addColorStop(1, '#0a1030')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // 背景星点（静态随机，用frame做微弱闪烁）
    ctx.save()
    for (let i = 0; i < 28; i++) {
      // 用伪随机固定位置（seed by index）
      const sx = ((i * 137.5) % 1) * W    // 黄金比例分布，看起来随机但每帧一致
      const sy = ((i * 97.3 + i * i * 0.7) % 1) * H * 0.65
      const flicker = 0.3 + 0.2 * Math.sin(this.frame * 0.05 + i)
      ctx.globalAlpha = flicker
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(sx, sy, i % 3 === 0 ? 1.5 : 1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // 道路横条装饰（霓虹感细线）
    ctx.save()
    for (let i = 0; i < 4; i++) {
      const ly = H * 0.15 + i * H * 0.17
      const lg = ctx.createLinearGradient(0, 0, W, 0)
      lg.addColorStop(0,   'rgba(100,80,255,0)')
      lg.addColorStop(0.3, 'rgba(100,80,255,0.12)')
      lg.addColorStop(0.7, 'rgba(80,180,255,0.12)')
      lg.addColorStop(1,   'rgba(80,180,255,0)')
      ctx.fillStyle = lg
      ctx.fillRect(0, ly, W, 2)
    }
    ctx.restore()

    // 飞驰的车子（装饰动画，透明度提高）
    ctx.save()
    ctx.font = '30px sans-serif'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < this.carList.length; i++) {
      ctx.globalAlpha = 0.18 + (i % 3) * 0.08
      ctx.fillText(
        this.carList[i],
        (this.carAnimX + i * 80) % (W + 160) - 80,
        this.carY[i] + H * 0.28
      )
    }
    ctx.restore()

    // ===== Y 坐标全部用比例 =====
    const titleY   = H * 0.30
    const subY     = H * 0.385
    const carShowY = H * 0.465
    const btnY     = H * 0.555
    const btnH     = 62
    const btnW     = Math.min(230, W * 0.62)
    const bx       = W / 2 - btnW / 2
    const tip1Y    = H * 0.715
    const tip2Y    = H * 0.765

    // Logo 区域
    ctx.save()
    ctx.globalAlpha = this.logoAlpha

    // 大光晕（更强）
    const glow = ctx.createRadialGradient(W / 2, titleY, 5, W / 2, titleY, 140)
    glow.addColorStop(0, 'rgba(200,150,255,0.22)')
    glow.addColorStop(0.5,'rgba(255,200,0,0.12)')
    glow.addColorStop(1, 'rgba(255,200,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, titleY - 90, W, 200)

    // 标题
    ctx.font = 'bold 54px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 外描边（深金）
    ctx.strokeStyle = '#7a4f00'
    ctx.lineWidth = 7
    ctx.strokeText('赢了个赢', W / 2, titleY)
    // 内发光描边（橙金）
    ctx.strokeStyle = 'rgba(255,180,0,0.6)'
    ctx.lineWidth = 3
    ctx.strokeText('赢了个赢', W / 2, titleY)
    // 填充渐变
    const titleGrad = ctx.createLinearGradient(W/2 - 110, titleY - 30, W/2 + 110, titleY + 30)
    titleGrad.addColorStop(0,   '#FFE066')
    titleGrad.addColorStop(0.35,'#FFFBE8')
    titleGrad.addColorStop(0.65,'#FFD700')
    titleGrad.addColorStop(1,   '#FF9500')
    ctx.fillStyle = titleGrad
    ctx.fillText('赢了个赢', W / 2, titleY)

    // 副标题
    ctx.font = '16px sans-serif'
    ctx.fillStyle = 'rgba(180,210,255,0.75)'
    ctx.fillText('🏆 三消赢豪车，逐梦人生巅峰', W / 2, subY)

    // 车子展示（三辆车排列，略微放大）
    ctx.font = '44px sans-serif'
    const carShow = ['🏎️', '🚗', '🚙']
    carShow.forEach((c, i) => {
      const bounce = Math.sin(this.frame * 0.07 + i * 1.2) * 4
      ctx.fillText(c, W / 2 - 58 + i * 58, carShowY + bounce)
    })

    ctx.restore()

    // ===== 开始按钮（存坐标在 scale 之前）=====
    const btnCX = W / 2
    const btnCY = btnY + btnH / 2
    this.btnRect = { x: bx, y: btnY, w: btnW, h: btnH }

    ctx.save()
    ctx.translate(btnCX, btnCY)
    ctx.scale(this.btnScale, this.btnScale)
    ctx.translate(-btnCX, -btnCY)

    // 按钮投影
    ctx.shadowColor = 'rgba(255,160,0,0.55)'
    ctx.shadowBlur  = 22
    // 按钮填充渐变
    const btnGrad = ctx.createLinearGradient(bx, btnY, bx, btnY + btnH)
    btnGrad.addColorStop(0, '#FFE040')
    btnGrad.addColorStop(1, '#FF8800')
    ctx.fillStyle = btnGrad
    roundRect(ctx, bx, btnY, btnW, btnH, 32)
    ctx.fill()

    // 按钮内顶部高光
    ctx.shadowBlur = 0
    const btnHG = ctx.createLinearGradient(bx, btnY, bx, btnY + btnH * 0.5)
    btnHG.addColorStop(0, 'rgba(255,255,255,0.30)')
    btnHG.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = btnHG
    roundRect(ctx, bx, btnY, btnW, btnH * 0.5, { tl: 32, tr: 32, bl: 0, br: 0 })
    ctx.fill()

    // 按钮文字
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a1a2e'
    ctx.fillText('🚗 开始赢车', btnCX, btnCY)
    ctx.restore()

    // ===== 底部工具栏：排行榜 + 机会 + 设置 =====
    const toolY = H * 0.835
    const toolH = 50
    const toolW = (W - 56) / 3   // 三列等宽
    const tool1X = 16
    const tool2X = tool1X + toolW + 12
    const tool3X = tool2X + toolW + 12

    // 排行榜按钮
    ctx.save()
    ctx.fillStyle   = 'rgba(255,215,0,0.1)'
    ctx.strokeStyle = 'rgba(255,215,0,0.4)'
    ctx.lineWidth   = 1.2
    roundRect(ctx, tool1X, toolY, toolW, toolH, 16)
    ctx.fill(); ctx.stroke()
    // 顶部高光
    const t1hg = ctx.createLinearGradient(tool1X, toolY, tool1X, toolY + toolH * 0.5)
    t1hg.addColorStop(0, 'rgba(255,255,255,0.08)')
    t1hg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = t1hg
    roundRect(ctx, tool1X, toolY, toolW, toolH * 0.5, { tl: 16, tr: 16, bl: 0, br: 0 })
    ctx.fill()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#FFD700'
    ctx.fillText('🏆 好友排行', tool1X + toolW / 2, toolY + toolH / 2)
    this.rankBtnRect = { x: tool1X, y: toolY, w: toolW, h: toolH }
    ctx.restore()

    // 机会按钮
    const lives      = getLives()
    const livesColor = lives > 0 ? '#FF7B7B' : '#888'
    ctx.save()
    ctx.fillStyle   = lives > 0 ? 'rgba(255,80,80,0.1)' : 'rgba(100,100,100,0.1)'
    ctx.strokeStyle = lives > 0 ? 'rgba(255,80,80,0.4)' : 'rgba(100,100,100,0.3)'
    ctx.lineWidth   = 1.2
    roundRect(ctx, tool2X, toolY, toolW, toolH, 16)
    ctx.fill(); ctx.stroke()
    // 顶部高光
    const t2hg = ctx.createLinearGradient(tool2X, toolY, tool2X, toolY + toolH * 0.5)
    t2hg.addColorStop(0, 'rgba(255,255,255,0.08)')
    t2hg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = t2hg
    roundRect(ctx, tool2X, toolY, toolW, toolH * 0.5, { tl: 16, tr: 16, bl: 0, br: 0 })
    ctx.fill()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = livesColor
    const hearts = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives))
    ctx.fillText(`${hearts} ×${lives}`, tool2X + toolW / 2, toolY + toolH / 2)
    this.livesBtnRect = { x: tool2X, y: toolY, w: toolW, h: toolH }
    ctx.restore()

    // 设置按钮
    ctx.save()
    ctx.fillStyle   = 'rgba(160,160,255,0.10)'
    ctx.strokeStyle = 'rgba(160,160,255,0.40)'
    ctx.lineWidth   = 1.2
    roundRect(ctx, tool3X, toolY, toolW, toolH, 16)
    ctx.fill(); ctx.stroke()
    const t3hg = ctx.createLinearGradient(tool3X, toolY, tool3X, toolY + toolH * 0.5)
    t3hg.addColorStop(0, 'rgba(255,255,255,0.08)')
    t3hg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = t3hg
    roundRect(ctx, tool3X, toolY, toolW, toolH * 0.5, { tl: 16, tr: 16, bl: 0, br: 0 })
    ctx.fill()
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(200,200,255,0.9)'
    ctx.fillText('⚙️ 设置', tool3X + toolW / 2, toolY + toolH / 2)
    this.settingsBtnRect = { x: tool3X, y: toolY, w: toolW, h: toolH }
    ctx.restore()

    // 说明文字
    ctx.save()
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(180,200,240,0.5)'
    ctx.fillText('点击堆叠的车块，集齐3辆相同的车即可赢得！', W / 2, tip1Y)
    ctx.fillText('槽位满无法消除则失败，步数用光也会失败！', W / 2, tip2Y)
    ctx.restore()

    // ===== 机会不足弹窗 =====
    if (this._livesPopup) {
      this._drawLivesPopup(ctx, W, H)
    }
  }

  _drawLivesPopup(ctx, W, H) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, W, H)

    const cw = W - 60, ch = 290
    const cx = 30, cy = (H - ch) / 2

    // 卡片背景
    ctx.fillStyle = 'rgba(18,4,42,0.97)'
    roundRect(ctx, cx, cy, cw, ch, 22)
    ctx.fill()
    // 卡片描边（渐变）
    ctx.strokeStyle = 'rgba(255,80,80,0.5)'
    ctx.lineWidth   = 1.5
    roundRect(ctx, cx, cy, cw, ch, 22); ctx.stroke()
    // 顶部高光条
    const popHG = ctx.createLinearGradient(cx, cy, cx, cy + 60)
    popHG.addColorStop(0, 'rgba(255,100,100,0.12)')
    popHG.addColorStop(1, 'rgba(255,100,100,0)')
    ctx.fillStyle = popHG
    roundRect(ctx, cx, cy, cw, 60, { tl: 22, tr: 22, bl: 0, br: 0 })
    ctx.fill()

    ctx.font = 'bold 26px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#FF7B7B'
    ctx.fillText('💔 机会用完了', W / 2, cy + 48)

    const secs = getRecoverSecondsLeft()
    const mm   = String(Math.floor(secs / 60)).padStart(2, '0')
    const ss   = String(secs % 60).padStart(2, '0')
    ctx.font = '14px sans-serif'
    ctx.fillStyle = 'rgba(200,220,255,0.65)'
    ctx.fillText(`⏰ ${mm}:${ss} 后自动恢复 1 次机会`, W / 2, cy + 95)

    ctx.font = '30px sans-serif'
    ctx.fillText('🖤🖤🖤', W / 2, cy + 135)

    // 分享按钮
    const sbW = cw - 40, sbH = 52
    const sbX = cx + 20, sbY = cy + 163
    const sg  = ctx.createLinearGradient(sbX, sbY, sbX, sbY + sbH)
    sg.addColorStop(0, '#07C160'); sg.addColorStop(1, '#059a4a')
    ctx.fillStyle = sg
    roundRect(ctx, sbX, sbY, sbW, sbH, 26); ctx.fill()
    // 按钮顶部高光
    const sbHG = ctx.createLinearGradient(sbX, sbY, sbX, sbY + sbH * 0.5)
    sbHG.addColorStop(0, 'rgba(255,255,255,0.2)'); sbHG.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sbHG
    roundRect(ctx, sbX, sbY, sbW, sbH * 0.5, { tl: 26, tr: 26, bl: 0, br: 0 }); ctx.fill()
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText('📣 分享给好友，立得 +1 机会', W / 2, sbY + sbH / 2)
    this._popupShareBtn = { x: sbX, y: sbY, w: sbW, h: sbH }

    const cbY = sbY + sbH + 12
    ctx.fillStyle   = 'rgba(255,255,255,0.06)'
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth   = 1
    roundRect(ctx, sbX, cbY, sbW, sbH, 26); ctx.fill(); ctx.stroke()
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = 'rgba(200,220,255,0.6)'
    ctx.fillText('⏳ 等待恢复', W / 2, cbY + sbH / 2)
    this._popupCloseBtn = { x: sbX, y: cbY, w: sbW, h: sbH }

    ctx.restore()
  }

  onTouchEnd(x, y) {
    const hit = (b) => b && x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8

    if (this._livesPopup) {
      if (hit(this._popupShareBtn)) {
        shareForLife((next) => {
          if (next !== null) {
            this._livesPopup = false
            this.game.showGame(0)
          }
        })
        return
      }
      if (hit(this._popupCloseBtn)) {
        this._livesPopup = false
        return
      }
      this._livesPopup = false
      return
    }

    if (hit(this.rankBtnRect)) {
      this.game.showLeaderboard()
      return
    }

    if (hit(this.settingsBtnRect)) {
      this.game.showSettings()
      return
    }

    if (hit(this.livesBtnRect)) {
      const lives = getLives()
      if (lives < 3) {
        this._livesPopup = true
      }
      return
    }

    if (hit(this.btnRect)) {
      const lives = getLives()
      if (lives <= 0) {
        this._livesPopup = true
        return
      }
      this.game.showGame(0)
    }
  }
}
