// ============================================================
// 语音播报（用手机自带的中文语音，不需要联网）
// iPhone 规定：第一次播报必须由点按触发，所以“开始导航”按钮里先调用 unlockSpeech()
// ============================================================

// 浏览器是否支持语音
export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

// 存储“是否开启语音”的键名
const KEY = 'noel-nav-voice'

// 读取语音开关（默认开启）
export function getVoiceOn(): boolean {
  try {
    // 只有明确存了 '0' 才算关闭
    return localStorage.getItem(KEY) !== '0'
  } catch {
    // 读不到就默认开启
    return true
  }
}

// 保存语音开关
export function setVoiceOn(on: boolean) {
  try {
    // 存成 '1' 或 '0'
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // 存不了就算了
  }
}

// 找一个中文语音（找不到就用系统默认）
function chineseVoice(): SpeechSynthesisVoice | undefined {
  // 所有可用语音
  const voices = window.speechSynthesis.getVoices()
  // 优先普通话（中国大陆），其次任何中文
  return voices.find((v) => v.lang === 'zh-CN') ?? voices.find((v) => v.lang.startsWith('zh'))
}

// 播报一句话（会打断正在播报的上一句）
export function speak(text: string) {
  // 不支持就跳过
  if (!speechSupported) return
  // 停掉上一句
  window.speechSynthesis.cancel()
  // 新建一句话
  const u = new SpeechSynthesisUtterance(text)
  // 中文
  u.lang = 'zh-CN'
  // 有中文语音就用它
  const v = chineseVoice()
  if (v) u.voice = v
  // 语速稍快一点
  u.rate = 1.05
  // 开始播报
  window.speechSynthesis.speak(u)
}

// 在点按事件里调用一次，让 iPhone 允许之后自动播报
export function unlockSpeech(text = '开始导航') {
  // 不支持就跳过
  if (!speechSupported) return
  // 播一句开场白
  speak(text)
}

// 停止播报
export function stopSpeech() {
  // 不支持就跳过
  if (!speechSupported) return
  // 停止
  window.speechSynthesis.cancel()
}
