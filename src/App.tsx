// ============================================================
// App 外壳：页面路由 + 底部导航
// 用 HashRouter（网址里带 #），这样在 GitHub Pages 上刷新任何页面都不会 404
// 以后加新页面：在下面的 <Routes> 里加一行 <Route path="/xxx" element={<XxxPage />} />
// ============================================================

// 引入路由组件
import { HashRouter, Route, Routes } from 'react-router-dom'
// 引入底部导航
import { BottomNav } from './components/BottomNav'
// 引入各个页面
import HomePage from './pages/HomePage'
import DayPage from './pages/DayPage'
import UpcomingPage from './pages/UpcomingPage'
import MorePage from './pages/MorePage'
import ComingSoon from './pages/ComingSoon'

// App 组件
export default function App() {
  // 返回整体结构
  return (
    <HashRouter>
      {/* 上下结构：上面是页面，下面是导航栏；高度固定为屏幕高度 */}
      <div className="flex h-full flex-col">
        {/* 页面区域：占满剩余空间 */}
        <main className="relative min-h-0 flex-1">
          <Routes>
            {/* 首页：大地图 */}
            <Route path="/" element={<HomePage />} />
            {/* 今日旅程 */}
            <Route path="/today" element={<DayPage today />} />
            {/* 某一天 */}
            <Route path="/day/:n" element={<DayPage />} />
            {/* 未来旅程 */}
            <Route path="/upcoming" element={<UpcomingPage />} />
            {/* 地图（第 2 步） */}
            <Route
              path="/map"
              element={<ComingSoon title="地图" step={2} items={['搜索店铺、景点、地址', '拖动图钉标记多个地点，自动连成路线', '一键优化顺序', 'App 内逐路口导航：当前街道、下一个路口怎么拐', '一键交给 Google Maps 语音导航']} />}
            />
            {/* 预算（第 6 步） */}
            <Route
              path="/budget"
              element={<ComingSoon title="预算" step={6} items={['分类记账：交通 / 住宿 / 餐饮 / 门票 / 购物 / 其他', '计划 vs 实际', '欧元和丹麦克朗，汇率可手动设置', '总额不固定，随时可以改']} />}
            />
            {/* 票夹（第 5 步） */}
            <Route
              path="/tickets"
              element={<ComingSoon title="票夹" step={5} items={['上传车票图片 / PDF / 截图', '填写订单号、座位、时间，关联到行程段', '断网也能看', '全屏显示二维码，方便检票']} />}
            />
            {/* 更多 */}
            <Route path="/more" element={<MorePage />} />
            {/* 其他未知网址：回首页 */}
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        {/* 底部导航 */}
        <BottomNav />
      </div>
    </HashRouter>
  )
}
