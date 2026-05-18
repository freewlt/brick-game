// 当前运行环境统一入口。
// develop → 开发版，trial → 体验版，release → 正式版。

export function getEnvVersion() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || 'release'
  } catch (e) {
    return 'release'
  }
}

// 用于隔离本地 storage key。正式版不加前缀，兼容已有玩家数据。
export function getEnvPrefix(envVersion = getEnvVersion()) {
  if (envVersion === 'develop') return 'dev_'
  if (envVersion === 'trial') return 'trial_'
  return ''
}
