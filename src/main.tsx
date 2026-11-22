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
import { applyContent } from './db/content'
// 引入 App
import App from './App'

// 启动函数
async function start() {
  // 第一次打开时写入初始行程
  await ensureSeeded()
  // 合并最新的推荐内容（交通方式、城市指南）；出错也不影响打开 App
  await applyContent().catch((e) => console.error('推荐内容合并失败', e))
  // 申请持久存储（不等结果）
  requestPersistentStorage().catch(() => {})
  // 把 App 渲染到 #root 里
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// 执行启动
start()
