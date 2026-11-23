// ============================================================
// 车票表单：添加或编辑一张车票
//   - 上传图片 / PDF / 截图（可以多张）
//   - 关联到某段城际交通，填订单号、座位、时间等
// ============================================================

// 引入 React 钩子
import { useRef, useState } from 'react'
// 引入数据结构
import type { Segment, Stop, Ticket, TicketFile, TransportMode } from '../db/schema'
// 引入车票数据操作
import { saveTicket, useObjectUrl, useTicketFiles } from '../db/tickets'
// 引入文件处理
import { prepareFiles, type PreparedFile } from '../lib/files'
// 引入行程工具
import { MODE_LABEL } from '../lib/itinerary'
// 引入组件
import { Icon } from './Icon'
import { Field, INPUT, Sheet, TEXTAREA } from './Sheet'

// 车票可选的类型
const MODES: TransportMode[] = ['train', 'bus', 'flight', 'ferry', 'car']

// 交通段的显示名，例如 “Groningen → Berlin”
export function segmentName(seg: Segment, stops: Stop[]): string {
  // 出发地
  const from = stops.find((s) => s.id === seg.fromStopId)?.name ?? '?'
  // 目的地
  const to = stops.find((s) => s.id === seg.toStopId)?.name ?? '?'
  // 拼接
  return `${from} → ${to}`
}

// 车票表单
export function TicketForm({
  tripId,
  initial,
  segments,
  stops,
  defaultSegmentId,
  onClose,
  onSaved,
}: {
  // 旅行 ID
  tripId: string
  // 要编辑的车票（新建时为 null）
  initial: Ticket | null
  // 所有交通段（按行程顺序）
  segments: Segment[]
  // 所有城市
  stops: Stop[]
  // 新建时默认关联的交通段
  defaultSegmentId?: string
  // 关闭
  onClose: () => void
  // 保存成功（返回车票 ID）
  onSaved?: (id: string) => void
}) {
  // 关联的交通段
  const [segmentId, setSegmentId] = useState(initial?.segmentId ?? defaultSegmentId ?? '')
  // 当前关联的交通段对象
  const seg = segments.find((s) => s.id === segmentId)
  // 标题（不填就用交通段名字）
  const [title, setTitle] = useState(initial?.title ?? '')
  // 类型：新建时跟着交通段走
  const [mode, setMode] = useState<TransportMode>(initial?.mode ?? (seg && seg.mode !== 'tbd' ? seg.mode : 'train'))
  // 运营商：新建时用交通段选定的方式
  const [provider, setProvider] = useState(initial?.provider ?? seg?.options?.find((o) => o.id === seg.chosenOptionId)?.provider ?? '')
  // 出发时间
  const [departAt, setDepartAt] = useState(initial?.departAt ?? '')
  // 车次 / 航班号
  const [number, setNumber] = useState(initial?.number ?? '')
  // 座位
  const [seat, setSeat] = useState(initial?.seat ?? '')
  // 订单号
  const [orderNo, setOrderNo] = useState(initial?.orderNo ?? '')
  // 备注
  const [note, setNote] = useState(initial?.note ?? '')
  // 是否把交通段标记为已订（新建时默认勾选）
  const [markBooked, setMarkBooked] = useState(!initial)
  // 新上传、还没保存的文件
  const [newFiles, setNewFiles] = useState<PreparedFile[]>([])
  // 要删除的已有文件
  const [removed, setRemoved] = useState<string[]>([])
  // 正在处理文件的提示
  const [busy, setBusy] = useState<string | null>(null)
  // 出错
  const [error, setError] = useState<string | null>(null)
  // 文件选择框
  const inputRef = useRef<HTMLInputElement>(null)
  // 已有文件（编辑时）
  const existing = useTicketFiles(initial?.id) ?? []
  // 已有文件里还要保留的：PDF 原件和普通图片（PDF 转出来的图片跟着原件走，不单独显示）
  const keptFiles = existing.filter((f) => !removed.includes(f.id) && !f.pdfId)

  // 选择了文件
  const onPick = async (list: FileList | null) => {
    // 没选
    if (!list || list.length === 0) return
    // 处理中
    setBusy('正在处理文件…')
    setError(null)
    try {
      // 处理（PDF 转图片、大图缩小）
      const prepared = await prepareFiles(list, setBusy)
      // 加进列表
      setNewFiles((cur) => [...cur, ...prepared])
      // 一个都没处理成
      if (prepared.length === 0) setError('只支持图片和 PDF 文件')
    } catch {
      // 出错（例如 PDF 损坏或加密）
      setError('有文件处理失败了，可以换成截图再试')
    } finally {
      // 结束
      setBusy(null)
      // 清空选择框，下次选同一个文件也能触发
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // 保存
  const submit = async () => {
    // 标题：没填就用交通段名字，再不行就用“车票”
    const t = title.trim() || (seg ? segmentName(seg, stops) : '车票')
    // 保存
    const id = await saveTicket({
      ticket: {
        id: initial?.id,
        createdAt: initial?.createdAt,
        tripId,
        segmentId: segmentId || undefined,
        title: t,
        mode,
        provider: provider.trim() || undefined,
        departAt: departAt || undefined,
        number: number.trim() || undefined,
        seat: seat.trim() || undefined,
        orderNo: orderNo.trim() || undefined,
        note: note.trim() || undefined,
      },
      newFiles,
      removeFileIds: removed,
      markBooked,
    })
    // 通知
    onSaved?.(id)
    // 关闭
    onClose()
  }

  // 返回表单
  return (
    <Sheet
      title={initial ? '编辑车票' : '添加车票'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            取消
          </button>
          <button onClick={submit} disabled={!!busy} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper disabled:opacity-50">
            保存
          </button>
        </div>
      }
    >
      {/* 文件 */}
      <Field label="车票文件（图片 / PDF / 截图）" group>
        <div className="flex flex-wrap gap-2">
          {/* 已有文件 */}
          {keptFiles.map((f) => (
            <Thumb key={f.id} blob={f.blob} mime={f.mime} name={f.name} onRemove={() => setRemoved((r) => [...r, f.id])} />
          ))}
          {/* 新文件（PDF 转出来的图片不单独显示） */}
          {newFiles
            .filter((f) => !f.pdfKey)
            .map((f) => (
              <Thumb key={f.key} blob={f.blob} mime={f.mime} name={f.name} onRemove={() => setNewFiles((cur) => cur.filter((x) => x.key !== f.key && x.pdfKey !== f.key))} />
            ))}
          {/* 添加按钮 */}
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-[11px] text-muted">
            <Icon name="plus" size={18} />
            添加
          </button>
        </div>
        {/* 隐藏的文件选择框：iPhone 上可以选照片、拍照或从“文件”里选 PDF */}
        <input ref={inputRef} type="file" accept="image/*,application/pdf,.pdf" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
        {/* 处理中 */}
        {busy && <p className="mt-2 text-[12px] text-muted">{busy}</p>}
        {/* 说明 */}
        {!busy && <p className="mt-2 text-[11px] text-muted">PDF 会自动转成图片，断网也能直接看。文件只存在这台手机里。</p>}
      </Field>

      {/* 关联交通段 */}
      <Field label="关联的交通">
        <select
          value={segmentId}
          onChange={(e) => {
            // 新的交通段
            const id = e.target.value
            setSegmentId(id)
            // 新建时跟着交通段自动填类型和运营商
            const s = segments.find((x) => x.id === id)
            if (!initial && s) {
              if (s.mode !== 'tbd') setMode(s.mode)
              const chosen = s.options?.find((o) => o.id === s.chosenOptionId)
              if (chosen && !provider) setProvider(chosen.provider)
            }
          }}
          className={INPUT}
        >
          {/* 不关联 */}
          <option value="">不关联（例如门票）</option>
          {/* 每段交通 */}
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {segmentName(s, stops)}
            </option>
          ))}
        </select>
      </Field>

      {/* 标记已订 */}
      {segmentId && (
        <label className="mt-2 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={markBooked} onChange={(e) => setMarkBooked(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          同时把这段交通标记为「已订」
        </label>
      )}

      {/* 标题 */}
      <Field label="标题" hint="不填就用交通的名字">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={seg ? segmentName(seg, stops) : '例如 Tivoli 门票'} className={INPUT} />
      </Field>

      {/* 类型 */}
      <Field label="类型" group>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`h-9 rounded-full px-3.5 text-[13px] ${mode === m ? 'bg-ink text-paper' : 'bg-oat'}`}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </Field>

      {/* 运营商 */}
      <Field label="运营商">
        <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="例如 FlixBus、DB、easyJet" className={INPUT} />
      </Field>
      {/* 出发时间 */}
      <Field label="出发时间">
        <input type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} className={INPUT} />
      </Field>
      {/* 车次和座位并排 */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="车次 / 航班号">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="例如 ICE 123" className={INPUT} />
        </Field>
        <Field label="座位">
          <input value={seat} onChange={(e) => setSeat(e.target.value)} placeholder="例如 车厢 7 · 45" className={INPUT} />
        </Field>
      </div>
      {/* 订单号 */}
      <Field label="订单号 / 预订码">
        <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} autoCapitalize="characters" className={INPUT} />
      </Field>
      {/* 备注 */}
      <Field label="备注">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如 在 Hamburg 换车，站台 12" className={TEXTAREA} />
      </Field>

      {/* 出错 */}
      {error && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent">{error}</p>}
    </Sheet>
  )
}

// 文件缩略图（图片显示预览，PDF 显示图标）
function Thumb({ blob, mime, name, onRemove }: { blob: Blob; mime: string; name: string; onRemove: () => void }) {
  // 图片的临时网址（PDF 不需要）
  const url = useObjectUrl(mime.startsWith('image/') ? blob : null)
  // 返回
  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-line bg-oat">
      {/* 预览 */}
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center">
          <span className="text-[13px] font-bold text-accent">PDF</span>
          <span className="line-clamp-2 text-[9px] leading-tight text-muted">{name}</span>
        </div>
      )}
      {/* 删除 */}
      <button type="button" aria-label={`移除 ${name}`} onClick={onRemove} className="absolute top-0.5 right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
        <Icon name="close" size={12} />
      </button>
    </div>
  )
}

// 给其他页面用：一张车票里第一张能显示的图片
export function firstImage(files: TicketFile[] | undefined): TicketFile | undefined {
  // 找第一张图片
  return files?.find((f) => f.mime.startsWith('image/'))
}
