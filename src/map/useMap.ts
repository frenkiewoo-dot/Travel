// ============================================================
// 地图钩子：在一个 div 里创建 MapLibre 地图
//   - 自动套用奶油风样式（深色模式时切换深色样式）
//   - 每次样式加载完成，styleRev 加 1，页面据此重新添加路线等图层
// ============================================================

// 引入 MapLibre 地图引擎
import * as maplibregl from 'maplibre-gl'
// 引入地图引擎的“后台线程”文件地址（负责解析地图数据，不卡界面）
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
// 引入 React 钩子
import { useEffect, useRef, useState } from 'react'
// 引入样式生成函数
import { buildMapStyle, offlineFallbackStyle } from './mapStyle'
// 引入主题钩子
import { useTheme } from '../lib/theme'

// 告诉地图引擎后台线程文件在哪（Vite 打包后文件名会带哈希，所以要这样引用）
maplibregl.setWorkerUrl(workerUrl)

// 创建地图时的选项
export interface UseMapOptions {
  // 初始显示范围 [[西, 南], [东, 北]]（和 center/zoom 二选一）
  bounds?: [[number, number], [number, number]]
  // 显示范围四周留白（像素），给浮在地图上的按钮和卡片留位置
  padding?: { top: number; bottom: number; left: number; right: number }
  // 初始中心点
  center?: [number, number]
  // 初始缩放级别
  zoom?: number
}

// 地图钩子：返回的 containerRef 要绑定到放地图的 div 上
// （用“回调 ref”：div 真正出现在页面上时才创建地图，页面先显示“加载中”也没关系）
export function useMap(options: UseMapOptions) {
  // 放地图的 div（还没出现时是 null）
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  // 地图实例（创建好之前是 null）
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  // 样式版本号：每次样式加载完成 +1
  const [styleRev, setStyleRev] = useState(0)
  // 地图样式是否加载失败（离线且没有缓存）
  const [offline, setOffline] = useState(false)
  // 当前主题
  const theme = useTheme()
  // 记住创建时的主题，避免重复切换
  const themeRef = useRef(theme)
  // 记住初始选项（只在创建时用一次）
  const optionsRef = useRef(options)

  // 创建地图（容器出现后执行一次）
  useEffect(() => {
    // 容器还没出现，先不创建
    if (!container) return
    // 页面已经离开时用来中止
    let cancelled = false
    // 地图实例
    let instance: maplibregl.Map | null = null
    // 异步创建
    ;(async () => {
      // 先准备样式
      let style
      try {
        // 正常情况：下载并改造样式
        style = await buildMapStyle(themeRef.current)
      } catch {
        // 下载失败：用极简离线样式
        style = offlineFallbackStyle(themeRef.current)
        // 标记离线
        if (!cancelled) setOffline(true)
      }
      // 页面已经离开，或者容器不存在，就不创建了
      if (cancelled || !container) return
      // 初始选项
      const o = optionsRef.current
      // 创建地图
      instance = new maplibregl.Map({
        // 放在哪个 div 里
        container,
        // 样式
        style,
        // 初始中心
        center: o.center ?? [10, 53.5],
        // 初始缩放
        zoom: o.zoom ?? 5,
        // 初始范围（有的话优先）
        bounds: o.bounds,
        // 范围留白
        fitBoundsOptions: o.padding ? { padding: o.padding } : undefined,
        // 最大倾斜角度（越大越像从侧面看）
        maxPitch: 72,
        // 不显示默认的版权控件（下面自己加一个紧凑版）
        attributionControl: false,
        // 不在 URL 里记录位置
        hash: false,
        // 双指旋转地图
        touchZoomRotate: true,
        // 双指上下滑动来倾斜地图
        touchPitch: true,
        // 拖动旋转（电脑上用右键）
        dragRotate: true,
      })
      // 加一个紧凑的版权信息（地图数据来自 OpenStreetMap，必须注明）
      instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
      // 地图加载完后把版权信息收起成一个小 “i” 图标（点一下可以展开）
      instance.once('load', () => {
        // 找到版权信息元素
        const attrib = container.querySelector('.maplibregl-ctrl-attrib')
        // 去掉“展开”状态
        attrib?.classList.remove('maplibregl-compact-show')
      })
      // 每次样式加载完成，版本号 +1
      instance.on('style.load', () => setStyleRev((r) => r + 1))
      // 调试用：网址带 ?debug 时，把地图挂到 window.__map 上，方便在浏览器控制台检查
      if (location.search.includes('debug')) (window as unknown as { __map?: maplibregl.Map }).__map = instance
      // 交给 React 状态
      setMap(instance)
    })()
    // 离开页面时
    return () => {
      // 标记取消
      cancelled = true
      // 销毁地图，释放内存
      instance?.remove()
    }
  }, [container])

  // 主题变化时切换地图样式
  useEffect(() => {
    // 地图还没创建，或者主题没变，就什么都不做
    if (!map || themeRef.current === theme) return
    // 记住新主题
    themeRef.current = theme
    // 生成新样式并套用
    buildMapStyle(theme)
      // 成功就切换（diff: false 表示整个重建，之后 style.load 会触发，页面会重新加图层）
      .then((style) => map.setStyle(style, { diff: false }))
      // 失败（离线）就保持原样
      .catch(() => {})
  }, [map, theme])

  // 返回：容器 ref、地图实例、样式版本号、是否离线
  return { containerRef: setContainer, map, styleRev, offline }
}
