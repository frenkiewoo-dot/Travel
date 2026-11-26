// ============================================================
// 城市详情「交通」标签的上半部分：
//   1. 你可能感兴趣：根据这次怎么来、怎么走，推荐要查的路线（例如 坐飞机来 → 机场到青旅；离开时 → 青旅到机场）
//   2. 查路线：选起点和终点（可以搜索地点，或点住处 / 市中心 / 机场 / 车站），选日期时间，查公共交通方案
//      （Transitous：免费的公共交通路线服务，市内、机场进城、城市之间的火车都能查）
//   3. 我的交通：查到的方案点「添加」存下来；可以按住左边的把手上下拖，调整先后顺序；可以删除
// ============================================================

// 引入 React 钩子
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
// 引入数据结构
import type { Place, SavedRoute, Stop } from '../db/schema'
import type { TripData } from '../db/hooks'
// 引入数据操作
import { updateStop } from '../db/trip'
import { newId } from '../db/pins'
// 引入推荐内容（交通指南）
import { guideFor } from '../data/content'
// 引入查路线
import { hhmm, modeIcon, modeZh, planRoutes, type PlanOption } from '../lib/transit'
// 引入地点搜索
import { bboxAround, findHubs, searchPlaces, type SearchResult } from '../lib/search'
// 引入工具
import { formatDuration } from '../lib/geo'
import { googleMapsDirections } from '../lib/gmaps'
import { dayLabel, toISODate, type DayInfo } from '../lib/itinerary'
// 引入组件
import { Icon } from './Icon'
import { INPUT } from './Sheet'
import { SortableList } from './SortableList'

// 一个地点（起点 / 终点）
interface Spot {
  name: string
  lat: number
  lng: number
}

// 主组件
export function CityTransport({ stop, data, hotel, cityDays }: { stop: Stop; data: TripData; hotel: Place | null; cityDays: DayInfo[] }) {
  // 查路线的起点、终点、日期、时间
  const [from, setFrom] = useState<Spot | null>(null)
  const [to, setTo] = useState<Spot | null>(null)
  const [date, setDate] = useState(() => cityDays.find((d) => d.date && d.date >= toISODate(new Date()))?.date ?? cityDays[0]?.date ?? toISODate(new Date()))
  const [time, setTime] = useState('10:00')
  // 查询结果
  const [options, setOptions] = useState<PlanOption[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 展开的方案
  const [openOpt, setOpenOpt] = useState<number | null>(null)
  // 查路线区域（推荐卡片点「查路线」时滚过去）
  const plannerRef = useRef<HTMLElement>(null)
  // 搜索地点的中心（记住，避免每次渲染都重新搜索）
  const near = useMemo<[number, number]>(() => [stop.lng, stop.lat], [stop.lng, stop.lat])

  // 住处（选定 / 预订的），否则市中心
  const home: Spot = hotel ? { name: hotel.name, lat: hotel.lat, lng: hotel.lng } : { name: `${stop.name} 市中心`, lat: stop.lat, lng: stop.lng }
  // 交通指南（推荐内容）
  const guide = stop.guide ?? guideFor(stop)

  // 怎么来、怎么走
  const arrSeg = data.segments.find((s) => s.toStopId === stop.id)
  const depSeg = data.segments.find((s) => s.fromStopId === stop.id)
  // 交通方式 → 要找的枢纽类型
  const kindOf = (mode?: string): 'airport' | 'station' | null => (mode === 'flight' ? 'airport' : mode === 'train' || mode === 'bus' ? 'station' : null)
  const arrKind = kindOf(arrSeg?.mode)
  const depKind = kindOf(depSeg?.mode)

  // 机场 / 车站：先用指南里的，没有就在地图数据里找
  const [hubs, setHubs] = useState<{ airport: Spot[]; station: Spot[] }>({ airport: [], station: [] })
  useEffect(() => {
    // 指南里的
    const curated = (kind: 'airport' | 'station') =>
      (guide?.arrivals ?? []).filter((a) => (a.type ?? (/机场/.test(a.nameZh) ? 'airport' : 'station')) === kind).map((a) => ({ name: a.name, lat: a.lat, lng: a.lng }))
    const a = curated('airport')
    const s = curated('station')
    setHubs({ airport: a, station: s })
    // 指南里没有的，去地图数据里找
    let alive = true
    ;(async () => {
      const [fa, fs] = await Promise.all([a.length ? a : findHubs([stop.lng, stop.lat], 'airport', stop.name), s.length ? s : findHubs([stop.lng, stop.lat], 'station', stop.name)])
      if (alive) setHubs({ airport: fa, station: fs })
    })()
    return () => {
      alive = false
    }
  }, [guide, stop.lat, stop.lng, stop.name])

  // 到达 / 离开的时间（有车票就用车票上的时间）
  const arrTicket = arrSeg && data.tickets.find((t) => t.segmentId === arrSeg.id)
  const depTicket = depSeg && data.tickets.find((t) => t.segmentId === depSeg.id)
  const arriveDay = cityDays[0]
  const departDay = cityDays[cityDays.length - 1]

  // 打开查路线并马上查
  const plan = (f: Spot, t: Spot, when?: { date?: string | null; time?: string }) => {
    setFrom(f)
    setTo(t)
    if (when?.date) setDate(when.date)
    if (when?.time) setTime(when.time)
    plannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    run(f, t, when?.date ?? date, when?.time ?? time)
  }

  // 查询
  const run = async (f = from, t = to, d = date, tm = time) => {
    if (!f || !t) return
    setSearching(true)
    setError(null)
    setOptions(null)
    setOpenOpt(null)
    try {
      // 出发时间（手机时区）
      const when = new Date(`${d}T${tm || '10:00'}`)
      const r = await planRoutes(f, t, Number.isNaN(when.getTime()) ? undefined : when.toISOString())
      setOptions(r)
      if (r.length === 0) setError('没有找到公共交通方案。可能是距离太远、时间太晚，或者那天的时刻表还没公布（可以先选一个最近的日期看大概的路线和用时）。')
    } catch {
      setError('查询失败，可能没网。可以用下面的 Google Maps 查。')
    } finally {
      setSearching(false)
    }
  }

  // 存下来的路线
  const routes = stop.routes ?? []
  // 添加一个方案
  const add = async (o: PlanOption) => {
    if (!from || !to) return
    const r: SavedRoute = { id: newId('route'), from, to, duration: o.duration, dep: o.dep, arr: o.arr, transfers: o.transfers, legs: o.legs }
    await updateStop(stop.id, { routes: [...routes, r] })
  }
  // 删除
  const remove = async (id: string) => {
    if (!window.confirm('从「我的交通」里删除这条路线？')) return
    await updateStop(stop.id, { routes: routes.filter((r) => r.id !== id) })
  }

  // 快捷地点（起点终点都能点）
  const quick: Spot[] = [home, ...(hotel ? [{ name: `${stop.name} 市中心`, lat: stop.lat, lng: stop.lng }] : []), ...hubs.airport, ...hubs.station]

  // 返回
  return (
    <div className="flex flex-col gap-3">
      {/* ===== 你可能感兴趣 ===== */}
      {(arrKind || depKind || hubs.station.length > 0) && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold">
            <Icon name="sparkle" size={15} />
            你可能感兴趣
          </h3>
          <div className="flex flex-col gap-3">
            {/* 到达：从机场 / 车站到住处 */}
            {(arrKind ? hubs[arrKind] : hubs.station).length > 0 && (
              <Suggestion
                icon={arrKind === 'airport' ? 'plane' : 'train'}
                title={`${arrKind === 'airport' ? '下飞机后' : '到站后'}：从${arrKind === 'airport' ? '机场' : '车站'}到${hotel ? `「${hotel.name}」` : '市中心'}`}
                sub={arrSeg ? `${arriveDay ? dayLabel(arriveDay) : ''}${arrTicket?.arriveAt ? ` ${arrTicket.arriveAt.slice(11, 16)} 到达` : ''}` : '常用的进城路线'}
                hubs={arrKind ? hubs[arrKind] : hubs.station}
                onPick={(h) => plan(h, home, { date: arriveDay?.date, time: arrTicket?.arriveAt?.slice(11, 16) ?? '12:00' })}
              />
            )}
            {/* 离开：从住处到机场 / 车站 */}
            {depKind && hubs[depKind].length > 0 && (
              <Suggestion
                icon={depKind === 'airport' ? 'plane' : 'train'}
                title={`离开时：从${hotel ? `「${hotel.name}」` : '市中心'}去${depKind === 'airport' ? '机场' : '车站'}`}
                sub={`${departDay ? dayLabel(departDay) : ''}${depTicket?.departAt ? ` ${depTicket.departAt.slice(11, 16)} 出发${depKind === 'airport' ? '（建议提前 2 小时到机场）' : ''}` : ''}`}
                hubs={hubs[depKind]}
                onPick={(h) => plan(home, h, { date: departDay?.date, time: leaveTime(depTicket?.departAt, depKind) })}
              />
            )}
          </div>
          {!hotel && <p className="mt-2 text-[12px] text-muted">在「酒店」里选定住处后，这里会直接查到住处的路线。</p>}
        </section>
      )}

      {/* ===== 查路线 ===== */}
      <section ref={plannerRef} className="scroll-mt-2 rounded-2xl border border-line bg-card p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold">
          <Icon name="search" size={15} />
          查路线
        </h3>
        <div className="flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <SpotField label="从" value={from} onChange={setFrom} near={near} quick={quick} />
            <SpotField label="到" value={to} onChange={setTo} near={near} quick={quick} />
          </div>
          {/* 交换起点终点 */}
          <button
            aria-label="交换起点和终点"
            onClick={() => {
              setFrom(to)
              setTo(from)
            }}
            className="flex w-9 shrink-0 items-center justify-center rounded-xl border border-line-strong"
          >
            <Icon name="swap" size={16} />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="日期" className={`${INPUT} px-2 text-[14px]`} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="出发时间" className={`${INPUT} px-2 text-[14px]`} />
        </div>
        <button onClick={() => run()} disabled={!from || !to || searching} className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-ink text-[14px] text-paper disabled:opacity-40">
          {searching ? '正在查…' : '搜索路线'}
        </button>

        {/* 结果 */}
        {error && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-accent">{error}</p>}
        {options && options.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {options.map((o, i) => (
              <li key={i} className="rounded-xl border border-line bg-paper">
                <button onClick={() => setOpenOpt(openOpt === i ? null : i)} aria-expanded={openOpt === i} className="w-full px-3 pt-2.5 pb-2 text-left">
                  <OptionSummary o={o} />
                </button>
                {openOpt === i && <LegList legs={o.legs} />}
                <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5">
                  <button onClick={() => setOpenOpt(openOpt === i ? null : i)} className="h-8 text-[12px] text-muted">
                    {openOpt === i ? '收起' : '每一段怎么坐'}
                  </button>
                  <AddButton added={routes.some((r) => r.dep === o.dep && r.arr === o.arr && r.from.name === from?.name && r.to.name === to?.name)} onAdd={() => add(o)} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Google Maps */}
        {from && to && (
          <a href={googleMapsDirections([from, to], false, 'transit')} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex h-9 items-center gap-1 text-[12px] text-accent underline underline-offset-2">
            <Icon name="external" size={13} />在 Google Maps 里查这段
          </a>
        )}
      </section>

      {/* ===== 我的交通 ===== */}
      {routes.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h3 className="flex items-center gap-1.5 text-[14px] font-semibold">
            <Icon name="list" size={15} />
            我的交通
          </h3>
          <p className="mt-0.5 mb-2.5 text-[12px] text-muted">按住左边的六个点上下拖，可以调整先后顺序。</p>
          <SortableList
            items={routes}
            onReorder={(next) => updateStop(stop.id, { routes: next })}
            render={(r, handle) => <SavedRouteCard r={r} handle={handle} onDelete={() => remove(r.id)} />}
          />
        </section>
      )}
    </div>
  )
}

// 离开时的出发时间：飞机提前 2.5 小时、火车提前 40 分钟
function leaveTime(departAt: string | undefined, kind: 'airport' | 'station'): string {
  if (!departAt) return kind === 'airport' ? '08:00' : '09:00'
  const d = new Date(departAt)
  if (Number.isNaN(d.getTime())) return '09:00'
  d.setMinutes(d.getMinutes() - (kind === 'airport' ? 150 : 40))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 一条推荐：标题、说明、机场 / 车站按钮（点一个就查路线）
function Suggestion({ icon, title, sub, hubs, onPick }: { icon: 'plane' | 'train'; title: string; sub: string; hubs: Spot[]; onPick: (h: Spot) => void }) {
  return (
    <div className="rounded-xl bg-oat px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Icon name={icon} size={16} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          {sub && <div className="text-[12px] text-muted">{sub}</div>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {hubs.map((h) => (
          <button key={h.name} onClick={() => onPick(h)} className="flex h-9 max-w-full items-center gap-1 rounded-full bg-card px-3 text-[12px]">
            <span className="truncate">{h.name}</span>
            <Icon name="chevronRight" size={12} className="shrink-0 text-muted" />
          </button>
        ))}
      </div>
    </div>
  )
}

// 选起点 / 终点：搜索城市附近的地点，或者点下面的快捷按钮
function SpotField({ label, value, onChange, near, quick }: { label: string; value: Spot | null; onChange: (s: Spot | null) => void; near: [number, number]; quick: Spot[] }) {
  // 搜索词
  const [q, setQ] = useState('')
  // 结果
  const [results, setResults] = useState<SearchResult[]>([])
  // 是否在输入（显示快捷按钮和结果）
  const [focused, setFocused] = useState(false)
  // 搜索（停止输入 0.4 秒后；只搜城市方圆 60 公里）
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        setResults(await searchPlaces(q, { near, bbox: bboxAround(near, 60) }, ctrl.signal))
      } catch {
        if (!ctrl.signal.aborted) setResults([])
      }
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, near])
  // 选好了
  const pick = (s: Spot) => {
    onChange(s)
    setQ('')
    setResults([])
    setFocused(false)
  }
  // 已经选了：显示名字，× 清掉
  if (value && !focused)
    return (
      <div className="flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-paper pr-1 pl-3">
        <span className="w-4 shrink-0 text-[12px] text-muted">{label}</span>
        <button onClick={() => setFocused(true)} className="min-w-0 flex-1 truncate text-left text-[14px]">
          {value.name}
        </button>
        <button aria-label={`清除${label}`} onClick={() => onChange(null)} className="flex h-9 w-9 shrink-0 items-center justify-center text-muted">
          <Icon name="close" size={14} />
        </button>
      </div>
    )
  // 输入中
  return (
    <div>
      <div className="flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-paper px-3 focus-within:border-accent">
        <span className="w-4 shrink-0 text-[12px] text-muted">{label}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="搜索地点，或点下面的"
          aria-label={`${label}哪里`}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted"
        />
      </div>
      {/* 快捷地点 + 搜索结果 */}
      {(focused || !value) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {quick.slice(0, 6).map((s) => (
            <button key={`${s.name}${s.lat}`} onClick={() => pick(s)} className="h-8 max-w-full truncate rounded-full bg-oat px-3 text-[12px]">
              {s.name}
            </button>
          ))}
        </div>
      )}
      {results.length > 0 && (
        <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-line bg-card">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => pick({ name: r.name, lat: r.lngLat[1], lng: r.lngLat[0] })} className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0">
                <span className="block truncate text-[13px]">{r.name}</span>
                <span className="block truncate text-[11px] text-muted">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 方案摘要：时间、用时、换乘、每一段的线路
function OptionSummary({ o }: { o: PlanOption | SavedRoute }) {
  // 坐车的段
  const rides = o.legs.filter((l) => l.mode !== 'WALK')
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold tabular-nums">
          {hhmm(o.dep)} → {hhmm(o.arr)}
        </span>
        <span className="text-[12px] text-muted">
          {formatDuration(o.duration)} · {o.transfers === 0 ? '直达' : `换乘 ${o.transfers} 次`}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {rides.map((l, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <Icon name="chevronRight" size={11} className="text-muted" />}
            <span className="flex h-6 items-center gap-1 rounded-md bg-oat px-1.5 text-[11px]">
              <Icon name={modeIcon(l.mode)} size={12} />
              {l.line ?? modeZh(l.mode)}
              {l.agency && <span className="text-muted">{l.agency}</span>}
            </span>
          </span>
        ))}
      </div>
    </>
  )
}

// 每一段的详情
function LegList({ legs }: { legs: PlanOption['legs'] }) {
  return (
    <ol className="flex flex-col gap-1.5 px-3 pb-2.5">
      {legs.map((l, i) => (
        <li key={i} className="flex gap-2 text-[12px] leading-relaxed">
          <span className="w-10 shrink-0 text-muted tabular-nums">{hhmm(l.dep)}</span>
          <Icon name={modeIcon(l.mode)} size={13} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {l.mode === 'WALK' ? (
              <>
                步行 {formatDuration(l.duration)} 到 {l.to}
              </>
            ) : (
              <>
                <b className="font-semibold">
                  {modeZh(l.mode)} {l.line}
                </b>
                {l.headsign && <span className="text-muted">（开往 {l.headsign}）</span>}
                <br />
                {l.from} → {l.to}，{formatDuration(l.duration)}
                {l.agency && <span className="text-muted"> · {l.agency}</span>}
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

// 「添加到我的交通」按钮
function AddButton({ added, onAdd }: { added: boolean; onAdd: () => void }) {
  return added ? (
    <span className="text-[12px] text-sage">✓ 已在我的交通</span>
  ) : (
    <button onClick={onAdd} className="flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-[12px] text-paper">
      <Icon name="plus" size={12} />
      添加到我的交通
    </button>
  )
}

// 我的交通里的一条
function SavedRouteCard({ r, handle, onDelete }: { r: SavedRoute; handle: ReactNode; onDelete: () => void }) {
  // 是否展开
  const [open, setOpen] = useState(false)
  // 日期
  const day = new Date(r.dep)
  return (
    <div className="rounded-xl border border-line bg-paper">
      <div className="flex items-start gap-1 py-1.5 pr-1">
        {handle}
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 py-1 text-left">
          <div className="truncate text-[13px] font-semibold">
            {r.from.name} → {r.to.name}
          </div>
          <div className="text-[11px] text-muted">{Number.isNaN(day.getTime()) ? '' : `${day.getMonth() + 1}月${day.getDate()}日`}</div>
          <div className="mt-1">
            <OptionSummary o={r} />
          </div>
        </button>
        <button aria-label="删除这条路线" onClick={onDelete} className="flex h-9 w-9 shrink-0 items-center justify-center text-muted">
          <Icon name="close" size={14} />
        </button>
      </div>
      {open && (
        <>
          <LegList legs={r.legs} />
          <a href={googleMapsDirections([r.from, r.to], false, 'transit')} target="_blank" rel="noopener noreferrer" className="mx-3 mb-2.5 inline-flex items-center gap-1 text-[12px] text-accent underline underline-offset-2">
            <Icon name="external" size={12} />在 Google Maps 里打开
          </a>
        </>
      )}
    </div>
  )
}
