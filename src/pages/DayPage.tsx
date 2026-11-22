// ============================================================
// 某一天的旅程（“今日旅程”也是这个页面）
//   - 上半屏：大地图，当天要去的地方都标上编号，沿真实街道画出步行路线
//   - 下半屏：当天的顺序清单，每两站之间的步行时间（远的话也显示公交时间），每站可以填时间
//   - “顺路排序”：自动排出总路程最短的顺序
//   - 导航：App 内逐路口导航，或把所有站点一起传给 Google Maps
//   - “在地图上编辑”：去地图标签搜索、放图钉
// ============================================================

// 引入 React 钩子
import { useEffect, useMemo, useState } from 'react'
// 引入路由工具
import { Link, useNavigate, useParams } from 'react-router-dom'
// 引入数据库
import { db } from '../db/db'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入数据结构
import type { DayPlan, DayPlanItem, Segment, Stop } from '../db/schema'
// 引入地图钩子
import { useMap } from '../map/useMap'
// 引入标记
import { stopMarker, useMeMarker } from '../map/markers'
// 引入景点建筑高亮
import { highlightLandmarks } from '../map/layers'
// 引入步行路线绘制
import { drawWalkRoute } from '../map/walkRoute'
// 引入 Google Maps 链接
import { GMAPS_MAX_WAYPOINTS, googleMapsDirections } from '../lib/gmaps'
// 引入定位
import { useGeolocation } from '../lib/useGeolocation'
// 引入步行路线
import { getWalkRoute, type WalkRoute } from '../lib/routing'
// 引入公交时间
import { departureTime, getTransitLeg, type TransitLeg } from '../lib/transit'
// 引入地理工具
import { boundsOf, formatDistance, formatDuration, optimizeOrder, type LngLat } from '../lib/geo'
// 引入行程工具
import { MODE_LABEL, dayLabel } from '../lib/itinerary'
// 引入图标
import { Icon, type IconName } from '../components/Icon'
// 引入地图按钮
import { MapButtons } from '../components/MapButtons'
// 引入底部面板
import { Sheet } from '../components/Sheet'
// 引入地点分类中文名
import { CATEGORY_LABEL } from '../components/PlaceForm'
// 引入交通方式图标
import { MODE_ICON } from './SegmentPage'
// 引入加载画面
import { Loading } from './HomePage'

// 页面组件；today = true 表示从“今日旅程”进来
export default function DayPage({ today = false }: { today?: boolean }) {
  // 读取网址里的天数参数（/day/3 里的 3）
  const params = useParams()
  // 页面跳转工具
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 要显示第几天：“今日旅程”用今天（没出发时是第 1 天），否则用网址参数
  const dayIndex = today ? (itin?.todayIndex ?? 1) : Number(params.n) || 1
  // 当天概况
  const day = itin?.days[dayIndex - 1]
  // 当天日程
  const plan = data?.dayPlans.find((p) => p.dayIndex === dayIndex)
  // 当天的站点（没有日程就是空数组）
  const items = useMemo(() => plan?.items ?? [], [plan])

  // 创建地图
  const { containerRef, map, styleRev, offline } = useMap({ center: [13.4, 52.52], zoom: 12 })
  // 定位
  const geo = useGeolocation(true)
  // 显示我的位置
  useMeMarker(map, geo.position)
  // 步行路线
  const [route, setRoute] = useState<WalkRoute | null>(null)
  // 是否正在计算路线
  const [routing, setRouting] = useState(false)
  // 顶部的小提示（例如“已经是最顺路的顺序”）
  const [toast, setToast] = useState<string | null>(null)
  // 每两站之间的公交方案（下标 i 表示第 i 站到第 i+1 站）
  const [transit, setTransit] = useState<Record<number, TransitLeg | null>>({})
  // 正在填时间的站点
  const [editingTime, setEditingTime] = useState<string | null>(null)
  // 是否显示“从景点添加”面板
  const [pickOpen, setPickOpen] = useState(false)

  // 站点坐标列表
  const points = useMemo(() => items.map((i) => [i.lng, i.lat] as LngLat), [items])
  // 用坐标拼成的 key，坐标变了才重新算路线
  const pointsKey = points.map((p) => p.join(',')).join(';')

  // 计算步行路线
  useEffect(() => {
    // 是否已取消（页面离开或站点又变了）
    let cancelled = false
    // 少于两站不用算
    if (points.length < 2) {
      setRoute(null)
      return
    }
    // 标记正在计算
    setRouting(true)
    // 请求路线
    getWalkRoute(points).then((r) => {
      // 已取消就不更新
      if (cancelled) return
      // 保存路线
      setRoute(r)
      // 计算结束
      setRouting(false)
    })
    // 取消
    return () => {
      cancelled = true
    }
    // 只在坐标变化时重新计算
  }, [pointsKey])

  // 在地图上画路线
  useEffect(() => {
    // 地图样式没好
    if (!map || styleRev === 0) return
    // 画路线（真实路线实线，估算虚线）
    drawWalkRoute(map, 'day', route?.coords ?? [], route?.isReal ?? false)
  }, [map, styleRev, route])

  // 编号标记
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 每站一个标记：1、2、3……
    const markers = items.map((it, i) =>
      stopMarker(String(i + 1), it.name, false, () => map.flyTo({ center: [it.lng, it.lat], zoom: 17, pitch: 60, duration: 1500 }))
        .setLngLat([it.lng, it.lat])
        .addTo(map),
    )
    // 移除旧标记
    return () => markers.forEach((m) => m.remove())
  }, [map, items])

  // 当天所在城市的坐标（没有安排时，地图显示这个城市）
  const cityLng = day?.stop.lng
  const cityLat = day?.stop.lat

  // 地图对准当天所有站点（站点变化时）
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 没有站点：显示当天所在的城市
    if (points.length === 0) {
      if (cityLng !== undefined && cityLat !== undefined) map.jumpTo({ center: [cityLng, cityLat], zoom: 13, pitch: 0 })
      return
    }
    // 只有一站：飞到那里
    if (points.length === 1) {
      map.jumpTo({ center: points[0], zoom: 15.5, pitch: 45 })
      return
    }
    // 多站：装下所有站点，稍微倾斜显示 3D
    const cam = map.cameraForBounds(boundsOf(points), { padding: { top: 90, bottom: 40, left: 40, right: 72 } })
    // 跳过去
    if (cam) map.jumpTo({ ...cam, pitch: 45, bearing: -12 })
  }, [map, pointsKey, cityLng, cityLat])

  // 站点所在的建筑染成淡金色
  useEffect(() => {
    // 地图没好
    if (!map || points.length === 0) return
    // 开始高亮
    return highlightLandmarks(map, points)
  }, [map, points])

  // 提示 2.5 秒后自动消失
  useEffect(() => {
    // 没提示
    if (!toast) return
    // 设置计时器
    const t = setTimeout(() => setToast(null), 2500)
    // 清除计时器
    return () => clearTimeout(t)
  }, [toast])

  // 当天的日期（查公交时刻表用）
  const dayDate = day?.date ?? null
  // 每站的时间拼成的 key（时间变了也要重新查公交）
  const timesKey = items.map((i) => i.time ?? '').join(',')

  // 步行比较远（超过 15 分钟）的两站之间，查一下坐公交要多久
  useEffect(() => {
    // 是否已取消
    let cancelled = false
    // 清空旧结果
    setTransit({})
    // 没有步行路线就不查
    if (!route) return
    // 一个一个查（不同时发很多请求）
    ;(async () => {
      for (let i = 0; i < route.legDurations.length; i++) {
        // 步行不到 15 分钟，不用查公交
        if (route.legDurations[i] < 900) continue
        // 查公交（出发时间用这一站填的时间）
        const leg = await getTransitLeg(points[i], points[i + 1], departureTime(dayDate, items[i]?.time))
        // 已取消就停
        if (cancelled) return
        // 保存
        setTransit((t) => ({ ...t, [i]: leg }))
      }
    })()
    // 取消
    return () => {
      cancelled = true
    }
    // 路线、日期、时间变化时重新查
  }, [route, dayDate, timesKey])

  // 加载中
  if (!data || !itin || !day) return <Loading />

  // 保存新的站点顺序到数据库
  const saveItems = async (next: DayPlanItem[]) => {
    // 已有日程：更新站点列表（改过之后就不再算示例）
    if (plan) await db.dayPlans.update(plan.id, { items: next, isSample: false })
    // 还没有日程：新建
    else {
      // 新日程
      const p: DayPlan = { id: `${data.trip.id}:${dayIndex}`, tripId: data.trip.id, dayIndex, items: next }
      // 写入
      await db.dayPlans.put(p)
    }
  }

  // 顺路排序
  const optimize = async () => {
    // 算出最短顺序
    const order = optimizeOrder(points)
    // 顺序没变
    if (order.every((v, i) => v === i)) {
      setToast('已经是最顺路的顺序了')
      return
    }
    // 按新顺序排列站点并保存
    await saveItems(order.map((i) => items[i]))
    // 提示
    setToast('已按最顺路的顺序重新排列')
  }

  // 把某一站上移或下移
  const move = (i: number, dir: -1 | 1) => {
    // 目标位置
    const j = i + dir
    // 越界就不动
    if (j < 0 || j >= items.length) return
    // 复制数组
    const next = [...items]
    // 交换两站
    ;[next[i], next[j]] = [next[j], next[i]]
    // 保存
    saveItems(next)
  }

  // 删除某一站
  const remove = (i: number) => saveItems(items.filter((_, k) => k !== i))

  // 设置某一站的时间（空的就清除）
  const setTime = (i: number, v: string) => saveItems(items.map((x, k) => (k === i ? { ...x, time: v || undefined } : x)))

  // 这个城市可以加进日程的地点（隐藏的不算；已选定的住处排最前）
  const cityPlaces = data.places
    .filter((p) => p.stopId === day.stop.id && !p.hidden)
    .sort((a, b) => Number(b.category === 'hotel' && b.status !== 'candidate') - Number(a.category === 'hotel' && a.status !== 'candidate'))

  // 当天是平安夜或圣诞节时的提醒
  const holiday = holidayNote(day.date)

  // Google Maps 导航链接（第 1 站是起点）
  const gmaps = googleMapsDirections(items, false)
  // 路线总距离
  const totalDist = route?.legDistances.reduce((a, b) => a + b, 0) ?? 0
  // 路线总时间
  const totalTime = route?.legDurations.reduce((a, b) => a + b, 0) ?? 0
  // 是不是预览（还没出发时看第一天）
  const isPreview = today && itin.today.kind !== 'during'
  // 前一天、后一天是否存在
  const hasPrev = dayIndex > 1
  const hasNext = dayIndex < itin.total

  // 页面内容
  return (
    <div className="relative flex h-full flex-col bg-paper">
      {/* 上半屏：地图 */}
      <div className="relative h-[52%] shrink-0">
        {/* 地图容器 */}
        <div className="absolute inset-0">
          {/* 内层铺满：MapLibre 会给这个 div 加 position: relative，所以定位放在外层 */}
          <div ref={containerRef} className="h-full w-full" />
        </div>
        {/* 顶部：返回按钮 + 当天标题 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),16px)]">
          {/* 返回按钮 */}
          <button
            aria-label="返回"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-glass shadow-[0_2px_10px_var(--shadow)] backdrop-blur"
          >
            <Icon name="back" size={20} />
          </button>
          {/* 标题胶囊 */}
          <div className="pointer-events-auto flex h-11 min-w-0 items-center gap-2 rounded-full border border-line bg-glass px-4 shadow-[0_2px_10px_var(--shadow)] backdrop-blur">
            {/* 城市名（衬线） */}
            <span className="font-serif text-[19px] font-medium">{day.stop.name}</span>
            {/* 第几天 */}
            <span className="truncate text-[13px] text-muted">{dayLabel(day)}</span>
          </div>
        </div>
        {/* 右侧按钮 */}
        <MapButtons map={map} me={geo.position} onLocate={geo.start} className="absolute right-4 bottom-4" />
        {/* 离线提示 */}
        {offline && (
          <div className="absolute inset-x-4 bottom-4 mr-16 rounded-xl bg-accent-soft px-3 py-2 text-[12px] text-accent">现在没有网络，底图暂时显示不了</div>
        )}
      </div>

      {/* 下半屏：清单（可以上下滚动） */}
      <div className="relative -mt-5 flex min-h-0 flex-1 flex-col rounded-t-[26px] border-t border-line bg-card shadow-[0_-8px_24px_var(--shadow)]">
        {/* 滚动区域 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* 第几天 + 预览标签 */}
              <div className="flex items-center gap-2">
                <h1 className="text-[19px] font-semibold">{dayLabel(day)}</h1>
                {/* 预览标签 */}
                {isPreview && <span className="rounded-full bg-oat px-2 py-0.5 text-[11px] text-muted">预览</span>}
              </div>
              {/* 摘要 */}
              <p className="mt-0.5 text-[12px] text-muted">
                {items.length > 0 ? `${day.stop.nameZh} · ${items.length} 站` : day.stop.nameZh}
                {/* 有路线时显示总距离和时间 */}
                {route && totalDist > 0 && ` · 步行约 ${formatDuration(totalTime)} · ${formatDistance(totalDist)}`}
                {/* 正在算路线 */}
                {routing && ' · 正在规划路线…'}
              </p>
            </div>
            {/* 前一天 / 后一天 */}
            <div className="flex shrink-0 gap-1">
              <DayNav to={hasPrev ? `/day/${dayIndex - 1}` : null} icon="back" label="前一天" />
              <DayNav to={hasNext ? `/day/${dayIndex + 1}` : null} icon="chevronRight" label="后一天" />
            </div>
          </div>

          {/* 预览说明 */}
          {isPreview && (
            <p className="mt-3 rounded-xl bg-oat px-3 py-2 text-[12px] leading-relaxed text-muted">
              还没出发，这里先显示旅途第一天。旅行开始后会自动切换成当天的安排。
            </p>
          )}

          {/* 平安夜 / 圣诞节提醒 */}
          {holiday && (
            <Link to={`/city/${day.stop.id}?tab=transport`} className="mt-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-[12px] leading-relaxed text-accent">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
              <span className="flex-1">{holiday}</span>
              <Icon name="chevronRight" size={14} className="mt-0.5 shrink-0" />
            </Link>
          )}

          {/* 当天的城际交通（点进去看可选方式） */}
          {day.segments.map((seg) => (
            <SegmentCard key={seg.id} seg={seg} stops={data.stops} />
          ))}

          {/* 示例说明 */}
          {plan?.isSample && items.length > 0 && (
            <p className="mt-3 text-[12px] leading-relaxed text-muted">这是演示用的示例安排，可以调整顺序、删除，或者点下面的「在地图上编辑」添加地点。</p>
          )}

          {/* 路线是估算的 */}
          {route && !route.isReal && <p className="mt-2 text-[12px] text-accent">没联网：先用直线估算，联网后会显示真实街道路线。</p>}

          {/* 站点清单 */}
          {items.length > 0 ? (
            <ol className="mt-3 flex flex-col">
              {items.map((it, i) => (
                <li key={it.id}>
                  {/* 两站之间的步行信息 */}
                  {i > 0 && <LegInfo walk={route ? { duration: route.legDurations[i - 1], distance: route.legDistances[i - 1] } : null} transit={transit[i - 1]} />}
                  {/* 站点行 */}
                  <div className="flex items-center gap-3">
                    {/* 编号圆圈 */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-on-accent">{i + 1}</span>
                    {/* 名字（点一下地图飞过去） */}
                    <button
                      onClick={() => map?.flyTo({ center: [it.lng, it.lat], zoom: 17, pitch: 60, duration: 1500 })}
                      className="min-h-[44px] min-w-0 flex-1 truncate text-left text-[15px]"
                    >
                      {it.name}
                    </button>
                    {/* 时间：点一下填写 */}
                    {editingTime === it.id ? (
                      <input
                        // 时间选择
                        type="time"
                        // 读屏文字
                        aria-label={`${it.name} 的时间`}
                        // 自动聚焦
                        autoFocus
                        // 当前值
                        defaultValue={it.time ?? ''}
                        // 离开时保存
                        onBlur={(e) => {
                          setTime(i, e.target.value)
                          setEditingTime(null)
                        }}
                        // 样式
                        className="h-9 w-[92px] shrink-0 rounded-lg border border-line-strong bg-paper px-1.5 text-[13px] text-ink"
                      />
                    ) : (
                      <button onClick={() => setEditingTime(it.id)} className={`h-8 shrink-0 rounded-full px-2.5 text-[12px] ${it.time ? 'bg-ink text-paper' : 'bg-oat text-muted'}`}>
                        {it.time ?? '时间'}
                      </button>
                    )}
                    {/* 上移 */}
                    <SmallBtn label="上移" icon="chevronUp" disabled={i === 0} onClick={() => move(i, -1)} />
                    {/* 下移 */}
                    <SmallBtn label="下移" icon="chevronDown" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
                    {/* 删除 */}
                    <SmallBtn label="删除" icon="close" onClick={() => remove(i)} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            // 没有安排
            <div className="mt-6 flex flex-col items-center gap-2 text-center">
              <Icon name="snow" size={28} className="text-line-strong" />
              <p className="text-[14px]">这一天还没有安排</p>
              <p className="text-[12px] text-muted">在地图上搜索或放图钉，就能加进这一天</p>
            </div>
          )}

          {/* 添加地点：从景点列表挑 / 在地图上编辑 */}
          <div className="mt-5 flex gap-2">
            {/* 从景点列表挑 */}
            <button onClick={() => setPickOpen(true)} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line-strong text-[14px]">
              <Icon name="plus" size={16} />
              从景点添加
            </button>
            {/* 在地图上编辑 */}
            <Link to={`/map?day=${dayIndex}`} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line-strong text-[14px]">
              <Icon name="map" size={16} />
              在地图上编辑
            </Link>
          </div>

          {/* 操作按钮 */}
          {items.length > 1 && (
            <div className="mt-2 flex flex-col gap-2">
              {/* 顺路排序（第 1 站不动） */}
              <button onClick={optimize} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[14px]">
                <Icon name="sparkle" size={17} />
                顺路排序（第 1 站不动）
              </button>
              {/* 导航：App 内 / Google Maps */}
              <div className="flex gap-2">
                {/* App 内逐路口导航 */}
                <Link to={`/nav?day=${dayIndex}`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink text-[14px] text-paper">
                  <Icon name="navigate" size={17} />
                  App 内导航
                </Link>
                {/* Google Maps */}
                <a href={gmaps} target="_blank" rel="noopener noreferrer" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[14px]">
                  <Icon name="external" size={16} />
                  Google Maps
                </a>
              </div>
              {/* 站点太多时提醒 */}
              {items.length > GMAPS_MAX_WAYPOINTS + 2 && (
                <p className="text-center text-[11px] text-muted">Google Maps 一次最多 {GMAPS_MAX_WAYPOINTS + 2} 站，超出的部分没有传过去</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 从景点添加 */}
      {pickOpen && (
        <Sheet title={`添加到${dayLabel(day)}`} onClose={() => setPickOpen(false)}>
          {/* 没有地点 */}
          {cityPlaces.length === 0 && (
            <p className="py-6 text-center text-[13px] leading-relaxed text-muted">
              {day.stop.name} 还没有酒店或景点。
              <br />
              可以先去
              <Link to={`/city/${day.stop.id}?tab=spots`} className="mx-1 text-accent underline">
                城市详情
              </Link>
              添加。
            </p>
          )}
          {/* 地点列表 */}
          <ul className="flex flex-col gap-2 pb-2">
            {cityPlaces.map((p) => {
              // 已经在当天日程里了
              const added = items.some((it) => it.placeId === p.id)
              // 一行
              return (
                <li key={p.id}>
                  <button
                    // 已加过的不能重复加
                    disabled={added}
                    // 加到最后
                    onClick={async () => {
                      await saveItems([...items, { id: `item-${crypto.randomUUID()}`, placeId: p.id, name: p.name, lat: p.lat, lng: p.lng }])
                      setToast(`已添加「${p.name}」`)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      {/* 名称 */}
                      <span className="block truncate text-[14px] font-medium">{p.name}</span>
                      {/* 分类 */}
                      <span className="block text-[12px] text-muted">
                        {p.category === 'hotel' && p.status !== 'candidate' ? '住处' : CATEGORY_LABEL[p.category]}
                        {p.duration && ` · 建议 ${p.duration}`}
                      </span>
                    </span>
                    {/* 状态 */}
                    <span className="shrink-0 text-[12px] text-muted">{added ? '已在日程里' : <Icon name="plus" size={16} />}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Sheet>
      )}

      {/* 顶部小提示 */}
      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),16px)+56px)] z-[60] flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2 text-[13px] text-paper shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  )
}

// 城际交通卡片
function SegmentCard({ seg, stops }: { seg: Segment; stops: Stop[] }) {
  // 出发地
  const from = stops.find((s) => s.id === seg.fromStopId)
  // 目的地
  const to = stops.find((s) => s.id === seg.toStopId)
  // 选定的方式
  const chosen = seg.options?.find((o) => o.id === seg.chosenOptionId)
  // 返回卡片（点进去看可选方式）
  return (
    <Link to={`/segment/${seg.id}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-paper/60 px-3.5 py-3">
      {/* 交通图标 */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oat text-ink">
        <Icon name={MODE_ICON[seg.mode]} size={18} />
      </span>
      {/* 文字 */}
      <div className="min-w-0 flex-1">
        {/* 出发 → 到达 */}
        <div className="truncate text-[14px] font-medium">
          {from?.name} → {to?.name}
        </div>
        {/* 方式、时段：选了方式显示运营商，没选显示有几种可选 */}
        <div className="truncate text-[12px] text-muted">
          {chosen ? `${MODE_LABEL[chosen.mode]} · ${chosen.provider}` : MODE_LABEL[seg.mode]}
          {seg.timeOfDay && ` · ${seg.timeOfDay}`}
          {!chosen && seg.options?.length ? ` · ${seg.options.length} 种可选方式` : ''}
        </div>
      </div>
      {/* 是否已订 */}
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${seg.booked ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>
        {seg.booked ? '已订' : '未订'}
      </span>
      {/* 箭头 */}
      <Icon name="chevronRight" size={15} className="shrink-0 text-muted" />
    </Link>
  )
}

// 两站之间的交通信息：步行时间和距离；如果公交明显更快，也显示公交
function LegInfo({ walk, transit }: { walk: { duration: number; distance: number } | null; transit: TransitLeg | null | undefined }) {
  // 公交比步行快 3 分钟以上才显示
  const showTransit = walk && transit && transit.duration < walk.duration - 180
  // 返回
  return (
    <div className="flex items-stretch gap-2 py-1 pl-[13px] text-[11px] text-muted">
      {/* 竖线 */}
      <span className="w-px shrink-0 bg-line-strong" />
      <div className="flex flex-col gap-0.5 py-0.5">
        {/* 步行 */}
        <span className="flex items-center gap-1.5">
          <Icon name="walk" size={14} />
          {walk ? `步行 ${formatDuration(walk.duration)} · ${formatDistance(walk.distance)}` : '计算中…'}
        </span>
        {/* 公交 */}
        {showTransit && (
          <span className="flex items-center gap-1.5 text-ink">
            <Icon name="train" size={14} />
            公交约 {formatDuration(transit.duration)}（{transit.summary}）
          </span>
        )}
      </div>
    </div>
  )
}

// 平安夜 / 圣诞节的提醒文字（日期没定或不是这几天就返回 null）
function holidayNote(date: string | null): string | null {
  // 没有日期
  if (!date) return null
  // 月-日
  const md = date.slice(5)
  // 平安夜
  if (md === '12-24') return '平安夜：商店和很多景点下午提前关门，晚上公交班次减少。点这里看本城的交通提醒。'
  // 圣诞节两天
  if (md === '12-25' || md === '12-26') return '圣诞节：多数商店关门，部分景点不开放，公交按周日 / 节假日时刻表。点这里看本城的交通提醒。'
  // 其他日子
  return null
}

// 小图标按钮（上移、下移、删除）
function SmallBtn({ label, icon, disabled, onClick }: { label: string; icon: IconName; disabled?: boolean; onClick: () => void }) {
  // 返回按钮
  return (
    <button
      // 读屏文字
      aria-label={label}
      // 禁用状态
      disabled={disabled}
      // 点击
      onClick={onClick}
      // 36 像素方形按钮，禁用时变淡
      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-30"
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

// 前一天 / 后一天按钮
function DayNav({ to, icon, label }: { to: string | null; icon: IconName; label: string }) {
  // 没有前一天/后一天：显示禁用的按钮
  if (!to)
    return (
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted opacity-30">
        <Icon name={icon} size={16} />
      </span>
    )
  // 有：显示链接（replace 表示不在历史记录里堆积）
  return (
    <Link to={to} replace aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong">
      <Icon name={icon} size={16} />
    </Link>
  )
}
