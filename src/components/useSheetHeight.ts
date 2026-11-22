// ============================================================
// 测量底部卡片的高度，写进父元素的 CSS 变量 --sheet-h
// 这样浮在地图上的按钮、版权信息可以始终待在卡片上方
// 用法：const sheetRef = useSheetHeight()，然后 <section ref={sheetRef}>
// （是“回调 ref”：卡片换成别的元素时也会自动重新测量）
// ============================================================

// 引入 React 钩子
import { useCallback, useRef } from 'react'

// 返回一个回调 ref，绑定到底部卡片上即可
export function useSheetHeight<T extends HTMLElement>() {
  // 当前的尺寸观察器
  const roRef = useRef<ResizeObserver | null>(null)
  // 元素出现或更换时调用
  return useCallback((el: T | null) => {
    // 先停止观察旧元素
    roRef.current?.disconnect()
    roRef.current = null
    // 元素消失了
    if (!el) return
    // 观察新元素的尺寸变化
    const ro = new ResizeObserver(() => {
      // 把高度写到父元素上（父元素里的所有东西都能用这个变量）
      el.parentElement?.style.setProperty('--sheet-h', `${el.offsetHeight}px`)
    })
    // 开始观察
    ro.observe(el)
    // 记下来
    roRef.current = ro
  }, [])
}
