// 赢了个赢 - 主入口
import GameScene        from './src/scenes/GameScene.js'
import StartScene       from './src/scenes/StartScene.js'
import ResultScene      from './src/scenes/ResultScene.js'
import LeaderboardScene from './src/scenes/LeaderboardScene.js'
import { handleShareEntry } from './src/utils/storage.js'

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

// ✅ 获取系统信息
const sysInfo = wx.getSystemInfoSync()
// 逻辑尺寸（CSS px，触摸事件用的坐标单位）
const logicWidth  = sysInfo.windowWidth
const logicHeight = sysInfo.windowHeight
// 设备像素比（iPhone高清屏通常是2或3）
const dpr = sysInfo.pixelRatio || 1

// ✅ canvas 物理像素 = 逻辑尺寸 × DPR → 高清不模糊
canvas.width  = logicWidth  * dpr
canvas.height = logicHeight * dpr

// ✅ 全局缩放：把绘图坐标系缩放到逻辑尺寸，这样所有绘制代码直接用逻辑px写即可
ctx.scale(dpr, dpr)

// 全局游戏状态管理（width/height 用逻辑尺寸，触摸坐标与绘图坐标一致）
const Game = {
  canvas,
  ctx,
  width:  logicWidth,
  height: logicHeight,
  dpr,
  currentScene: null,
  // 好友助力提示（入场时短暂显示）
  _shareToast: null,

  init() {
    // 检测是否从好友分享链接进入
    const fromShare = handleShareEntry()
    if (fromShare) {
      // 延迟显示"好友助力"提示（等场景渲染后）
      this._shareToast = { text: '🎁 好友助力！+1次机会', alpha: 1, frame: 0 }
    }

    this.showStart()
    this.bindEvents()
  },

  showStart() {
    this.currentScene = new StartScene(this)
    this.currentScene.init()
    this.loop()
  },

  showGame(levelIdx = 0) {
    this.currentScene = new GameScene(this, levelIdx)
    this.currentScene.init()
  },

  showResult(score, carsWon, levelIdx, isWin, stars) {
    this.currentScene = new ResultScene(this, score, carsWon, levelIdx, isWin, stars)
    this.currentScene.init()
  },

  showLeaderboard() {
    this.currentScene = new LeaderboardScene(this)
    this.currentScene.init()
  },

  loop() {
    const render = () => {
      // clearRect 用物理像素清全屏
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (this.currentScene) {
        this.currentScene.update()
        this.currentScene.draw()
      }
      // 好友助力 Toast
      this._drawShareToast()
      requestAnimationFrame(render)
    }
    render()
  },

  _drawShareToast() {
    const toast = this._shareToast
    if (!toast) return
    toast.frame++
    // 显示120帧（约2秒），然后淡出
    if (toast.frame > 120) {
      toast.alpha = Math.max(0, toast.alpha - 0.04)
    }
    if (toast.alpha <= 0) { this._shareToast = null; return }

    ctx.save()
    ctx.globalAlpha = toast.alpha
    ctx.fillStyle   = 'rgba(30,200,100,0.92)'
    const tw = 220, th = 44, tx = (logicWidth - tw) / 2, ty = 60
    ctx.beginPath()
    ctx.roundRect ? ctx.roundRect(tx, ty, tw, th, 22)
                  : (() => { ctx.rect(tx, ty, tw, th) })()
    ctx.fill()
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(toast.text, logicWidth / 2, ty + th / 2)
    ctx.restore()
  },

  bindEvents() {
    // ✅ 触摸坐标是逻辑px，与绘图坐标系完全一致，无需换算
    wx.onTouchStart((e) => {
      const touch = e.touches[0]
      if (this.currentScene && this.currentScene.onTouchStart) {
        this.currentScene.onTouchStart(touch.clientX, touch.clientY)
      }
    })
    wx.onTouchEnd((e) => {
      const touch = e.changedTouches[0]
      if (this.currentScene && this.currentScene.onTouchEnd) {
        this.currentScene.onTouchEnd(touch.clientX, touch.clientY)
      }
    })
    wx.onTouchMove((e) => {
      const touch = e.touches[0]
      if (this.currentScene && this.currentScene.onTouchMove) {
        this.currentScene.onTouchMove(touch.clientX, touch.clientY)
      }
    })
  }
}

Game.init()
