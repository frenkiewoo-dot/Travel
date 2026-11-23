// ============================================================
// 票夹（底部导航“票夹”）
//   按行程顺序列出每段交通的车票，最后是没关联交通的（例如门票）
//   所有车票都存在手机里，断网也能看
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入路由
import { Link, useNavigate } from 'react-router-dom'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入行程工具
import { computeSpans, dayLabel } from '../lib/itinerary'
// 引入组件
import { Icon } from '../components/Icon'
import { TicketCard } from '../components/TicketCard'
import { TicketForm, segmentName } from '../components/TicketForm'
// 引入加载画面
import { Loading } from './HomePage'

// 页面组件
export default function TicketsPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 添加表单：null 不显示；segId 是预先选好的交通段
  const [adding, setAdding] = useState<{ segId?: string } | null>(null)

  // 加载中
  if (!data || !itin) return <Loading />

  // 每个城市的时间段（算交通是哪天）
  const spans = computeSpans(data.stops)
  // 交通段按行程顺序排列
  const segments = [...data.segments].sort((a, b) => (data.stops.find((s) => s.id === a.fromStopId)?.order ?? 0) - (data.stops.find((s) => s.id === b.fromStopId)?.order ?? 0))
  // 某段交通是哪天
  const dayOf = (fromStopId: string) => {
    // 出发城市的离开日
    const sp = spans.find((s) => s.stop.id === fromStopId)
    // 那天的文字
    return sp ? dayLabel(itin.days[sp.departDay - 1]) : undefined
  }
  // 车票按出发时间排序
  const tickets = [...data.tickets].sort((a, b) => (a.departAt ?? '').localeCompare(b.departAt ?? '') || a.createdAt - b.createdAt)
  // 没关联交通（或关联的交通已经不存在）的车票
  const others = tickets.filter((t) => !t.segmentId || !segments.some((s) => s.id === t.segmentId))

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),24px)] pb-10">
      {/* 标题 + 添加 */}
      <div className="flex items-end justify-between">
        <div>
          <div className="font-serif text-[16px] italic text-muted">Billets</div>
          <h1 className="text-[28px] font-semibold">票夹</h1>
        </div>
        <button onClick={() => setAdding({})} className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] text-paper">
          <Icon name="plus" size={16} />
          添加车票
        </button>
      </div>
      {/* 说明 */}
      <p className="mt-2 text-[12px] leading-relaxed text-muted">车票文件只存在这台手机里，断网也能打开。检票时点「全屏显示」。</p>

      {/* 每段交通 */}
      {segments.map((seg) => {
        // 这段交通的车票
        const list = tickets.filter((t) => t.segmentId === seg.id)
        // 一组
        return (
          <section key={seg.id} className="mt-6">
            {/* 组标题：交通段 + 日期 + 是否已订 */}
            <Link to={`/segment/${seg.id}`} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{segmentName(seg, data.stops)}</span>
                <span className="block text-[12px] text-muted">{dayOf(seg.fromStopId)}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${seg.booked ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{seg.booked ? '已订' : '未订'}</span>
            </Link>
            {/* 车票 */}
            <div className="mt-2.5 flex flex-col gap-3">
              {list.map((t) => (
                <TicketCard key={t.id} ticket={t} fallbackDate={dayOf(seg.fromStopId)} />
              ))}
              {/* 没有车票 */}
              {list.length === 0 && <SegmentEmpty onAdd={() => setAdding({ segId: seg.id })} />}
            </div>
          </section>
        )
      })}

      {/* 其他车票 */}
      {others.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold">其他（门票等）</h2>
          <div className="mt-2.5 flex flex-col gap-3">
            {others.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      )}

      {/* 添加表单 */}
      {adding && (
        <TicketForm
          tripId={data.trip.id}
          initial={null}
          segments={segments}
          stops={data.stops}
          defaultSegmentId={adding.segId}
          onClose={() => setAdding(null)}
          onSaved={(id) => navigate(`/ticket/${id}`)}
        />
      )}
    </div>
  )
}

// 某段交通还没有车票时的占位
function SegmentEmpty({ onAdd }: { onAdd: () => void }) {
  // 返回
  return (
    <button onClick={onAdd} className="flex h-14 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-[13px] text-muted">
      <Icon name="plus" size={15} />
      还没有车票，点这里添加
    </button>
  )
}
