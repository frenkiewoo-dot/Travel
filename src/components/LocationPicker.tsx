// ============================================================
// 选位置：搜索地址，或者在小地图上点一下 / 拖动图钉
// 用在“自己添加酒店景点”和“添加城市”的表单里
//   - localKm 有值（酒店景点表单）：只搜城市方圆 localKm 公里，按距离排序；找不到时可以搜索全部地区或去 Google Maps
//   - localKm 不传（添加城市）：搜索全部地区
// ============================================================

// 引入 React 钩子
import { useEffect, useRef, useState } from 'react'
// 引入地图钩子
import { useMap } from '../map/useMap'
// 引入图钉标记
import { pinMarker } from '../map/markers'
// 引入搜索
import { bboxAround, distanceText, googleMapsSearchUrl, reverseGeocode, searchPlaces, type SearchResult } from '../lib/search'
// 引入坐标类型
import type { LngLat } from '../lib/geo'
// 引入图标
import { Icon } from './Icon'
// 引入输入框样式
import { INPUT } from './Sheet'

// 选中的位置
export interface PickedLocation {
  // 坐标
  lngLat: LngLat
  // 搜索结果的名字（在地图上点的没有）
  name?: string
  // 地址
  address?: string
  // 国家代码
  countryCode?: string
}

// 选位置组件
export function LocationPicker({
  value,
  near,
  zoom = 13,
  onChange,
  placeholder = '搜索地址或地名',
  localKm,
}: {
  // 当前位置
  value: LngLat | null
  // 搜索时优先附近（通常是城市中心），也是地图初始中心
  near: LngLat
  // 地图初始缩放
  zoom?: number
  // 位置变化时回调
  onChange: (loc: PickedLocation) => void
  // 搜索框提示文字
  placeholder?: string
  // 只搜中心方圆多少公里（不传 = 全部地区）
  localKm?: number
}) {
  // 是否扩大到全部地区（只在限定范围时有用）
  const [searchAll, setSearchAll] = useState(false)
  // 搜索关键词
  const [query, setQuery] = useState('')
  // 搜索结果
  const [results, setResults] = useState<SearchResult[]>([])
  // 是否正在搜索
  const [searching, setSearching] = useState(false)
  // 小地图（初始中心：已有位置或城市中心）
  const { containerRef, map } = useMap({ center: value ?? near, zoom: value ? 15 : zoom })
  // 最新的回调（地图事件里用）
  const onChangeRef = useRef(onChange)
  // 每次渲染更新
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // 搜索（停止输入 0.45 秒后）
  useEffect(() => {
    // 太短不搜
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    // 用来取消过时的请求
    const ctrl = new AbortController()
    // 延迟执行
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        // 搜索：限定范围时只搜城市附近
        setResults(await searchPlaces(query, { near, bbox: localKm && !searchAll ? bboxAround(near, localKm) : null }, ctrl.signal))
      } catch {
        // 出错就清空
        if (!ctrl.signal.aborted) setResults([])
      } finally {
        if (!ctrl.signal.aborted) setSearching(false)
      }
    }, 450)
    // 取消
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, near, localKm, searchAll])

  // 在地图上点一下：设为位置，并查地址
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 点击
    const onClick = async (e: { lngLat: { lng: number; lat: number } }) => {
      // 坐标
      const ll: LngLat = [e.lngLat.lng, e.lngLat.lat]
      // 先回调坐标
      onChangeRef.current({ lngLat: ll })
      // 再查地址
      const addr = await reverseGeocode(ll)
      // 查到了再回调一次
      if (addr) onChangeRef.current({ lngLat: ll, address: addr })
    }
    // 注册
    map.on('click', onClick)
    // 取消
    return () => {
      map.off('click', onClick)
    }
  }, [map])

  // 位置变化：显示可拖动的图钉
  useEffect(() => {
    // 地图没好或没有位置
    if (!map || !value) return
    // 图钉（拖完更新位置）
    const m = pinMarker('', '位置', {
      draggable: true,
      onDragEnd: async (ll) => {
        // 回调新坐标
        onChangeRef.current({ lngLat: ll })
        // 查地址
        const addr = await reverseGeocode(ll)
        // 查到了再回调
        if (addr) onChangeRef.current({ lngLat: ll, address: addr })
      },
    })
      .setLngLat(value)
      .addTo(map)
    // 移除
    return () => {
      m.remove()
    }
  }, [map, value])

  // 选中一个搜索结果
  const choose = (r: SearchResult) => {
    // 回调
    onChange({ lngLat: r.lngLat, name: r.name, address: r.address, countryCode: r.countryCode })
    // 清空搜索
    setQuery('')
    setResults([])
    // 地图飞过去
    map?.flyTo({ center: r.lngLat, zoom: 15.5, duration: 1200 })
  }

  // 返回组件
  return (
    <div>
      {/* 搜索框 */}
      <div className="relative">
        {/* 放大镜 */}
        <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        {/* 输入框 */}
        <input
          type="search"
          aria-label="搜索位置"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchAll(false)
          }}
          placeholder={placeholder}
          className={`${INPUT} pl-9`}
        />
      </div>
      {/* 搜索结果 */}
      {query.trim().length >= 2 && (
        <div className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-line">
          {/* 搜索中 */}
          {searching && results.length === 0 && <p className="px-3 py-2 text-[13px] text-muted">正在搜索…</p>}
          {/* 没结果：说明，并给出下一步 */}
          {!searching && results.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-muted">
              {localKm && !searchAll ? `这个城市附近没有找到。` : '没有找到。'}可以直接在下面小地图上点选位置，或者：
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                {localKm && !searchAll && (
                  <button type="button" onClick={() => setSearchAll(true)} className="text-accent underline underline-offset-2">
                    搜索全部地区
                  </button>
                )}
                <a href={googleMapsSearchUrl(query, near)} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                  在 Google Maps 里搜
                </a>
              </span>
            </div>
          )}
          {/* 结果 */}
          {results.map((r) => (
            <button key={r.id} type="button" onClick={() => choose(r)} className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0">
              {/* 名称 */}
              <span className="block truncate text-[14px]">
                {r.name}
                {r.kind && <span className="ml-1.5 text-[12px] text-muted">{r.kind}</span>}
              </span>
              {/* 地址 + 距离 */}
              <span className="block truncate text-[12px] text-muted">
                {localKm && r.distance !== undefined && <span className="tabular-nums">{distanceText(r.distance)} · </span>}
                {r.address}
              </span>
            </button>
          ))}
        </div>
      )}
      {/* 小地图 */}
      <div className="relative mt-2 h-44 overflow-hidden rounded-xl border border-line">
        {/* 地图容器 */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="h-full w-full" />
        </div>
        {/* 提示 */}
        <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-glass px-2.5 py-1 text-[11px] text-muted">
          {value ? '可以拖动图钉微调位置' : '在地图上点一下选择位置'}
        </span>
      </div>
    </div>
  )
}
