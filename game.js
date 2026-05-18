// 赢了个赢 - 主入口
import GameScene        from './src/scenes/GameScene.js'
import StartScene       from './src/scenes/StartScene.js'
import ResultScene      from './src/scenes/ResultScene.js'
import LeaderboardScene from './src/scenes/LeaderboardScene.js'
import SettingsScene    from './src/scenes/SettingsScene.js'
import AllClearScene    from './src/scenes/AllClearScene.js'
import AchievementScene from './src/scenes/AchievementScene.js'
import DailyScene       from './src/scenes/DailyScene.js'
import { handleShareEntry, saveLevelProgress, saveMyUserInfo, loadCloudProgress } from './src/utils/storage.js'
import { auth, userInfo, getEnvPrefix } from './src/utils/wxApi.js'
import AudioManager     from './src/utils/audio.js'

// 'develop' | 'trial' | 'release'
let _envVersion = 'release'
try { _envVersion = wx.getAccountInfoSync().miniProgram.envVersion || 'release' } catch (e) {}
export const envVersion = _envVersion

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

// ✅ 获取系统信息
const sysInfo = wx.getSystemInfoSync()
// 逻辑尺寸（CSS px，触摸事件用的坐标单位）
const logicWidth  = sysInfo.windowWidth
const logicHeight = sysInfo.windowHeight
// 设备像素比（iPhone高清屏通常是2或3）
// 小游戏长时间运行时 DPR=3 会显著放大 Canvas 显存占用；卡通画面封顶到 2 更稳。
const dpr = Math.min(sysInfo.pixelRatio || 1, 2)

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
  _loopStarted: false,
  // 好友助力提示（入场时短暂显示）
  _shareToast: null,
  // 隐私授权状态：true=已授权 / false=用户拒绝 / null=未询问过
  // 让 LeaderboardScene 复用此状态，避免重复弹授权窗口
  _privacyOK:  null,
  _rankCache:  null,   // { list, ts } — 排行榜跨场景缓存
  _lastRenderErrorAt: 0,
  _renderErrorRecoveryTimer: null,

  init() {
    // 初始化微信云开发（envId 在微信开发者工具→云开发控制台获取后填入）
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.init({ env: 'YOUR_ENV_ID', traceUser: true })
    }

    // 初始化音效系统（创建 WebAudioContext）
    AudioManager.init()

    // 检测是否从好友分享链接进入
    const fromShare = handleShareEntry()
    if (fromShare) {
      // 延迟显示"好友助力"提示（等场景渲染后）
      this._shareToast = { text: '🎁 好友助力！+1次机会', alpha: 1, frame: 0 }
    }

    // 隐私授权 → 拉取并缓存自己的头像/昵称
    this._initUserInfo()

    // 启动时静默同步云端进度，不阻塞 UI；云端值回来后如果更大则覆盖本地
    loadCloudProgress(() => {})

    this.showStart()
    this.bindEvents()
  },

  _initUserInfo() {
    const doFetch = () => {
      userInfo.getBasic((info) => {
        if (info.nickName) {
          saveMyUserInfo({ nickname: info.nickName, avatarUrl: info.avatarUrl || '' })
        }
      })
    }

    auth.requirePrivacy().then((ok) => {
      this._privacyOK = ok
      if (ok) doFetch()
    })
  },

  showStart() {
    if (this._renderErrorRecoveryTimer) {
      clearTimeout(this._renderErrorRecoveryTimer)
      this._renderErrorRecoveryTimer = null
    }
    this._switchScene(new StartScene(this))
    if (!this._loopStarted) {
      this._loopStarted = true
      this.loop()
    }
  },

  showGame(levelIdx = 0) {
    saveLevelProgress(levelIdx)
    this._switchScene(new GameScene(this, levelIdx, null, null, `level_${levelIdx}`))
  },

  showResult(score, carsWon, levelIdx, isWin, stars) {
    this._switchScene(new ResultScene(this, score, carsWon, levelIdx, isWin, stars))
  },

  showLeaderboard() {
    this._switchScene(new LeaderboardScene(this))
  },

  showSettings() {
    this._switchScene(new SettingsScene(this))
  },

  showAllClear() {
    this._switchScene(new AllClearScene(this))
  },

  showAchievements() {
    this._switchScene(new AchievementScene(this))
  },

  showDaily() {
    this._switchScene(new DailyScene(this))
  },

  // 从 DailyScene 进入每日关卡游戏（dailyScene 引用用于结果回调）
  showDailyGame(levelCfg, dailyScene, seed = null) {
    const scene = new GameScene(this, 0, levelCfg, (isWin, score, carsWon, stars) => {
      // 先让 DailyScene 处理统计/成就
      dailyScene.onDailyResult(isWin)
      // 再展示结算卡片，结算"下一步"返回每日挑战页
      this._switchScene(new ResultScene(this, score, carsWon, -1, isWin, stars, () => {
        this.showDaily()
      }))
    }, seed)
    this._switchScene(scene)
  },

  loop() {
    const render = () => {
      // clearRect 用物理像素清全屏
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      try {
        if (this.currentScene) {
          this.currentScene.update()
          this.currentScene.draw()
        }
      } catch (e) {
        this._handleRenderError(e)
      }
      // 好友助力 Toast
      this._drawShareToast()
      requestAnimationFrame(render)
    }
    render()
  },

  _handleRenderError(err) {
    const now = Date.now()
    if (now - this._lastRenderErrorAt > 1000) {
      this._lastRenderErrorAt = now
      try { console.error('[Game] render failed', err) } catch (e) {}
    }

    if (this._renderErrorRecoveryTimer === null) {
      this._renderErrorRecoveryTimer = setTimeout(() => {
        this._renderErrorRecoveryTimer = null
        this.showStart()
      }, 2000)
    }

    ctx.save()
    ctx.fillStyle = '#5BC8F5'
    ctx.fillRect(0, 0, logicWidth, logicHeight)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('画面异常，即将返回首页', logicWidth / 2, logicHeight / 2 - 12)
    ctx.font = '13px sans-serif'
    ctx.fillText('或点击屏幕立即返回', logicWidth / 2, logicHeight / 2 + 18)
    ctx.restore()
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

  _switchScene(newScene) {
    if (this.currentScene && typeof this.currentScene.destroy === 'function') {
      this.currentScene.destroy()
    }
    this.currentScene = newScene
    newScene.init()
  },

  bindEvents() {
    // ✅ 触摸坐标是逻辑px，与绘图坐标系完全一致，无需换算
    wx.onTouchStart((e) => {
      const touch = e.touches[0]
      if (this._renderErrorRecoveryTimer) {
        clearTimeout(this._renderErrorRecoveryTimer)
        this._renderErrorRecoveryTimer = null
        this.showStart()
        return
      }
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
