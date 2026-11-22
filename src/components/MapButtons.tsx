// ============================================================
// 浮在地图右侧的圆形按钮：指南针、2D/3D 切换、回到我的位置
// ============================================================

// 引入 MapLibre 类型
import type { Map as MLMap } from 'maplibre-gl'
// 引入 React 钩子
import { useEffect, useState } from 'react'
// 引入图标
import { Icon } from './Icon'
// 引入坐标类型
import type { LngLat } from '../lib/geo'

// 圆形按钮的公共样式：44 像素（手指好点）、半透明卡片底、细描边、轻阴影
const ROUND = 'flex h-11 w-11 items-center justify-center rounded-full border border-line bg-glass text-ink shadow-[0_2px_10px_var(--shadow)] backdrop-blur'

// 按钮组组件
export function MapButtons({
  map,
  me,
  onLocate,
  className = '',
}: {
  // 地图实例
  map: MLMap | null
  // 我的位置（没有就是 null）
  me: LngLat | null
  // 点“定位”但还没有位置时，调用它开始定位
  onLocate: () => void
  // 额外样式（用来定位按钮组）
  className?: string
}) {
  // 地图当前旋转角度（指南针跟着转）
  const [bearing, setBearing] = useState(0)
  // 地图当前倾斜角度
  const [pitch, setPitch] = useState(0)

  // 监听地图的旋转和倾斜
  useEffect(() => {
    // 地图还没好
    if (!map) return
    // 更新角度
    const update = () => {
      // 旋转角度
      setBearing(map.getBearing())
      // 倾斜角度
      setPitch(map.getPitch())
    }
    // 先更新一次
    update()
    // 地图移动时更新
    map.on('move', update)
    // 离开时取消监听
    return () => {
      map.off('move', update)
    }
  }, [map])

  // 是否处于 3D（倾斜）状态
  const is3D = pitch > 10

  // 返回按钮组
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* 指南针：地图转了才显示，点一下回正北 */}
      {(Math.abs(bearing) > 1 || is3D) && (
        <button
          // 读屏文字
          aria-label="回到正北方向"
          // 样式
          className={ROUND}
          // 点击：回正北
          onClick={() => map?.easeTo({ bearing: 0, duration: 600 })}
        >
          {/* 图标随地图旋转反向转动，始终指向北 */}
          <span style={{ transform: `rotate(${-bearing}deg)` }} className="inline-flex text-accent">
            <Icon name="compass" size={20} />
          </span>
        </button>
      )}
      {/* 2D / 3D 切换 */}
      <button
        // 读屏文字
        aria-label={is3D ? '切换到平面地图' : '切换到 3D 视角'}
        // 样式
        className={`${ROUND} text-[11px] font-semibold`}
        // 点击：在平面和倾斜 60 度之间切换
        onClick={() => map?.easeTo({ pitch: is3D ? 0 : 60, duration: 800 })}
      >
        {/* 显示要切换到的模式 */}
        {is3D ? '2D' : '3D'}
      </button>
      {/* 回到我的位置 */}
      <button
        // 读屏文字
        aria-label="回到我的位置"
        // 样式，图标用定位蓝
        className={`${ROUND} text-locate`}
        // 点击
        onClick={() => {
          // 有位置：飞过去
          if (me) map?.flyTo({ center: me, zoom: Math.max(map.getZoom(), 15), duration: 1600 })
          // 没位置：开始定位
          else onLocate()
        }}
      >
        {/* 定位图标 */}
        <Icon name="locate" size={20} />
      </button>
    </div>
  )
}
