// ============================================================
// 城市详情页（/city/城市ID）
//   标签：酒店 / 景点 / 日程 / 交通 / 地图 / 相册 / 天气
//   - 可以打开任何一次旅行里的城市（例如在「城市」里点以前去过的城市看相册）
//   - 酒店、景点：可以自己添加、编辑、删除，状态：候选 / 已选定 / 已预订
//   - 酒店选定一个后，可以一键隐藏或删除其余候选
//   - 我推荐的项目有“推荐 · 需核实”标签
// ============================================================

// 引入 React 钩子
import { useEffect, useMemo, useState, type ReactNode } from 'react'
// 引入路由工具
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
// 引入数据钩子
import { useActiveTripId, useItinerary, useTripData, type TripData } from '../db/hooks'
// 引入数据库（查这个城市属于哪次旅行）
import { db } from '../db/db'
import { useLiveQuery } from 'dexie-react-hooks'
// 引入切换旅行
import { setActiveTrip } from '../db/trip'
// 引入相册
import { Album } from '../components/Album'
// 引入天气
import { WeatherView } from '../components/WeatherView'
// 引入市内交通（你可能感兴趣、查路线、我的交通）
import { CityTransport } from '../components/CityTransport'
// 引入按位置找交通指南
import { guideFor } from '../data/content'
// 引入数据结构
import type { Place, PlaceCategory, Segment, Stop } from '../db/schema'
// 引入数据操作
import { addPlaceToDay, deleteCandidateHotels, setOtherHotelsHidden, updateStop } from '../db/trip'
// 引入行程工具
import { MODE_LABEL, computeSpans, dayLabel, type DayInfo } from '../lib/itinerary'
// 引入地理工具
import { boundsOf, type LngLat } from '../lib/geo'
// 引入 Google Maps 链接
import { googleMapsDirections } from '../lib/gmaps'
// 引入地图
import { useMap } from '../map/useMap'
import { placeMarker, useMeMarker } from '../map/markers'
import { highlightLandmarks } from '../map/layers'
// 引入定位
import { useGeolocation } from '../lib/useGeolocation'
// 引入组件
import { Icon, type IconName } from '../components/Icon'
import { PlaceCard, statusClass } from '../components/PlaceCard'
import { PlaceForm, STATUS_LABEL } from '../components/PlaceForm'
import { Sheet, TEXTAREA } from '../components/Sheet'
import { MapButtons } from '../components/MapButtons'
// 引入加载画面
import { Loading } from './HomePage'
// 引入国名
import { countryLocalUpper } from '../lib/countries'

// 标签
type Tab = 'hotel' | 'spots' | 'plan' | 'transport' | 'map' | 'album' | 'weather'
// 标签列表
const TABS: { value: Tab; label: string }[] = [
  { value: 'hotel', label: '酒店' },
  { value: 'spots', label: '景点' },
  { value: 'plan', label: '日程' },
  { value: 'transport', label: '交通' },
  { value: 'map', label: '地图' },
  { value: 'album', label: '相册' },
  { value: 'weather', label: '天气' },
]


// 状态排序：已预订 → 已选定 → 候选
const STATUS_ORDER = { booked: 0, selected: 1, candidate: 2 } as const

// 页面组件
export default function CityPage() {
  // 网址参数
  const { id } = useParams()
  // 网址里的 ?tab=
  const [search, setSearch] = useSearchParams()
  // 页面跳转
  const navigate = useNavigate()
  // 这个城市属于哪次旅行（null = 找不到这个城市）
  const owner = useLiveQuery(async () => (id ? ((await db.stops.get(id))?.tripId ?? null) : null), [id])
  // 当前旅行 ID
  const activeTripId = useActiveTripId()
  // 读这个城市所在旅行的数据（找不到就读当前旅行）
  const data = useTripData(owner ?? undefined)
  // 每天概况
  const itin = useItinerary(data)
  // 当前标签（记在网址里，返回时还在原来的标签）
  const tab = (search.get('tab') as Tab | null) ?? 'hotel'
  // 切换标签
  const setTab = (t: Tab) => setSearch({ tab: t }, { replace: true })
  // 展开的卡片
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // 表单状态（null = 不显示）
  const [form, setForm] = useState<{ initial: Place | null; category: PlaceCategory } | null>(null)
  // 正在选择“加入哪一天”的地点
  const [dayPickFor, setDayPickFor] = useState<Place | null>(null)
  // 是否显示已隐藏的酒店
  const [showHidden, setShowHidden] = useState(false)
  // 地图上要聚焦的地点
  const [mapFocus, setMapFocus] = useState<string | null>(null)
  // 顶部提示
  const [toast, setToast] = useState<string | null>(null)

  // 提示自动消失
  useEffect(() => {
    // 没提示
    if (!toast) return
    // 2.5 秒后消失（长的提示多停一会儿）
    const t = setTimeout(() => setToast(null), toast.length > 24 ? 5000 : 2500)
    // 清除
    return () => clearTimeout(t)
  }, [toast])

  // 这个城市
  const stop = data?.stops.find((s) => s.id === id)
  // 城市中心（给表单用；记住它，避免每次渲染都变）
  const center = useMemo<LngLat>(() => (stop ? [stop.lng, stop.lat] : [0, 0]), [stop])
  // 这个城市的时间段
  const span = useMemo(() => (data && stop ? computeSpans(data.stops).find((s) => s.stop.id === stop.id) : undefined), [data, stop])
  // 这个城市的所有地点
  const places = useMemo(() => (data && stop ? data.places.filter((p) => p.stopId === stop.id) : []), [data, stop])

  // 加载中（也要等查到城市属于哪次旅行，避免先显示错的旅行）
  if (!data || !itin || owner === undefined || (owner && data.trip.id !== owner)) return <Loading />
  // 找不到这个城市（例如被删了）
  if (!stop)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-paper">
        <p className="text-muted">找不到这个城市</p>
        <Link to="/" className="text-accent underline">
          回首页
        </Link>
      </div>
    )

  // 排序：状态优先，再按添加时间
  const sorted = [...places].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.createdAt ?? 0) - (b.createdAt ?? 0))
  // 酒店
  const hotels = sorted.filter((p) => p.category === 'hotel')
  // 景点等其他地点
  const spots = sorted.filter((p) => p.category !== 'hotel')
  // 已选定或已预订的酒店
  const chosenHotel = hotels.find((h) => h.status !== 'candidate')
  // 还显示着的候选酒店
  const visibleCandidates = hotels.filter((h) => h.status === 'candidate' && !h.hidden)
  // 已隐藏的数量
  const hiddenCount = hotels.filter((h) => h.hidden).length
  // 列表里要显示的酒店
  const shownHotels = hotels.filter((h) => showHidden || !h.hidden)
  // 这个城市的天（到达日到离开日；“以后想去”的城市没有）
  const cityDays = span ? itin.days.filter((d) => d.dayIndex >= span.arriveDay && d.dayIndex <= span.departDay) : []
  // 和这个城市有关的交通（到达和离开）
  const segs = data.segments.filter((s) => s.toStopId === stop.id || s.fromStopId === stop.id)

  // 卡片的公共回调
  const cardProps = (p: Place) => ({
    place: p,
    expanded: expandedId === p.id,
    onToggle: () => setExpandedId((cur) => (cur === p.id ? null : p.id)),
    onEdit: () => setForm({ initial: p, category: p.category }),
    onShowOnMap: () => {
      setMapFocus(p.id)
      setTab('map')
    },
  })

  // 日期范围文字（“以后想去”的城市显示“以后去”）
  const first = span ? itin.days[span.arriveDay - 1] : undefined
  const last = span ? itin.days[span.departDay - 1] : undefined
  // 有日期就显示日期，否则显示第几天
  const rangeText = !span ? '以后去 · 不在本次旅行里' : first?.date && last?.date ? `${dayLabel(first)} — ${dayLabel(last)}` : `第 ${span.arriveDay}–${span.departDay} 天`

  // 页面内容
  return (
    <div className="relative flex h-full flex-col bg-paper">
      {/* 顶部：返回 + 城市名 */}
      <header className="shrink-0 px-5 pt-[max(env(safe-area-inset-top),12px)]">
        {/* 返回 */}
        <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
          <Icon name="back" size={22} />
        </button>
        {/* 国家（相册标签里省掉，给照片多留空间） */}
        {tab !== 'album' && <div className="text-[11px] tracking-[0.16em] text-muted">{countryLocalUpper(stop.country)}</div>}
        {/* 城市名（相册标签里小一点，封面上已经有大字城市名） */}
        <h1 className={`font-serif leading-none font-medium ${tab === 'album' ? 'text-[30px]' : 'text-[46px]'}`}>{stop.name}</h1>
        {/* 中文名、日期、住几晚 */}
        <p className="mt-1.5 text-[14px] text-muted">
          {stop.nameZh} · {rangeText}
          {stop.kind === 'stay' && ` · 住 ${stop.nights} 晚`}
        </p>
        {/* 不是当前旅行里的城市：说明一下，可以切换过去 */}
        {activeTripId && data.trip.id !== activeTripId && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-oat px-3 py-2 text-[12px]">
            <span className="min-w-0 truncate text-muted">来自旅行「{data.trip.name}」</span>
            <button onClick={() => setActiveTrip(data.trip.id).then(() => navigate('/'))} className="shrink-0 text-accent underline underline-offset-2">
              切换到这次旅行
            </button>
          </div>
        )}
        {/* 标签栏 */}
        <div role="tablist" aria-label="城市内容" className="mt-4 flex gap-1 rounded-2xl bg-oat p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`h-9 min-w-0 flex-1 rounded-xl px-0 text-[13px] ${tab === t.value ? 'bg-card font-medium text-ink shadow-sm' : 'text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* 内容区 */}
      {tab === 'map' ? (
        // 地图标签：铺满剩余空间
        <CityMap
          places={places.filter((p) => !p.hidden)}
          center={center}
          focusId={mapFocus}
          onOpen={(p) => {
            setExpandedId(p.id)
            setTab(p.category === 'hotel' ? 'hotel' : 'spots')
          }}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-8">
          {/* ===== 天气 ===== */}
          {tab === 'weather' && <WeatherView stop={stop} stayDates={cityDays.map((d) => d.date).filter((d): d is string => !!d)} />}

          {/* ===== 相册 ===== */}
          {tab === 'album' && <Album stop={stop} tripId={data.trip.id} places={places} onToast={setToast} />}

          {/* ===== 酒店 ===== */}
          {tab === 'hotel' && (
            <>
              {/* 摘要 + 添加 */}
              <ListHeader
                summary={hotels.length === 0 ? '还没有住宿' : `${hotels.length} 个住宿${chosenHotel ? ` · 已${STATUS_LABEL[chosenHotel.status].replace('已', '')}「${chosenHotel.name}」` : ''}`}
                onAdd={() => setForm({ initial: null, category: 'hotel' })}
              />
              {/* 选定后：隐藏或删除其余候选 */}
              {chosenHotel && visibleCandidates.length > 0 && (
                <div className="mt-3 rounded-2xl bg-oat p-3.5">
                  <p className="text-[13px]">已经选好住宿了，其余 {visibleCandidates.length} 个候选要怎么处理？</p>
                  <div className="mt-2.5 flex gap-2">
                    {/* 隐藏 */}
                    <button onClick={() => setOtherHotelsHidden(stop.id, true)} className="h-10 flex-1 rounded-xl bg-ink text-[13px] text-paper">
                      隐藏其余候选
                    </button>
                    {/* 删除 */}
                    <button
                      onClick={async () => {
                        if (window.confirm(`删除其余 ${visibleCandidates.length} 个候选住宿？`)) await deleteCandidateHotels(stop.id)
                      }}
                      className="h-10 flex-1 rounded-xl border border-line-strong text-[13px]"
                    >
                      全部删除
                    </button>
                  </div>
                </div>
              )}
              {/* 卡片列表 */}
              <div className="mt-3 flex flex-col gap-2.5">
                {shownHotels.map((p) => (
                  <PlaceCard key={p.id} {...cardProps(p)} />
                ))}
              </div>
              {/* 显示/收起已隐藏的 */}
              {hiddenCount > 0 && (
                <button onClick={() => setShowHidden((v) => !v)} className="mt-3 h-11 w-full text-[13px] text-muted underline underline-offset-4">
                  {showHidden ? '收起已隐藏的候选' : `显示已隐藏的 ${hiddenCount} 个候选`}
                </button>
              )}
              {/* 空状态 */}
              {hotels.length === 0 && <Empty text="推荐的青旅和经济型酒店会在第 7 步调研后填进来。现在也可以先自己添加。" />}
            </>
          )}

          {/* ===== 景点 ===== */}
          {tab === 'spots' && (
            <>
              {/* 摘要 + 添加 */}
              <ListHeader summary={spots.length === 0 ? '还没有景点' : `${spots.length} 个地点`} onAdd={() => setForm({ initial: null, category: 'attraction' })} />
              {/* 卡片列表 */}
              <div className="mt-3 flex flex-col gap-2.5">
                {spots.map((p) => (
                  <PlaceCard key={p.id} {...cardProps(p)} onAddToDay={() => setDayPickFor(p)} />
                ))}
              </div>
              {/* 空状态 */}
              {spots.length === 0 && <Empty text="还没有景点。点「自己添加」搜索名字或地址；也可以在底部「地图」里搜索后放图钉、存进某一天的日程。" />}
            </>
          )}

          {/* ===== 日程 ===== */}
          {tab === 'plan' && (
            <div className="flex flex-col gap-2.5">
              {/* 以后想去的城市：没有日程 */}
              {!span && (
                <p className="rounded-2xl bg-oat p-4 text-[13px] leading-relaxed text-muted">
                  这个城市不在本次旅行里。在「本次旅行」里把它加进来后，这里会显示每天的安排。
                  <Link to="/trip" className="mt-2 block text-accent underline underline-offset-2">
                    去本次旅行
                  </Link>
                </p>
              )}
              {cityDays.map((d) => {
                // 这天的日程
                const plan = data.dayPlans.find((p) => p.dayIndex === d.dayIndex)
                // 站点名
                const names = plan?.items.map((i) => i.name) ?? []
                // 一张卡片
                return (
                  <Link key={d.dayIndex} to={`/day/${d.dayIndex}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5">
                    {/* 第几天 */}
                    <div className="flex w-10 shrink-0 flex-col items-center">
                      <span className="font-serif text-[28px] leading-none font-medium">{d.dayIndex}</span>
                      <span className="text-[10px] tracking-widest text-muted">DAY</span>
                    </div>
                    {/* 内容 */}
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold">{dayLabel(d)}</div>
                      {/* 当天的交通 */}
                      {d.segments.length > 0 && <div className="truncate text-[12px] text-accent">{d.segments.map((s) => segText(s, data.stops)).join(' · ')}</div>}
                      {/* 站点 */}
                      <div className="truncate text-[12px] text-muted">{names.length ? names.join(' · ') : '还没安排'}</div>
                    </div>
                    <Icon name="chevronRight" size={16} className="shrink-0 text-muted" />
                  </Link>
                )
              })}
              {span && <p className="mt-1 text-[12px] leading-relaxed text-muted">在「景点」里点开一个地点，按「加入日程」就能放进某一天。</p>}
            </div>
          )}

          {/* ===== 交通 ===== */}
          {tab === 'transport' && (
            <div className="flex flex-col gap-2.5">
              {/* 到达和离开这个城市的城际交通（点进去看可选方式） */}
              {segs.map((s) => {
                // 选定的方式
                const chosen = s.options?.find((o) => o.id === s.chosenOptionId)
                // 一行
                return (
                  <Link key={s.id} to={`/segment/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oat">
                      <Icon name={MODE_ICON[s.mode]} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{segText(s, data.stops)}</div>
                      <div className="truncate text-[12px] text-muted">
                        {s.toStopId === stop.id ? '到达' : '离开'}
                        {s.timeOfDay && ` · ${s.timeOfDay}`}
                        {chosen ? ` · ${chosen.provider}` : s.options?.length ? ` · ${s.options.length} 种可选方式` : ''}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${s.booked ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{s.booked ? '已订' : '未订'}</span>
                    <Icon name="chevronRight" size={15} className="shrink-0 text-muted" />
                  </Link>
                )
              })}
              {/* 市内交通指南 */}
              <CityGuideView stop={stop} hotel={chosenHotel ?? null} data={data} cityDays={cityDays} />
            </div>
          )}
        </div>
      )}

      {/* 表单 */}
      {form && (
        <PlaceForm tripId={data.trip.id} stopId={stop.id} cityCenter={center} initial={form.initial} defaultCategory={form.category} onClose={() => setForm(null)} />
      )}

      {/* 加入哪一天 */}
      {dayPickFor && (
        <Sheet title={`把「${dayPickFor.name}」加入哪一天？`} onClose={() => setDayPickFor(null)}>
          <ul className="flex flex-col gap-2 pb-2">
            {cityDays.map((d) => {
              // 这天已有几个地点
              const count = data.dayPlans.find((p) => p.dayIndex === d.dayIndex)?.items.length ?? 0
              // 一行
              return (
                <li key={d.dayIndex}>
                  <button
                    onClick={async () => {
                      // 加进去
                      await addPlaceToDay(data.trip.id, d.dayIndex, dayPickFor)
                      // 关闭
                      setDayPickFor(null)
                      // 提示
                      setToast(`已加入${dayLabel(d)}`)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-[14px] font-medium">{dayLabel(d)}</span>
                      <span className="block text-[12px] text-muted">{count > 0 ? `已有 ${count} 个地点，加在最后` : '还没安排'}</span>
                    </span>
                    <Icon name="plus" size={16} className="text-muted" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Sheet>
      )}

      {/* 提示 */}
      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+8px)] z-50 flex justify-center px-6">
          <span className="rounded-full bg-ink px-4 py-2 text-[13px] text-paper shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  )
}

// 交通方式图标
const MODE_ICON: Record<Segment['mode'], IconName> = { train: 'train', bus: 'bus', flight: 'plane', ferry: 'bus', car: 'bus', tbd: 'question' }

// 交通的文字，例如 “Berlin → København · 火车”
function segText(s: Segment, stops: { id: string; name: string }[]): string {
  // 出发地
  const from = stops.find((x) => x.id === s.fromStopId)?.name ?? '?'
  // 目的地
  const to = stops.find((x) => x.id === s.toStopId)?.name ?? '?'
  // 拼接
  return `${from} → ${to} · ${MODE_LABEL[s.mode]}`
}

// 列表顶部：摘要 + “自己添加”按钮
function ListHeader({ summary, onAdd }: { summary: string; onAdd: () => void }) {
  // 返回
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-[13px] text-muted">{summary}</span>
      <button onClick={onAdd} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-4 text-[13px]">
        <Icon name="plus" size={15} />
        自己添加
      </button>
    </div>
  )
}

// 空状态
function Empty({ text }: { text: string }) {
  // 返回
  return (
    <div className="mt-8 flex flex-col items-center gap-2 px-6 text-center">
      <Icon name="snow" size={28} className="text-line-strong" />
      <p className="text-[13px] leading-relaxed text-muted">{text}</p>
    </div>
  )
}

// 城市地图：酒店和景点用不同图标，已选定的高亮
function CityMap({ places, center, focusId, onOpen }: { places: Place[]; center: LngLat; focusId: string | null; onOpen: (p: Place) => void }) {
  // 地图
  const { containerRef, map } = useMap({ center, zoom: 13 })
  // 定位
  const geo = useGeolocation(true)
  // 我的位置
  useMeMarker(map, geo.position)
  // 选中的地点
  const [selected, setSelected] = useState<Place | null>(null)

  // 标记
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 每个地点一个标记
    const markers = places.map((p) =>
      placeMarker(p.name, p.category === 'hotel', p.status !== 'candidate', () => setSelected(p))
        .setLngLat([p.lng, p.lat])
        .addTo(map),
    )
    // 移除
    return () => markers.forEach((m) => m.remove())
  }, [map, places])

  // 初始视角：有要聚焦的地点就飞过去，否则装下所有地点
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 要聚焦的地点
    const f = focusId ? places.find((p) => p.id === focusId) : null
    // 有：飞过去
    if (f) {
      map.jumpTo({ center: [f.lng, f.lat], zoom: 16.5, pitch: 50 })
      setSelected(f)
      return
    }
    // 少于两个地点：显示城市中心
    if (places.length < 2) return
    // 装下全部（右边多留一些，给已选定地点的名字标签）
    const cam = map.cameraForBounds(boundsOf(places.map((p) => [p.lng, p.lat] as LngLat)), { padding: { top: 60, bottom: 70, left: 40, right: 150 } })
    // 跳过去
    if (cam) map.jumpTo(cam)
    // 只在地图创建时执行一次
  }, [map])

  // 景点建筑染金色
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 只高亮景点类
    return highlightLandmarks(
      map,
      places.filter((p) => p.category === 'attraction' || p.category === 'market').map((p) => [p.lng, p.lat] as LngLat),
    )
  }, [map, places])

  // 返回地图
  return (
    <div className="relative mt-3 min-h-0 flex-1">
      {/* 地图容器 */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {/* 图例 */}
      <div className="pointer-events-none absolute top-3 left-3 flex gap-3 rounded-full bg-glass px-3 py-1.5 text-[11px] text-muted shadow-sm">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-[4px] border-2 border-ink" />
          住宿
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full border-2 border-gold" />
          景点
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-accent" />
          已选定
        </span>
      </div>
      {/* 地图按钮 */}
      <MapButtons map={map} me={geo.position} onLocate={geo.start} className={`absolute right-4 ${selected ? 'bottom-[150px]' : 'bottom-5'}`} />
      {/* 选中的地点卡片 */}
      {selected && (
        <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-line bg-card p-3.5 shadow-[0_6px_24px_var(--shadow)]">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {/* 名称 */}
              <div className="truncate text-[15px] font-semibold">{selected.name}</div>
              {/* 状态和价格 */}
              <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(selected.status)}`}>{STATUS_LABEL[selected.status]}</span>
                <span className="truncate">{selected.priceNote ?? selected.ticket ?? selected.address ?? ''}</span>
              </div>
            </div>
            {/* 关闭 */}
            <button aria-label="关闭" onClick={() => setSelected(null)} className="-mt-1 -mr-1 flex h-9 w-9 items-center justify-center text-muted">
              <Icon name="close" size={16} />
            </button>
          </div>
          {/* 操作 */}
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => onOpen(selected)} className="h-10 flex-1 rounded-xl bg-ink text-[13px] text-paper">
              查看详情
            </button>
            <a href={googleMapsDirections([selected], true)} target="_blank" rel="noopener noreferrer" className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px]">
              <Icon name="navigate" size={15} />
              导航
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// 市内交通指南：车票、App、到了以后怎么走、节日提醒、我的笔记、来源
function CityGuideView({ stop, hotel, data, cityDays }: { stop: Stop; hotel: Place | null; data: TripData; cityDays: DayInfo[] }) {
  // 指南（推荐内容）：初始行程存在城市上；其他旅行按位置找（例如米兰、佛罗伦萨、罗马）
  const g = stop.guide ?? guideFor(stop)
  // 返回
  return (
    <div className="mt-2 flex flex-col gap-3">
      {/* 节日提醒（最重要，放最前面） */}
      {g && g.holidayNotes.length > 0 && (
        <GuideSection title={g.holidayTitle ?? '圣诞期间'} icon="alert" accent>
          <ul className="flex flex-col gap-1.5">
            {g.holidayNotes.map((t) => (
              <li key={t} className="text-[13px] leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {/* 你可能感兴趣、查路线、我的交通 */}
      <CityTransport stop={stop} data={data} hotel={hotel} cityDays={cityDays} />

      {/* 到了以后怎么走 */}
      {g && g.arrivals.length > 0 && (
        <GuideSection title={hotel ? `到了以后怎么去「${hotel.name}」` : '到了以后怎么进城'} icon="pin">
          <ul className="flex flex-col gap-3">
            {g.arrivals.map((a) => (
              <li key={a.name}>
                {/* 车站名 */}
                <div className="text-[14px] font-medium">
                  {a.name} <span className="text-[12px] font-normal text-muted">{a.nameZh}</span>
                </div>
                {/* 怎么走 */}
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{a.how}</p>
                {/* 一键查路线：选好住处就到住处，否则到市中心 */}
                <a
                  href={googleMapsDirections([a, hotel ?? { lat: stop.lat, lng: stop.lng }], false, 'transit')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[12px]"
                >
                  <Icon name="navigate" size={13} />
                  {hotel ? '公交路线到住处' : '公交路线到市中心'}
                </a>
              </li>
            ))}
          </ul>
          {/* 还没选住处的提示 */}
          {!hotel && <p className="mt-3 text-[12px] text-muted">在「酒店」里选定住处后，这里会直接显示到住处的路线。</p>}
        </GuideSection>
      )}

      {/* 车票 */}
      {g && g.tickets.length > 0 && (
        <GuideSection title="车票" icon="ticket">
          <ul className="flex flex-col gap-2.5">
            {g.tickets.map((t) => (
              <li key={t.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium">{t.name}</span>
                  <span className="shrink-0 text-[13px]">{t.price}</span>
                </div>
                {t.note && <p className="text-[12px] leading-relaxed text-muted">{t.note}</p>}
              </li>
            ))}
          </ul>
          {/* 在哪里买 */}
          {g.buy && g.buy.length > 0 && (
            <div className="mt-3 rounded-xl bg-oat px-3 py-2.5">
              <div className="text-[12px] font-semibold">在哪里买</div>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-[12px] leading-relaxed">
                {g.buy.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </GuideSection>
      )}

      {/* 推荐 App */}
      {g && g.apps.length > 0 && (
        <GuideSection title="推荐 App" icon="more">
          <ul className="flex flex-col gap-2">
            {g.apps.map((a) => (
              <li key={a.name} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{a.name}</div>
                  <div className="text-[12px] text-muted">{a.use}</div>
                </div>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`打开 ${a.name} 网站`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong">
                    <Icon name="external" size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {/* 小贴士 */}
      {g && g.tips.length > 0 && (
        <GuideSection title="小贴士" icon="sparkle">
          <ul className="flex list-disc flex-col gap-1.5 pl-4">
            {g.tips.map((t) => (
              <li key={t} className="text-[13px] leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      {/* 没有整理好的指南：给出查票价和通票的地方 */}
      {!g && (
        <GuideSection title="车票和通票" icon="ticket">
          <p className="text-[13px] leading-relaxed text-muted">这个城市还没有整理好的车票信息。可以在这里查单程票、一日票 / 通票的价格和在哪里买：</p>
          <div className="mt-2 flex flex-col gap-2">
            <a href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(stop.name)}#Get_around`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-oat px-3 py-2.5 text-[13px]">
              <span>
                Wikivoyage「Get around」
                <span className="block text-[11px] text-muted">旅行百科：市内交通、车票、机场进城</span>
              </span>
              <Icon name="external" size={14} className="text-muted" />
            </a>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`${stop.name} public transport day ticket price where to buy`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-oat px-3 py-2.5 text-[13px]">
              <span>
                Google 搜索「{stop.name} 一日票价格」
                <span className="block text-[11px] text-muted">一般能找到当地公交公司的官网</span>
              </span>
              <Icon name="external" size={14} className="text-muted" />
            </a>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">想要像米兰、哥本哈根那样整理好的指南（票价、在哪里买、机场怎么进城），可以让 Claude 调研后加进来。查到的信息也可以记在下面的「我的笔记」里。</p>
        </GuideSection>
      )}

      {/* 我的笔记（离开输入框时保存） */}
      <GuideSection title="我的笔记" icon="edit">
        <textarea
          defaultValue={stop.transportNote ?? ''}
          onBlur={(e) => updateStop(stop.id, { transportNote: e.target.value.trim() || undefined })}
          placeholder="例如：买了 72 小时 City Pass；住处最近的地铁站是…"
          className={TEXTAREA}
        />
      </GuideSection>

      {/* 来源 */}
      {g && (
        <div className="px-1 text-[11px] leading-relaxed text-muted">
          <span>推荐 · 需核实 · 调研于 {g.updated}。来源：</span>
          {g.sources.map((src, i) => (
            <span key={src.url}>
              {i > 0 && '；'}
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {src.label}
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// 指南里的一块
function GuideSection({ title, icon, accent, children }: { title: string; icon: IconName; accent?: boolean; children: ReactNode }) {
  // 返回卡片
  return (
    <section className={`rounded-2xl p-4 ${accent ? 'bg-accent-soft text-accent' : 'border border-line bg-card'}`}>
      {/* 标题 */}
      <h3 className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold">
        <Icon name={icon} size={15} />
        {title}
      </h3>
      {children}
    </section>
  )
}
