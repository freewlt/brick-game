// 伪随机工具（LCG，只依赖种子，不用 Math.random）
// 用于每日挑战关卡生成和游戏棋盘洗牌，保证相同种子产生相同序列。
export function seededRng(seed) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xFFFFFFFF
  }
}
