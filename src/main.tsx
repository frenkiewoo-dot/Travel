// ============================================================
// 程序入口：准备好数据后，把 App 显示到页面上
// ============================================================

// 引入 React 的严格模式（开发时帮忙发现问题）
import { StrictMode } from 'react'
// 引入 React 的渲染函数
import { createRoot } from 'react-dom/client'
// 引入衬线字体（打包进 App，离线也能用）：常规、半粗、斜体
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
// 引入全局样式
import './styles/index.css'
// 引入主题（会立即根据设置切换深浅色）
import './lib/theme'
// 引入数据库初始化
import { ensureSeeded, requestPersistentStorage } from './db/db'
// 引入推荐内容合并
import { applyContent, contentIsCurrent } from './db/content'
// 引入 App
import App from './App'
// 引入 iPhone 全屏模式的高度修正
import { setupAppHeight } from './lib/appHeight'

// 先修正 iPhone 全屏模式的高度（在显示任何内容之前）
setupAppHeight()

// 启动函数
async function start() {
  // 第一次打开时写入初始行程
  await ensureSeeded()
  // 推荐内容有新版本（例如第一次打开、App 更新了推荐内容）：先合并完再显示，避免显示一半旧内容
  const current = await contentIsCurrent().catch(() => false)
  if (!current) await applyContent().catch((e) => console.error('推荐内容合并失败', e))
  // 把 App 渲染到 #root 里（越早显示，iPhone 越早换掉打开时那张模糊的截图）
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // 已经是最新版本：在后台检查一下推荐地点（新建的旅行、新加的城市），不耽误显示
  if (current) applyContent().catch((e) => console.error('推荐内容合并失败', e))
  // 申请持久存储（不等结果）
  requestPersistentStorage().catch(() => {})
}

// 新版本：App 刚打开的 20 秒内下载好了新版本，就马上重新载入一次，换成新版本；
// 之后才下载好的，等下次打开再换（避免正在用的时候突然刷新，例如检票时）
// （第一次安装时没有旧版本，不需要重新载入）
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  // 打开的时间
  const openedAt = Date.now()
  // 新版本接管时
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (Date.now() - openedAt < 20000) window.location.reload()
  })
}

// 执行启动
start()
