// ============================================================
// 一个旅行都没有时显示（例如把所有旅行都删除了）：新建旅行、看已删除的旅行、从备份恢复
// ============================================================

// 引入路由
import { Link } from 'react-router-dom'
// 引入图标
import { Icon } from '../components/Icon'

// 页面组件
export function NoTripPage() {
  // 返回
  return (
    <div className="flex h-full flex-col items-center justify-center bg-paper px-8 text-center">
      <div className="font-serif text-[18px] italic text-muted">Bon voyage</div>
      <h1 className="mt-1 text-[24px] font-semibold">还没有旅行</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">新建一次旅行开始计划；刚删掉的旅行可以在「已删除的旅行」里恢复。</p>
      <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2">
        <Link to="/trips" className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[15px] text-paper">
          <Icon name="plus" size={16} />
          新建旅行
        </Link>
        <Link to="/trash" className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-line-strong text-[15px]">
          <Icon name="trash" size={16} />
          已删除的旅行
        </Link>
        <Link to="/backup" className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-line-strong text-[15px]">
          <Icon name="upload" size={16} />
          从备份恢复
        </Link>
      </div>
    </div>
  )
}
