# Noël 旅行

一个只给自己用的旅行规划 App（PWA），可以装到手机主屏幕上，第一次用于 2026 年圣诞的柏林、哥本哈根之行。

- **网址**：https://frenkiewoo-dot.github.io/Travel/
- **数据**：全部存在手机本地（IndexedDB），不上传任何服务器；仓库里没有任何个人数据
- **离线**：App 本身和看过的地图区域都会缓存，断网也能打开

---

## 目前完成的功能（第 1 步）

| 页面 | 功能 |
| --- | --- |
| 首页（行程） | 荷兰、德国、丹麦三国真实地图；整条路线（火车/大巴实线，飞机点线）；GPS 蓝点；点城市飞进 3D 街区；景点建筑染成淡金色 |
| 今日旅程 | 当天所有站点编号显示在地图上，沿真实街道画出步行路线；每两站间的步行时间；顺路排序；上移/下移/删除；一键用 Google Maps 导航 |
| 未来旅程 | 小地图显示剩下的路线；按天列出之后每天的城市、交通、安排 |
| 更多 | 深色/浅色/跟随系统；存储状态；建设进度 |

出发日期还没定时，所有日期都显示为「旅途第 N 天」。

---

## 技术栈

| 用途 | 选择 | 理由 |
| --- | --- | --- |
| 打包 | Vite | 快、配置简单 |
| 界面 | React + TypeScript | 组件化，类型检查能提前发现错误 |
| 样式 | Tailwind CSS v4 | 颜色和间距统一管理（颜色变量在 `src/styles/index.css`） |
| 地图 | MapLibre GL JS 6 | 开源免费，支持旋转、倾斜、3D 建筑 |
| 地图数据 | OpenFreeMap（OpenStreetMap） | 免费、不需要 key |
| 步行路线 | OSRM（routing.openstreetmap.de） | 免费、不需要 key |
| 本地数据库 | Dexie（IndexedDB） | 支持数据结构版本升级和迁移 |
| 离线 | vite-plugin-pwa（Workbox） | 自动生成 service worker |

---

## 目录结构

```
src/
  main.tsx              程序入口：写入初始数据，渲染 App
  App.tsx               页面路由 + 底部导航（加新页面在这里加一行）
  styles/index.css      颜色变量（浅色/深色）、地图标记样式
  db/
    schema.ts           数据结构定义 + SCHEMA_VERSION（版本号）
    db.ts               数据库表结构、版本迁移
    seed.ts             初始行程数据（只有公开信息）
    hooks.ts            读取数据的 React 钩子
  lib/
    itinerary.ts        行程计算：每天在哪、旅途第几天
    geo.ts              距离、顺路排序、弧线、路线解码
    routing.ts          步行路线（联网 + 本地缓存 + 离线估算）
    theme.ts            深色/浅色模式
    useGeolocation.ts   GPS 定位
  map/
    mapStyle.ts         地图配色（奶油风）和 3D 建筑
    useMap.ts           创建地图的钩子
    layers.ts           图层工具、景点建筑高亮
    markers.ts          城市/景点/编号/我的位置 标记
    tripRoute.ts        城市之间的路线
  components/           图标、底部导航、地图按钮
  pages/                各个页面
```

---

## 以后怎么加功能

1. **加新页面**：在 `src/pages/` 新建一个组件，然后在 `src/App.tsx` 的 `<Routes>` 里加一行 `<Route path="/xxx" element={<XxxPage />} />`。如果要放进底部导航，改 `src/components/BottomNav.tsx` 里的 `TABS`。
2. **改数据结构**（例如给地点加一个字段、加一张新表）：
   - 在 `src/db/schema.ts` 改类型定义，并把 `SCHEMA_VERSION` 加 1
   - 在 `src/db/db.ts` 加一个新版本：
     ```ts
     db.version(2).stores({ /* 新的表结构，没变的表也要写上 */ }).upgrade(async (tx) => {
       // 把旧数据改成新格式
     })
     ```
   - 旧数据会在用户下次打开 App 时自动升级，不会丢
3. **改颜色**：只改 `src/styles/index.css` 顶部的颜色变量；地图配色在 `src/map/mapStyle.ts` 的 `LIGHT` / `DARK`。

---

## 本地开发

需要先安装 [Node.js](https://nodejs.org/) 22 或更新版本。

```bash
npm install        # 第一次：安装依赖
npm run dev        # 启动开发服务器，浏览器打开显示的地址
npm run build      # 打包（会先做类型检查）
npm run preview    # 预览打包结果
```

调试：网址加上 `?debug`（例如 `http://localhost:5173/?debug#/`），浏览器控制台里可以用 `window.__map` 访问当前地图。

---

## 部署

推送代码到 GitHub 后会自动部署，不需要手动操作：

1. `.github/workflows/deploy.yml` 会自动安装依赖、打包
2. 打包结果发布到 `gh-pages` 分支
3. GitHub Pages 从 `gh-pages` 分支提供网页

**第一次需要在 GitHub 上设置一次**：仓库 → Settings → Pages → Build and deployment → Source 选 **Deploy from a branch** → Branch 选 **gh-pages**、文件夹选 **/ (root)** → Save。

想手动重新部署：仓库 → Actions → 「部署到 GitHub Pages」→ Run workflow。

---

## 版权

地图数据 © [OpenStreetMap](https://www.openstreetmap.org/copyright) 贡献者；地图服务 [OpenFreeMap](https://openfreemap.org/)；步行路线 [OSRM](https://project-osrm.org/) / [FOSSGIS](https://routing.openstreetmap.de/)。
