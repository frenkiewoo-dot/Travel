// ============================================================
// 地图上的标记：城市、景点、日程编号、我的位置
// 标记是普通的网页元素（DOM），样式写在 styles/index.css 里
// ============================================================

// 引入 MapLibre
import * as maplibregl from 'maplibre-gl'
// 引入 React 钩子
import { useEffect, useRef } from 'react'
// 引入坐标类型
import type { LngLat } from '../lib/geo'

// 创建城市标记（圆点 + 城市名）
export function cityMarker(name: string, isHome: boolean, onClick: () => void): maplibregl.Marker {
  // 外层元素（做成按钮，方便读屏和键盘操作）
  const el = document.createElement('button')
  // 样式类：家用实心圆点
  el.className = `city-marker${isHome ? ' home' : ''}`
  // 读屏文字
  el.setAttribute('aria-label', `查看 ${name}`)
  // 去掉按钮默认样式
  el.style.background = 'none'
  el.style.border = '0'
  el.style.padding = '0'
  // 圆点
  const dot = document.createElement('span')
  dot.className = 'dot'
  // 城市名
  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = name
  // 放进外层
  el.append(dot, label)
  // 点击事件（阻止事件传到地图上）
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  // 创建标记：锚点在左边（圆点对准城市坐标）
  return new maplibregl.Marker({ element: el, anchor: 'left', offset: [-7, 0] })
}

// 创建景点标记（金色名字 + 小菱形）
export function poiMarker(name: string, onClick?: () => void): maplibregl.Marker {
  // 外层元素
  const el = document.createElement('button')
  // 样式类
  el.className = 'poi-marker'
  // 读屏文字
  el.setAttribute('aria-label', name)
  // 去掉按钮默认样式
  el.style.background = 'none'
  el.style.border = '0'
  el.style.padding = '0'
  // 名字
  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = name
  // 小菱形
  const pin = document.createElement('span')
  pin.className = 'pin'
  // 放进外层
  el.append(label, pin)
  // 点击事件
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick?.()
  })
  // 锚点在底部（菱形尖端对准景点）
  return new maplibregl.Marker({ element: el, anchor: 'bottom' })
}

// 创建日程编号标记（圆形数字 + 右侧地名）
export function stopMarker(label: string, name: string, isStart: boolean, onClick?: () => void): maplibregl.Marker {
  // 外层元素
  const el = document.createElement('button')
  // 样式类：起点用深色
  el.className = `stop-wrap${isStart ? ' is-start' : ''}`
  // 读屏文字
  el.setAttribute('aria-label', isStart ? `起点：${name}` : `第 ${label} 站：${name}`)
  // 圆形编号
  const num = document.createElement('span')
  num.className = 'stop-marker'
  num.textContent = label
  // 地名
  const text = document.createElement('span')
  text.className = 'stop-label'
  text.textContent = name
  // 放进外层
  el.append(num, text)
  // 点击事件
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick?.()
  })
  // 锚点在左边，偏移半个圆，让圆心对准坐标
  return new maplibregl.Marker({ element: el, anchor: 'left', offset: [-14, 0] })
}

// 钩子：在地图上显示“我的位置”蓝点，位置变化时移动它
export function useMeMarker(map: maplibregl.Map | null, position: LngLat | null) {
  // 保存蓝点标记
  const markerRef = useRef<maplibregl.Marker | null>(null)
  // 位置或地图变化时更新
  useEffect(() => {
    // 地图没好或者还没有位置
    if (!map || !position) return
    // 第一次：创建蓝点
    if (!markerRef.current) {
      // 蓝点元素
      const el = document.createElement('div')
      el.className = 'me-marker'
      // 读屏文字
      el.setAttribute('aria-label', '我的位置')
      // 创建标记并加到地图
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat(position).addTo(map)
    } else {
      // 之后：只移动位置
      markerRef.current.setLngLat(position)
    }
  }, [map, position])
  // 离开页面时移除蓝点
  useEffect(() => {
    return () => {
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [map])
}
