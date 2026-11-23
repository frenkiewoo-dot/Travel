// ============================================================
// 车票卡片：做成纸质票根的样子
//   上半部分：日期、出发 → 到达、出发时间 / 座位 / 订单号
//   虚线下面：车票缩略图 + “全屏显示”按钮
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入路由链接
import { Link } from 'react-router-dom'
// 引入数据结构
import type { Ticket } from '../db/schema'
// 引入车票数据工具
import { useObjectUrl, useTicketFiles, viewableFiles } from '../db/tickets'
// 引入行程工具
import { MODE_LABEL } from '../lib/itinerary'
// 引入组件
import { Icon } from './Icon'
import { TicketViewer } from './TicketViewer'
// 引入交通方式图标
import { MODE_ICON } from '../pages/SegmentPage'

// 星期几
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 把 'YYYY-MM-DDTHH:mm' 变成 “12月23日 周三 09:15”
export function formatDepart(v?: string): string | null {
  // 没有时间
  if (!v) return null
  // 解析
  const d = new Date(v)
  // 解析失败
  if (Number.isNaN(d.getTime())) return v
  // 时和分（补零）
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  // 拼接
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]} ${hh}:${mm}`
}

// 全屏时底部显示的大字信息
export function viewerLines(t: Ticket): { label: string; value: string }[] {
  // 有什么显示什么
  return [
    t.orderNo ? { label: '订单号', value: t.orderNo } : null,
    t.seat ? { label: '座位', value: t.seat } : null,
    t.number ? { label: '车次 / 航班', value: t.number } : null,
  ].filter((x): x is { label: string; value: string } => x !== null)
}

// 车票卡片
export function TicketCard({ ticket: t, fallbackDate }: { ticket: Ticket; fallbackDate?: string }) {
  // 这张车票的文件
  const files = useTicketFiles(t.id)
  // 能显示的图片
  const images = viewableFiles(files ?? [])
  // 第一张图片的网址（缩略图）
  const thumb = useObjectUrl(images[0]?.blob)
  // 是否全屏显示
  const [full, setFull] = useState(false)
  // 出发时间文字
  const when = formatDepart(t.departAt)

  // 返回卡片
  return (
    <article className="overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_2px_12px_var(--shadow)]">
      {/* 上半部分：点进去看详情 */}
      <Link to={`/ticket/${t.id}`} className="block px-5 pt-4 pb-3.5">
        {/* 日期 + 离线可看 */}
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            <Icon name={MODE_ICON[t.mode]} size={14} />
            {when ?? fallbackDate ?? '时间未填'} · {MODE_LABEL[t.mode]}
            {t.provider && ` · ${t.provider}`}
          </span>
          {images.length > 0 && (
            <span className="shrink-0 text-sage">✓ 离线可看</span>
          )}
        </div>
        {/* 标题（出发 → 到达） */}
        <h3 className="mt-2 font-serif text-[26px] leading-tight font-semibold">{t.title}</h3>
        {/* 关键信息 */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <Info label="车次" value={t.number} />
          <Info label="座位" value={t.seat} />
          {/* 订单号只显示后 4 位，详情里看完整的 */}
          <Info label="订单号" value={t.orderNo ? `••${t.orderNo.slice(-4)}` : undefined} />
        </div>
      </Link>
      {/* 虚线 */}
      <div className="mx-4 border-t-[1.5px] border-dashed border-line-strong" />
      {/* 下半部分：缩略图 + 全屏按钮 */}
      <div className="flex items-center gap-4 px-5 pt-3.5 pb-4">
        {/* 缩略图 */}
        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-lg border border-line bg-oat">
          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[11px] text-muted">无图片</div>}
        </div>
        {/* 说明 + 按钮 */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-[12px] leading-snug text-muted">{images.length > 0 ? `${images.length} 张 · 检票时全屏显示，记得调高亮度` : '还没有上传车票文件'}</span>
          <button disabled={images.length === 0} onClick={() => setFull(true)} className="h-10 rounded-xl bg-ink text-[13px] text-paper disabled:opacity-40">
            全屏显示
          </button>
        </div>
      </div>
      {/* 全屏 */}
      {full && <TicketViewer files={images} title={t.title} lines={viewerLines(t)} onClose={() => setFull(false)} />}
    </article>
  )
}

// 一项信息（没有就显示横线）
function Info({ label, value }: { label: string; value?: string }) {
  // 返回
  return (
    <div className="min-w-0">
      <div className="text-muted">{label}</div>
      <div className="truncate text-[15px] font-semibold">{value ?? '—'}</div>
    </div>
  )
}
