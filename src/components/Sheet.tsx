// ============================================================
// 底部弹出面板：表单、选择列表等都用它
// 点面板外面的半透明区域可以关闭
// ============================================================

// 引入 React 类型
import type { ReactNode } from 'react'
// 引入图标
import { Icon } from './Icon'

// 面板组件
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  // 返回面板
  return (
    // 半透明遮罩，铺满屏幕；点它关闭
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/35" onClick={onClose}>
      {/* 面板本身（点里面不关闭） */}
      <div
        // 对话框语义
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // 阻止点击冒泡到遮罩
        onClick={(e) => e.stopPropagation()}
        // 样式：最高占屏幕 88%，圆角顶部
        className="flex max-h-[88%] flex-col rounded-t-[26px] bg-card shadow-[0_-8px_30px_var(--shadow)]"
      >
        {/* 标题栏 */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
          {/* 标题 */}
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {/* 关闭按钮 */}
          <button aria-label="关闭" onClick={onClose} className="-mr-2 flex h-10 w-10 items-center justify-center text-muted">
            <Icon name="close" size={18} />
          </button>
        </div>
        {/* 内容（可以滚动） */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {/* 底部按钮区（固定在底部） */}
        {footer && <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">{footer}</div>}
      </div>
    </div>
  )
}

// 表单里的一个字段：标签 + 输入控件
// group = true 时（里面是一组按钮而不是输入框），外层用 div，避免点标签误触第一个按钮
export function Field({ label, hint, children, group }: { label: string; hint?: string; children: ReactNode; group?: boolean }) {
  // 内容
  const inner = (
    <>
      {/* 标签文字 */}
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      {/* 输入控件 */}
      {children}
      {/* 提示 */}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </>
  )
  // 按钮组用 div，输入框用 label（点标签能聚焦输入框）
  return group ? <div className="mt-3">{inner}</div> : <label className="mt-3 block">{inner}</label>
}

// 统一的输入框样式
export const INPUT = 'h-11 w-full rounded-xl border border-line-strong bg-paper px-3 text-[15px] text-ink outline-none focus:border-accent'
// 统一的多行输入框样式
export const TEXTAREA = 'min-h-[76px] w-full rounded-xl border border-line-strong bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-accent'

// 分段选择（例如 候选 / 已选定 / 已预订）
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  // 返回分段控件
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-oat p-1">
      {options.map((o) => (
        <button
          // 唯一 key
          key={o.value}
          // 单选语义
          role="radio"
          aria-checked={value === o.value}
          // 选择
          onClick={() => onChange(o.value)}
          // 选中的用卡片底色
          className={`h-9 flex-1 rounded-lg text-[13px] ${value === o.value ? 'bg-card font-medium shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
