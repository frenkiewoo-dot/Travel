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

// 水滴形图钉的 SVG（34×42，尖端在底部中间）
const PIN_SVG =
  '<svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path d="M17 40.5S3.5 28.6 3.5 17a13.5 13.5 0 1127 0c0 11.6-13.5 23.5-13.5 23.5z" /></svg>'

// 创建图钉标记（带编号，可以拖动）
export function pinMarker(
  label: string,
  name: string,
  opts: { draggable?: boolean; selected?: boolean; onClick?: () => void; onDragEnd?: (lngLat: LngLat) => void } = {},
): maplibregl.Marker {
  // 外层元素
  const el = document.createElement('button')
  // 样式类：选中时颜色加深
  el.className = `pin-marker${opts.selected ? ' is-selected' : ''}`
  // 读屏文字
  el.setAttribute('aria-label', `图钉 ${label}：${name}`)
  // 水滴形状 + 编号
  el.innerHTML = `${PIN_SVG}<span class="num"></span>`
  // 写入编号（用 textContent 避免特殊字符出问题）
  el.querySelector('.num')!.textContent = label
  // 点击事件
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    opts.onClick?.()
  })
  // 创建标记：尖端（底部）对准坐标
  const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: opts.draggable ?? false })
  // 拖动结束时回调新位置
  if (opts.onDragEnd) {
    marker.on('dragend', () => {
      // 新坐标
      const ll = marker.getLngLat()
      // 回调
      opts.onDragEnd!([ll.lng, ll.lat])
    })
  }
  // 返回
  return marker
}

// 床的图标（酒店）
const BED_PATH = 'M3 18V7M3 14h18v4M21 14v-2a3 3 0 00-3-3h-7v5M6.5 11.5a1.5 1.5 0 100-.01'
// 星星图标（景点）
const STAR_PATH = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z'

// 创建城市地图上的地点标记：酒店是圆角方块 + 床，景点是金色圆圈 + 星星
// chosen = 已选定或已预订：变大、变成酒红色，并显示名字
export function placeMarker(name: string, isHotel: boolean, chosen: boolean, onClick?: () => void): maplibregl.Marker {
  // 外层元素
  const el = document.createElement('button')
  // 样式类
  el.className = `place-marker ${isHotel ? 'hotel' : 'attraction'}${chosen ? ' is-chosen' : ''}`
  // 读屏文字
  el.setAttribute('aria-label', `${isHotel ? '住宿' : '地点'}：${name}`)
  // 图标
  const ico = document.createElement('span')
  ico.className = 'ico'
  ico.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${isHotel ? BED_PATH : STAR_PATH}"/></svg>`
  // 名字
  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = name
  // 放进外层
  el.append(ico, label)
  // 点击
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick?.()
  })
  // 锚点：图标中心对准坐标（名字在右边）
  return new maplibregl.Marker({ element: el, anchor: 'left', offset: [chosen ? -18 : -15, 0] })
}
