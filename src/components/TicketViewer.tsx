// ============================================================
// 全屏显示车票（检票用）
//   - 白色背景，二维码最容易被扫到
//   - 点图片放大 / 缩小，多页可以左右切换
//   - 打开期间屏幕保持常亮
//   - 网页没法自动调亮度，所以提示手动调到最亮
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入数据结构
import type { TicketFile } from '../db/schema'
// 引入临时网址工具
import { useObjectUrl } from '../db/tickets'
// 引入屏幕常亮
import { useWakeLock } from '../lib/useWakeLock'
// 引入图标
import { Icon } from './Icon'

// 全屏查看组件
export function TicketViewer({
  files,
  start = 0,
  title,
  lines,
  onClose,
}: {
  // 要显示的图片
  files: TicketFile[]
  // 从第几张开始
  start?: number
  // 标题
  title: string
  // 底部的大字信息（例如订单号、座位）
  lines: { label: string; value: string }[]
  // 关闭
  onClose: () => void
}) {
  // 当前第几张
  const [index, setIndex] = useState(Math.min(start, Math.max(0, files.length - 1)))
  // 是否放大
  const [zoomed, setZoomed] = useState(false)
  // 打开期间屏幕常亮
  useWakeLock(true)
  // 当前图片
  const file = files[index]
  // 图片网址
  const url = useObjectUrl(file?.blob)

  // 切换到某一张（并取消放大）
  const go = (i: number) => {
    setIndex(i)
    setZoomed(false)
  }

  // 返回全屏层（固定白底黑字，不跟深色模式变）
  return (
    <div role="dialog" aria-modal="true" aria-label={`${title}（全屏）`} className="fixed inset-0 z-[100] flex flex-col bg-white text-[#1a1a1a]">
      {/* 顶部：关闭 + 标题 + 页码 */}
      <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)] pb-2">
        {/* 关闭 */}
        <button aria-label="关闭全屏" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/5">
          <Icon name="close" size={20} />
        </button>
        {/* 标题 */}
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</div>
        {/* 页码 */}
        {files.length > 1 && (
          <span className="shrink-0 rounded-full bg-black/5 px-3 py-1 text-[13px]">
            {index + 1} / {files.length}
          </span>
        )}
      </div>

      {/* 中间：图片（放大后可以拖动查看） */}
      <div className={`min-h-0 flex-1 ${zoomed ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}>
        {url ? (
          <img
            // 图片
            src={url}
            // 读屏文字
            alt={`${title} 第 ${index + 1} 张`}
            // 点一下放大 / 缩小
            onClick={() => setZoomed((z) => !z)}
            // 放大时宽度 220%，否则完整显示
            className={zoomed ? 'max-w-none' : 'max-h-full max-w-full object-contain'}
            style={zoomed ? { width: '220%' } : undefined}
          />
        ) : (
          // 没有图片
          <p className="text-[14px] text-black/50">这张车票还没有图片</p>
        )}
      </div>

      {/* 底部：提示 + 信息 + 翻页 */}
      <div className="shrink-0 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {/* 亮度提示 */}
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-black/55">
          <Icon name="sun" size={14} />
          请把屏幕亮度调到最高 · 点图片可以放大
        </p>
        {/* 大字信息 */}
        {lines.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-1">
            {lines.map((l) => (
              <div key={l.label} className="text-center">
                <div className="text-[11px] text-black/50">{l.label}</div>
                <div className="text-[18px] font-semibold tracking-wide">{l.value}</div>
              </div>
            ))}
          </div>
        )}
        {/* 翻页 */}
        {files.length > 1 && (
          <div className="mt-2 flex gap-2">
            <button disabled={index === 0} onClick={() => go(index - 1)} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-black/5 text-[14px] disabled:opacity-30">
              <Icon name="back" size={16} />
              上一张
            </button>
            <button disabled={index === files.length - 1} onClick={() => go(index + 1)} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-black/5 text-[14px] disabled:opacity-30">
              下一张
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
