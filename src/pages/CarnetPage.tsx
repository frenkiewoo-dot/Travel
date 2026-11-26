// ============================================================
// 旅行手册（/carnet）：把当前旅行的所有信息整理成一页，像一本旅行指南
//   I   路线：每个目的地、日期、住几晚
//   II  交通：每段机票 / 火车（航班号、时间、是否已订、票）
//   III 住宿：每个城市住哪（地址、入住退房、截图）
//   IV  每日安排：每天在哪、几点去哪里、节日提醒
//   V   推荐景点：每个城市值得去的地方（门票、开放时间、节日提醒）
//   VI  相册：每个城市的照片
//   可以「打印 / 存成 PDF」（电脑上打印时会自动去掉按钮和底部导航）
// ============================================================

// 引入 React 钩子
import type { ReactNode } from 'react'
// 引入路由
import { Link, useNavigate } from 'react-router-dom'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入数据结构
import type { Place, Stop } from '../db/schema'
// 引入照片概况
import { usePhotoSummary } from '../db/photos'
// 引入行程工具
import { MODE_LABEL, computeSpans, dayLabel } from '../lib/itinerary'
// 引入组件
import { Icon } from '../components/Icon'
import { PhotoImg } from '../components/Album'
import { segmentName } from '../components/TicketForm'
import { formatDepart } from '../components/TicketCard'
import { statusClass } from '../components/PlaceCard'
import { STATUS_LABEL, CATEGORY_LABEL } from '../components/PlaceForm'
import { MODE_ICON } from './SegmentPage'
// 引入加载画面
import { Loading } from './HomePage'

// 页面组件：当前旅行的手册
export default function CarnetPage() {
  return <Carnet />
}

// 旅行手册内容；tripId 不传就是当前旅行；embedded = 嵌在别的页面里（例如「已删除的旅行」详情），不显示返回和打印按钮、链接不能点
export function Carnet({ tripId, embedded }: { tripId?: string; embedded?: boolean }) {
  // 页面跳转
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData(tripId)
  // 每天概况
  const itin = useItinerary(data)
  // 照片概况
  const photos = usePhotoSummary()

  // 加载中
  if (!data || !itin) return <Loading />

  // 旅行
  const trip = data.trip
  // 每个地点的时间段
  const spans = computeSpans(data.stops)
  // 住宿城市（按顺序）
  const stays = spans.filter((s) => s.stop.kind === 'stay').map((s) => s.stop)
  // 交通段按行程顺序
  const orderOf = (id: string) => data.stops.find((s) => s.id === id)?.order ?? 0
  const segments = [...data.segments].sort((a, b) => orderOf(a.fromStopId) - orderOf(b.fromStopId))
  // 第一天和最后一天
  const first = itin.days[0]
  const last = itin.days[itin.days.length - 1]
  // 封面照片：第一个有照片的住宿城市
  const cover = stays.map((s) => photos?.get(s.id)?.cover).find(Boolean)
  // 某个地点的到达日文字
  const dayOfStop = (stopId: string, which: 'arrive' | 'depart') => {
    const sp = spans.find((s) => s.stop.id === stopId)
    const d = sp ? itin.days[(which === 'arrive' ? sp.arriveDay : sp.departDay) - 1] : undefined
    return d ? dayLabel(d) : ''
  }

  // 页面内容
  return (
    <div className={embedded ? 'pointer-events-none' : 'print-flow h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-14'}>
      {/* 返回 */}
      {!embedded && (
        <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="no-print -ml-3 flex h-11 w-11 items-center justify-center">
          <Icon name="back" size={22} />
        </button>
      )}

      {/* ===== 封面 ===== */}
      <div className="font-serif text-[16px] italic text-muted">Carnet de voyage</div>
      <h1 className="font-serif text-[46px] leading-[0.95] font-medium">{trip.name}</h1>
      {trip.subtitle && <div className="mt-1 font-serif text-[18px] italic text-muted">{trip.subtitle}</div>}
      <p className="mt-2 text-[13px] text-muted">
        {first?.date && last?.date ? `${dayLabel(first)} — ${dayLabel(last)}` : '日期待定'} · {itin.total} 天 · {trip.travelers} 人
      </p>
      {/* 路线一行 */}
      <p className="mt-1 text-[13px]">
        {spans
          .map((s) => s.stop)
          .filter((s, i, arr) => s.kind !== 'transit' && (i === 0 || arr[i - 1].name !== s.name))
          .map((s) => s.name)
          .join(' → ')}
      </p>
      {cover && (
        <div className="mt-4 overflow-hidden rounded-[20px]" style={{ aspectRatio: '16 / 10' }}>
          <PhotoImg photo={cover} full className="h-full w-full object-cover" />
        </div>
      )}
      {/* 按钮 */}
      <div className={`no-print mt-4 flex gap-2 ${embedded ? 'hidden' : ''}`}>
        <button onClick={() => window.print()} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink text-[14px] text-paper">
          <Icon name="download" size={16} />
          打印 / 存成 PDF
        </button>
        <Link to="/trip" className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[14px]">
          <Icon name="edit" size={15} />
          修改行程
        </Link>
      </div>
      {stays.length === 0 && <p className="mt-4 rounded-2xl bg-accent-soft p-4 text-[13px] text-accent">这次旅行还没有目的地。先去「本次旅行」添加城市，手册会自动生成。</p>}

      {/* ===== I 路线 ===== */}
      <Section n="I" fr="Itinéraire" title="路线">
        <ol className="relative ml-1.5 border-l border-line-strong pl-5">
          {spans.map(({ stop: s }) => (
            <li key={s.id} className="relative pb-3.5 last:pb-0">
              {/* 时间线上的点 */}
              <span className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-paper ${s.kind === 'stay' ? 'bg-accent' : 'bg-line-strong'}`} />
              <div className="flex items-baseline justify-between gap-2">
                <span className={s.kind === 'stay' ? 'font-serif text-[20px] font-medium' : 'text-[14px]'}>{s.name}</span>
                <span className="shrink-0 text-[12px] text-muted">{s.kind === 'stay' ? `${s.nights} 晚` : s.kind === 'home' ? '出发 / 回家' : '中转'}</span>
              </div>
              <div className="text-[12px] text-muted">
                {s.nameZh} · {s.kind === 'stay' ? `${dayOfStop(s.id, 'arrive')} — ${dayOfStop(s.id, 'depart')}` : dayOfStop(s.id, 'arrive')}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ===== II 交通 ===== */}
      <Section n="II" fr="Transports" title="机票和交通">
        <div className="flex flex-col gap-2.5">
          {segments.map((seg) => {
            // 这段的车票
            const tickets = data.tickets.filter((t) => t.segmentId === seg.id)
            // 选定的方式
            const chosen = seg.options?.find((o) => o.id === seg.chosenOptionId)
            // 一张卡片
            return (
              <Card key={seg.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[15px] font-semibold">
                      <Icon name={MODE_ICON[seg.mode]} size={15} className="shrink-0" />
                      <span className="truncate">{segmentName(seg, data.stops)}</span>
                    </div>
                    <div className="text-[12px] text-muted">
                      {dayOfStop(seg.fromStopId, 'depart')} · {MODE_LABEL[seg.mode]}
                      {seg.timeOfDay && ` · ${seg.timeOfDay}`}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${seg.booked ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{seg.booked ? '已订' : '未订'}</span>
                </div>
                {/* 车票信息 */}
                {tickets.map((t) => (
                  <Link key={t.id} to={`/ticket/${t.id}`} className="mt-2.5 block rounded-xl bg-oat px-3 py-2 text-[13px]">
                    <div className="font-medium">{[t.provider, t.number].filter(Boolean).join(' ') || t.title}</div>
                    <div className="text-[12px] text-muted">
                      {[formatDepart(t.departAt), t.arriveAt && `到达 ${formatDepart(t.arriveAt)?.slice(-5)}`, t.seat && `座位 ${t.seat}`].filter(Boolean).join(' · ') || '点开看车票'}
                    </div>
                  </Link>
                ))}
                {/* 没有车票：显示选定的方式或提醒 */}
                {tickets.length === 0 && (
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">
                    {chosen ? `已选：${chosen.provider} · ${chosen.title}${chosen.duration ? ` · ${chosen.duration}` : ''}` : seg.options?.length ? `${seg.options.length} 种可选方式，还没选` : '还没有安排'}
                    <Link to={`/segment/${seg.id}`} className="no-print ml-1 text-accent underline underline-offset-2">
                      去安排
                    </Link>
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </Section>

      {/* ===== III 住宿 ===== */}
      <Section n="III" fr="Hébergement" title="住宿">
        <div className="flex flex-col gap-2.5">
          {stays.map((s) => {
            // 这个城市的住宿（已预订优先）
            const hotels = data.places.filter((p) => p.stopId === s.id && p.category === 'hotel')
            const chosen = hotels.find((h) => h.status === 'booked') ?? hotels.find((h) => h.status === 'selected')
            // 住宿凭证
            const voucher = chosen && data.tickets.find((t) => t.placeId === chosen.id)
            // 一张卡片
            return (
              <Card key={s.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-[20px] font-medium">{s.name}</span>
                  <span className="text-[12px] text-muted">
                    {dayOfStop(s.id, 'arrive')} 起 · {s.nights} 晚
                  </span>
                </div>
                {chosen ? (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold">{chosen.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(chosen.status)}`}>{STATUS_LABEL[chosen.status]}</span>
                    </div>
                    {chosen.address && <div className="text-[12px] text-muted">{chosen.address}</div>}
                    {voucher && (
                      <Link to={`/ticket/${voucher.id}`} className="mt-1.5 inline-block text-[12px] text-accent underline underline-offset-2">
                        {[voucher.departAt && `入住 ${formatDepart(voucher.departAt)}`, voucher.arriveAt && `退房 ${formatDepart(voucher.arriveAt)}`].filter(Boolean).join(' · ') || '看预订截图'}
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[12px] text-accent">
                    还没订住宿{hotels.length ? `（有 ${hotels.filter((h) => !h.hidden).length} 个候选）` : ''}
                    <Link to={`/city/${s.id}?tab=hotel`} className="no-print ml-1 underline underline-offset-2">
                      去看看
                    </Link>
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </Section>

      {/* ===== IV 每日安排 ===== */}
      <Section n="IV" fr="Jour par jour" title="每日安排">
        <div className="flex flex-col gap-2.5">
          {itin.days.map((d) => {
            // 这天的日程
            const plan = data.dayPlans.find((p) => p.dayIndex === d.dayIndex)
            const items = plan?.items ?? []
            // 节日提醒
            const md = d.date?.slice(5)
            const holiday = md === '12-24' ? '平安夜：商店和很多景点下午提前关门' : md === '12-25' ? '圣诞节：多数商店关门，部分景点不开放' : md === '12-26' ? '圣诞节第二天：公共假日，部分商店和景点仍不开放' : null
            // 一天
            return (
              <Card key={d.dayIndex}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">
                    <span className="mr-1.5 font-serif text-[20px] font-medium">{d.dayIndex}</span>
                    {dayLabel(d)}
                  </span>
                  <span className="truncate text-[12px] text-muted">{d.stop.nameZh || d.stop.name}</span>
                </div>
                {/* 当天的交通 */}
                {d.segments.map((s) => (
                  <div key={s.id} className="mt-1 flex items-center gap-1.5 text-[12px] text-accent">
                    <Icon name={MODE_ICON[s.mode]} size={13} />
                    {segmentName(s, data.stops)}
                  </div>
                ))}
                {/* 节日提醒 */}
                {holiday && <div className="mt-1 text-[12px] text-accent">⚠ {holiday}</div>}
                {/* 站点 */}
                {items.length > 0 ? (
                  <ol className="mt-2 flex flex-col gap-1">
                    {items.map((it, i) => (
                      <li key={it.id} className="flex gap-2 text-[13px]">
                        <span className={`${it.time ? 'w-11' : 'w-5'} shrink-0 text-muted tabular-nums`}>{it.time ?? `${i + 1}.`}</span>
                        <span className="min-w-0">{it.name}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-[12px] text-muted">还没安排</p>
                )}
                <Link to={`/day/${d.dayIndex}`} className="no-print mt-2 inline-flex items-center gap-1 text-[12px] text-accent">
                  地图和步行路线
                  <Icon name="chevronRight" size={12} />
                </Link>
              </Card>
            )
          })}
        </div>
      </Section>

      {/* ===== V 推荐景点 ===== */}
      <Section n="V" fr="À voir" title="景点">
        {stays.map((s) => (
          <CitySpots key={s.id} stop={s} places={data.places.filter((p) => p.stopId === s.id)} />
        ))}
      </Section>

      {/* ===== VI 相册 ===== */}
      <Section n="VI" fr="Souvenirs" title="相册">
        <div className="grid grid-cols-2 gap-2.5">
          {stays.map((s) => {
            // 这个城市的照片概况
            const ph = photos?.get(s.id)
            // 一格
            return (
              <Link key={s.id} to={`/city/${s.id}?tab=album`} className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="relative bg-oat" style={{ aspectRatio: '4 / 5' }}>
                  {ph ? <PhotoImg photo={ph.cover} className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] text-muted">旅行时在城市的「相册」里上传照片</span>}
                </div>
                <div className="px-3 py-2">
                  <div className="font-serif text-[18px] leading-tight font-medium">{s.name}</div>
                  <div className="text-[12px] text-muted">{ph ? `${ph.count} 张照片` : '还没有照片'}</div>
                </div>
              </Link>
            )
          })}
        </div>
      </Section>

      {/* 结尾 */}
      <div className="mt-14 text-center font-serif text-[22px] italic text-muted">Bon voyage</div>
    </div>
  )
}

// 一个大章节：罗马数字 + 法语小标题 + 中文标题
function Section({ n, fr, title, children }: { n: string; fr: string; title: string; children: ReactNode }) {
  // 返回
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <span className="font-serif text-[17px] italic text-muted">{n}</span>
        <span className="h-px flex-1 bg-line" />
        <span className="font-serif text-[15px] italic text-muted">{fr}</span>
      </div>
      <h2 className="mt-1 mb-3 text-[22px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

// 卡片
function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-line bg-card p-3.5">{children}</div>
}

// 一个城市的景点：已选定的在前，再列候选（最多 8 个）
function CitySpots({ stop, places }: { stop: Stop; places: Place[] }) {
  // 景点（不含住宿和车站、不含隐藏的）
  const spots = places.filter((p) => p.category !== 'hotel' && p.category !== 'station' && !p.hidden)
  // 排序：已预订 → 已选定 → 候选
  const order = { booked: 0, selected: 1, candidate: 2 }
  const sorted = [...spots].sort((a, b) => order[a.status] - order[b.status] || (a.createdAt ?? 0) - (b.createdAt ?? 0)).slice(0, 8)
  // 返回
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-serif text-[20px] font-medium">{stop.name}</span>
        <Link to={`/city/${stop.id}?tab=spots`} className="no-print text-[12px] text-accent">
          全部 {spots.length} 个
        </Link>
      </div>
      {sorted.length === 0 && <p className="text-[12px] text-muted">还没有景点。在城市的「景点」标签里添加，或者让 Claude 帮你调研推荐。</p>}
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
        {sorted.map((p) => (
          <li key={p.id} className="px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[14px] font-semibold">{p.name}</span>
              <span className="shrink-0 text-[11px] text-muted">{p.status === 'candidate' ? CATEGORY_LABEL[p.category] : STATUS_LABEL[p.status]}</span>
            </div>
            <div className="text-[12px] text-muted">{[p.nameZh, p.ticket, p.duration && `建议 ${p.duration}`].filter(Boolean).join(' · ')}</div>
            {p.holidayNote && <div className="mt-0.5 text-[12px] text-accent">⚠ {p.holidayNote}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
