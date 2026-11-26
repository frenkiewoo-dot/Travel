// ============================================================
// 横向列表的“拖动滑动”：
//   - 手机上本来就能用手指左右滑
//   - 电脑上：按住鼠标左右拖动；鼠标滚轮上下滚也会让列表左右移动
//   - 拖动后松开不会误点到卡片
// 用法：const ref = useDragScroll<HTMLDivElement>()，然后 <div ref={ref} className="overflow-x-auto ...">
//   （返回的是“回调 ref”：列表晚一点才显示出来也能正常工作）
// ============================================================

// 引入 React 钩子
import { useCallback, useRef } from 'react'

// 拖动滑动钩子
export function useDragScroll<T extends HTMLElement>() {
  // 取消上一个元素的监听
  const cleanup = useRef<(() => void) | null>(null)

  // 元素出现 / 消失时调用
  return useCallback((el: T | null) => {
    // 先取消旧的
    cleanup.current?.()
    cleanup.current = null
    // 元素消失了
    if (!el) return
    // 按下时的位置和滚动位置
    let startX = 0
    let startScroll = 0
    // 是否按着鼠标
    let pressed = false
    // 是否真的拖动了（拖动了就不算点击）
    let moved = false
    // 原来的吸附设置（拖动时先关掉，松开再恢复）
    let snap = ''

    // 按下（只处理鼠标；手指交给浏览器自己滑）
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      pressed = true
      moved = false
      startX = e.clientX
      startScroll = el.scrollLeft
    }
    // 移动
    const onMove = (e: PointerEvent) => {
      if (!pressed) return
      // 移动距离
      const dx = e.clientX - startX
      // 超过 4 像素才算拖动
      if (!moved && Math.abs(dx) > 4) {
        moved = true
        // 拖动时关掉吸附，跟手
        snap = el.style.scrollSnapType
        el.style.scrollSnapType = 'none'
        el.style.cursor = 'grabbing'
      }
      // 跟着鼠标滚动
      if (moved) el.scrollLeft = startScroll - dx
    }
    // 松开
    const onUp = () => {
      if (!pressed) return
      pressed = false
      if (moved) {
        // 恢复吸附（浏览器会自动对齐到最近的卡片）
        el.style.scrollSnapType = snap
        el.style.cursor = ''
      }
    }
    // 拖动后松开时会触发一次点击：拦下来
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
        moved = false
      }
    }
    // 鼠标滚轮：上下滚动变成左右移动（列表能横向滚动时）
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      // 到头了就让页面正常滚
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0
      if (atStart || atEnd) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    // 拖图片时浏览器会自己拖出一个图片影子：禁止
    const onDragStart = (e: DragEvent) => e.preventDefault()

    // 监听
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('click', onClick, true)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('dragstart', onDragStart)
    // 记下取消监听的方法
    cleanup.current = () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('dragstart', onDragStart)
    }
  }, [])
}
