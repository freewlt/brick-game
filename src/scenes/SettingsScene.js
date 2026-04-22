// 设置场景 - 赢了个赢（天蓝主题，对齐设计图）
import { roundRect } from '../utils/draw.js'
import AudioManager  from '../utils/audio.js'

function e(str) { return str.replace(/\uFE0F/g, '') }

export default class SettingsScene {
  constructor(game) {
    this.game     = game
    this.frame    = 0
    this._backBtn = null
    this._sfxRow  = null
  }

  init() { this.frame = 0 }
  update() { this.frame++ }

  draw() {
    const { ctx, width: W, height: H } = this.game
    const safeTop = this.game.safeTop || 0
    const padX    = 16

    // ── 背景：天蓝渐变（与 StartScene 一致）──
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,    '#5BC8F5')
    bg.addColorStop(0.42, '#7DD6F8')
    bg.addColorStop(0.72, '#A8E6FF')
    bg.addColorStop(1,    '#C5F0FF')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ── 顶部导航栏 ──
    const navH   = safeTop + 52
    const navBg  = ctx.createLinearGradient(0, 0, 0, navH)
    navBg.addColorStop(0, 'rgba(91,200,245,0.95)')
    navBg.addColorStop(1, 'rgba(91,200,245,0.80)')
    ctx.save()
    ctx.fillStyle = navBg
    ctx.fillRect(0, 0, W, navH)
    ctx.restore()

    // 返回按钮（胶囊，左上角）
    const btnY  = safeTop + 10
    const btnH  = 32
    const btnW  = 68
    const btnX  = padX
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.55)'
    ctx.strokeStyle = 'rgba(255,255,255,0.80)'
    ctx.lineWidth   = 1
    roundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2)
    ctx.fill(); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a6090'
    ctx.fillText('← 返回', btnX + btnW / 2, btnY + btnH / 2)
    ctx.restore()
    this._backBtn = { x: btnX, y: btnY, w: btnW, h: btnH }

    // 页面标题（居中）
    ctx.save()
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(e('⚙ 设置'), W / 2, safeTop + 26)
    ctx.restore()

    // ── 卡片区 ──
    let cy = navH + 16
    const cardX = padX
    const cardW = W - padX * 2
    const rowH  = 64
    const gap   = 10

    // ─ 分组标签：声音 ─
    this._drawGroupLabel(ctx, cardX, cy, '声音')
    cy += 22

    // 音效开关行
    const sfxOn = AudioManager.enabled
    this._drawCard(ctx, cardX, cy, cardW, rowH)
    this._drawRowContent(ctx, cardX, cy, rowH,
      e('🎵'), '游戏音效', '消除音 · BGM · 胜负音效')
    this._drawToggle(ctx, cardX + cardW - 62, cy + (rowH - 30) / 2, 52, 30, sfxOn)
    this._sfxRow = { x: cardX, y: cy, w: cardW, h: rowH }
    cy += rowH + gap

    // ─ 分组标签：关于 ─
    cy += 8
    this._drawGroupLabel(ctx, cardX, cy, '关于')
    cy += 22

    // 关于信息行（合并成一张卡片，内部分行）
    const infoRows = [
      { icon: e('🚗'), title: '赢了个赢',  sub: '版本 v1.0.0 · 三消赢豪车',          arrow: true },
      { icon: e('📖'), title: '玩法规则',  sub: '集齐3辆同款即消除，清空棋盘通关',    arrow: true },
      { icon: e('🏆'), title: '共 30 关',  sub: '难度递进 · 星级评定 ★★★',           arrow: false },
    ]

    // 合并卡片背景
    const groupH = infoRows.length * rowH + (infoRows.length - 1) * 1
    this._drawCard(ctx, cardX, cy, cardW, groupH)

    for (let i = 0; i < infoRows.length; i++) {
      const row = infoRows[i]
      const ry  = cy + i * (rowH + 1)

      // 分割线（非第一行）
      if (i > 0) {
        ctx.save()
        ctx.strokeStyle = 'rgba(100,180,230,0.25)'
        ctx.lineWidth   = 1
        ctx.beginPath()
        ctx.moveTo(cardX + 54, ry)
        ctx.lineTo(cardX + cardW - 16, ry)
        ctx.stroke()
        ctx.restore()
      }

      this._drawRowContent(ctx, cardX, ry, rowH, row.icon, row.title, row.sub)

      // 右侧箭头
      if (row.arrow) {
        ctx.save()
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(80,140,190,0.55)'
        ctx.fillText('›', cardX + cardW - 14, ry + rowH / 2)
        ctx.restore()
      }
    }
    cy += groupH + gap
  }

  // 分组标签（灰蓝小字）
  _drawGroupLabel(ctx, x, y, text) {
    ctx.save()
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(30,100,160,0.55)'
    ctx.fillText(text, x + 4, y + 6)
    ctx.restore()
  }

  // 玻璃果冻卡片背景
  _drawCard(ctx, x, y, w, h) {
    ctx.save()
    // 底色：浅蓝白玻璃
    ctx.fillStyle = 'rgba(220,242,255,0.72)'
    roundRect(ctx, x, y, w, h, 16); ctx.fill()
    // 顶部高光
    const hg = ctx.createLinearGradient(x, y, x, y + h * 0.42)
    hg.addColorStop(0,   'rgba(255,255,255,0.60)')
    hg.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    hg.addColorStop(1,   'rgba(255,255,255,0.00)')
    ctx.fillStyle = hg
    roundRect(ctx, x, y, w, h * 0.42, { tl:16, tr:16, bl:0, br:0 }); ctx.fill()
    // 左侧亮边
    const lg = ctx.createLinearGradient(x, y, x + w*0.12, y)
    lg.addColorStop(0, 'rgba(255,255,255,0.30)')
    lg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = lg
    roundRect(ctx, x, y, w*0.12, h, { tl:16, tr:0, bl:16, br:0 }); ctx.fill()
    // 右侧亮边
    const rg = ctx.createLinearGradient(x + w, y, x + w - w*0.10, y)
    rg.addColorStop(0, 'rgba(255,255,255,0.18)')
    rg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = rg
    roundRect(ctx, x + w - w*0.10, y, w*0.10, h, { tl:0, tr:16, bl:0, br:16 }); ctx.fill()
    // 底部反光
    const bg2 = ctx.createLinearGradient(x, y + h, x, y + h - h*0.15)
    bg2.addColorStop(0, 'rgba(255,255,255,0.18)')
    bg2.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = bg2
    roundRect(ctx, x, y + h - h*0.15, w, h*0.15, { tl:0, tr:0, bl:16, br:16 }); ctx.fill()
    // 细边框
    ctx.strokeStyle = 'rgba(160,215,245,0.60)'
    ctx.lineWidth   = 1.2
    roundRect(ctx, x, y, w, h, 16); ctx.stroke()
    ctx.restore()
  }

  // 行内容：图标 + 主标题 + 副标题
  _drawRowContent(ctx, cardX, rowY, rowH, icon, title, sub) {
    // 图标背景圆
    ctx.save()
    ctx.fillStyle = 'rgba(200,235,255,0.75)'
    ctx.beginPath()
    ctx.arc(cardX + 28, rowY + rowH / 2, 20, 0, Math.PI * 2)
    ctx.fill()
    // 图标背景圆内高光
    const igHg = ctx.createLinearGradient(cardX + 8, rowY + rowH/2 - 20, cardX + 8, rowY + rowH/2)
    igHg.addColorStop(0, 'rgba(255,255,255,0.60)')
    igHg.addColorStop(1, 'rgba(255,255,255,0.00)')
    ctx.fillStyle = igHg
    ctx.beginPath()
    ctx.arc(cardX + 28, rowY + rowH / 2, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '22px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.globalAlpha = 1
    ctx.fillText(icon, cardX + 28, rowY + rowH / 2)
    ctx.restore()

    ctx.save()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = '#1a5070'
    ctx.fillText(title, cardX + 54, rowY + rowH / 2 - 9)
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(40,120,180,0.60)'
    ctx.fillText(sub, cardX + 54, rowY + rowH / 2 + 10)
    ctx.restore()
  }

  // 拨动开关（iOS 风格，绿色/灰色）
  _drawToggle(ctx, x, y, w, h, on) {
    const r = h / 2
    ctx.save()
    // 轨道
    ctx.beginPath()
    ctx.arc(x + r,     y + r, r, Math.PI / 2, -Math.PI / 2)
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2)
    ctx.closePath()
    ctx.fillStyle = on ? '#34C759' : 'rgba(160,200,220,0.55)'
    ctx.fill()
    // 轨道描边
    ctx.strokeStyle = on ? 'rgba(52,199,89,0.6)' : 'rgba(150,190,210,0.4)'
    ctx.lineWidth   = 1
    ctx.stroke()
    // 滑块
    const knobX = on ? x + w - r - 2 : x + r + 2
    ctx.beginPath()
    ctx.arc(knobX, y + r, r - 3, 0, Math.PI * 2)
    ctx.fillStyle   = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.20)'
    ctx.shadowBlur  = 4
    ctx.fill()
    ctx.restore()
  }

  onTouchEnd(x, y) {
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    if (hit(this._backBtn)) {
      if (AudioManager.enabled) AudioManager.playBGM()
      this.game.showStart()
      return
    }
    if (hit(this._sfxRow)) {
      AudioManager.toggle()
      return
    }
  }
}
