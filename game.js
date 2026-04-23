// 赢了个赢 - 主入口
import GameScene        from './src/scenes/GameScene.js'
import StartScene       from './src/scenes/StartScene.js'
import ResultScene      from './src/scenes/ResultScene.js'
import LeaderboardScene from './src/scenes/LeaderboardScene.js'
import SettingsScene    from './src/scenes/SettingsScene.js'
import AllClearScene    from './src/scenes/AllClearScene.js'
import AchievementScene from './src/scenes/AchievementScene.js'
import DailyScene       from './src/scenes/DailyScene.js'
import { handleShareEntry, saveLevelProgress } from './src/utils/storage.js'
import AudioManager     from './src/utils/audio.js'

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

// ✅ 获取系统信息
const sysInfo = wx.getSystemInfoSync()
// 逻辑尺寸（CSS px，触摸事件用的坐标单位）
const logicWidth  = sysInfo.windowWidth
const logicHeight = sysInfo.windowHeight
// 设备像素比（iPhone高清屏通常是2或3）
const dpr = sysInfo.pixelRatio || 1

// ✅ 动态计算安全顶部高度（状态栏 + 胶囊按钮区，适配刘海屏/安卓各机型）
// statusBarHeight = 状态栏高度（系统级，各机型不同）
// + 44 = 胶囊按钮高度（微信固定 32px）+ 上下各 6px 间距
let statusBarHeight = 44  // 兜底默认值
let safeTopHeight   = 88  // 兜底默认值
try {
  const winInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  statusBarHeight = winInfo.statusBarHeight || 44
  safeTopHeight   = statusBarHeight + 44
} catch (e) {}
const safeTop = safeTopHeight

// ✅ canvas 物理像素 = 逻辑尺寸 × DPR → 高清不模糊
canvas.width  = logicWidth  * dpr
canvas.height = logicHeight * dpr

// ✅ 全局缩放：把绘图坐标系缩放到逻辑尺寸，这样所有绘制代码直接用逻辑px写即可
ctx.scale(dpr, dpr)

// 全局游戏状态管理（width/height 用逻辑尺寸，触摸坐标与绘图坐标一致）
const Game = {
  canvas,
  ctx,
  width:   logicWidth,
  height:  logicHeight,
  safeTop:          safeTop,          // ✅ 动态安全顶，各场景统一从 this.game.safeTop 读取
  statusBarHeight:  statusBarHeight,  // ✅ 状态栏高度，用于对齐微信胶囊按钮
  dpr,
  currentScene: null,
  // 好友助力提示（入场时短暂显示）
  _shareToast: null,

  init() {
    // 初始化音效系统（创建 WebAudioContext）
    AudioManager.init()

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
    saveLevelProgress(levelIdx)   // 记录本次进入的关卡，退出即恢复
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

  showSettings() {
    // 进设置页时停掉 BGM，避免 timer 泄漏
    AudioManager.stopBGM()
    this.currentScene = new SettingsScene(this)
    this.currentScene.init()
  },

  showAllClear() {
    this.currentScene = new AllClearScene(this)
    this.currentScene.init()
  },

  showAchievements() {
    this.currentScene = new AchievementScene(this)
    this.currentScene.init()
  },

  showDaily() {
    this.currentScene = new DailyScene(this)
    this.currentScene.init()
  },

  // 从 DailyScene 进入每日关卡游戏（dailyScene 引用用于结果回调）
  showDailyGame(levelCfg, dailyScene) {
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
      // 先让 DailyScene 处理统计/成就
      dailyScene.onDailyResult(isWin)
      // 再展示结算卡片，结算"下一步"返回每日挑战页
      this.currentScene = new ResultScene(this, score, carsWon, -1, isWin, stars, () => {
        this.showDaily()
      })
      this.currentScene.init()
    })
    this.currentScene = scene
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
