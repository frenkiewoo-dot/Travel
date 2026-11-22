// ============================================================
// 屏幕常亮：导航时不让手机自动锁屏（iPhone 需要 iOS 16.4 以上）
// ============================================================

// 引入 React 钩子
import { useEffect } from 'react'

// active = true 时保持屏幕常亮
export function useWakeLock(active: boolean) {
  // active 变化时执行
  useEffect(() => {
    // 不需要常亮，或者浏览器不支持
    if (!active || !('wakeLock' in navigator)) return
    // 当前的常亮锁
    let lock: WakeLockSentinel | null = null
    // 是否已经结束
    let stopped = false
    // 申请常亮
    const request = async () => {
      try {
        // 申请屏幕常亮
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // 申请失败（例如省电模式），忽略
      }
    }
    // 切回 App 时重新申请（切到后台时系统会自动释放）
    const onVisible = () => {
      // 页面可见并且还在导航
      if (document.visibilityState === 'visible' && !stopped) request()
    }
    // 先申请一次
    request()
    // 监听切换
    document.addEventListener('visibilitychange', onVisible)
    // 结束时释放
    return () => {
      // 标记结束
      stopped = true
      // 取消监听
      document.removeEventListener('visibilitychange', onVisible)
      // 释放常亮
      lock?.release().catch(() => {})
    }
  }, [active])
}
