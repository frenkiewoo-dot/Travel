// ============================================================
// 本次旅行（/trip）：按时间顺序安排这次去哪里
//   - 每个目的地：日期、住几晚、住宿（含预订截图）
//   - 目的地之间的交通：航班号 / 车次、起飞到达时间、机票截图
//   - 以后想去的城市：一键加入本次旅行
//   - 基本信息：旅行名称、出发日期、人数
// 改动立即保存；改了顺序或住几晚，日期和每天的日程会自动跟着调整
// ============================================================

// 引入 React 钩子
import { useMemo, useState } from 'react'
// 引入路由工具
import { Link, useNavigate } from 'react-router-dom'
// 引入数据钩子
import { useItinerary, useTripData, type TripData } from '../db/hooks'
// 引入数据结构
import type { Place, Segment, Stop, StopKind, Ticket } from '../db/schema'
// 引入数据操作
import { saveStops, updateTrip } from '../db/trip'
// 引入推荐地点合并（新加城市后自动带上推荐）
import { mergePlaces } from '../db/content'
// 引入车票工具
import { useObjectUrl, useTicketFiles, viewableFiles } from '../db/tickets'
// 引入照片概况（删除城市前提醒有几张照片）
import { usePhotoSummary } from '../db/photos'
// 引入行程工具
import { MODE_LABEL, computeSpans, dayLabel, routeStops, type DayInfo } from '../lib/itinerary'
// 引入坐标类型
import type { LngLat } from '../lib/geo'
// 引入组件
import { Icon, type IconName } from '../components/Icon'
import { Field, INPUT, Segmented } from '../components/Sheet'
import { StopForm, Stepper, type StopDraft } from '../components/StopForm'
import { PlaceForm, STATUS_LABEL } from '../components/PlaceForm'
import { TicketForm, segmentName } from '../components/TicketForm'
import { statusClass } from '../components/PlaceCard'
// 引入交通方式图标
import { MODE_ICON } from './SegmentPage'
// 引入加载画面
import { Loading } from './HomePage'

// 地点类型的中文
const KIND_LABEL: Record<StopKind, string> = { stay: '住宿', transit: '中转', home: '出发 / 回家', saved: '以后去' }

// 'YYYY-MM-DDTHH:mm' → 'HH:mm'
function hm(v?: string): string | null {
  // 没有时间
  if (!v) return null
  // 取时间部分
  return v.slice(11, 16) || null
}

// 页面组件
export default function PlanPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 每个城市的照片概况
  const photoSummary = usePhotoSummary()
  // 城市 ID → 照片张数
  const photoCounts = useMemo(() => new Map([...(photoSummary ?? new Map()).entries()].map(([k, v]) => [k, v.count])), [photoSummary])
  // 城市表单：null 不显示；stop 为 null 是新建，kind 是新建时的类型
  const [stopForm, setStopForm] = useState<{ stop: Stop | null; kind: StopKind } | null>(null)
  // 添加住宿的表单（对应的城市）
  const [hotelFor, setHotelFor] = useState<Stop | null>(null)
  // 车票表单：交通段 或 住宿
  const [ticketFor, setTicketFor] = useState<{ segId?: string; place?: Place } | null>(null)

  // 每个城市的时间段
  const spans = useMemo(() => (data ? computeSpans(data.stops) : []), [data])
  // 地图默认中心（第一个城市，用于城市搜索）
  const near = useMemo<LngLat>(() => (data?.stops[0] ? [data.stops[0].lng, data.stops[0].lat] : [10, 53]), [data])

  // 加载中
  if (!data || !itin) return <Loading />
  // 旅行
  const trip = data.trip
  // 本次路线（按顺序）
  const route = routeStops(data.stops)
  // 以后想去的城市
  const saved = data.stops.filter((s) => s.kind === 'saved')

  // 保存：路线 + 以后想去
  // 保存城市列表，然后检查新加的城市有没有推荐的青旅和景点
  const commit = (nextRoute: Stop[], nextSaved: Stop[] = saved) => saveStops(trip.id, [...nextRoute, ...nextSaved]).then(() => mergePlaces())

  // 在路线里移动
  const move = (i: number, dir: -1 | 1) => {
    // 目标位置
    const j = i + dir
    // 越界
    if (j < 0 || j >= route.length) return
    // 交换
    const next = [...route]
    ;[next[i], next[j]] = [next[j], next[i]]
    // 保存
    commit(next)
  }

  // 改住几晚
  const setNights = (id: string, n: number) => commit(route.map((s) => (s.id === id ? { ...s, nights: n } : s)))

  // 把城市移到“以后想去”（资料都保留）
  const toSaved = (s: Stop) => {
    // 确认
    if (!window.confirm(`把「${s.name}」移出本次旅行？它的酒店、景点资料会保留在「城市 → 以后想去」里。`)) return
    // 保存
    commit(
      route.filter((x) => x.id !== s.id),
      [...saved, { ...s, kind: 'saved' }],
    )
  }

  // 把“以后想去”的城市加入本次旅行（放在最后一个住宿城市后面）
  const toRoute = (s: Stop) => {
    // 最后一个住宿城市的位置
    const lastStay = route.map((x) => x.kind).lastIndexOf('stay')
    // 插入位置：最后一个住宿城市后面；没有就放在回家前面
    const at = lastStay >= 0 ? lastStay + 1 : Math.max(0, route.length - 1)
    // 保存
    commit(
      [...route.slice(0, at), { ...s, kind: 'stay', nights: Math.max(1, s.nights) }, ...route.slice(at)],
      saved.filter((x) => x.id !== s.id),
    )
  }

  // 删除城市（资料也删除）
  const remove = (s: Stop) => {
    // 这个城市的酒店景点数量
    const n = data.places.filter((p) => p.stopId === s.id).length
    // 这个城市的照片数量
    const photoCount = photoCounts?.get(s.id) ?? 0
    // 确认（有照片时特别提醒）
    if (
      !window.confirm(
        `彻底删除「${s.name}」？${n > 0 ? `它的 ${n} 个酒店/景点也会删除。` : ''}${photoCount > 0 ? `相册里的 ${photoCount} 张照片也会删除！` : ''}如果只是这次不去，可以用「移出本次旅行」。`,
      )
    )
      return
    // 路线里的城市：至少保留两个地点
    if (s.kind !== 'saved' && route.length <= 2) {
      window.alert('行程里至少要有两个地点')
      return
    }
    // 保存
    commit(
      route.filter((x) => x.id !== s.id),
      saved.filter((x) => x.id !== s.id),
    )
  }

  // 城市表单保存
  const onStopSaved = (draft: StopDraft) => {
    // 已有的城市：替换（类型可能变了：在路线和以后想去之间移动）
    const existing = data.stops.find((s) => s.id === draft.id)
    // 完整的城市对象
    const full: Stop = { ...(existing ?? { tripId: trip.id, order: 0 }), ...draft } as Stop
    // 去掉旧位置
    const r = route.filter((s) => s.id !== draft.id)
    const sv = saved.filter((s) => s.id !== draft.id)
    // 以后想去
    if (full.kind === 'saved') commit(r, [...sv, full])
    // 已经在路线里：原位替换
    else if (existing && existing.kind !== 'saved') commit(route.map((s) => (s.id === draft.id ? full : s)), sv)
    // 新加入路线：放在最后一个住宿城市后面
    else {
      // 最后一个住宿城市的位置
      const lastStay = r.map((x) => x.kind).lastIndexOf('stay')
      // 插入位置
      const at = lastStay >= 0 ? lastStay + 1 : Math.max(0, r.length - 1)
      // 保存
      commit([...r.slice(0, at), full, ...r.slice(at)], sv)
    }
    // 关闭表单
    setStopForm(null)
  }

  // 第一天和最后一天
  const first = itin.days[0]
  const last = itin.days[itin.days.length - 1]

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-12">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 标题 + 切换旅行 */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="font-serif text-[16px] italic text-muted">Ce voyage</div>
          <h1 className="text-[28px] font-semibold">本次旅行</h1>
        </div>
        <Link to="/trips" className="mb-1 flex h-9 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3 text-[12px]">
          切换 / 新建旅行
        </Link>
      </div>
      {/* 名称和日期范围 */}
      <p className="mt-1 text-[14px] text-muted">
        {trip.name} · {first?.date && last?.date ? `${dayLabel(first)} — ${dayLabel(last)}` : '日期待定'} · 共 {itin.total} 天
      </p>

      {/* ===== 基本信息（可以折叠） ===== */}
      <details className="mt-4 rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-[15px] font-semibold">基本信息（名称、出发日期、人数）</summary>
        {/* 名称（离开输入框时保存） */}
        <Field label="旅行名称">
          <input defaultValue={trip.name} onBlur={(e) => e.target.value.trim() && updateTrip(trip.id, { name: e.target.value.trim() })} className={INPUT} />
        </Field>
        {/* 副标题 */}
        <Field label="副标题">
          <input defaultValue={trip.subtitle ?? ''} onBlur={(e) => updateTrip(trip.id, { subtitle: e.target.value.trim() || undefined })} className={INPUT} />
        </Field>
        {/* 出发日期 */}
        <Field label="出发日期（旅途第一天）" group>
          <Segmented
            label="出发日期"
            value={trip.startDate ? 'set' : 'tbd'}
            options={[
              { value: 'tbd', label: '待定' },
              { value: 'set', label: '已定' },
            ]}
            onChange={(v) => updateTrip(trip.id, { startDate: v === 'set' ? (trip.startDate ?? '2026-12-20') : null })}
          />
        </Field>
        {/* 已定：选日期 */}
        {trip.startDate && (
          <Field label="日期">
            <input type="date" value={trip.startDate} onChange={(e) => e.target.value && updateTrip(trip.id, { startDate: e.target.value })} className={INPUT} />
          </Field>
        )}
        {/* 人数 */}
        <Field label="出行人数" group>
          <Stepper value={trip.travelers} min={1} max={12} unit="人" onChange={(n) => updateTrip(trip.id, { travelers: n })} />
        </Field>
      </details>

      {/* ===== 行程（按时间顺序） ===== */}
      <h2 className="mt-6 text-[17px] font-semibold">按时间顺序</h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">改了顺序或住几晚，日期和每天的日程会自动跟着调整。</p>
      <ol className="mt-3 flex flex-col">
        {route.map((s, i) => {
          // 这个城市的时间段
          const span = spans.find((x) => x.stop.id === s.id)
          // 到达和离开那天
          const arrive = span ? itin.days[span.arriveDay - 1] : undefined
          const depart = span ? itin.days[span.departDay - 1] : undefined
          // 和下一个地点之间的交通
          const seg = i < route.length - 1 ? data.segments.find((g) => g.fromStopId === s.id && g.toStopId === route[i + 1].id) : undefined
          // 一个地点 + 后面的交通
          return (
            <li key={s.id}>
              {/* 地点 */}
              {s.kind === 'stay' ? (
                <StayCard
                  stop={s}
                  arrive={arrive}
                  depart={depart}
                  data={data}
                  onNights={(n) => setNights(s.id, n)}
                  onEdit={() => setStopForm({ stop: s, kind: s.kind })}
                  onUp={i > 0 ? () => move(i, -1) : undefined}
                  onDown={i < route.length - 1 ? () => move(i, 1) : undefined}
                  onToSaved={() => toSaved(s)}
                  onAddHotel={() => setHotelFor(s)}
                  onAddHotelTicket={(p) => setTicketFor({ place: p })}
                />
              ) : (
                <PointRow
                  stop={s}
                  when={arrive ? dayLabel(arrive) : ''}
                  onEdit={() => setStopForm({ stop: s, kind: s.kind })}
                  onUp={i > 0 ? () => move(i, -1) : undefined}
                  onDown={i < route.length - 1 ? () => move(i, 1) : undefined}
                  onDelete={() => remove(s)}
                />
              )}
              {/* 交通 */}
              {seg && <SegmentRow seg={seg} data={data} onAddTicket={() => setTicketFor({ segId: seg.id })} />}
            </li>
          )
        })}
      </ol>

      {/* 还没有住宿城市：提示怎么开始 */}
      {!route.some((s) => s.kind === 'stay') && (
        <p className="mt-3 rounded-2xl bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-accent">
          还没有目的地。点下面的「添加目的地」，按时间顺序一个一个加城市（例如 Milano → Firenze → Roma），每个城市选「住宿城市」、填住几晚。要经过的机场可以选「只是路过」。
        </p>
      )}

      {/* 旅行手册 */}
      {route.some((s) => s.kind === 'stay') && (
        <Link to="/carnet" className="mt-3 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-paper">
          <span>
            <span className="block text-[14px] font-semibold">生成旅行手册</span>
            <span className="block text-[12px] opacity-75">机票、住宿、每天的安排、景点、照片，一页看完</span>
          </span>
          <Icon name="chevronRight" size={16} />
        </Link>
      )}

      {/* 添加目的地 */}
      <button onClick={() => setStopForm({ stop: null, kind: 'stay' })} className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-[14px]">
        <Icon name="plus" size={16} />
        添加目的地
      </button>

      {/* ===== 以后想去 ===== */}
      <h2 className="mt-8 text-[17px] font-semibold">以后想去</h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">不在这次行程里，但酒店、景点资料都保留着。在底部「城市」里也能看到。</p>
      <div className="mt-3 flex flex-col gap-2.5">
        {saved.map((s) => (
          <div key={s.id} className="rounded-2xl border border-line bg-card p-3.5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-serif text-[21px] leading-tight font-medium">{s.name}</span>
                  <span className="truncate text-[12px] text-muted">{s.nameZh}</span>
                </div>
                <div className="text-[12px] text-muted">{data.places.filter((p) => p.stopId === s.id).length} 个酒店 / 景点</div>
              </div>
              <IconBtn label={`编辑 ${s.name}`} icon="edit" onClick={() => setStopForm({ stop: s, kind: s.kind })} />
              <IconBtn label={`删除 ${s.name}`} icon="trash" onClick={() => remove(s)} />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => toRoute(s)} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-ink text-[13px] text-paper">
                <Icon name="plus" size={14} />
                加入本次旅行
              </button>
              <Link to={`/city/${s.id}`} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-line-strong text-[13px]">
                城市详情
                <Icon name="chevronRight" size={14} />
              </Link>
            </div>
          </div>
        ))}
        {/* 添加以后想去的城市 */}
        <button onClick={() => setStopForm({ stop: null, kind: 'saved' })} className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-[13px] text-muted">
          <Icon name="plus" size={15} />
          添加以后想去的城市
        </button>
      </div>

      {/* 城市表单 */}
      {stopForm && <StopForm initial={stopForm.stop} near={near} defaultKind={stopForm.kind} onSave={onStopSaved} onClose={() => setStopForm(null)} />}
      {/* 添加住宿（默认“已预订”） */}
      {hotelFor && (
        <PlaceForm
          tripId={trip.id}
          stopId={hotelFor.id}
          cityCenter={[hotelFor.lng, hotelFor.lat]}
          initial={null}
          defaultCategory="hotel"
          defaultStatus="booked"
          onClose={() => setHotelFor(null)}
        />
      )}
      {/* 车票 / 住宿截图 */}
      {ticketFor && (
        <TicketForm
          tripId={trip.id}
          initial={null}
          segments={data.segments}
          stops={data.stops}
          defaultSegmentId={ticketFor.segId}
          place={ticketFor.place ? { id: ticketFor.place.id, name: ticketFor.place.name } : undefined}
          onClose={() => setTicketFor(null)}
        />
      )}
    </div>
  )
}

// 住宿城市的卡片：日期、住几晚、住宿和预订截图
function StayCard({
  stop: s,
  arrive,
  depart,
  data,
  onNights,
  onEdit,
  onUp,
  onDown,
  onToSaved,
  onAddHotel,
  onAddHotelTicket,
}: {
  stop: Stop
  arrive?: DayInfo
  depart?: DayInfo
  data: TripData
  onNights: (n: number) => void
  onEdit: () => void
  onUp?: () => void
  onDown?: () => void
  onToSaved: () => void
  onAddHotel: () => void
  onAddHotelTicket: (p: Place) => void
}) {
  // 已选定或已预订的住宿
  const hotels = data.places.filter((p) => p.stopId === s.id && p.category === 'hotel' && p.status !== 'candidate')
  // 返回卡片
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      {/* 第一行：城市名 + 编辑 */}
      <div className="flex items-start gap-3">
        <span className="mt-2 h-3 w-3 shrink-0 rounded-full border-2 border-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-serif text-[24px] leading-tight font-medium">{s.name}</span>
            <span className="truncate text-[12px] text-muted">{s.nameZh}</span>
          </div>
          {/* 日期范围 */}
          <div className="text-[13px] text-muted">{arrive && depart ? `${dayLabel(arrive)} — ${dayLabel(depart)}` : ''}</div>
        </div>
        <IconBtn label={`编辑 ${s.name}`} icon="edit" onClick={onEdit} />
      </div>
      {/* 第二行：住几晚 + 排序 + 移出 */}
      <div className="mt-2 flex items-center gap-1 pl-6">
        <Stepper value={s.nights} min={1} max={30} unit="晚" onChange={onNights} />
        <span className="ml-auto flex">
          <IconBtn label="上移" icon="chevronUp" disabled={!onUp} onClick={() => onUp?.()} />
          <IconBtn label="下移" icon="chevronDown" disabled={!onDown} onClick={() => onDown?.()} />
          <IconBtn label={`把 ${s.name} 移出本次旅行`} icon="close" onClick={onToSaved} />
        </span>
      </div>

      {/* 住宿 */}
      <div className="mt-3 ml-6 border-t border-line pt-3">
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <Icon name="bed" size={14} />
          住宿
        </div>
        {/* 已定的住宿 */}
        {hotels.map((h) => (
          <HotelRow key={h.id} hotel={h} tickets={data.tickets.filter((t) => t.placeId === h.id)} onAddTicket={() => onAddHotelTicket(h)} />
        ))}
        {/* 添加住宿 */}
        <div className="mt-2 flex gap-2">
          <button onClick={onAddHotel} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-[13px]">
            <Icon name="plus" size={14} />
            {hotels.length ? '再加一个住宿' : '添加住宿'}
          </button>
          <Link to={`/city/${s.id}`} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-line-strong text-[13px]">
            城市详情
            <Icon name="chevronRight" size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

// 一个住宿：名字、状态、预订截图
function HotelRow({ hotel: h, tickets, onAddTicket }: { hotel: Place; tickets: Ticket[]; onAddTicket: () => void }) {
  // 返回
  return (
    <div className="mt-2 rounded-xl bg-paper/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium">{h.name}</div>
          {h.address && <div className="truncate text-[12px] text-muted">{h.address}</div>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${statusClass(h.status)}`}>{STATUS_LABEL[h.status]}</span>
      </div>
      {/* 预订截图 */}
      <div className="mt-2 flex flex-wrap gap-2">
        {tickets.map((t) => (
          <TicketThumb key={t.id} ticket={t} />
        ))}
        <button onClick={onAddTicket} className="flex h-14 items-center gap-1 rounded-lg border border-dashed border-line-strong px-3 text-[12px] text-muted">
          <Icon name="plus" size={13} />
          预订截图
        </button>
      </div>
    </div>
  )
}

// 交通行：方式、航班号、时间、机票截图
function SegmentRow({ seg, data, onAddTicket }: { seg: Segment; data: TripData; onAddTicket: () => void }) {
  // 这一段的车票（按出发时间）
  const tickets = data.tickets.filter((t) => t.segmentId === seg.id).sort((a, b) => (a.departAt ?? '').localeCompare(b.departAt ?? ''))
  // 第一张票（显示航班号和时间）
  const t0 = tickets[0]
  // 时间：出发 – 到达
  const time = t0 && hm(t0.departAt) ? `${hm(t0.departAt)}${hm(t0.arriveAt) ? `–${hm(t0.arriveAt)}` : ''}` : seg.timeOfDay
  // 返回
  return (
    <div className="my-1.5 ml-[17px] border-l-2 border-dashed border-line-strong py-1.5 pl-4">
      {/* 交通信息（点进去看详情） */}
      <Link to={`/segment/${seg.id}`} className="flex items-center gap-2.5">
        <Icon name={MODE_ICON[seg.mode]} size={17} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">
            {MODE_LABEL[seg.mode]}
            {t0?.number && ` · ${t0.number}`}
            {time && ` · ${time}`}
          </span>
          <span className="block truncate text-[11px] text-muted">
            {segmentName(seg, data.stops)}
            {tickets.length > 1 && ` · ${tickets.length} 张票`}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${seg.booked ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{seg.booked ? '已订' : '未订'}</span>
        <Icon name="chevronRight" size={14} className="shrink-0 text-muted" />
      </Link>
      {/* 机票截图 */}
      <div className="mt-2 flex flex-wrap gap-2">
        {tickets.map((t) => (
          <TicketThumb key={t.id} ticket={t} />
        ))}
        <button onClick={onAddTicket} className="flex h-14 items-center gap-1 rounded-lg border border-dashed border-line-strong px-3 text-[12px] text-muted">
          <Icon name="plus" size={13} />
          {seg.mode === 'flight' ? '机票截图' : '车票'}
        </button>
      </div>
    </div>
  )
}

// 车票缩略图（点进去看车票详情）
function TicketThumb({ ticket }: { ticket: Ticket }) {
  // 文件
  const files = useTicketFiles(ticket.id)
  // 第一张图片
  const url = useObjectUrl(viewableFiles(files ?? [])[0]?.blob)
  // 返回
  return (
    <Link to={`/ticket/${ticket.id}`} aria-label={`查看 ${ticket.title}`} className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Icon name="ticket" size={18} className="text-muted" />}
    </Link>
  )
}

// 出发地 / 中转 / 回家：一行
function PointRow({ stop: s, when, onEdit, onUp, onDown, onDelete }: { stop: Stop; when: string; onEdit: () => void; onUp?: () => void; onDown?: () => void; onDelete: () => void }) {
  // 返回
  return (
    <div className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
      {/* 圆点：家实心，中转小点 */}
      <span className={`ml-[3px] shrink-0 rounded-full border-2 border-accent ${s.kind === 'home' ? 'h-3 w-3 bg-accent' : 'h-2.5 w-2.5'}`} />
      <div className="min-w-0 flex-1">
        {/* 地名（当地原文）占一整行，避免被按钮挤掉 */}
        <div className="truncate text-[15px] font-medium">{s.name}</div>
        {/* 中文名、类型、日期 */}
        <div className="truncate text-[11px] text-muted">
          {s.nameZh} · {KIND_LABEL[s.kind]}
          {when && ` · ${when}`}
        </div>
      </div>
      <IconBtn label={`编辑 ${s.name}`} icon="edit" onClick={onEdit} />
      <IconBtn label="上移" icon="chevronUp" disabled={!onUp} onClick={() => onUp?.()} />
      <IconBtn label="下移" icon="chevronDown" disabled={!onDown} onClick={() => onDown?.()} />
      <IconBtn label={`删除 ${s.name}`} icon="trash" onClick={onDelete} />
    </div>
  )
}

// 小图标按钮
function IconBtn({ label, icon, onClick, disabled }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean }) {
  // 返回按钮
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-25">
      <Icon name={icon} size={16} />
    </button>
  )
}
