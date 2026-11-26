// ============================================================
// 长按地图上的路线：按住约 0.6 秒，手指下面出现一个慢慢转满的圆圈，转满就打开那段交通
//   - 手机：手指按住；电脑：按住鼠标左键
//   - 按住时移动超过 10 像素（在拖地图）就取消
//   - 鼠标移到路线上时变成小手
// ============================================================

// 引入 React 钩子
import { useEffect, useRef, useState } from 'react'
// 引入 MapLibre 类型
import type { Map as MLMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl'

// 按住多久算长按（毫秒）
export const LONG_PRESS_MS = 600

// 正在长按的状态：位置（相对地图左上角）和是哪一段
export interface PressState {
  x: number
  y: number
  segId: string
  // 已经转满，正在打开
  firing: boolean
}

// 长按路线的钩子；layerId 是能点中的图层（看不见的粗线），onFire 收到交通段 ID
export function useRouteLongPress(map: MLMap | null, layerId: string, onFire: (segId: string) => void): PressState | null {
  // 当前状态（给界面画圆圈）
  const [press, setPress] = useState<PressState | null>(null)
  // 最新的回调
  const fireRef = useRef(onFire)
  fireRef.current = onFire

  useEffect(() => {
    // 地图没好
    if (!map) return
    // 计时器
    let timer: ReturnType<typeof setTimeout> | null = null
    // 按下的位置
    let start: { x: number; y: number } | null = null
    // 取消
    const cancel = () => {
      if (timer) clearTimeout(timer)
      timer = null
      start = null
      setPress((p) => (p?.firing ? p : null))
    }
    // 按下：看看按在不在路线上
    const down = (e: MapMouseEvent | MapTouchEvent) => {
      // 鼠标只认左键；手指只认一根
      const oe = e.originalEvent as MouseEvent | TouchEvent
      if ('button' in oe && oe.button !== 0) return
      if ('touches' in oe && oe.touches.length !== 1) return cancel()
      // 图层还没画好
      if (!map.getLayer(layerId)) return
      // 按到的路线
      const f = map.queryRenderedFeatures(e.point, { layers: [layerId] })[0]
      const segId = f?.properties?.segId as string | undefined
      if (!segId) return
      // 开始计时
      start = { x: e.point.x, y: e.point.y }
      setPress({ x: e.point.x, y: e.point.y, segId, firing: false })
      timer = setTimeout(() => {
        timer = null
        // 手机轻轻震一下（支持的话）
        navigator.vibrate?.(15)
        setPress({ x: start!.x, y: start!.y, segId, firing: true })
        // 稍等一下让“正在打开”显示出来
        setTimeout(() => fireRef.current(segId), 250)
      }, LONG_PRESS_MS)
    }
    // 移动：动得太多（在拖地图）就取消
    const move = (e: MapMouseEvent | MapTouchEvent) => {
      if (!start) return
      if (Math.hypot(e.point.x - start.x, e.point.y - start.y) > 10) cancel()
    }
    // 鼠标移到路线上：变成小手
    const enter = () => (map.getCanvas().style.cursor = 'pointer')
    const leave = () => (map.getCanvas().style.cursor = '')
    // 监听
    map.on('mousedown', down)
    map.on('touchstart', down)
    map.on('mousemove', move)
    map.on('touchmove', move)
    map.on('mouseup', cancel)
    map.on('touchend', cancel)
    map.on('touchcancel', cancel)
    map.on('dragstart', cancel)
    map.on('zoomstart', cancel)
    map.on('mouseenter', layerId, enter)
    map.on('mouseleave', layerId, leave)
    // 取消监听
    return () => {
      cancel()
      map.off('mousedown', down)
      map.off('touchstart', down)
      map.off('mousemove', move)
      map.off('touchmove', move)
      map.off('mouseup', cancel)
      map.off('touchend', cancel)
      map.off('touchcancel', cancel)
      map.off('dragstart', cancel)
      map.off('zoomstart', cancel)
      map.off('mouseenter', layerId, enter)
      map.off('mouseleave', layerId, leave)
    }
  }, [map, layerId])

  // 返回
  return press
}
