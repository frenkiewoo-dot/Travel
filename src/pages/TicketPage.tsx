// ============================================================
// 一张车票的详情（/ticket/车票ID）
//   - 所有信息（订单号完整显示）
//   - 车票图片（点一下全屏）、PDF 原件
//   - 编辑、删除、跳到关联的交通
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入路由工具
import { Link, useNavigate, useParams } from 'react-router-dom'
// 引入数据钩子
import { useTripData } from '../db/hooks'
// 引入数据结构
import type { TicketFile } from '../db/schema'
// 引入车票数据操作
import { deleteTicket, useObjectUrl, useTicketFiles, viewableFiles } from '../db/tickets'
// 引入行程工具
import { MODE_LABEL } from '../lib/itinerary'
// 引入组件
import { Icon } from '../components/Icon'
import { TicketViewer } from '../components/TicketViewer'
import { TicketForm, segmentName } from '../components/TicketForm'
import { formatDepart, viewerLines } from '../components/TicketCard'
// 引入加载画面
import { Loading } from './HomePage'

// 页面组件
export default function TicketPage() {
  // 网址参数
  const { id } = useParams()
  // 页面跳转
  const navigate = useNavigate()
  // 旅行数据
  const data = useTripData()
  // 车票文件
  const files = useTicketFiles(id)
  // 全屏从第几张开始（null 不全屏）
  const [fullAt, setFullAt] = useState<number | null>(null)
  // 是否在编辑
  const [editing, setEditing] = useState(false)

  // 加载中
  if (!data || !files) return <Loading />
  // 这张车票
  const t = data.tickets.find((x) => x.id === id)
  // 找不到（例如刚删除）
  if (!t)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-paper">
        <p className="text-muted">找不到这张车票</p>
        <Link to="/tickets" className="text-accent underline">
          回票夹
        </Link>
      </div>
    )
  // 能显示的图片
  const images = viewableFiles(files)
  // PDF 原件
  const pdfs = files.filter((f) => f.mime === 'application/pdf')
  // 关联的交通段
  const seg = data.segments.find((s) => s.id === t.segmentId)
  // 交通段按行程顺序（编辑表单用）
  const segments = [...data.segments].sort((a, b) => (data.stops.find((s) => s.id === a.fromStopId)?.order ?? 0) - (data.stops.find((s) => s.id === b.fromStopId)?.order ?? 0))

  // 删除
  const remove = async () => {
    // 确认
    if (!window.confirm(`删除「${t.title}」和它的所有文件？`)) return
    // 删除
    await deleteTicket(t.id)
    // 回票夹
    navigate('/tickets', { replace: true })
  }

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-10">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/tickets'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 类型 */}
      <div className="font-serif text-[16px] italic text-muted">Billet · {MODE_LABEL[t.mode]}</div>
      {/* 标题 */}
      <h1 className="font-serif text-[34px] leading-tight font-semibold">{t.title}</h1>

      {/* 全屏显示（最常用，放最上面） */}
      <button disabled={images.length === 0} onClick={() => setFullAt(0)} className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[15px] text-paper disabled:opacity-40">
        <Icon name="ticket" size={18} />
        全屏显示车票
      </button>

      {/* 信息 */}
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-card p-4 text-[13px]">
        <Item label="出发时间" value={formatDepart(t.departAt)} wide />
        <Item label="运营商" value={t.provider} />
        <Item label="车次 / 航班" value={t.number} />
        <Item label="座位" value={t.seat} />
        <Item label="订单号" value={t.orderNo} selectable />
        {t.note && <Item label="备注" value={t.note} wide />}
      </dl>

      {/* 关联的交通 */}
      {seg && (
        <Link to={`/segment/${seg.id}`} className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-[13px]">
          <span>
            关联交通：<b className="font-semibold">{segmentName(seg, data.stops)}</b>
          </span>
          <Icon name="chevronRight" size={15} className="text-muted" />
        </Link>
      )}

      {/* 图片 */}
      {images.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[15px] font-semibold">车票图片</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {images.map((f, i) => (
              <ImageTile key={f.id} file={f} onOpen={() => setFullAt(i)} />
            ))}
          </div>
        </section>
      )}

      {/* PDF 原件 */}
      {pdfs.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[15px] font-semibold">PDF 原件</h2>
          <div className="mt-2 flex flex-col gap-2">
            {pdfs.map((f) => (
              <PdfLink key={f.id} file={f} />
            ))}
          </div>
        </section>
      )}

      {/* 编辑、删除 */}
      <div className="mt-6 flex gap-2">
        <button onClick={() => setEditing(true)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[14px]">
          <Icon name="edit" size={15} />
          编辑
        </button>
        <button onClick={remove} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[14px] text-muted">
          <Icon name="trash" size={15} />
          删除
        </button>
      </div>

      {/* 全屏 */}
      {fullAt !== null && <TicketViewer files={images} start={fullAt} title={t.title} lines={viewerLines(t)} onClose={() => setFullAt(null)} />}
      {/* 编辑表单 */}
      {editing && <TicketForm tripId={t.tripId} initial={t} segments={segments} stops={data.stops} onClose={() => setEditing(false)} />}
    </div>
  )
}

// 一项信息
function Item({ label, value, wide, selectable }: { label: string; value?: string | null; wide?: boolean; selectable?: boolean }) {
  // 返回
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-muted">{label}</dt>
      {/* 订单号可以长按复制 */}
      <dd className={`mt-0.5 text-[15px] font-medium break-words ${selectable ? 'select-all' : ''}`}>{value || '—'}</dd>
    </div>
  )
}

// 图片格子
function ImageTile({ file, onOpen }: { file: TicketFile; onOpen: () => void }) {
  // 临时网址
  const url = useObjectUrl(file.blob)
  // 返回
  return (
    <button onClick={onOpen} className="aspect-[3/4] overflow-hidden rounded-xl border border-line bg-white">
      {url && <img src={url} alt={file.name} className="h-full w-full object-contain" />}
    </button>
  )
}

// PDF 原件链接（在新页面打开）
function PdfLink({ file }: { file: TicketFile }) {
  // 临时网址
  const url = useObjectUrl(file.blob)
  // 返回
  return (
    <a href={url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-[11px] font-bold text-accent">PDF</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{file.name}</span>
      <Icon name="external" size={15} className="text-muted" />
    </a>
  )
}
