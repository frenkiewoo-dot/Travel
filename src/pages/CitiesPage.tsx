// ============================================================
// 城市（底部导航“城市”）
//   - 本次旅行：按时间顺序，按国家分组，显示日期和住宿状态
//   - 以后想去：按国家分组（例如柏林）
//   - 去过的城市：其他旅行里有照片的城市（点进去看相册）
//   有照片的城市在卡片左边显示封面小图
//   点一个城市进去：酒店、景点、日程、交通、地图、相册
// ============================================================

// 引入 React 钩子
import { useMemo, useState, type ReactNode } from 'react'
// 引入路由
import { Link } from 'react-router-dom'
// 引入实时查询
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入照片概况
import { usePhotoSummary, type StopPhotoSummary } from '../db/photos'
// 引入照片显示
import { PhotoImg } from '../components/Album'
// 引入数据钩子
import { useItinerary, useTripData, type TripData } from '../db/hooks'
// 引入数据结构
import type { Stop } from '../db/schema'
// 引入数据操作
import { saveStops } from '../db/trip'
// 引入推荐地点合并
import { mergePlaces } from '../db/content'
// 引入行程工具
import { computeSpans, dayLabel } from '../lib/itinerary'
// 引入坐标类型
import type { LngLat } from '../lib/geo'
// 引入组件
import { Icon } from '../components/Icon'
import { StopForm, type StopDraft } from '../components/StopForm'
// 引入加载画面
import { Loading } from './HomePage'
// 引入国名表
import { COUNTRY_NAME } from '../lib/countries'

// 按国家分组（保持原来的顺序：国家按第一次出现排序）
function groupByCountry(stops: Stop[]): { country: string; stops: Stop[] }[] {
  // 结果
  const groups: { country: string; stops: Stop[] }[] = []
  // 逐个城市
  for (const s of stops) {
    // 找这个国家的组
    const g = groups.find((x) => x.country === s.country)
    // 有就加进去，没有就新建
    if (g) g.stops.push(s)
    else groups.push({ country: s.country, stops: [s] })
  }
  // 返回
  return groups
}

// 页面组件
export default function CitiesPage() {
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 是否显示“添加以后想去的城市”表单
  const [adding, setAdding] = useState(false)
  // 每个城市的时间段
  const spans = useMemo(() => (data ? computeSpans(data.stops) : []), [data])
  // 城市搜索的默认中心
  const near = useMemo<LngLat>(() => (data?.stops[0] ? [data.stops[0].lng, data.stops[0].lat] : [10, 53]), [data])
  // 照片概况（城市 ID → 张数、封面）
  const photos = usePhotoSummary()
  // 其他旅行里有照片的城市（去过的城市）
  const visited = useLiveQuery(async () => {
    // 有照片的城市 ID
    const ids = [...(photos?.keys() ?? [])]
    // 读出这些城市
    const stops = (await db.stops.bulkGet(ids)).filter((s): s is Stop => !!s && s.tripId !== data?.trip.id)
    // 旅行名称
    const trips = await db.trips.bulkGet([...new Set(stops.map((s) => s.tripId))])
    // 返回城市和它所在旅行的名称（已删除的旅行不算）
    return stops
      .map((s) => ({ stop: s, trip: trips.find((t) => t?.id === s.tripId) }))
      .filter((x) => x.trip && !x.trip.deletedAt)
      .map((x) => ({ stop: x.stop, tripName: x.trip!.name }))
  }, [photos, data?.trip.id])

  // 加载中
  if (!data || !itin) return <Loading />
  // 本次旅行的住宿城市（按顺序）
  const thisTrip = spans.filter((sp) => sp.stop.kind === 'stay').map((sp) => sp.stop)
  // 以后想去
  const saved = data.stops.filter((s) => s.kind === 'saved')

  // 添加以后想去的城市
  const onSaved = async (draft: StopDraft) => {
    // 加在最后
    await saveStops(data.trip.id, [...data.stops, { ...draft, kind: 'saved', tripId: data.trip.id, order: data.stops.length }])
    // 检查有没有这个城市的推荐青旅和景点
    await mergePlaces()
    // 关闭表单
    setAdding(false)
  }

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),24px)] pb-10">
      {/* 标题 */}
      <div className="font-serif text-[16px] italic text-muted">Villes</div>
      <h1 className="text-[28px] font-semibold">城市</h1>

      {/* ===== 本次旅行 ===== */}
      <div className="mt-5 flex items-end justify-between">
        <h2 className="text-[17px] font-semibold">本次旅行</h2>
        <Link to="/trip" className="flex items-center gap-1 text-[13px] text-accent">
          安排行程
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
      {thisTrip.length === 0 && <p className="mt-2 text-[13px] text-muted">还没有目的地，去「本次旅行」里添加。</p>}
      {groupByCountry(thisTrip).map((g) => (
        <CountryGroup key={g.country} country={g.country}>
          {g.stops.map((s) => {
            // 时间段
            const sp = spans.find((x) => x.stop.id === s.id)
            // 日期范围
            const range = sp ? `${dayLabel(itin.days[sp.arriveDay - 1])} — ${dayLabel(itin.days[sp.departDay - 1])}` : ''
            // 城市卡片
            return <CityCard key={s.id} stop={s} data={data} photo={photos?.get(s.id)} sub={`${range} · ${s.nights} 晚`} />
          })}
        </CountryGroup>
      ))}

      {/* ===== 以后想去 ===== */}
      <h2 className="mt-8 text-[17px] font-semibold">以后想去</h2>
      {groupByCountry(saved).map((g) => (
        <CountryGroup key={g.country} country={g.country}>
          {g.stops.map((s) => (
            <CityCard key={s.id} stop={s} data={data} photo={photos?.get(s.id)} sub="以后去" />
          ))}
        </CountryGroup>
      ))}
      {saved.length === 0 && <p className="mt-2 text-[13px] text-muted">还没有。想去但这次不去的城市可以先存在这里。</p>}
      {/* 添加 */}
      <button onClick={() => setAdding(true)} className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-[13px] text-muted">
        <Icon name="plus" size={15} />
        添加以后想去的城市
      </button>

      {/* ===== 去过的城市（其他旅行里有照片的） ===== */}
      {!!visited?.length && (
        <>
          <div className="mt-8 flex items-end justify-between">
            <h2 className="text-[17px] font-semibold">去过的城市</h2>
            <Link to="/trips" className="flex items-center gap-1 text-[13px] text-accent">
              我的旅行
              <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          <p className="mt-0.5 text-[12px] text-muted">以前旅行里拍过照片的城市，点进去看相册。</p>
          <div className="mt-3 flex flex-col gap-2">
            {visited.map(({ stop: s, tripName }) => (
              <CityCard key={s.id} stop={s} photo={photos?.get(s.id)} sub={tripName} toAlbum />
            ))}
          </div>
        </>
      )}

      {/* 表单 */}
      {adding && <StopForm initial={null} near={near} defaultKind="saved" onSave={onSaved} onClose={() => setAdding(false)} />}
    </div>
  )
}

// 一个国家的分组
function CountryGroup({ country, children }: { country: string; children: ReactNode }) {
  // 国名
  const [local, zh] = COUNTRY_NAME[country] ?? [country, '']
  // 返回
  return (
    <section className="mt-3">
      {/* 国家标题：当地语言大写 + 中文 */}
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[11px] tracking-[0.16em] text-muted uppercase">{local}</span>
        <span className="text-[11px] text-muted">{zh}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

// 城市卡片（有照片的显示封面小图；toAlbum = 直接打开相册标签）
function CityCard({ stop: s, data, sub, photo, toAlbum }: { stop: Stop; data?: TripData; sub: string; photo?: StopPhotoSummary; toAlbum?: boolean }) {
  // 这个城市的地点（其他旅行的城市不需要）
  const places = data?.places.filter((p) => p.stopId === s.id) ?? []
  // 住宿状态
  const booked = places.some((p) => p.category === 'hotel' && p.status === 'booked')
  const selected = places.some((p) => p.category === 'hotel' && p.status === 'selected')
  // 景点数量
  const spots = places.filter((p) => p.category !== 'hotel').length
  // 返回
  return (
    <Link to={`/city/${s.id}${toAlbum || photo ? '?tab=album' : ''}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 pl-4">
      {/* 封面小图 */}
      {photo && (
        <span className="-my-0.5 -ml-1 h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-oat">
          <PhotoImg photo={photo.cover} className="h-full w-full object-cover" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {/* 城市名 */}
        <div className="flex items-baseline gap-2">
          <span className="truncate font-serif text-[24px] leading-tight font-medium">{s.name}</span>
          <span className="truncate text-[12px] text-muted">{s.nameZh}</span>
        </div>
        {/* 日期 / 以后去 / 哪次旅行 */}
        <div className="truncate text-[12px] text-muted">
          {sub}
          {spots > 0 && ` · ${spots} 个景点`}
          {photo && ` · ${photo.count} 张照片`}
        </div>
      </div>
      {/* 住宿状态（本次旅行的城市才显示） */}
      {data && s.kind === 'stay' && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${booked ? 'bg-sage-soft text-sage' : selected ? 'bg-oat text-ink' : 'bg-accent-soft text-accent'}`}>
          {booked ? '住宿已订' : selected ? '住宿已选定' : '住宿未订'}
        </span>
      )}
      <Icon name="chevronRight" size={16} className="shrink-0 text-muted" />
    </Link>
  )
}
