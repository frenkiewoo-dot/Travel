// ============================================================
// iPhone「添加到主屏幕」后全屏打开时的高度修正
//   问题：状态栏设成透明（内容延伸到状态栏下面）时，iPhone 给网页的高度会少掉状态栏那一截，
//         App 从屏幕最顶上开始画，所以最下面会空出一条（大约状态栏的高度）
//   解决：在 iPhone 全屏模式下，用屏幕的真实高度作为 App 高度，写进 CSS 变量 --app-h
//         （Safari 网页里、安卓、电脑上不受影响，还是用原来的 100%）
// ============================================================

// 是不是 iPhone / iPad 主屏幕全屏模式
function isIosStandalone(): boolean {
  // Safari 独有的 navigator.standalone：从主屏幕打开时是 true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// 算出并写入 App 高度
function apply() {
  // 不是 iPhone 全屏模式：不用改
  if (!isIosStandalone()) return
  // 竖屏用屏幕高度，横屏用屏幕宽度（iPhone 的 screen 尺寸不随旋转变化）
  const portrait = window.matchMedia('(orientation: portrait)').matches
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
  // 取网页高度和屏幕高度里大的那个（万一以后 iPhone 修好了这个问题，也不会变矮）
  const h = Math.max(full, window.innerHeight)
  // 写进 CSS 变量
  document.documentElement.style.setProperty('--app-h', `${h}px`)
  // 标记全屏模式（CSS 用它让弹出面板等以 App 为准，铺满整个屏幕）
  document.documentElement.classList.add('ios-standalone')
}

// 启动时设置，转屏和尺寸变化时更新
export function setupAppHeight() {
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', () => setTimeout(apply, 300))
}
