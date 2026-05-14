// wx API 统一封装层
// 集中 try/catch、失败统一 console.warn 上报

function warn(api, err) {
  console.warn(`[wxApi] ${api} failed:`, err)
}

// ── 本地存储 ──
export const storage = {
  get(key, defaultVal = null) {
    try {
      const v = wx.getStorageSync(key)
      return v === '' || v === undefined ? defaultVal : v
    } catch (e) { warn('getStorageSync', e); return defaultVal }
  },
  set(key, value) {
    try { wx.setStorageSync(key, value); return true }
    catch (e) { warn('setStorageSync', e); return false }
  },
}

// ── 分享 ──
export const share = {
  send({ title, imageUrl, query = '', onSuccess, onFail }) {
    try {
      wx.shareAppMessage({
        title, imageUrl, query,
        success: () => { onSuccess && onSuccess() },
        fail:    (e) => { warn('shareAppMessage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('shareAppMessage', e); onFail && onFail(e) }
  },
  getLaunchQuery() {
    try { return (wx.getLaunchOptionsSync().query) || {} }
    catch (e) { warn('getLaunchOptionsSync', e); return {} }
  },
}

// ── 隐私授权 ──
export const auth = {
  requirePrivacy() {
    return new Promise((resolve) => {
      if (typeof wx.requirePrivacyAuthorize !== 'function') {
        resolve(true); return
      }
      try {
        wx.requirePrivacyAuthorize({
          success: () => resolve(true),
          fail:    (e) => { warn('requirePrivacyAuthorize', e); resolve(false) },
        })
      } catch (e) { warn('requirePrivacyAuthorize', e); resolve(false) }
    })
  },
}

// ── 用户信息 ──
export const userInfo = {
  getProfile(desc, onSuccess, onFail) {
    try {
      wx.getUserProfile({
        desc,
        success: (res) => onSuccess && onSuccess(res.userInfo || {}),
        fail:    (e)   => { warn('getUserProfile', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getUserProfile', e); onFail && onFail(e) }
  },
  getBasic(onSuccess, onFail) {
    try {
      wx.getUserInfo({
        success: (res) => onSuccess && onSuccess(res.userInfo || {}),
        fail:    (e)   => { warn('getUserInfo', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getUserInfo', e); onFail && onFail(e) }
  },
}

// ── 云存储（开放数据域）──
export const cloud = {
  setKV(kvList, onSuccess, onFail) {
    try {
      wx.setUserCloudStorage({
        KVDataList: kvList,
        success: () => onSuccess && onSuccess(),
        fail:    (e) => { warn('setUserCloudStorage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('setUserCloudStorage', e); onFail && onFail(e) }
  },
  getFriendKV(keyList, onSuccess, onFail) {
    try {
      wx.getFriendCloudStorage({
        keyList,
        success: (res) => onSuccess && onSuccess(res.data || []),
        fail:    (e)   => { warn('getFriendCloudStorage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getFriendCloudStorage', e); onFail && onFail(e) }
  },
  getMyKV(keyList, onSuccess, onFail) {
    try {
      wx.getUserCloudStorage({
        keyList,
        success: (res) => onSuccess && onSuccess(res.KVDataList || []),
        fail:    (e)   => { warn('getUserCloudStorage', e); onFail && onFail(e) },
      })
    } catch (e) { warn('getUserCloudStorage', e); onFail && onFail(e) }
  },
  call(name, data, onSuccess, onFail) {
    try {
      wx.cloud.callFunction({
        name,
        data,
        success: (res) => onSuccess && onSuccess(res.result),
        fail:    (e)   => { warn('callFunction:' + name, e); onFail && onFail(e) },
      })
    } catch (e) { warn('callFunction:' + name, e); onFail && onFail(e) }
  },
}

// ── 激励视频广告 ──
export const ad = {
  createRewarded(adUnitId) {
    if (!adUnitId) return null
    try {
      const inst = wx.createRewardedVideoAd({ adUnitId })
      return {
        show() {
          return new Promise((resolve) => {
            const onClose = (res) => {
              inst.offClose(onClose)
              resolve(!!(res && res.isEnded))
            }
            inst.onClose(onClose)
            inst.onError((e) => { warn('rewardedVideoAd.onError', e); resolve(false) })
            inst.show().catch((e) => { warn('rewardedVideoAd.show', e); resolve(false) })
          })
        }
      }
    } catch (e) { warn('createRewardedVideoAd', e); return null }
  },
}
