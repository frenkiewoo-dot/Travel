// ============================================================
// 未来旅程：上面一张小地图显示剩下的路线，下面按天列出之后每天的安排
// ============================================================

// 引入 React 钩子
import { useEffect, useMemo } from 'react'
// 引入路由工具
import { Link, useNavigate } from 'react-router-dom'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入地图钩子
import { useMap } from '../map/useMap'
// 引入城市标记
import { cityMarker } from '../map/markers'
// 引入路线绘制
import { drawTripRoute, uniqueCities } from '../map/tripRoute'
// 引入地理工具
import { boundsOf, type LngLat } from '../lib/geo'
// 引入行程工具
import { MODE_LABEL, dayLabel } from '../lib/itinerary'
// 引入图标
import { Icon } from '../components/Icon'
// 引入加载画面
import { Loading } from './HomePage'

// 页面组件
export default function UpcomingPage() {
  // 页面跳转工具
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 创建小地图
  const { containerRef, map, styleRev } = useMap({ center: [9.6, 54], zoom: 4.4 })

  // 未来的天：“今日旅程”显示的那天之后的所有天
  const upcoming = useMemo(() => (itin ? itin.days.filter((d) => d.dayIndex > itin.todayIndex) : []), [itin])

  // 剩下的路线：从今天所在城市开始往后的地点和交通
  const remaining = useMemo(() => {
    // 没数据
    if (!data || !itin) return null
    // 今天所在城市
    const cur = itin.days[itin.todayIndex - 1]?.stop
    // 它的顺序号
    const fromOrder = cur?.order ?? 0
    // 从这个城市开始、本次路线上的地点（“以后想去”的不算）
    const stops = data.stops.filter((s) => s.kind !== 'saved' && s.order >= fromOrder)
    // 这些地点的 ID
    const ids = new Set(stops.map((s) => s.id))
    // 出发地在其中的交通段
    const segments = data.segments.filter((s) => ids.has(s.fromStopId))
    // 返回
    return { stops, segments }
  }, [data, itin])

  // 画路线并对准
  useEffect(() => {
    // 地图样式没好
    if (!map || styleRev === 0 || !remaining) return
    // 画路线
    drawTripRoute(map, remaining.stops, remaining.segments, 'upcoming')
  }, [map, styleRev, remaining])

  // 城市标记 + 对准范围
  useEffect(() => {
    // 地图没好
    if (!map || !remaining || remaining.stops.length === 0) return
    // 去重后的城市
    const cities = uniqueCities(remaining.stops)
    // 每个城市一个标记（点了就去首页）
    const markers = cities.map((c) => cityMarker(c.name, c.kind === 'home', () => navigate('/')).setLngLat([c.lng, c.lat]).addTo(map))
    // 装下所有城市
    const cam = map.cameraForBounds(boundsOf(remaining.stops.map((s) => [s.lng, s.lat] as LngLat)), { padding: { top: 70, bottom: 40, left: 30, right: 90 } })
    // 跳过去
    if (cam) map.jumpTo(cam)
    // 移除标记
    return () => markers.forEach((m) => m.remove())
  }, [map, remaining, navigate])

  // 加载中
  if (!data || !itin) return <Loading />

  // 页面内容
  return (
    <div className="flex h-full flex-col bg-paper">
      {/* 上方小地图 */}
      <div className="relative h-[34%] shrink-0">
        {/* 地图容器 */}
        <div className="absolute inset-0">
          {/* 内层铺满：MapLibre 会给这个 div 加 position: relative，所以定位放在外层 */}
          <div ref={containerRef} className="h-full w-full" />
        </div>
        {/* 返回按钮和标题 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),16px)]">
          {/* 返回 */}
          <button
            aria-label="返回"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card shadow-[0_2px_10px_var(--shadow)]"
          >
            <Icon name="back" size={20} />
          </button>
          {/* 标题 */}
          <div className="pointer-events-auto flex h-11 items-center rounded-full border border-line bg-card px-4 text-[15px] font-semibold shadow-[0_2px_10px_var(--shadow)]">未来旅程</div>
        </div>
      </div>

      {/* 下方每天的列表 */}
      <div className="relative -mt-5 min-h-0 flex-1 overflow-y-auto rounded-t-[26px] border-t border-line bg-card px-5 pt-5 pb-6 shadow-[0_-8px_24px_var(--shadow)]">
        {/* 说明 */}
        <p className="text-[12px] text-muted">
          {itin.today.kind === 'during' ? '今天之后' : '第一天之后'}还有 {upcoming.length} 天 · {data.trip.startDate ? '日期已定' : data.trip.startDateHint ?? '出发日待定'}
        </p>
        {/* 没有了 */}
        {upcoming.length === 0 && <p className="mt-6 text-center text-[14px] text-muted">后面没有安排了，旅途愉快！</p>}
        {/* 每天一张卡片 */}
        <ol className="mt-3 flex flex-col gap-2.5">
          {upcoming.map((d) => {
            // 这天的日程
            const plan = data.dayPlans.find((p) => p.dayIndex === d.dayIndex)
            // 这天的站点名字
            const names = plan?.items.map((i) => i.name) ?? []
            // 卡片
            return (
              <li key={d.dayIndex}>
                <Link to={`/day/${d.dayIndex}`} className="flex gap-3 rounded-2xl border border-line bg-paper/60 p-3.5">
                  {/* 左侧：第几天的大数字 */}
                  <div className="flex w-10 shrink-0 flex-col items-center">
                    <span className="font-serif text-[30px] leading-none font-medium">{d.dayIndex}</span>
                    <span className="text-[10px] tracking-widest text-muted">DAY</span>
                  </div>
                  {/* 右侧：内容 */}
                  <div className="min-w-0 flex-1">
                    {/* 日期标题 + 城市 */}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-semibold">{dayLabel(d)}</span>
                      <span className="truncate font-serif text-[17px]">{d.stop.name}</span>
                    </div>
                    {/* 当天的城际交通 */}
                    {d.segments.map((seg) => {
                      // 出发地
                      const from = data.stops.find((s) => s.id === seg.fromStopId)
                      // 目的地
                      const to = data.stops.find((s) => s.id === seg.toStopId)
                      // 一行交通信息
                      return (
                        <div key={seg.id} className="mt-1 flex items-center gap-1.5 text-[12px] text-accent">
                          <Icon name="arrowRight" size={13} />
                          <span className="truncate">
                            {from?.name} → {to?.name} · {MODE_LABEL[seg.mode]}
                            {seg.timeOfDay && ` · ${seg.timeOfDay}`}
                          </span>
                        </div>
                      )
                    })}
                    {/* 当天的站点 */}
                    <p className="mt-1 truncate text-[12px] text-muted">{names.length > 0 ? names.join(' · ') : '还没安排'}</p>
                  </div>
                  {/* 右箭头 */}
                  <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-muted" />
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
