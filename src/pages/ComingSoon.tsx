// ============================================================
// “建设中”页面：还没做到的功能先放一个说明页
// ============================================================

// 引入图标
import { Icon } from '../components/Icon'

// 页面组件：标题、属于第几步、这一步会做什么
export default function ComingSoon({ title, step, items }: { title: string; step: number; items: string[] }) {
  // 返回页面
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),24px)] pb-8">
      {/* 斜体小标题 */}
      <div className="font-serif text-[16px] italic text-muted">En construction</div>
      {/* 页面标题 */}
      <h1 className="mt-1 text-[28px] font-semibold">{title}</h1>
      {/* 说明卡片 */}
      <div className="mt-5 rounded-2xl border border-line bg-card p-5">
        {/* 第几步 */}
        <div className="flex items-center gap-2 text-[13px] text-accent">
          <Icon name="snow" size={16} />第 {step} 步建设
        </div>
        {/* 这一步会做的功能 */}
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((t) => (
            <li key={t} className="flex gap-2 text-[14px] leading-relaxed">
              {/* 小圆点 */}
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
