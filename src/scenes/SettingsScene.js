// 设置场景 - 赢了个赢
import { roundRect } from '../utils/draw.js'
import AudioManager  from '../utils/audio.js'

export default class SettingsScene {
  constructor(game) {
    this.game      = game
    this.frame     = 0
    this._backBtn  = null
    this._sfxRow   = null   // 音效开关点击区
  }

  init() {
    this.frame = 0
  }

  update() {
    this.frame++
  }

  draw() {
    const { ctx, width: W, height: H } = this.game

    // ── 背景（与 StartScene 一致）──
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0,   '#12042a')
    bg.addColorStop(0.5, '#0d0a2e')
    bg.addColorStop(1,   '#0a1030')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // 背景星点
    ctx.save()
    for (let i = 0; i < 22; i++) {
      const sx = ((i * 137.5) % 1) * W
      const sy = ((i * 97.3 + i * i * 0.7) % 1) * H * 0.8
      const flicker = 0.25 + 0.15 * Math.sin(this.frame * 0.05 + i)
      ctx.globalAlpha = flicker
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(sx, sy, i % 3 === 0 ? 1.5 : 1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    const safeTop = this.game.safeTop
    const padX    = 20

    // ── 顶部栏 ──
    ctx.save()
    ctx.fillStyle = 'rgba(8,10,22,0.95)'
    ctx.fillRect(0, 0, W, safeTop + 44)
    // 底部细线
    const rl = ctx.createLinearGradient(0, 0, W, 0)
    rl.addColorStop(0,   'rgba(180,80,255,0)')
    rl.addColorStop(0.3, 'rgba(80,160,255,0.55)')
    rl.addColorStop(0.7, 'rgba(255,215,0,0.55)')
    rl.addColorStop(1,   'rgba(255,80,80,0)')
    ctx.fillStyle = rl
    ctx.fillRect(0, safeTop + 43, W, 1.5)
    ctx.restore()

    // 返回按钮（左上角）— 圆形箭头风格
    const backR = 18
    const backCX = padX + backR, backCY = safeTop + 22
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.12)'
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.arc(backCX, backCY, backR, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText('‹', backCX + 1, backCY + 1)   // 单箭头，视觉居中补1px
    ctx.restore()
    this._backBtn = { x: backCX - backR, y: backCY - backR, w: backR * 2, h: backR * 2 }

    // 页面标题（左对齐，紧贴返回按钮右侧）
    ctx.save()
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#FFD700'
    ctx.fillText('设置', W / 2 + 10, safeTop + 22)
    ctx.restore()

    // ── 设置卡片区域 ──
    const cardX = padX, cardW = W - padX * 2
    let   cardY = safeTop + 72

    // ─ 分组标题：声音 ─
    ctx.save()
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(160,180,220,0.6)'
    ctx.fillText('声音', cardX + 4, cardY)
    ctx.restore()
    cardY += 22

    // 音效开关行
    const rowH  = 62
    const sfxOn = AudioManager.enabled
    ctx.save()
    ctx.fillStyle   = 'rgba(255,255,255,0.05)'
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth   = 1
    roundRect(ctx, cardX, cardY, cardW, rowH, 14); ctx.fill(); ctx.stroke()
    ctx.restore()
    // 左侧图标（独立绘制，避免被 save/restore 截断）
    ctx.save()
    ctx.font = '24px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText('🎵', cardX + 16, cardY + rowH / 2)
    ctx.restore()
    // 标题 + 副标题
    ctx.save()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText('游戏音效', cardX + 54, cardY + rowH / 2 - 9)
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(160,190,230,0.6)'
    ctx.fillText('消除音 · BGM · 胜负音效', cardX + 54, cardY + rowH / 2 + 10)
    ctx.restore()
    // 右侧拨动开关
    this._drawToggle(ctx, cardX + cardW - 64, cardY + (rowH - 30) / 2, 54, 30, sfxOn)
    this._sfxRow = { x: cardX, y: cardY, w: cardW, h: rowH }
    cardY += rowH + 10

    // ─ 分组标题：关于 ─
    cardY += 10
    ctx.save()
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(160,180,220,0.6)'
    ctx.fillText('关于', cardX + 4, cardY)
    ctx.restore()
    cardY += 22

    // 复用：绘制只读信息行
    const infoRows = [
      { icon: '🚗', title: '赢了个赢',  sub: '版本 v1.0.0 · 三消赢豪车' },
      { icon: '📖', title: '玩法规则',  sub: '集齐3辆同款即消除，清空棋盘通关' },
      { icon: '🏆', title: '共 10 关',  sub: '难度递进 · 星级评定 ⭐⭐⭐' },
    ]
    for (const row of infoRows) {
      ctx.save()
      ctx.fillStyle   = 'rgba(255,255,255,0.04)'
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth   = 1
      roundRect(ctx, cardX, cardY, cardW, rowH, 14); ctx.fill(); ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(row.icon, cardX + 16, cardY + rowH / 2)
      ctx.restore()

      ctx.save()
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.font = 'bold 15px sans-serif'
      ctx.fillStyle = '#fff'
      ctx.fillText(row.title, cardX + 54, cardY + rowH / 2 - 9)
      ctx.font = '11px sans-serif'
      ctx.fillStyle = 'rgba(160,190,230,0.6)'
      ctx.fillText(row.sub, cardX + 54, cardY + rowH / 2 + 10)
      ctx.restore()

      cardY += rowH + 10
    }
  }

  // ── 拨动开关（iOS 风格）──
  _drawToggle(ctx, x, y, w, h, on) {
    const r = h / 2
    ctx.save()

    // 轨道
    ctx.beginPath()
    ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2)       // 左半圆
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2)   // 右半圆
    ctx.closePath()
    ctx.fillStyle = on ? '#2ECC71' : 'rgba(100,100,120,0.6)'
    ctx.fill()
    // 轨道描边
    ctx.strokeStyle = on ? 'rgba(46,204,113,0.8)' : 'rgba(150,150,170,0.4)'
    ctx.lineWidth   = 1.5
    ctx.stroke()

    // 滑块
    const knobX = on ? x + w - r - 2 : x + r + 2
    ctx.beginPath()
    ctx.arc(knobX, y + r, r - 3, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur  = 4
    ctx.fill()

    ctx.restore()
  }

  onTouchEnd(x, y) {
    const hit = (b) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h

    // 返回
    if (hit(this._backBtn)) {
      // 若音效已开启则重启 BGM（从设置页回到开始页，BGM 已被停掉）
      if (AudioManager.enabled) {
        AudioManager.playBGM()
      }
      this.game.showStart()
      return
    }

    // 音效开关
    if (hit(this._sfxRow)) {
      AudioManager.toggle()
      return
    }
  }
}
