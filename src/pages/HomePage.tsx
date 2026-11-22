// ============================================================
// 首页：整屏真实地图（荷兰、德国、丹麦）+ 整条路线 + 我的位置
//   - 右上角：今日旅程 / 未来旅程
//   - 点城市：飞过去，放大到街道级别，倾斜成 3D
//   - 底部卡片：旅行概况和城市列表
// ============================================================

// 引入 React 钩子
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
// 引入路由链接
import { Link } from 'react-router-dom'
// 引入 MapLibre 类型
import type * as maplibregl from 'maplibre-gl'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入数据结构
import type { Place, Stop } from '../db/schema'
// 引入地图钩子
import { useMap } from '../map/useMap'
// 引入标记工具
import { cityMarker, poiMarker, useMeMarker } from '../map/markers'
// 引入路线绘制
import { drawTripRoute, uniqueCities } from '../map/tripRoute'
// 引入景点高亮
import { highlightLandmarks } from '../map/layers'
// 引入定位钩子
import { useGeolocation } from '../lib/useGeolocation'
// 引入地理工具
import { boundsOf, type LngLat } from '../lib/geo'
// 引入行程工具
import { computeSpans, dayLabel } from '../lib/itinerary'
// 引入图标
import { Icon } from '../components/Icon'
// 引入地图按钮
import { MapButtons } from '../components/MapButtons'

// 需要在地图上显示成金色标记的地点类型
const LANDMARK_CATS: Place['category'][] = ['attraction', 'market']

// 用户是否开启了“减少动态效果”（开了就不做飞行动画）
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 首页组件
export default function HomePage() {
  // 读取旅行数据
  const data = useTripData()
  // 计算每天概况
  const itin = useItinerary(data)
  // 创建地图（先显示欧洲北部，数据到了再对准路线）
  const { containerRef, map, styleRev, offline } = useMap({ center: [9.6, 54], zoom: 4.6 })
  // 开始定位
  const geo = useGeolocation(true)
  // 在地图上显示我的位置
  useMeMarker(map, geo.position)
  // 当前聚焦的城市（null = 全览）
  const [focusId, setFocusId] = useState<string | null>(null)
  // 底部卡片是否展开
  const [sheetOpen, setSheetOpen] = useState(true)
  // 是否关掉了定位错误提示
  const [geoDismissed, setGeoDismissed] = useState(false)
  // 底部卡片元素（用来量高度，给地图留白）
  const sheetRef = useRef<HTMLDivElement>(null)
  // 是否已经对准过路线（只在第一次自动对准）
  const fittedRef = useRef(false)

  // 城市列表（去重）
  const cities = useMemo(() => (data ? uniqueCities(data.stops) : []), [data])
  // 住宿城市及其天数
  const spans = useMemo(() => (data ? computeSpans(data.stops).filter((s) => s.stop.kind === 'stay') : []), [data])
  // 需要金色标记的景点
  const landmarks = useMemo(() => (data ? data.places.filter((p) => LANDMARK_CATS.includes(p.category) && !p.hidden) : []), [data])

  // 计算地图留白：上面留给按钮，下面留给卡片，右边留给圆形按钮
  const padding = useCallback(() => {
    // 底部卡片的高度
    const sheetH = sheetRef.current?.offsetHeight ?? 220
    // 返回留白
    return { top: 140, bottom: sheetH + 24, left: 36, right: 76 }
  }, [])

  // 回到全览：显示整条路线，平面、正北
  const overview = useCallback(
    (animate = true) => {
      // 地图或数据没好
      if (!map || cities.length === 0) return
      // 取消聚焦
      setFocusId(null)
      // 算出能装下所有城市的视角
      const cam = map.cameraForBounds(boundsOf(cities.map((c) => [c.lng, c.lat] as LngLat)), { padding: padding() })
      // 算不出来就算了
      if (!cam) return
      // 动画飞过去（或直接跳过去）
      const opts = { ...cam, pitch: 0, bearing: 0 }
      // 需要动画并且没开“减少动态效果”
      if (animate && !reducedMotion) map.flyTo({ ...opts, duration: 1800 })
      // 否则直接跳
      else map.jumpTo(opts)
    },
    [map, cities, padding],
  )

  // 聚焦一个城市：飞过去，放大到街道，倾斜成 3D
  const focusCity = useCallback(
    (stop: Stop) => {
      // 地图没好
      if (!map) return
      // 记录聚焦的城市
      setFocusId(stop.id)
      // 这个城市的景点
      const pts = landmarks.filter((p) => p.stopId === stop.id).map((p) => [p.lng, p.lat] as LngLat)
      // 有景点就以景点的中心为目标，否则用城市中心
      const center: LngLat = pts.length ? centerOf(pts) : [stop.lng, stop.lat]
      // 飞行动画
      map.flyTo({
        // 目标中心
        center,
        // 街道级别
        zoom: 15.2,
        // 倾斜 60 度，看到 3D 楼
        pitch: 60,
        // 稍微旋转一点，更有立体感
        bearing: -20,
        // 给底部卡片留位置
        padding: padding(),
        // 动画时长
        duration: reducedMotion ? 0 : 3200,
        // 即使开了“减少动态”也执行
        essential: true,
      })
    },
    [map, landmarks, padding],
  )

  // 飞到一个景点（更近、更斜）
  const focusPlace = useCallback(
    (p: Place) => {
      // 地图没好
      if (!map) return
      // 飞过去
      map.flyTo({ center: [p.lng, p.lat], zoom: 16.8, pitch: 65, bearing: map.getBearing() - 30, padding: padding(), duration: reducedMotion ? 0 : 2200, essential: true })
    },
    [map, padding],
  )

  // 数据和地图都好了以后，第一次自动对准整条路线
  useEffect(() => {
    // 已经对准过，或者还没准备好
    if (fittedRef.current || !map || cities.length === 0) return
    // 标记已对准
    fittedRef.current = true
    // 不要动画，直接显示
    overview(false)
  }, [map, cities, overview])

  // 画路线（样式每次重新加载后都要重画）
  useEffect(() => {
    // 地图样式还没加载或没有数据
    if (!map || styleRev === 0 || !data) return
    // 画路线
    drawTripRoute(map, data.stops, data.segments, 'home')
  }, [map, styleRev, data])

  // 城市标记
  useEffect(() => {
    // 没准备好
    if (!map) return
    // 每个城市创建一个标记
    const markers = cities.map((c) => cityMarker(c.name, c.kind === 'home', () => focusCity(c)).setLngLat([c.lng, c.lat]).addTo(map))
    // 离开或数据变化时移除旧标记
    return () => markers.forEach((m) => m.remove())
  }, [map, cities, focusCity])

  // 景点标记
  useEffect(() => {
    // 没准备好
    if (!map) return
    // 每个景点创建一个金色标记
    const markers = landmarks.map((p) => poiMarker(p.name, () => focusPlace(p)).setLngLat([p.lng, p.lat]).addTo(map))
    // 移除旧标记
    return () => markers.forEach((m) => m.remove())
  }, [map, landmarks, focusPlace])

  // 根据缩放级别显示/隐藏标记：远看显示城市，近看显示景点
  useEffect(() => {
    // 没准备好
    if (!map) return
    // 更新显示状态
    const update = () => {
      // 当前缩放
      const z = map.getZoom()
      // 城市标记：放大到 10 级以上就隐藏
      document.querySelectorAll('.city-marker').forEach((el) => el.classList.toggle('is-hidden', z > 10))
      // 景点标记：12 级以下隐藏
      document.querySelectorAll('.poi-marker').forEach((el) => ((el as HTMLElement).style.display = z < 12 ? 'none' : ''))
    }
    // 先执行一次
    update()
    // 缩放时更新
    map.on('zoom', update)
    // 取消监听
    return () => {
      map.off('zoom', update)
    }
  }, [map, cities, landmarks])

  // 景点建筑染成淡金色
  useEffect(() => {
    // 没准备好
    if (!map || landmarks.length === 0) return
    // 开始高亮，返回清理函数
    return highlightLandmarks(map, landmarks.map((p) => [p.lng, p.lat] as LngLat))
  }, [map, landmarks])

  // 加载中
  if (!data || !itin) return <Loading />

  // 当前聚焦的城市
  const focused = focusId ? data.stops.find((s) => s.id === focusId) : null
  // 聚焦城市的时间段
  const focusedSpan = focused ? spans.find((s) => s.stop.id === focused.id) : null
  // 左上角的状态文字
  const status =
    // 还没出发
    itin.today.kind === 'before'
      ? itin.today.daysUntil === null
        ? '出发日待定'
        : `还有 ${itin.today.daysUntil} 天出发`
      // 旅途中
      : itin.today.kind === 'during'
        ? `今天是${dayLabel(itin.days[itin.today.dayIndex - 1])}`
        // 已结束
        : '旅行已结束'

  // 页面内容
  return (
    <div className="relative h-full w-full overflow-hidden bg-paper">
      {/* 地图容器：铺满整个页面 */}
      <div className="absolute inset-0">
          {/* 内层铺满：MapLibre 会给这个 div 加 position: relative，所以定位放在外层 */}
          <div ref={containerRef} className="h-full w-full" />
        </div>

      {/* 顶部：左边旅行名和状态，右边两个按钮 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),16px)]">
        {/* 左上角卡片 */}
        <div className="pointer-events-auto min-w-0 rounded-2xl border border-line bg-glass px-3.5 py-2 shadow-[0_2px_12px_var(--shadow)] backdrop-blur">
          {/* 副标题（斜体衬线） */}
          <div className="font-serif text-[15px] italic text-muted">{data.trip.subtitle ?? 'Voyage'}</div>
          {/* 状态 */}
          <div className="truncate text-[14px] font-semibold">{status}</div>
        </div>
        {/* 右上角按钮组 */}
        <div className="pointer-events-auto flex shrink-0 gap-2">
          {/* 今日旅程：深色主按钮 */}
          <Link to="/today" className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-medium text-paper shadow-[0_2px_12px_var(--shadow)]">
            <Icon name="sun" size={16} />
            今日旅程
          </Link>
          {/* 未来旅程：浅色按钮 */}
          <Link to="/upcoming" className="flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-glass px-3.5 text-[13px] font-medium text-ink shadow-[0_2px_12px_var(--shadow)] backdrop-blur">
            <Icon name="arrowRight" size={16} />
            未来旅程
          </Link>
        </div>
      </div>

      {/* 提示条：离线 或 定位出错 */}
      <div className="pointer-events-none absolute inset-x-4 top-[calc(max(env(safe-area-inset-top),16px)+64px)] flex flex-col gap-2">
        {/* 离线提示 */}
        {offline && <Notice text="现在没有网络：底图暂时显示不了，路线和标记照常可用" />}
        {/* 定位出错提示（可关闭） */}
        {geo.error && !geoDismissed && <Notice text={geo.error} onClose={() => setGeoDismissed(true)} />}
      </div>

      {/* 右侧圆形按钮：放在卡片上方 */}
      <MapButtons map={map} me={geo.position} onLocate={geo.start} className="absolute right-4 bottom-[calc(var(--sheet-h,220px)+16px)]" />

      {/* 底部卡片 */}
      <section
        // 用来量高度
        ref={sheetRef}
        // 卡片样式：圆角顶部、卡片底色、轻阴影
        className="absolute inset-x-0 bottom-0 rounded-t-[26px] border-t border-line bg-card px-5 pb-4 shadow-[0_-8px_24px_var(--shadow)]"
      >
        {/* 拖动条（点一下展开/收起） */}
        <button
          // 读屏文字
          aria-label={sheetOpen ? '收起卡片' : '展开卡片'}
          // 展开状态
          aria-expanded={sheetOpen}
          // 横向铺满，44 像素高
          className="flex h-6 w-full items-center justify-center"
          // 点击切换
          onClick={() => setSheetOpen((o) => !o)}
        >
          {/* 小横条 */}
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </button>

        {/* 聚焦某个城市时 */}
        {focused ? (
          <div className="flex flex-col gap-3">
            {/* 城市名和返回全览 */}
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                {/* 国家代码 */}
                <div className="text-[11px] tracking-[0.14em] text-muted">{COUNTRY[focused.country] ?? focused.country}</div>
                {/* 城市名（当地原文，衬线大字） */}
                <h1 className="font-serif text-[34px] leading-none font-medium">{focused.name}</h1>
                {/* 中文名和住几晚 */}
                <div className="mt-1 text-[13px] text-muted">
                  {focused.nameZh}
                  {focusedSpan && ` · ${spanText(focusedSpan.arriveDay, focusedSpan.departDay, itin.days)} · 住 ${focused.nights} 晚`}
                </div>
              </div>
              {/* 返回全览按钮 */}
              <button onClick={() => overview()} className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3.5 text-[13px]">
                <Icon name="back" size={15} />
                全览
              </button>
            </div>
            {/* 城市详情入口 */}
            <Link to={`/city/${focused.id}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-ink text-[14px] text-paper">
              酒店 · 景点 · 日程
              <Icon name="chevronRight" size={15} />
            </Link>
            {/* 展开时显示景点列表 */}
            {sheetOpen && (
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {/* 这个城市的景点 */}
                {landmarks
                  .filter((p) => p.stopId === focused.id)
                  .map((p) => (
                    <button key={p.id} onClick={() => focusPlace(p)} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-oat px-3.5 text-[13px]">
                      {/* 金色小菱形 */}
                      <span className="h-2 w-2 rotate-45 bg-gold" />
                      {p.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ) : (
          // 全览时
          <div className="flex flex-col gap-3">
            {/* 旅行名和日期（上下两行，避免名字被截断） + 编辑行程 */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* 旅行名 */}
                <h1 className="font-serif text-[26px] leading-tight font-medium">{data.trip.name}</h1>
                {/* 日期范围或待定提示 */}
                <div className="mt-0.5 text-[12px] text-muted">{dateRange(itin.days, data.trip.startDateHint)}</div>
              </div>
              {/* 编辑行程 */}
              <Link to="/trip" className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3.5 text-[13px]">
                <Icon name="edit" size={14} />
                编辑
              </Link>
            </div>
            {/* 展开时显示城市卡片 */}
            {sheetOpen && (
              <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
                {/* 每个住宿城市一张卡片 */}
                {spans.map(({ stop, arriveDay, departDay }) => {
                  // 这个城市的酒店有没有已预订的
                  const booked = data.places.some((p) => p.stopId === stop.id && p.category === 'hotel' && p.status === 'booked')
                  // 有没有已选定的
                  const selected = data.places.some((p) => p.stopId === stop.id && p.category === 'hotel' && p.status === 'selected')
                  // 卡片
                  return (
                    <button
                      // 唯一 key
                      key={stop.id}
                      // 点击：飞到这个城市
                      onClick={() => focusCity(stop)}
                      // 卡片样式
                      className="flex min-w-[148px] flex-1 flex-col items-start gap-1 rounded-2xl border border-line bg-paper/60 p-3 text-left"
                    >
                      {/* 城市名 */}
                      <span className="font-serif text-[21px] leading-none font-medium">{stop.name}</span>
                      {/* 天数 */}
                      <span className="text-[12px] text-muted">
                        {spanText(arriveDay, departDay, itin.days)} · {stop.nights}晚
                      </span>
                      {/* 住宿状态 */}
                      <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] ${booked ? 'bg-sage-soft text-sage' : selected ? 'bg-oat text-ink' : 'bg-accent-soft text-accent'}`}>
                        {booked ? '住宿已订' : selected ? '住宿已选定' : '住宿未订'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 把卡片高度同步成 CSS 变量，让右侧按钮始终在卡片上方 */}
      <SheetHeightSync sheetRef={sheetRef} map={map} deps={[sheetOpen, focusId]} />
    </div>
  )
}

// 国家代码 → 当地语言的国名
const COUNTRY: Record<string, string> = { NL: 'NEDERLAND', DE: 'DEUTSCHLAND', DK: 'DANMARK' }

// 一组点的中心
function centerOf(pts: LngLat[]): LngLat {
  // 经度平均值
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length
  // 纬度平均值
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length
  // 返回中心
  return [lng, lat]
}

// 城市停留时间的文字：日期已定显示 “12/23–12/25”，否则 “第1–3天”
function spanText(arrive: number, depart: number, days: { date: string | null }[]): string {
  // 到达那天
  const a = days[arrive - 1]
  // 离开那天
  const d = days[depart - 1]
  // 有日期就显示日期
  if (a?.date && d?.date) return `${shortDate(a.date)}–${shortDate(d.date)}`
  // 否则显示第几天
  return `第${arrive}–${depart}天`
}

// 'YYYY-MM-DD' → 'M/D'
function shortDate(iso: string): string {
  // 拆开
  const [, m, d] = iso.split('-')
  // 去掉前导零
  return `${Number(m)}/${Number(d)}`
}

// 整个旅行的日期范围
function dateRange(days: { date: string | null }[], hint?: string): string {
  // 第一天
  const first = days[0]?.date
  // 最后一天
  const last = days[days.length - 1]?.date
  // 都有日期
  if (first && last) return `${shortDate(first)} — ${shortDate(last)}`
  // 没日期就显示提示和总天数
  return `${hint ?? '日期待定'} · 共 ${days.length} 天`
}

// 提示条组件
function Notice({ text, onClose }: { text: string; onClose?: () => void }) {
  // 返回提示条
  return (
    <div className="pointer-events-auto flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-accent shadow-[0_2px_10px_var(--shadow)]">
      {/* 提醒图标 */}
      <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
      {/* 文字 */}
      <span className="flex-1">{text}</span>
      {/* 关闭按钮 */}
      {onClose && (
        <button aria-label="关闭提示" onClick={onClose} className="-m-1 p-1">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
}

// 把底部卡片高度写进 CSS 变量 --sheet-h，并通知地图留白变化
function SheetHeightSync({ sheetRef, map, deps }: { sheetRef: RefObject<HTMLDivElement | null>; map: maplibregl.Map | null; deps: unknown[] }) {
  // 卡片内容变化（展开/收起/聚焦）后执行
  useEffect(() => {
    // 卡片元素
    const el = sheetRef.current
    // 不存在就跳过
    if (!el) return
    // 观察卡片尺寸变化
    const ro = new ResizeObserver(() => {
      // 写入 CSS 变量（在卡片的父元素上）
      el.parentElement?.style.setProperty('--sheet-h', `${el.offsetHeight}px`)
    })
    // 开始观察
    ro.observe(el)
    // 停止观察
    return () => ro.disconnect()
  }, [sheetRef, map, ...deps])
  // 这个组件不渲染任何东西
  return null
}

// 加载中的画面
export function Loading() {
  // 居中显示一个斜体 Noël
  return (
    <div className="flex h-full items-center justify-center bg-paper">
      <span className="font-serif text-3xl italic text-muted">Noël</span>
    </div>
  )
}
