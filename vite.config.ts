// 引入 Vite 的配置函数（让编辑器能给出配置项的提示）
import { defineConfig } from 'vite'
// React 插件：让 Vite 能编译 JSX，并支持开发时的热更新
import react from '@vitejs/plugin-react'
// Tailwind CSS v4 的 Vite 插件：自动扫描代码里用到的样式类
import tailwindcss from '@tailwindcss/vite'
// PWA 插件：自动生成 manifest（安装信息）和 service worker（离线缓存）
import { VitePWA } from 'vite-plugin-pwa'

// 导出 Vite 配置
export default defineConfig({
  // 用相对路径打包：这样部署在 GitHub Pages 的子路径 /Travel/ 下也能正常加载
  base: './',
  // 开发服务器配置
  server: {
    // 允许同一局域网的手机访问开发服务器（调试用）
    host: true,
  },
  // 打包设置
  build: {
    // 地图引擎本身约 1MB，把“文件过大”提醒的门槛调高到 2MB
    chunkSizeWarningLimit: 2000,
  },
  // 插件列表
  plugins: [
    // 启用 React 支持
    react(),
    // 启用 Tailwind
    tailwindcss(),
    // 启用 PWA
    VitePWA({
      // 有新版本时自动更新 service worker（下次打开 App 就是新版）
      registerType: 'autoUpdate',
      // 这些 public 目录里的文件也要放进离线缓存
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // manifest：告诉手机这个网页“装到主屏幕”后长什么样
      manifest: {
        // 完整名称（安装提示里显示）
        name: 'Noël 旅行',
        // 短名称（主屏幕图标下面显示）
        short_name: 'Noël',
        // 描述
        description: '我的圣诞旅行规划',
        // 界面语言
        lang: 'zh-CN',
        // 打开 App 时进入的地址（相对路径）
        start_url: './',
        // App 的作用范围
        scope: './',
        // 独立窗口显示（没有浏览器地址栏）
        display: 'standalone',
        // 竖屏
        orientation: 'portrait',
        // 启动画面背景色（奶油白）
        background_color: '#F6F1E9',
        // 系统状态栏颜色
        theme_color: '#F6F1E9',
        // 图标列表
        icons: [
          // 192 像素图标（安卓主屏幕）
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          // 512 像素图标（安卓启动画面）
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          // 可裁切图标（安卓会把它裁成圆形或圆角方形）
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Workbox：生成 service worker 的工具，这里配置缓存规则
      workbox: {
        // App 自己的文件全部预缓存（断网也能打开）
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        // PDF 处理库很大（约 1.8MB），只有上传 PDF 车票时才用，不放进首次安装；第一次用到时再缓存（见下面的规则）
        globIgnores: ['**/pdf.worker*', '**/pdf-*.js'],
        // 单个文件最大 5MB（地图引擎比较大，默认 2MB 不够）
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 运行时缓存：App 运行中请求到的外部资源
        runtimeCaching: [
          {
            // PDF 处理库：第一次用到时下载并缓存，之后断网也能用
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/pdf[.-]/.test(url.pathname),
            // 优先用缓存
            handler: 'CacheFirst',
            // 缓存设置
            options: { cacheName: 'pdf-lib', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // 地图瓦片（.pbf 矢量数据）、字体、图标：看过的区域缓存下来，断网时还能看
            urlPattern: ({ url }) =>
              // 只处理 OpenFreeMap 的域名
              url.hostname === 'tiles.openfreemap.org' &&
              // 并且是瓦片、字体或图标文件
              /\.(pbf|png|json)$/.test(url.pathname) &&
              // 样式和瓦片目录文件除外（它们由下一条规则处理）
              !url.pathname.startsWith('/styles/') &&
              url.pathname !== '/planet',
            // 优先用缓存，没有缓存才联网
            handler: 'CacheFirst',
            // 缓存设置
            options: {
              // 缓存的名字
              cacheName: 'map-tiles',
              // 过期规则
              expiration: {
                // 最多存 6000 个文件
                maxEntries: 6000,
                // 最多存 90 天
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              // 只缓存成功的响应
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 地图样式文件和瓦片目录：优先联网拿最新的，断网时用缓存
            urlPattern: ({ url }) =>
              url.hostname === 'tiles.openfreemap.org' &&
              (url.pathname.startsWith('/styles/') || url.pathname === '/planet'),
            // 先联网，失败再用缓存
            handler: 'NetworkFirst',
            // 缓存设置
            options: {
              // 缓存名字
              cacheName: 'map-style',
              // 联网超过 4 秒就改用缓存（网很差的时候不至于一直等）
              networkTimeoutSeconds: 4,
              // 只缓存成功的响应
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
