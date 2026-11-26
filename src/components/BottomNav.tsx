// ============================================================
// 底部导航栏：行程 / 城市 / 地图 / 预算 / 票夹 / 更多
// ============================================================

// 引入路由的导航链接组件（会自动知道当前是哪一页）
import { NavLink } from 'react-router-dom'
// 引入图标
import { Icon, type IconName } from './Icon'

// 六个标签的配置
const TABS: { to: string; label: string; icon: IconName }[] = [
  // 行程（首页大地图）
  { to: '/', label: '行程', icon: 'trip' },
  // 城市（本次旅行的城市 + 以后想去的城市，按国家分组）
  { to: '/cities', label: '城市', icon: 'city' },
  // 地图（搜索、图钉、导航）
  { to: '/map', label: '地图', icon: 'map' },
  // 预算
  { to: '/budget', label: '预算', icon: 'wallet' },
  // 票夹
  { to: '/tickets', label: '票夹', icon: 'ticket' },
  // 更多
  { to: '/more', label: '更多', icon: 'more' },
]

// 底部导航组件
export function BottomNav() {
  // 返回导航栏
  return (
    <nav
      // 读屏软件读出的名字
      aria-label="主导航"
      // 样式：卡片底色、顶部细线、六等分网格；底部留出 iPhone 的横条安全区
      className="grid shrink-0 grid-cols-6 border-t border-line bg-card pb-[max(env(safe-area-inset-bottom),8px)] pt-2"
    >
      {/* 逐个渲染标签 */}
      {TABS.map((t) => (
        <NavLink
          // React 列表需要唯一 key
          key={t.to}
          // 链接地址
          to={t.to}
          // 首页只在完全匹配时才高亮
          end={t.to === '/'}
          // 当前页用深色，其他用灰褐色；整块至少 44 像素高，方便单手点
          className={({ isActive }) =>
            `flex min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] ${isActive ? 'text-ink' : 'text-muted'}`
          }
        >
          {/* 图标 */}
          <Icon name={t.icon} size={22} stroke={1.5} />
          {/* 文字 */}
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
