// ============================================================
// 一段城际交通的详情（/segment/交通段ID）
//   - 可选方式：火车 / 大巴 / 飞机，大致时长、价格、预订链接
//   - 选定一种方式，标记“已订”，写时间和备注
//   - 也可以自己添加方式
//   - 这一段的车票（票夹）
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入路由工具
import { Link, useNavigate, useParams } from 'react-router-dom'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入数据结构
import type { TransportMode, TransportOption } from '../db/schema'
// 引入数据操作
import { addUserOption, chooseOption, deleteOption, updateSegment } from '../db/trip'
// 引入行程工具
import { MODE_LABEL, computeSpans, dayLabel } from '../lib/itinerary'
// 引入 Google Maps 链接
import { googleMapsDirections } from '../lib/gmaps'
// 引入组件
import { Icon, type IconName } from '../components/Icon'
import { Field, INPUT, Segmented, Sheet, TEXTAREA } from '../components/Sheet'
import { TicketCard } from '../components/TicketCard'
import { TicketForm } from '../components/TicketForm'
// 引入加载画面
import { Loading } from './HomePage'

// 交通方式图标
export const MODE_ICON: Record<TransportMode, IconName> = { train: 'train', bus: 'bus', flight: 'plane', ferry: 'bus', car: 'bus', tbd: 'question' }
// 可选的交通方式
const MODES: TransportMode[] = ['train', 'bus', 'flight', 'ferry', 'car', 'tbd']

// 页面组件
export default function SegmentPage() {
  // 网址参数
  const { id } = useParams()
  // 页面跳转
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 是否显示“自己添加方式”表单
  const [adding, setAdding] = useState(false)
  // 是否显示“添加车票”表单
  const [addingTicket, setAddingTicket] = useState(false)

  // 加载中
  if (!data || !itin) return <Loading />
  // 这一段
  const seg = data.segments.find((s) => s.id === id)
  // 找不到
  if (!seg)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-paper">
        <p className="text-muted">找不到这段交通（可能调整过行程）</p>
        <Link to="/trip" className="text-accent underline">
          去编辑行程
        </Link>
      </div>
    )
  // 出发地和目的地
  const from = data.stops.find((s) => s.id === seg.fromStopId)
  const to = data.stops.find((s) => s.id === seg.toStopId)
  // 出发那天：出发城市的离开日
  const span = computeSpans(data.stops).find((s) => s.stop.id === seg.fromStopId)
  const day = span ? itin.days[span.departDay - 1] : undefined
  // 可选方式
  const options = seg.options ?? []
  // 选定的方式
  const chosen = options.find((o) => o.id === seg.chosenOptionId)

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-10">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 小标题 */}
      <div className="font-serif text-[16px] italic text-muted">Trajet</div>
      {/* 出发 → 到达 */}
      <h1 className="font-serif text-[32px] leading-tight font-medium">
        {from?.name} <span className="text-muted">→</span> {to?.name}
      </h1>
      {/* 日期、时间 */}
      <p className="mt-1 text-[14px] text-muted">
        {day ? dayLabel(day) : ''}
        {seg.timeOfDay && ` · ${seg.timeOfDay}`}
        {chosen ? ` · 已选：${chosen.provider}` : ` · ${MODE_LABEL[seg.mode]}`}
      </p>

      {/* 是否已订 */}
      <div className="mt-4">
        <Segmented
          label="是否已订票"
          value={seg.booked ? 'yes' : 'no'}
          options={[
            { value: 'no', label: '还没订' },
            { value: 'yes', label: '已订票' },
          ]}
          onChange={(v) => updateSegment(seg.id, { booked: v === 'yes' })}
        />
      </div>

      {/* 车票 */}
      <h2 className="mt-6 flex items-center justify-between text-[15px] font-semibold">
        车票
        <button onClick={() => setAddingTicket(true)} className="flex h-9 items-center gap-1 rounded-full border border-line-strong px-3 text-[12px] font-normal">
          <Icon name="plus" size={14} />
          添加车票
        </button>
      </h2>
      <div className="mt-2 flex flex-col gap-3">
        {data.tickets
          .filter((t) => t.segmentId === seg.id)
          .map((t) => (
            <TicketCard key={t.id} ticket={t} fallbackDate={day ? dayLabel(day) : undefined} />
          ))}
        {/* 没有车票 */}
        {!data.tickets.some((t) => t.segmentId === seg.id) && <p className="text-[12px] text-muted">订好票后把车票图片或 PDF 存在这里，断网也能打开。</p>}
      </div>

      {/* 可选方式 */}
      <h2 className="mt-6 flex items-center justify-between text-[15px] font-semibold">
        可选方式
        <span className="text-[12px] font-normal text-muted">{options.length > 0 ? '价格和时间都是大概，订票前请核实' : ''}</span>
      </h2>
      {/* 方式卡片 */}
      <div className="mt-2 flex flex-col gap-2.5">
        {options.map((o) => (
          <OptionCard
            key={o.id}
            option={o}
            chosen={o.id === seg.chosenOptionId}
            onChoose={() => chooseOption(seg.id, o.id === seg.chosenOptionId ? null : o.id)}
            onDelete={o.source === 'user' ? () => window.confirm(`删除「${o.provider}」？`) && deleteOption(seg.id, o.id) : undefined}
          />
        ))}
        {/* 没有推荐方式 */}
        {options.length === 0 && (
          <p className="rounded-2xl bg-oat p-4 text-[13px] leading-relaxed text-muted">
            {seg.mode === 'flight'
              ? '机票已经订好的话，在上面「车票」里添加机票截图、填航班号和时间就行。'
              : '这一段还没有推荐方式。可以用下面的 Google Maps 查一下，或者自己添加。'}
          </p>
        )}
      </div>

      {/* 自己添加 + Google Maps 查公交火车 */}
      <div className="mt-3 flex gap-2">
        <button onClick={() => setAdding(true)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[13px]">
          <Icon name="plus" size={15} />
          自己添加方式
        </button>
        {from && to && (
          <a href={googleMapsDirections([from, to], false, 'transit')} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px]">
            <Icon name="external" size={15} />
            Google Maps 查车次
          </a>
        )}
      </div>

      {/* 时间、方式、备注 */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-[15px] font-semibold">我的安排</h2>
        {/* 没选定方式时，可以直接选交通工具 */}
        {!chosen && (
          <Field label="交通方式" group>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button key={m} type="button" aria-pressed={seg.mode === m} onClick={() => updateSegment(seg.id, { mode: m })} className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] ${seg.mode === m ? 'bg-ink text-paper' : 'bg-oat'}`}>
                  <Icon name={MODE_ICON[m]} size={14} />
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </Field>
        )}
        {/* 时间（离开输入框时保存） */}
        <Field label="出发时间">
          <input defaultValue={seg.timeOfDay ?? ''} onBlur={(e) => updateSegment(seg.id, { timeOfDay: e.target.value.trim() || undefined })} placeholder="例如 上午，或 09:15 出发" className={INPUT} />
        </Field>
        {/* 备注 */}
        <Field label="备注" hint="例如车次、座位、订单号（车票文件存在上面的「车票」里）">
          <textarea defaultValue={seg.note ?? ''} onBlur={(e) => updateSegment(seg.id, { note: e.target.value.trim() || undefined })} className={TEXTAREA} />
        </Field>
      </section>

      {/* 添加车票的表单 */}
      {addingTicket && (
        <TicketForm
          tripId={data.trip.id}
          initial={null}
          segments={data.segments}
          stops={data.stops}
          defaultSegmentId={seg.id}
          onClose={() => setAddingTicket(false)}
        />
      )}

      {/* 自己添加方式的表单 */}
      {adding && <OptionForm onClose={() => setAdding(false)} onSave={(o) => addUserOption(seg.id, o).then(() => setAdding(false))} />}
    </div>
  )
}

// 一种方式的卡片
function OptionCard({ option: o, chosen, onChoose, onDelete }: { option: TransportOption; chosen: boolean; onChoose: () => void; onDelete?: () => void }) {
  // 返回卡片
  return (
    <article className={`rounded-2xl border bg-card p-4 ${chosen ? 'border-accent' : 'border-line'}`}>
      {/* 第一行：图标 + 运营商 + 标签 */}
      <div className="flex items-start gap-3">
        {/* 交通工具图标 */}
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chosen ? 'bg-accent text-on-accent' : 'bg-oat'}`}>
          <Icon name={MODE_ICON[o.mode]} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          {/* 运营商 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[16px] font-semibold">{o.provider}</h3>
            <span className="rounded-md bg-oat px-1.5 py-0.5 text-[11px] text-muted">{MODE_LABEL[o.mode]}</span>
            {/* 推荐 · 需核实 */}
            {o.source === 'recommended' && <span className="rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-[11px] text-muted">推荐 · 需核实</span>}
          </div>
          {/* 路线 */}
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{o.title}</p>
        </div>
      </div>
      {/* 时长、价格、班次 */}
      <dl className="mt-3 grid grid-cols-[3rem_1fr] gap-x-2 gap-y-1 text-[13px]">
        {o.duration && (
          <>
            <dt className="text-muted">时长</dt>
            <dd>{o.duration}</dd>
          </>
        )}
        {o.price && (
          <>
            <dt className="text-muted">价格</dt>
            <dd>{o.price}</dd>
          </>
        )}
        {o.frequency && (
          <>
            <dt className="text-muted">班次</dt>
            <dd>{o.frequency}</dd>
          </>
        )}
      </dl>
      {/* 备注 */}
      {o.note && <p className="mt-2 text-[13px] leading-relaxed">{o.note}</p>}
      {/* 节日提醒 */}
      {o.holidayNote && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1.5 text-[12px] leading-snug text-accent">
          <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
          {o.holidayNote}
        </p>
      )}
      {/* 按钮 */}
      <div className="mt-3 flex gap-2">
        {/* 选这个 */}
        <button onClick={onChoose} className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] ${chosen ? 'bg-accent text-on-accent' : 'bg-ink text-paper'}`}>
          {chosen ? '已选这个（点一下取消）' : '选这个'}
        </button>
        {/* 预订网站 */}
        {o.url && (
          <a href={o.url} target="_blank" rel="noopener noreferrer" className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px]">
            <Icon name="external" size={14} />
            订票 / 查询
          </a>
        )}
      </div>
      {/* 来源、删除 */}
      {(o.sourceUrl || onDelete) && (
        <div className="mt-2 flex items-center text-[12px]">
          {o.sourceUrl && (
            <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-2">
              信息来源
            </a>
          )}
          {onDelete && (
            <button onClick={onDelete} className="ml-auto flex items-center gap-1 text-muted">
              <Icon name="trash" size={13} />
              删除
            </button>
          )}
        </div>
      )}
    </article>
  )
}

// 自己添加方式的表单
function OptionForm({ onClose, onSave }: { onClose: () => void; onSave: (o: Omit<TransportOption, 'id' | 'source'>) => void }) {
  // 交通方式
  const [mode, setMode] = useState<TransportMode>('train')
  // 运营商
  const [provider, setProvider] = useState('')
  // 路线说明
  const [title, setTitle] = useState('')
  // 时长
  const [duration, setDuration] = useState('')
  // 价格
  const [price, setPrice] = useState('')
  // 链接
  const [url, setUrl] = useState('')
  // 备注
  const [note, setNote] = useState('')
  // 出错
  const [error, setError] = useState<string | null>(null)

  // 保存
  const submit = () => {
    // 必填：运营商
    if (!provider.trim()) {
      setError('请填写运营商，例如 FlixBus、DB')
      return
    }
    // 链接补上 https://
    const u = url.trim()
    // 交出数据
    onSave({
      mode,
      provider: provider.trim(),
      title: title.trim(),
      duration: duration.trim() || undefined,
      price: price.trim() || undefined,
      url: u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`) : undefined,
      note: note.trim() || undefined,
    })
  }

  // 返回表单
  return (
    <Sheet
      title="添加交通方式"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            取消
          </button>
          <button onClick={submit} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper">
            保存
          </button>
        </div>
      }
    >
      {/* 交通方式 */}
      <Field label="交通方式" group>
        <div className="flex flex-wrap gap-1.5">
          {MODES.filter((m) => m !== 'tbd').map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] ${mode === m ? 'bg-ink text-paper' : 'bg-oat'}`}>
              <Icon name={MODE_ICON[m]} size={14} />
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </Field>
      {/* 运营商 */}
      <Field label="运营商 *">
        <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="例如 FlixBus、DB、Ryanair" className={INPUT} />
      </Field>
      {/* 路线 */}
      <Field label="路线说明">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如 Hamburg 换车" className={INPUT} />
      </Field>
      {/* 时长 */}
      <Field label="时长">
        <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="例如 约 7 小时" className={INPUT} />
      </Field>
      {/* 价格 */}
      <Field label="价格">
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="例如 €29" className={INPUT} />
      </Field>
      {/* 链接 */}
      <Field label="订票链接">
        <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" inputMode="url" placeholder="https://…" className={INPUT} />
      </Field>
      {/* 备注 */}
      <Field label="备注">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={TEXTAREA} />
      </Field>
      {/* 出错 */}
      {error && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent">{error}</p>}
    </Sheet>
  )
}
