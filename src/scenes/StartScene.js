// 开始场景 - 赢了个赢（明亮蓝天主题）
import { roundRect } from '../utils/draw.js'
import { getLives, getRecoverSecondsLeft, shareForLife, getLevelProgress } from '../utils/storage.js'

// 剥掉 \uFE0F 变体选择符，避免微信小游戏 Canvas 渲染成小方块
function e(str) {
  return str.replace(/\uFE0F/g, '')
}

export default class StartScene {
  constructor(game) {
    this.game            = game
    this.btnRect         = null
    this.dailyBtnRect    = null
    this.rankBtnRect     = null
    this.livesBtnRect    = null
    this.settingsBtnRect = null
    this.achBtnRect      = null
    this.logoAlpha       = 0
    this.btnScale        = 1
    this.frame           = 0
    // 云朵动画
    this.cloudX          = [0, 0, 0]
    this._initClouds      = false
    // 机会不足弹窗
    this._livesPopup     = false
    this._popupShareBtn  = null
    this._popupCloseBtn  = null
  }

  init() {
    this._livesPopup  = false
    this._initClouds  = false
  }

  update() {
    this.frame++
    this.logoAlpha = Math.min(1, this.logoAlpha + 0.025)
    this.btnScale  = 1 + Math.sin(this.frame * 0.055) * 0.028

    // 初始化云朵位置
    const W = this.game.width
    if (!this._initClouds) {
      this.cloudX = [W * 0.1, W * 0.55, W * 0.82]
      this._initClouds = true
    }
    // 云朵慢速右移，超出后从左侧重新出现
    const speeds = [0.4, 0.25, 0.35]
    for (let i = 0; i < 3; i++) {
      this.cloudX[i] += speeds[i]
      if (this.cloudX[i] > W + 60) this.cloudX[i] = -60
    }
  }

  draw() {
    const { ctx, width, height } = this.game
    const H = height, W = width
    const statusBarH = this.game.statusBarHeight || 44
    const capCenterY = statusBarH + 22   // 与微信胶囊垂直中心对齐

    // ===== 背景：天蓝渐变 =====
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,    '#5BC8F5')   // 天空蓝
    bg.addColorStop(0.42, '#7DD6F8')
    bg.addColorStop(0.72, '#A8E6FF')
    bg.addColorStop(1,    '#C5F0FF')   // 浅蓝白
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ===== 云朵（白色圆角椭圆，3朵）=====
    ctx.save()
    ctx.globalAlpha = 0.82
    const cloudY   = [H * 0.06, H * 0.10, H * 0.04]
    const cloudW   = [90, 70, 55]
    const cloudH2  = [22, 18, 16]
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(this.cloudX[i], cloudY[i], cloudW[i] / 2, cloudH2[i] / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      // 云朵顶部小泡
      ctx.beginPath()
      ctx.arc(this.cloudX[i] - cloudW[i] * 0.15, cloudY[i] - cloudH2[i] * 0.5, cloudH2[i] * 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(this.cloudX[i] + cloudW[i] * 0.1, cloudY[i] - cloudH2[i] * 0.4, cloudH2[i] * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // ===== 地面区域（下方浅草绿到白色）=====
    ctx.save()
    const ground = ctx.createLinearGradient(0, H * 0.82, 0, H)
    ground.addColorStop(0, 'rgba(180,235,180,0.0)')
    ground.addColorStop(1, 'rgba(200,245,200,0.22)')
    ctx.fillStyle = ground
    ctx.fillRect(0, H * 0.82, W, H * 0.18)
    ctx.restore()

    // ===== Y 坐标布局 =====
    const titleY   = H * 0.195
    const subY     = H * 0.275
    const carShowY = H * 0.385
    const roadY    = H * 0.465   // 路面线
    const dailyY   = H * 0.525
    const btnY     = H * 0.610
    const btnH     = 66
    const btnW     = W - 48
    const bx       = 24
    const tip1Y    = H * 0.738
    const tip2Y    = H * 0.775

    // ===== Logo 区（淡入）=====
    ctx.save()
    ctx.globalAlpha = this.logoAlpha

    // 奖杯（与微信胶囊垂直中心对齐）
    ctx.font      = '28px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(e('🏆'), W / 2, capCenterY)

    // 标题"赢了个赢"——金色厚描边
    ctx.font = 'bold 56px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 深棕外描边（立体感）
    ctx.strokeStyle = '#7a3800'
    ctx.lineWidth   = 10
    ctx.strokeText('赢了个赢', W / 2, titleY)
    // 橙金内发光
    ctx.strokeStyle = 'rgba(255,160,0,0.5)'
    ctx.lineWidth   = 4
    ctx.strokeText('赢了个赢', W / 2, titleY)
    // 金色渐变填充
    const tg = ctx.createLinearGradient(W/2 - 130, titleY - 30, W/2 + 130, titleY + 30)
    tg.addColorStop(0,    '#FFE855')
    tg.addColorStop(0.28, '#FFFBE0')
    tg.addColorStop(0.60, '#FFD700')
    tg.addColorStop(1,    '#FF8C00')
    ctx.fillStyle = tg
    ctx.fillText('赢了个赢', W / 2, titleY)

    // 副标题
    ctx.font      = '15px sans-serif'
    ctx.fillStyle = 'rgba(20,80,140,0.72)'
    ctx.fillText(e('🏆 三消赢豪车，逐梦人生巅峰'), W / 2, subY)

    // ===== 路面（弧形曲线装饰，对应图片右侧弧线）=====
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = '#fff'
    ctx.lineWidth   = 18
    ctx.beginPath()
    ctx.moveTo(W * 0.6, carShowY - 20)
    ctx.bezierCurveTo(W * 1.1, carShowY + 40, W * 0.9, roadY + 80, W * 0.5, roadY + 120)
    ctx.stroke()
    ctx.globalAlpha = 0.10
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(W * 0.72, carShowY)
    ctx.bezierCurveTo(W * 1.15, carShowY + 60, W * 0.95, roadY + 90, W * 0.55, roadY + 130)
    ctx.stroke()
    ctx.restore()

    // 路面横线
    ctx.save()
    const rl = ctx.createLinearGradient(0, roadY, W, roadY)
    rl.addColorStop(0,   'rgba(255,255,255,0)')
    rl.addColorStop(0.2, 'rgba(255,255,255,0.45)')
    rl.addColorStop(0.8, 'rgba(255,255,255,0.45)')
    rl.addColorStop(1,   'rgba(255,255,255,0)')
    ctx.strokeStyle = rl
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.moveTo(0, roadY)
    ctx.lineTo(W, roadY)
    ctx.stroke()
    ctx.restore()
        
    
    // ===== 三辆车（弹跳 + 倒影）=====
    const carShow   = [e('🏎'), e('🚗'), e('🚙')]
    const carSpacing = W * 0.26
    const carBaseX  = W / 2 - carSpacing
    ctx.font = '48px sans-serif'
    for (let i = 0; i < carShow.length; i++) {
      const bounce = Math.sin(this.frame * 0.07 + i * 1.4) * 5
      const cx = carBaseX + i * carSpacing
      const cy = carShowY + bounce
      ctx.fillText(carShow[i], cx, cy)
      // 倒影
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.transform(1, 0, 0, -1, 0, 0)
      ctx.fillText(carShow[i], cx, -(cy + 44))
      ctx.restore()
    }

    ctx.restore()   // end logoAlpha

    // ===== 每日挑战按钮（全宽，青色胶囊）=====
    const dH = 56, dX = bx, dY = dailyY, dW = btnW
    ctx.save()
    ctx.shadowColor = 'rgba(0,180,220,0.38)'
    ctx.shadowBlur  = 16
    const dg = ctx.createLinearGradient(dX, dY, dX, dY + dH)
    dg.addColorStop(0, '#26D8F0')
    dg.addColorStop(1, '#00A8C8')
    ctx.fillStyle = dg
    roundRect(ctx, dX, dY, dW, dH, 28)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.font = 'bold 21px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(e('📅 每日挑战'), W / 2, dY + dH / 2)
    this.dailyBtnRect = { x: dX, y: dY, w: dW, h: dH }
    ctx.restore()

    // ===== 开始赢车按钮（全宽，橙金胶囊，脉冲缩放）=====
    const btnCX = W / 2, btnCY = btnY + btnH / 2
    this.btnRect = { x: bx, y: btnY, w: btnW, h: btnH }
    ctx.save()
    ctx.translate(btnCX, btnCY)
    ctx.scale(this.btnScale, this.btnScale)
    ctx.translate(-btnCX, -btnCY)
    ctx.shadowColor = 'rgba(255,140,0,0.55)'
    ctx.shadowBlur  = 30
    const bg2 = ctx.createLinearGradient(bx, btnY, bx, btnY + btnH)
    bg2.addColorStop(0, '#FFE040')
    bg2.addColorStop(1, '#FF8000')
    ctx.fillStyle = bg2
    roundRect(ctx, bx, btnY, btnW, btnH, 33)
    ctx.fill()
    ctx.shadowBlur = 0
    const bHG = ctx.createLinearGradient(bx, btnY, bx, btnY + btnH * 0.52)
    bHG.addColorStop(0, 'rgba(255,255,255,0.38)')
    bHG.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = bHG
    ctx.fill()
    ctx.font = 'bold 25px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#3d1800'
    ctx.fillText(e('🚗 开始赢车'), btnCX, btnCY)
    ctx.restore()

    // ===== 说明文字 =====
    ctx.save()
    ctx.font      = '12px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(20,80,140,0.55)'
    ctx.fillText('点击堆叠的车块，集齐3辆相同的车即可赢得！', W / 2, tip1Y)
    ctx.fillText('槽位满无法消除则失败，步数用光也会失败！', W / 2, tip2Y)
    ctx.restore()

    // ===== 底部工具栏 =====
    const toolY  = H * 0.838
    const toolH  = 54
    const GAP    = 8
    const toolW  = (W - 16 * 2 - GAP * 3) / 4
    const tool1X = 16
    const tool2X = tool1X + toolW + GAP
    const tool3X = tool2X + toolW + GAP
    const tool4X = tool3X + toolW + GAP

    this._drawToolBtn(ctx, tool1X, toolY, toolW, toolH,
      { bg: '#FFF3C0', border: '#F5C842', iconColor: '#C8960C' },
      e('🏆'), '排行', '#8B6400')
    this.rankBtnRect = { x: tool1X, y: toolY, w: toolW, h: toolH }

    // 机会按钮（带爱心）
    const lives = getLives()
    this._drawLivesToolBtn(ctx, tool2X, toolY, toolW, toolH, lives)
    this.livesBtnRect = { x: tool2X, y: toolY, w: toolW, h: toolH }

    this._drawToolBtn(ctx, tool3X, toolY, toolW, toolH,
      { bg: '#FFF0D0', border: '#E8A020', iconColor: '#B87000' },
      e('🏅'), '成就', '#8B5000')
    this.achBtnRect = { x: tool3X, y: toolY, w: toolW, h: toolH }

    this._drawToolBtn(ctx, tool4X, toolY, toolW, toolH,
      { bg: '#EEF0FF', border: '#8890CC', iconColor: '#445099' },
      '\u2699', '设置', '#334488')   // ⚙ 不带 FE0F
    this.settingsBtnRect = { x: tool4X, y: toolY, w: toolW, h: toolH }

    // ===== 机会不足弹窗 =====
    if (this._livesPopup) {
      this._drawLivesPopup(ctx, W, H)
    }
  }

  // 通用工具按钮绘制（图标+文字上下居中，无变体符）
  _drawToolBtn(ctx, x, y, w, h, theme, icon, label, labelColor) {
    ctx.save()
    ctx.fillStyle   = theme.bg
    ctx.strokeStyle = theme.border
    ctx.lineWidth   = 1.5
    roundRect(ctx, x, y, w, h, 14)
    ctx.fill(); ctx.stroke()
   
    // 图标
    ctx.font = '20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = theme.iconColor
    ctx.fillText(icon, x + w / 2, y + h / 2 - 9)
    // 文字
    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = labelColor
    ctx.fillText(label, x + w / 2, y + h / 2 + 12)
    ctx.restore()
  }

  // 机会按钮（红色爱心，无 FE0F）
  _drawLivesToolBtn(ctx, x, y, w, h, lives) {
    ctx.save()
    ctx.fillStyle   = lives > 0 ? '#FFE8E8' : '#F0F0F0'
    ctx.strokeStyle = lives > 0 ? '#E06060' : '#AAAAAA'
    ctx.lineWidth   = 1.5
    roundRect(ctx, x, y, w, h, 14)
    ctx.fill(); ctx.stroke()
   
    // 爱心：用 ♥ (U+2665) 避免 FE0F
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const heartFull  = '\u2665'   // ♥ 实心
    const heartEmpty = '\u2661'   // ♡ 空心
    const row = heartFull.repeat(lives) + heartEmpty.repeat(Math.max(0, 3 - lives))
    ctx.fillStyle = lives > 0 ? '#E03030' : '#AAAAAA'
    ctx.fillText(row, x + w / 2, y + h / 2 - 9)
    // ×N
    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = lives > 0 ? '#C02020' : '#888888'
    ctx.fillText(`\u00d7${lives}`, x + w / 2, y + h / 2 + 12)
    ctx.restore()
  }

  _drawLivesPopup(ctx, W, H) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, W, H)

    const cw = W - 56, ch = 290
    const cx = 28, cy = (H - ch) / 2

    // 卡片（白色，圆角）
    ctx.fillStyle = '#FFFFFF'
    roundRect(ctx, cx, cy, cw, ch, 22); ctx.fill()
    ctx.strokeStyle = '#FFB0B0'
    ctx.lineWidth   = 1.5
    roundRect(ctx, cx, cy, cw, ch, 22); ctx.stroke()
    // 顶部红色条
    const popHG = ctx.createLinearGradient(cx, cy, cx, cy + 70)
    popHG.addColorStop(0, 'rgba(255,100,100,0.12)')
    popHG.addColorStop(1, 'rgba(255,100,100,0)')
    ctx.fillStyle = popHG
    roundRect(ctx, cx, cy, cw, 70, { tl: 22, tr: 22, bl: 0, br: 0 }); ctx.fill()

    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#E03030'
    ctx.fillText('\u2665\u2665\u2665 机会用完了', W / 2, cy + 46)

    const secs = getRecoverSecondsLeft()
    const mm   = String(Math.floor(secs / 60)).padStart(2, '0')
    const ss   = String(secs % 60).padStart(2, '0')
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#888'
    ctx.fillText(`${mm}:${ss} 后自动恢复 1 次机会`, W / 2, cy + 92)

    ctx.font = '28px sans-serif'
    ctx.fillStyle = '#CCC'
    ctx.fillText('\u2661\u2661\u2661', W / 2, cy + 130)

    // 分享按钮
    const sbW = cw - 36, sbH = 52
    const sbX = cx + 18, sbY = cy + 158
    const sg  = ctx.createLinearGradient(sbX, sbY, sbX, sbY + sbH)
    sg.addColorStop(0, '#07C160'); sg.addColorStop(1, '#059a4a')
    ctx.fillStyle = sg
    roundRect(ctx, sbX, sbY, sbW, sbH, 26); ctx.fill()
    const sbHG = ctx.createLinearGradient(sbX, sbY, sbX, sbY + sbH * 0.5)
    sbHG.addColorStop(0, 'rgba(255,255,255,0.22)'); sbHG.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sbHG
    roundRect(ctx, sbX, sbY, sbW, sbH * 0.5, { tl: 26, tr: 26, bl: 0, br: 0 }); ctx.fill()
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText('分享给好友，立得 +1 机会', W / 2, sbY + sbH / 2)
    this._popupShareBtn = { x: sbX, y: sbY, w: sbW, h: sbH }

    const cbY = sbY + sbH + 10
    ctx.fillStyle   = '#F5F5F5'
    ctx.strokeStyle = '#DDD'
    ctx.lineWidth   = 1
    roundRect(ctx, sbX, cbY, sbW, sbH, 26); ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = '#999'
    ctx.fillText('等待自动恢复', W / 2, cbY + sbH / 2)
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
            const savedLevel = getLevelProgress()
            this.game.showGame(savedLevel)
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

    if (hit(this.rankBtnRect))     { this.game.showLeaderboard(); return }
    if (hit(this.dailyBtnRect))    { this.game.showDaily(); return }
    if (hit(this.achBtnRect))      { this.game.showAchievements(); return }
    if (hit(this.settingsBtnRect)) { this.game.showSettings(); return }

    if (hit(this.livesBtnRect)) {
      if (getLives() < 3) this._livesPopup = true
      return
    }

    if (hit(this.btnRect)) {
      if (getLives() <= 0) { this._livesPopup = true; return }
      this.game.showGame(getLevelProgress())
    }
  }
}
