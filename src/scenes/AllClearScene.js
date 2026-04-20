// 全通关彩蛋场景 - 赢了个赢
import { roundRect } from '../utils/draw.js'
import { CONFIG }    from '../config.js'
import AudioManager  from '../utils/audio.js'

// ── 单个烟花粒子 ──
class FireworkParticle {
  constructor(x, y, color) {
    this.x = x; this.y = y
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 5
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed - 2
    this.color = color
    this.alpha = 1
    this.r     = 2 + Math.random() * 3
    this.life  = 55 + Math.random() * 30
    this.maxLife = this.life
    this.trail = []
  }
  update() {
    this.trail.push({ x: this.x, y: this.y })
    if (this.trail.length > 5) this.trail.shift()
    this.x += this.vx; this.y += this.vy
    this.vy += 0.12      // 重力
    this.vx *= 0.97
    this.life--
    this.alpha = this.life / this.maxLife
  }
  isDead() { return this.life <= 0 }
  draw(ctx) {
    ctx.save()
    // 拖尾
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i]
      ctx.globalAlpha = this.alpha * (i / this.trail.length) * 0.4
      ctx.fillStyle   = this.color
      ctx.beginPath()
      ctx.arc(t.x, t.y, this.r * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    // 主球
    ctx.globalAlpha = this.alpha
    ctx.fillStyle   = this.color
    ctx.shadowColor = this.color
    ctx.shadowBlur  = 8
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ── 飘字 ──
class FloatLabel {
  constructor(text, x, y, color = '#FFD700', size = 22) {
    this.text = text; this.x = x; this.y = y
    this.color = color; this.size = size
    this.alpha = 0; this.vy = -0.6; this.life = 80; this.maxLife = 80
    this._fadeIn = true
  }
  update() {
    this.y += this.vy
    this.life--
    if (this._fadeIn) {
      this.alpha = Math.min(1, this.alpha + 0.08)
      if (this.alpha >= 1) this._fadeIn = false
    } else {
      this.alpha = this.life / this.maxLife
    }
  }
  isDead() { return this.life <= 0 }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha   = this.alpha
    ctx.font          = `bold ${this.size}px sans-serif`
    ctx.textAlign     = 'center'
    ctx.textBaseline  = 'middle'
    ctx.fillStyle     = this.color
    ctx.shadowColor   = this.color
    ctx.shadowBlur    = 10
    ctx.fillText(this.text, this.x, this.y)
    ctx.restore()
  }
}

export default class AllClearScene {
  constructor(game) {
    this.game        = game
    this.frame       = 0
    this.particles   = []
    this.floats      = []
    this._homeBtn    = null
    this._retryBtn   = null
    // 烟花发射计划（时间轴：frame）
    this._fwSchedule = [0, 18, 36, 55, 75, 100, 130, 170]
    this._fwIdx      = 0
    // 星星彩屑背景
    this._stars      = Array.from({ length: 30 }, (_, i) => ({
      x:     Math.random() * 400,
      y:     Math.random() * 800,
      r:     0.5 + Math.random() * 1.5,
      speed: 0.3 + Math.random() * 0.5,
      alpha: 0.2 + Math.random() * 0.6,
    }))
  }

  init() {
    this.frame     = 0
    this.particles = []
    this.floats    = []
    this._fwIdx    = 0
    // 入场 BGM 换成循环播放（StartScene BGM）
    AudioManager.playBGM()
  }

  // ── 发射一束烟花 ──
  _burst(x, y) {
    const palette = [
      '#FFD700', '#FF6B35', '#2ECC71', '#4FC3F7',
      '#E91E8C', '#9B59B6', '#1ABC9C', '#FF4444',
    ]
    const color = palette[Math.floor(Math.random() * palette.length)]
    const count = 28 + Math.floor(Math.random() * 20)
    for (let i = 0; i < count; i++) {
      this.particles.push(new FireworkParticle(x, y, color))
    }
  }

  update() {
    const W = this.game.width
    const H = this.game.height
    this.frame++

    // ── 按时间轴自动发射烟花 ──
    if (this._fwIdx < this._fwSchedule.length &&
        this.frame >= this._fwSchedule[this._fwIdx]) {
      const x = 60 + Math.random() * (W - 120)
      const y = 80 + Math.random() * (H * 0.4)
      this._burst(x, y)
      this._fwIdx++
    }

    // ── 之后每 60 帧随机一次 ──
    if (this.frame > 200 && this.frame % 60 === 0) {
      this._burst(60 + Math.random() * (W - 120), 60 + Math.random() * (H * 0.35))
    }

    // 粒子 & 飘字
    this.particles = this.particles.filter(p => { p.update(); return !p.isDead() })
    this.floats    = this.floats.filter(f    => { f.update(); return !f.isDead() })

    // ── 定时弹出飘字 ──
    if (this.frame === 20)  this.floats.push(new FloatLabel('🏆 全部通关！', W / 2, H * 0.38, '#FFD700', 28))
    if (this.frame === 60)  this.floats.push(new FloatLabel('你是真正的赢家！', W / 2, H * 0.5, '#FFA500', 20))
    if (this.frame === 110) this.floats.push(new FloatLabel('🚀 更多关卡即将到来', W / 2, H * 0.6, '#4FC3F7', 18))

    // 星星漂移
    for (const s of this._stars) {
      s.y -= s.speed
      if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W }
    }
  }

  draw() {
    const { ctx, width: W, height: H } = this.game
    const cx = W / 2

    // ── 背景渐变（深夜庆典感）──
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,   '#06001a')
    bg.addColorStop(0.4, '#0a0030')
    bg.addColorStop(1,   '#02080a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ── 漂浮小星 ──
    for (const s of this._stars) {
      ctx.save()
      ctx.globalAlpha = s.alpha * (0.4 + 0.3 * Math.sin(this.frame * 0.04 + s.x))
      ctx.fillStyle   = '#ffffff'
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    // ── 烟花粒子 ──
    this.particles.forEach(p => p.draw(ctx))

    // ── 主内容卡片 ──
    this._drawCard(ctx, W, H, cx)

    // ── 飘字 ──
    this.floats.forEach(f => f.draw(ctx))

    // ── 底部按钮 ──
    this._drawButtons(ctx, W, H, cx)
  }

  _drawCard(ctx, W, H, cx) {
    const safeTop = this.game.safeTop
    const cardX   = 24
    const cardW   = W - 48
    const cardY   = safeTop + 16
    const cardH   = H * 0.62

    // 卡片背景
    ctx.save()
    ctx.fillStyle   = 'rgba(12,8,35,0.88)'
    ctx.strokeStyle = 'rgba(255,215,0,0.55)'
    ctx.lineWidth   = 1.8
    roundRect(ctx, cardX, cardY, cardW, cardH, 24); ctx.fill(); ctx.stroke()

    // 卡片顶部彩虹光条
    const rainbow = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0)
    rainbow.addColorStop(0,    'rgba(255,80,80,0.8)')
    rainbow.addColorStop(0.25, 'rgba(255,215,0,0.9)')
    rainbow.addColorStop(0.5,  'rgba(50,220,120,0.8)')
    rainbow.addColorStop(0.75, 'rgba(80,160,255,0.8)')
    rainbow.addColorStop(1,    'rgba(180,80,255,0.8)')
    ctx.fillStyle = rainbow
    roundRect(ctx, cardX, cardY, cardW, 4, { tl: 24, tr: 24, bl: 0, br: 0 }); ctx.fill()
    ctx.restore()

    // ── 大奖杯 emoji + 光晕 ──
    const trophyY = cardY + 74
    const bounce  = Math.sin(this.frame * 0.07) * 6
    ctx.save()
    ctx.font      = '72px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    // 外发光
    ctx.shadowColor = 'rgba(255,215,0,0.8)'
    ctx.shadowBlur  = 30 + Math.sin(this.frame * 0.1) * 10
    ctx.fillText('🏆', cx, trophyY + bounce)
    ctx.restore()

    // ── 标题：全部通关 ──
    const titleY = trophyY + 60
    ctx.save()
    const tg = ctx.createLinearGradient(cx - 100, 0, cx + 100, 0)
    tg.addColorStop(0, '#FFD700'); tg.addColorStop(0.5, '#FFFDE7'); tg.addColorStop(1, '#FFA500')
    ctx.font      = 'bold 30px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = tg
    ctx.shadowColor = 'rgba(255,200,0,0.6)'; ctx.shadowBlur = 12
    ctx.fillText('全部通关 ！', cx, titleY)
    ctx.restore()

    // ── 副标题 ──
    ctx.save()
    ctx.font      = '16px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(200,230,255,0.75)'
    ctx.fillText('你已征服所有 ' + CONFIG.LEVELS.length + ' 关！', cx, titleY + 38)
    ctx.restore()

    // ── 三颗金星 ──
    const starY = titleY + 80
    for (let i = 0; i < 3; i++) {
      const sb    = Math.sin(this.frame * 0.09 + i * 1.1) * 4
      const scale = 1 + 0.08 * Math.sin(this.frame * 0.12 + i * 0.9)
      ctx.save()
      ctx.translate(cx - 44 + i * 44, starY + sb)
      ctx.scale(scale, scale)
      ctx.font      = '36px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(255,215,0,0.9)'; ctx.shadowBlur = 16
      ctx.fillText('⭐', 0, 0)
      ctx.restore()
    }

    // ── "更多关卡即将到来" 彩色跑马灯文字 ──
    const comingY = starY + 60
    const pulse   = 0.65 + 0.35 * Math.abs(Math.sin(this.frame * 0.055))
    ctx.save()
    ctx.globalAlpha = pulse
    const cg = ctx.createLinearGradient(cx - 110, 0, cx + 110, 0)
    cg.addColorStop(0,    '#FF6B35')
    cg.addColorStop(0.33, '#FFD700')
    cg.addColorStop(0.66, '#2ECC71')
    cg.addColorStop(1,    '#4FC3F7')
    ctx.font      = 'bold 17px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = cg
    ctx.shadowColor = 'rgba(255,200,100,0.5)'; ctx.shadowBlur = 8
    ctx.fillText('🚀  更多关卡即将到来  🚀', cx, comingY)
    ctx.restore()

    // ── 小车图标彩带 ──
    const iconY   = comingY + 36
    const icons   = CONFIG.CAR_ICONS
    const iconGap = (cardW - 32) / icons.length
    ctx.save()
    icons.forEach((icon, i) => {
      const ix     = cardX + 16 + i * iconGap + iconGap / 2
      const ibounce = Math.sin(this.frame * 0.07 + i * 0.8) * 4
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.frame * 0.05 + i)
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(icon, ix, iconY + ibounce)
    })
    ctx.restore()
  }

  _drawButtons(ctx, W, H, cx) {
    const btnY  = H - 160
    const btnH  = 50
    const btnR  = 25
    const bw2   = (W - 56) / 2

    // 重玩按钮（从第1关开始）
    const rx = 20
    ctx.save()
    const rg = ctx.createLinearGradient(rx, btnY, rx, btnY + btnH)
    rg.addColorStop(0, '#FFD700'); rg.addColorStop(1, '#FF8C00')
    ctx.fillStyle = rg
    roundRect(ctx, rx, btnY, bw2, btnH, btnR); ctx.fill()
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1a1a2e'
    ctx.fillText('🔄 从头再战', rx + bw2 / 2, btnY + btnH / 2)
    this._retryBtn = { x: rx, y: btnY, w: bw2, h: btnH }
    ctx.restore()

    // 首页按钮
    const hx = rx + bw2 + 16
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.1)'
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5
    roundRect(ctx, hx, btnY, bw2, btnH, btnR); ctx.fill(); ctx.stroke()
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
    ctx.fillText('🏠 首页', hx + bw2 / 2, btnY + btnH / 2)
    this._homeBtn = { x: hx, y: btnY, w: bw2, h: btnH }
    ctx.restore()

    // 底部装饰说明
    ctx.save()
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(160,200,255,0.35)'
    ctx.fillText('关注我们获取新关卡更新通知', cx, H - 90)
    ctx.restore()
  }

  onTouchEnd(x, y) {
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    if (hit(this._retryBtn)) {
      this.game.showGame(0)   // 从第1关重新开始
      return
    }
    if (hit(this._homeBtn)) {
      this.game.showStart()
    }
  }
}
