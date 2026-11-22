// ============================================================
// 地图标签：自由探索
//   - 顶部搜索框：搜店铺、景点、地址
//   - 放图钉：把右边的图钉拖到地图上 / 长按地图 / 点搜索结果或地图上的店铺
//   - 图钉可以拖动、改名、调整顺序、删除，自动连成步行路线
//   - 开始导航（App 内）或交给 Google Maps
//   - 网址带 ?day=3 时，编辑的是旅途第 3 天的日程
// ============================================================

// 引入 React 钩子
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
// 引入路由工具
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
// 引入 MapLibre 类型
import type * as maplibregl from 'maplibre-gl'
// 引入图钉数据
import { newId, usePins } from '../db/pins'
// 引入行程计算
import { useItinerary } from '../db/hooks'
// 引入数据结构
import type { DayPlanItem } from '../db/schema'
// 引入地图钩子
import { useMap } from '../map/useMap'
// 引入标记
import { pinMarker, poiMarker, useMeMarker } from '../map/markers'
// 引入步行路线绘制
import { drawWalkRoute } from '../map/walkRoute'
// 引入定位
import { useGeolocation } from '../lib/useGeolocation'
// 引入搜索
import { reverseGeocode, searchPlaces, type SearchResult } from '../lib/search'
// 引入步行路线
import { getWalkRoute, type WalkRoute } from '../lib/routing'
// 引入地理工具
import { boundsOf, formatDistance, formatDuration, optimizeOrder, type LngLat } from '../lib/geo'
// 引入 Google Maps 链接
import { googleMapsDirections } from '../lib/gmaps'
// 引入行程工具
import { dayLabel } from '../lib/itinerary'
// 引入图标
import { Icon, type IconName } from '../components/Icon'
// 引入地图按钮
import { MapButtons } from '../components/MapButtons'
// 引入卡片高度测量
import { useSheetHeight } from '../components/useSheetHeight'

// 拖图钉时，图钉画在手指上方多少像素（避免被手指挡住）
const GHOST_LIFT = 52

// 地图上被点中或搜到的地点
interface PickedPlace {
  // 名称
  name: string
  // 说明（类别、地址）
  detail: string
  // 坐标
  lngLat: LngLat
}

// 页面组件
export default function MapPage() {
  // 网址参数
  const [params] = useSearchParams()
  // 要编辑的天（没有就是草稿模式）
  const day = params.get('day') ? Number(params.get('day')) : null
  // 页面跳转
  const navigate = useNavigate()
  // 图钉数据
  const { pins, save, update, add, saveToDay, data } = usePins(day)
  // 每天概况
  const itin = useItinerary(data)
  // 地图
  const { containerRef, map, styleRev, offline } = useMap({ center: [13.405, 52.52], zoom: 12 })
  // 定位
  const geo = useGeolocation(true)
  // 显示我的位置
  useMeMarker(map, geo.position)

  // 搜索关键词
  const [query, setQuery] = useState('')
  // 搜索结果
  const [results, setResults] = useState<SearchResult[]>([])
  // 是否正在搜索
  const [searching, setSearching] = useState(false)
  // 搜索出错提示
  const [searchError, setSearchError] = useState<string | null>(null)
  // 是否显示搜索结果列表
  const [showResults, setShowResults] = useState(false)
  // 当前选中的地点（搜索结果或地图上点到的店铺）
  const [picked, setPicked] = useState<PickedPlace | null>(null)
  // 当前选中的图钉
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 正在改名的图钉
  const [editingId, setEditingId] = useState<string | null>(null)
  // 步行路线
  const [route, setRoute] = useState<WalkRoute | null>(null)
  // 底部卡片是否展开
  const [sheetOpen, setSheetOpen] = useState(false)
  // 拖图钉时的位置
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  // 是否显示“保存到日程”面板
  const [saveOpen, setSaveOpen] = useState(false)
  // 顶部小提示
  const [toast, setToast] = useState<string | null>(null)
  // 搜索框
  const inputRef = useRef<HTMLInputElement>(null)
  // 用户是否手动移动过地图（移动过就不再自动跳到我的位置）
  const userMovedRef = useRef(false)
  // 是否已经设置过初始视角
  const viewedRef = useRef(false)
  // 底部卡片（测量高度用）
  const sheetRef = useSheetHeight<HTMLElement>()

  // 当前编辑的那天
  const dayInfo = day && itin ? itin.days[day - 1] : null

  // 放一个新图钉；没给名字时用坐标自动取名
  const addPin = useCallback(
    async (ll: LngLat, name?: string) => {
      // 新图钉
      const pin: DayPlanItem = { id: newId(), name: name ?? '正在获取地名…', lat: ll[1], lng: ll[0], autoName: !name }
      // 保存
      await add(pin)
      // 选中新图钉
      setSelectedId(pin.id)
      // 没名字就去查地名
      if (!name) {
        // 查地名（没网时用“图钉”）
        const n = await reverseGeocode(ll)
        // 写回名字
        await update(pin.id, { name: n ?? '图钉' })
      }
    },
    [add, update],
  )
  // 给地图事件用的最新 addPin（事件只注册一次）
  const addPinRef = useRef(addPin)
  // 每次渲染更新
  useEffect(() => {
    addPinRef.current = addPin
  }, [addPin])

  // ----- 初始视角 -----
  useEffect(() => {
    // 地图或数据没好，或者已经设置过
    if (!map || pins === undefined || !itin || viewedRef.current) return
    // 标记已设置
    viewedRef.current = true
    // 有图钉：装下所有图钉
    if (pins.length > 0) {
      // 只有一个就飞过去
      if (pins.length === 1) map.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 15.5 })
      // 多个就装下全部
      else {
        // 计算视角
        const cam = map.cameraForBounds(boundsOf(pins.map((p) => [p.lng, p.lat] as LngLat)), { padding: { top: 140, bottom: 220, left: 50, right: 80 } })
        // 跳过去
        if (cam) map.jumpTo(cam)
      }
      return
    }
    // 没有图钉：显示那一天（或今天）所在的城市
    const stop = itin.days[(day ?? itin.todayIndex) - 1]?.stop
    // 跳过去
    if (stop) map.jumpTo({ center: [stop.lng, stop.lat], zoom: 13.5 })
  }, [map, pins, itin, day])

  // 草稿模式、没有图钉、用户没动过地图时，定位到了就跳到我的位置
  useEffect(() => {
    // 条件不满足
    if (!map || !geo.position || day || userMovedRef.current || (pins && pins.length > 0)) return
    // 标记为已移动（只跳一次）
    userMovedRef.current = true
    // 跳到我的位置
    map.jumpTo({ center: geo.position, zoom: 15 })
  }, [map, geo.position, day, pins])

  // ----- 搜索（停止输入 0.45 秒后再搜，节省请求） -----
  useEffect(() => {
    // 太短不搜
    if (query.trim().length < 2) {
      setResults([])
      setSearchError(null)
      return
    }
    // 用来取消过时的请求
    const ctrl = new AbortController()
    // 延迟执行
    const t = setTimeout(async () => {
      // 标记正在搜索
      setSearching(true)
      try {
        // 地图中心（让附近的结果排前面）
        const c = map?.getCenter()
        // 搜索
        const r = await searchPlaces(query, c ? [c.lng, c.lat] : null, ctrl.signal)
        // 保存结果
        setResults(r)
        // 清掉错误
        setSearchError(null)
      } catch {
        // 不是被取消的才提示错误
        if (!ctrl.signal.aborted) setSearchError('搜索失败，请检查网络')
      } finally {
        // 不是被取消的才结束加载状态
        if (!ctrl.signal.aborted) setSearching(false)
      }
    }, 450)
    // 关键词变化或离开页面时取消
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, map])

  // 选中一个搜索结果
  const chooseResult = (r: SearchResult) => {
    // 显示地点卡片
    setPicked({ name: r.name, detail: [r.kind, r.address].filter(Boolean).join(' · '), lngLat: r.lngLat })
    // 收起结果列表
    setShowResults(false)
    // 收起键盘
    inputRef.current?.blur()
    // 地图飞过去
    map?.flyTo({ center: r.lngLat, zoom: 16.5, pitch: 45, duration: 1600 })
  }

  // ----- 地图上的交互：长按放图钉、点店铺、点空白处 -----
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 长按计时器
    let timer: number | undefined
    // 手指按下的位置
    let start: { x: number; y: number } | null = null
    // 最近一次触摸的时间（触屏长按时浏览器还会额外发一个“右键菜单”事件，用它来忽略）
    let lastTouch = 0
    // 取消长按
    const cancel = () => {
      // 清掉计时器
      window.clearTimeout(timer)
      timer = undefined
      start = null
    }
    // 手指按下
    const onTouchStart = (e: maplibregl.MapTouchEvent) => {
      // 记录触摸时间
      lastTouch = Date.now()
      // 多指操作（缩放、旋转）不算长按
      if (e.originalEvent.touches.length !== 1) return cancel()
      // 记录位置
      start = { x: e.point.x, y: e.point.y }
      // 按住的坐标
      const ll = e.lngLat
      // 0.55 秒后算长按
      timer = window.setTimeout(() => {
        // 放图钉
        addPinRef.current([ll.lng, ll.lat])
        // 安卓上轻震一下（iPhone 不支持，没关系）
        navigator.vibrate?.(12)
        // 结束
        cancel()
      }, 550)
    }
    // 手指移动超过 10 像素就不算长按
    const onTouchMove = (e: maplibregl.MapTouchEvent) => {
      if (start && Math.hypot(e.point.x - start.x, e.point.y - start.y) > 10) cancel()
    }
    // 电脑上右键也能放图钉（刚触摸过说明是手机长按，上面已经处理了，这里跳过）
    const onContext = (e: maplibregl.MapMouseEvent) => {
      // 1.5 秒内触摸过就忽略
      if (Date.now() - lastTouch < 1500) return
      // 放图钉
      addPinRef.current([e.lngLat.lng, e.lngLat.lat])
    }
    // 用户拖动地图
    const onDragStart = () => {
      // 记录用户动过地图
      userMovedRef.current = true
      // 取消长按
      cancel()
    }
    // 点击地图
    const onClick = (e: maplibregl.MapMouseEvent) => {
      // 地图上的店铺、景点图层
      const layers = map.getStyle().layers.filter((l) => l.id.startsWith('poi')).map((l) => l.id)
      // 点到的店铺
      const f = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined
      // 点到了有名字的店铺
      if (f && f.properties?.name && f.geometry.type === 'Point') {
        // 坐标
        const c = f.geometry.coordinates as LngLat
        // 显示地点卡片
        setPicked({ name: String(f.properties.name), detail: '地图上的地点', lngLat: c })
      } else {
        // 点空白处：取消选择
        setPicked(null)
        setSelectedId(null)
      }
      // 收起搜索结果
      setShowResults(false)
    }
    // 注册事件
    map.on('touchstart', onTouchStart)
    map.on('touchmove', onTouchMove)
    map.on('touchend', cancel)
    map.on('touchcancel', cancel)
    map.on('dragstart', onDragStart)
    map.on('zoomstart', cancel)
    map.on('contextmenu', onContext)
    map.on('click', onClick)
    // 离开时取消注册
    return () => {
      cancel()
      map.off('touchstart', onTouchStart)
      map.off('touchmove', onTouchMove)
      map.off('touchend', cancel)
      map.off('touchcancel', cancel)
      map.off('dragstart', onDragStart)
      map.off('zoomstart', cancel)
      map.off('contextmenu', onContext)
      map.off('click', onClick)
    }
  }, [map])

  // ----- 选中地点的金色标记 -----
  useEffect(() => {
    // 没有选中地点
    if (!map || !picked) return
    // 金色标记
    const m = poiMarker(picked.name).setLngLat(picked.lngLat).addTo(map)
    // 移除
    return () => {
      m.remove()
    }
  }, [map, picked])

  // ----- 图钉标记 -----
  useEffect(() => {
    // 没准备好
    if (!map || !pins) return
    // 每个图钉一个可拖动标记
    const markers = pins.map((p, i) =>
      pinMarker(String(i + 1), p.name, {
        // 可以拖动
        draggable: true,
        // 是否选中
        selected: p.id === selectedId,
        // 点击：选中并展开列表
        onClick: () => {
          setSelectedId(p.id)
          setSheetOpen(true)
        },
        // 拖完：保存新位置，自动取的名字重新取
        onDragEnd: async (ll) => {
          // 保存坐标
          await update(p.id, { lat: ll[1], lng: ll[0] })
          // 名字是自动取的，就按新位置重新取
          if (p.autoName) {
            // 查地名
            const n = await reverseGeocode(ll)
            // 写回
            if (n) await update(p.id, { name: n })
          }
        },
      })
        .setLngLat([p.lng, p.lat])
        .addTo(map),
    )
    // 移除旧标记
    return () => markers.forEach((m) => m.remove())
  }, [map, pins, selectedId, update])

  // ----- 步行路线 -----
  // 图钉坐标拼成的 key（坐标变了才重新算）
  const pointsKey = (pins ?? []).map((p) => `${p.lng},${p.lat}`).join(';')
  // 计算路线
  useEffect(() => {
    // 是否已取消
    let cancelled = false
    // 坐标
    const pts = (pins ?? []).map((p) => [p.lng, p.lat] as LngLat)
    // 少于两个点没有路线
    if (pts.length < 2) {
      setRoute(null)
      return
    }
    // 请求路线
    getWalkRoute(pts).then((r) => {
      // 没取消就保存
      if (!cancelled) setRoute(r)
    })
    // 取消
    return () => {
      cancelled = true
    }
    // 只在坐标变化时重新算
  }, [pointsKey])
  // 画路线
  useEffect(() => {
    // 样式没好
    if (!map || styleRev === 0) return
    // 画
    drawWalkRoute(map, 'pins', route?.coords ?? [], route?.isReal ?? false)
  }, [map, styleRev, route])

  // ----- 提示自动消失 -----
  useEffect(() => {
    // 没提示
    if (!toast) return
    // 2.5 秒后消失
    const t = setTimeout(() => setToast(null), 2500)
    // 清除
    return () => clearTimeout(t)
  }, [toast])

  // ----- 从右边拖图钉到地图上 -----
  const onPinSourceDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    // 阻止默认行为（例如页面滚动）
    e.preventDefault()
    // 按下的位置
    const sx = e.clientX
    const sy = e.clientY
    // 是否真的拖动了
    let moved = false
    // 手指移动
    const onMove = (ev: PointerEvent) => {
      // 移动超过 6 像素才算拖动
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true
      // 显示跟着手指的图钉
      if (moved) setGhost({ x: ev.clientX, y: ev.clientY })
    }
    // 手指抬起
    const onUp = (ev: PointerEvent) => {
      // 取消监听
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      // 隐藏拖动中的图钉
      setGhost(null)
      // 地图没好
      if (!map) return
      // 只是点了一下：在地图中心放一个
      if (!moved) {
        // 地图中心
        const c = map.getCenter()
        // 放图钉
        addPin([c.lng, c.lat])
        // 提示
        setToast('已在地图中心放了一个图钉，可以拖动调整位置')
        return
      }
      // 图钉尖端的位置（手指上方）
      const tipX = ev.clientX
      const tipY = ev.clientY - GHOST_LIFT
      // 尖端下面是什么元素
      const under = document.elementFromPoint(tipX, tipY)
      // 不在地图上（例如在卡片或按钮上）就不放
      if (!under || !map.getContainer().contains(under)) return
      // 地图容器的位置
      const rect = map.getContainer().getBoundingClientRect()
      // 屏幕坐标换算成经纬度
      const ll = map.unproject([tipX - rect.left, tipY - rect.top])
      // 放图钉
      addPin([ll.lng, ll.lat])
    }
    // 开始监听
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // 图钉列表（加载中当作空）
  const list = useMemo(() => pins ?? [], [pins])

  // 移动图钉顺序
  const move = (i: number, dir: -1 | 1) => {
    // 目标位置
    const j = i + dir
    // 越界
    if (j < 0 || j >= list.length) return
    // 复制并交换
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    // 保存
    save(next)
  }

  // 删除图钉
  const remove = (id: string) => save(list.filter((p) => p.id !== id))

  // 优化顺序（第一个图钉不动）
  const optimize = async () => {
    // 算最短顺序
    const order = optimizeOrder(list.map((p) => [p.lng, p.lat] as LngLat))
    // 顺序没变
    if (order.every((v, i) => v === i)) {
      setToast('已经是最顺路的顺序了')
      return
    }
    // 保存新顺序
    await save(order.map((i) => list[i]))
    // 提示
    setToast('已按最顺路的顺序重新排列（第 1 个不动）')
  }

  // 清空全部图钉
  const clearAll = async () => {
    // 确认
    if (!window.confirm(day ? '清空这一天的所有地点？' : '清空所有图钉？')) return
    // 保存空列表
    await save([])
    // 取消选择
    setSelectedId(null)
  }

  // 路线总距离和时间
  const totalDist = route?.legDistances.reduce((a, b) => a + b, 0) ?? 0
  const totalTime = route?.legDurations.reduce((a, b) => a + b, 0) ?? 0
  // Google Maps 链接（从我的位置出发，经过所有图钉）
  const gmaps = googleMapsDirections(list, true)
  // 导航页地址
  const navUrl = day ? `/nav?day=${day}` : '/nav'

  // 页面内容
  return (
    <div className="relative h-full w-full overflow-hidden bg-paper">
      {/* 地图 */}
      <div className="absolute inset-0">
        {/* 内层铺满 */}
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* 顶部：搜索框 + 编辑提示 */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-2 px-4 pt-[max(env(safe-area-inset-top),16px)]">
        {/* 搜索框 */}
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-glass px-3.5 shadow-[0_2px_12px_var(--shadow)] backdrop-blur">
          {/* 放大镜 */}
          <Icon name="search" size={18} className="shrink-0 text-muted" />
          {/* 输入框 */}
          <input
            ref={inputRef}
            // 输入类型：搜索（iPhone 键盘会显示“搜索”按钮）
            type="search"
            // 读屏文字
            aria-label="搜索地点"
            // 提示文字
            placeholder="搜索店铺、景点、地址"
            // 当前值
            value={query}
            // 输入时更新
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(true)
            }}
            // 聚焦时显示结果
            onFocus={() => setShowResults(true)}
            // 样式：去掉边框，铺满
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
          {/* 清空按钮 */}
          {query && (
            <button
              aria-label="清空搜索"
              onClick={() => {
                setQuery('')
                setResults([])
                inputRef.current?.focus()
              }}
              className="-mr-1 flex h-9 w-9 items-center justify-center text-muted"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* 搜索结果 */}
        {showResults && query.trim().length >= 2 && (
          <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-line bg-card shadow-[0_6px_24px_var(--shadow)]">
            {/* 正在搜索 */}
            {searching && results.length === 0 && <p className="px-4 py-3 text-[13px] text-muted">正在搜索…</p>}
            {/* 出错 */}
            {searchError && <p className="px-4 py-3 text-[13px] text-accent">{searchError}</p>}
            {/* 没结果 */}
            {!searching && !searchError && results.length === 0 && <p className="px-4 py-3 text-[13px] text-muted">没有找到，换个关键词试试</p>}
            {/* 结果列表 */}
            {results.map((r) => (
              <button key={r.id} onClick={() => chooseResult(r)} className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-b-0">
                {/* 图标 */}
                <Icon name="pin" size={17} className="mt-0.5 shrink-0 text-accent" />
                {/* 文字 */}
                <span className="min-w-0 flex-1">
                  {/* 名称 + 类别 */}
                  <span className="block truncate text-[14px] font-medium">
                    {r.name}
                    {r.kind && <span className="ml-1.5 text-[12px] font-normal text-muted">{r.kind}</span>}
                  </span>
                  {/* 地址 */}
                  <span className="block truncate text-[12px] text-muted">{r.address}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 编辑某一天时的提示条 */}
        {day && !showResults && (
          <div className="flex items-center justify-between gap-2 self-start rounded-full border border-line bg-glass py-1 pr-1 pl-3.5 text-[13px] shadow-[0_2px_10px_var(--shadow)] backdrop-blur">
            {/* 正在编辑哪天 */}
            <span>
              正在编辑 <b className="font-semibold">{dayInfo ? dayLabel(dayInfo) : `第 ${day} 天`}</b>
            </span>
            {/* 完成：回到那天的页面 */}
            <Link to={`/day/${day}`} replace className="flex h-8 items-center rounded-full bg-ink px-3 text-[12px] text-paper">
              完成
            </Link>
          </div>
        )}

        {/* 离线提示 */}
        {offline && <p className="rounded-xl bg-accent-soft px-3 py-2 text-[12px] text-accent">现在没有网络：底图和搜索暂时用不了</p>}
      </div>

      {/* 右侧按钮：地图按钮 + 图钉来源 */}
      <div className="absolute right-4 bottom-[calc(var(--sheet-h,120px)+16px)] flex flex-col items-center gap-2">
        {/* 地图按钮 */}
        <MapButtons map={map} me={geo.position} onLocate={geo.start} />
        {/* 图钉：按住拖到地图上，点一下放在地图中心 */}
        <button
          // 读屏文字
          aria-label="放一个图钉：按住拖到地图上，或点一下放在地图中心"
          // 按下开始拖动
          onPointerDown={onPinSourceDown}
          // 禁止浏览器把这个手势当成滚动
          style={{ touchAction: 'none' }}
          // 样式：酒红圆形按钮
          className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_4px_14px_var(--shadow)]"
        >
          {/* 图钉图标 */}
          <Icon name="pin" size={22} />
          {/* 小字 */}
          <span className="text-[10px] leading-none">拖我</span>
        </button>
      </div>

      {/* 拖动中的图钉（跟着手指） */}
      {ghost && (
        <div aria-hidden="true" className="pointer-events-none fixed z-50" style={{ left: ghost.x, top: ghost.y - GHOST_LIFT, transform: 'translate(-50%, -100%)' }}>
          {/* 图钉形状 */}
          <svg width="34" height="42" viewBox="0 0 34 42" className="drop-shadow-lg">
            <path d="M17 40.5S3.5 28.6 3.5 17a13.5 13.5 0 1127 0c0 11.6-13.5 23.5-13.5 23.5z" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
          </svg>
        </div>
      )}

      {/* 选中地点的卡片（在底部卡片上方） */}
      {picked && (
        <div className="absolute inset-x-4 bottom-[calc(var(--sheet-h,120px)+16px)] mr-16 rounded-2xl border border-line bg-card p-3.5 shadow-[0_6px_24px_var(--shadow)]">
          {/* 名称和关闭 */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {/* 名称 */}
              <div className="truncate text-[15px] font-semibold">{picked.name}</div>
              {/* 说明 */}
              <div className="truncate text-[12px] text-muted">{picked.detail}</div>
            </div>
            {/* 关闭 */}
            <button aria-label="关闭" onClick={() => setPicked(null)} className="-mt-1 -mr-1 flex h-9 w-9 items-center justify-center text-muted">
              <Icon name="close" size={16} />
            </button>
          </div>
          {/* 操作按钮 */}
          <div className="mt-2.5 flex gap-2">
            {/* 放图钉 */}
            <button
              onClick={() => {
                addPin(picked.lngLat, picked.name)
                setPicked(null)
                setToast(`已把「${picked.name}」加为图钉`)
              }}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-[13px] text-on-accent"
            >
              <Icon name="pin" size={16} />
              放图钉
            </button>
            {/* 用 Google Maps 打开 */}
            <a
              href={googleMapsDirections([{ lat: picked.lngLat[1], lng: picked.lngLat[0] }], true)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px]"
            >
              <Icon name="external" size={15} />
              Google Maps
            </a>
          </div>
        </div>
      )}

      {/* 底部卡片 */}
      <section ref={sheetRef} className="absolute inset-x-0 bottom-0 max-h-[62%] overflow-y-auto rounded-t-[26px] border-t border-line bg-card px-5 pb-4 shadow-[0_-8px_24px_var(--shadow)]">
        {/* 拖动条 */}
        <button aria-label={sheetOpen ? '收起列表' : '展开列表'} aria-expanded={sheetOpen} onClick={() => setSheetOpen((o) => !o)} className="flex h-6 w-full items-center justify-center">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </button>

        {/* 标题行 */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {/* 标题 */}
            <h1 className="text-[17px] font-semibold">{day ? (dayInfo ? `${dayLabel(dayInfo)} · ${dayInfo.stop.name}` : `第 ${day} 天`) : '我的图钉'}</h1>
            {/* 摘要 */}
            <p className="truncate text-[12px] text-muted">
              {list.length === 0
                ? '长按地图，或把右边的图钉拖到地图上'
                : `${list.length} 个地点${route && totalDist > 0 ? ` · 步行约 ${formatDuration(totalTime)} · ${formatDistance(totalDist)}` : ''}`}
            </p>
          </div>
          {/* 展开/收起列表 */}
          {list.length > 0 && (
            <button onClick={() => setSheetOpen((o) => !o)} className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3 text-[12px]">
              <Icon name={sheetOpen ? 'chevronDown' : 'list'} size={15} />
              {sheetOpen ? '收起' : '列表'}
            </button>
          )}
        </div>

        {/* 主要操作：导航 */}
        {list.length > 0 && (
          <div className="mt-3 flex gap-2">
            {/* App 内导航 */}
            <Link to={navUrl} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink text-[14px] text-paper">
              <Icon name="navigate" size={16} />
              开始导航
            </Link>
            {/* Google Maps */}
            <a href={gmaps} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[14px]">
              <Icon name="external" size={15} />
              Google Maps
            </a>
          </div>
        )}

        {/* 展开后的列表 */}
        {sheetOpen && list.length > 0 && (
          <div className="mt-3">
            <ol className="flex flex-col">
              {list.map((p, i) => (
                <li key={p.id}>
                  {/* 两站之间的步行信息 */}
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-0.5 pl-[13px] text-[11px] text-muted">
                      <span className="h-4 w-px bg-line-strong" />
                      <Icon name="walk" size={13} />
                      {route?.legDurations[i - 1] !== undefined ? `${formatDuration(route.legDurations[i - 1])} · ${formatDistance(route.legDistances[i - 1])}` : '…'}
                    </div>
                  )}
                  {/* 图钉行 */}
                  <div className={`flex items-center gap-2 rounded-xl ${p.id === selectedId ? 'bg-oat' : ''}`}>
                    {/* 编号 */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-on-accent">{i + 1}</span>
                    {/* 名字：编辑中显示输入框 */}
                    {editingId === p.id ? (
                      <input
                        // 自动聚焦
                        autoFocus
                        // 读屏文字
                        aria-label="图钉名称"
                        // 初始值
                        defaultValue={p.name}
                        // 失去焦点时保存
                        onBlur={(e) => {
                          // 新名字（空的就保留原名）
                          const v = e.target.value.trim()
                          // 保存（手动改过的名字不再自动更新）
                          if (v && v !== p.name) update(p.id, { name: v, autoName: false })
                          // 结束编辑
                          setEditingId(null)
                        }}
                        // 按回车也保存
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                        // 样式
                        className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-paper px-2 text-[15px] outline-none"
                      />
                    ) : (
                      <button
                        // 点名字：选中并飞过去
                        onClick={() => {
                          setSelectedId(p.id)
                          map?.flyTo({ center: [p.lng, p.lat], zoom: 17, duration: 1200 })
                        }}
                        className="min-h-[44px] min-w-0 flex-1 truncate text-left text-[15px]"
                      >
                        {p.name}
                      </button>
                    )}
                    {/* 改名 */}
                    <SmallBtn label="改名" icon="edit" onClick={() => setEditingId(p.id)} />
                    {/* 上移 */}
                    <SmallBtn label="上移" icon="chevronUp" disabled={i === 0} onClick={() => move(i, -1)} />
                    {/* 下移 */}
                    <SmallBtn label="下移" icon="chevronDown" disabled={i === list.length - 1} onClick={() => move(i, 1)} />
                    {/* 删除 */}
                    <SmallBtn label="删除" icon="close" onClick={() => remove(p.id)} />
                  </div>
                </li>
              ))}
            </ol>

            {/* 次要操作 */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {/* 优化顺序 */}
              <SecondaryBtn icon="sparkle" label="顺路排序" onClick={optimize} disabled={list.length < 3} />
              {/* 保存到日程（草稿模式才有） */}
              {!day ? <SecondaryBtn icon="calendarPlus" label="存到日程" onClick={() => setSaveOpen(true)} /> : <span />}
              {/* 清空 */}
              <SecondaryBtn icon="trash" label="清空" onClick={clearAll} />
            </div>
          </div>
        )}
      </section>

      {/* 保存到日程的面板 */}
      {saveOpen && itin && (
        <SaveToDaySheet
          days={itin.days.map((d) => ({ dayIndex: d.dayIndex, label: dayLabel(d), city: d.stop.name, count: data?.dayPlans.find((p) => p.dayIndex === d.dayIndex)?.items.length ?? 0 }))}
          onClose={() => setSaveOpen(false)}
          onSave={async (target, mode) => {
            // 保存
            await saveToDay(target, list, mode)
            // 关闭面板
            setSaveOpen(false)
            // 去那一天的页面
            navigate(`/day/${target}`)
          }}
        />
      )}

      {/* 顶部小提示 */}
      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),16px)+60px)] flex justify-center px-6">
          <span className="rounded-full bg-ink px-4 py-2 text-center text-[13px] text-paper shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  )
}

// “保存到日程”面板：选择哪一天，以及追加还是替换
function SaveToDaySheet({
  days,
  onClose,
  onSave,
}: {
  days: { dayIndex: number; label: string; city: string; count: number }[]
  onClose: () => void
  onSave: (day: number, mode: 'append' | 'replace') => void
}) {
  // 选中的天
  const [chosen, setChosen] = useState<number | null>(null)
  // 返回面板
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/30" onClick={onClose}>
      {/* 面板本身（点里面不关闭） */}
      <div className="max-h-[75%] overflow-y-auto rounded-t-[26px] bg-card px-5 pt-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">存到哪一天？</h2>
          <button aria-label="关闭" onClick={onClose} className="flex h-9 w-9 items-center justify-center text-muted">
            <Icon name="close" size={18} />
          </button>
        </div>
        {/* 天列表 */}
        <ul className="mt-2 flex flex-col gap-2">
          {days.map((d) => (
            <li key={d.dayIndex} className={`rounded-2xl border ${chosen === d.dayIndex ? 'border-accent' : 'border-line'}`}>
              {/* 选择这一天 */}
              <button onClick={() => (d.count === 0 ? onSave(d.dayIndex, 'replace') : setChosen(d.dayIndex))} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <span>
                  {/* 第几天 */}
                  <span className="block text-[14px] font-medium">{d.label}</span>
                  {/* 城市和已有安排 */}
                  <span className="block text-[12px] text-muted">
                    {d.city} · {d.count > 0 ? `已有 ${d.count} 个地点` : '还没安排'}
                  </span>
                </span>
                <Icon name="chevronRight" size={16} className="text-muted" />
              </button>
              {/* 已有安排时：追加还是替换 */}
              {chosen === d.dayIndex && (
                <div className="flex gap-2 px-4 pb-3">
                  <button onClick={() => onSave(d.dayIndex, 'append')} className="h-10 flex-1 rounded-xl bg-ink text-[13px] text-paper">
                    追加到后面
                  </button>
                  <button onClick={() => onSave(d.dayIndex, 'replace')} className="h-10 flex-1 rounded-xl border border-line-strong text-[13px]">
                    替换原有安排
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// 小图标按钮
function SmallBtn({ label, icon, disabled, onClick }: { label: string; icon: IconName; disabled?: boolean; onClick: () => void }) {
  // 返回按钮
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-30">
      <Icon name={icon} size={16} />
    </button>
  )
}

// 次要操作按钮
function SecondaryBtn({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  // 返回按钮
  return (
    <button onClick={onClick} disabled={disabled} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px] disabled:opacity-40">
      <Icon name={icon} size={15} />
      {label}
    </button>
  )
}
