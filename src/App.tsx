// ============================================================
// App 外壳：页面路由 + 底部导航
// 用 HashRouter（网址里带 #），这样在 GitHub Pages 上刷新任何页面都不会 404
// 以后加新页面：在下面的 <Routes> 里加一行 <Route path="/xxx" element={<XxxPage />} />
// ============================================================

// 引入路由组件
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
// 引入底部导航
import { BottomNav } from './components/BottomNav'
// 引入各个页面
import HomePage from './pages/HomePage'
import DayPage from './pages/DayPage'
import UpcomingPage from './pages/UpcomingPage'
import MorePage from './pages/MorePage'
import BudgetPage from './pages/BudgetPage'
import LinksPage from './pages/LinksPage'
import BackupPage from './pages/BackupPage'
import MapPage from './pages/MapPage'
import NavPage from './pages/NavPage'
import CityPage from './pages/CityPage'
import PlanPage from './pages/PlanPage'
import CitiesPage from './pages/CitiesPage'
import SegmentPage from './pages/SegmentPage'
import TicketsPage from './pages/TicketsPage'
import TicketPage from './pages/TicketPage'
import GuidePage from './pages/GuidePage'
import TripsPage from './pages/TripsPage'
import CarnetPage from './pages/CarnetPage'
import TrashPage, { TrashDetailPage } from './pages/TrashPage'
import { NoTripPage } from './pages/NoTripPage'
// 引入“有没有旅行”
import { useHasTrips } from './db/hooks'

// App 组件
export default function App() {
  // 返回整体结构（路由包在最外层，里面的组件才能读当前网址）
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

// 外壳：页面 + 底部导航
function Shell() {
  // 当前网址
  const location = useLocation()
  // 导航页全屏显示，不要底部导航栏
  const hideNav = location.pathname.startsWith('/nav')
  // 有没有旅行（全都删除了的话，大部分页面没有内容可显示）
  const hasTrips = useHasTrips()
  // 没有旅行时也能打开的页面
  const noTripOk = ['/trips', '/trash', '/more', '/backup', '/guide', '/links'].some((p) => location.pathname.startsWith(p))
  // 返回结构
  return (
    <>
      {/* 上下结构：上面是页面，下面是导航栏；高度固定为屏幕高度 */}
      <div className="flex h-full flex-col">
        {/* 页面区域：占满剩余空间 */}
        <main className="relative min-h-0 flex-1">
          {/* 一个旅行都没有：显示提示（新建 / 已删除的旅行 / 从备份恢复） */}
          {hasTrips === false && !noTripOk ? (
            <NoTripPage />
          ) : (
          <Routes>
            {/* 首页：大地图 */}
            <Route path="/" element={<HomePage />} />
            {/* 今日旅程 */}
            <Route path="/today" element={<DayPage today />} />
            {/* 某一天 */}
            <Route path="/day/:n" element={<DayPage />} />
            {/* 城市详情 */}
            <Route path="/city/:id" element={<CityPage />} />
            {/* 城际交通详情 */}
            <Route path="/segment/:id" element={<SegmentPage />} />
            {/* 本次旅行 */}
            <Route path="/trip" element={<PlanPage />} />
            {/* 城市 */}
            <Route path="/cities" element={<CitiesPage />} />
            {/* 未来旅程 */}
            <Route path="/upcoming" element={<UpcomingPage />} />
            {/* 地图：搜索、图钉、路线 */}
            <Route path="/map" element={<MapPage />} />
            {/* App 内导航 */}
            <Route path="/nav" element={<NavPage />} />
            {/* 预算 */}
            <Route path="/budget" element={<BudgetPage />} />
            {/* 常用链接 */}
            <Route path="/links" element={<LinksPage />} />
            {/* 备份与恢复 */}
            <Route path="/backup" element={<BackupPage />} />
            {/* 票夹 */}
            <Route path="/tickets" element={<TicketsPage />} />
            {/* 一张车票 */}
            <Route path="/ticket/:id" element={<TicketPage />} />
            {/* 更多 */}
            <Route path="/more" element={<MorePage />} />
            {/* 使用说明 */}
            <Route path="/guide" element={<GuidePage />} />
            {/* 我的旅行（多次旅行） */}
            <Route path="/trips" element={<TripsPage />} />
            {/* 旅行手册 */}
            <Route path="/carnet" element={<CarnetPage />} />
            {/* 已删除的旅行 */}
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/trash/:id" element={<TrashDetailPage />} />
            {/* 其他未知网址：回首页 */}
            <Route path="*" element={<HomePage />} />
          </Routes>
          )}
        </main>
        {/* 底部导航（导航页不显示） */}
        {!hideNav && <BottomNav />}
      </div>
    </>
  )
}
