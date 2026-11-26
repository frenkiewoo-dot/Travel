# Noël 旅行

一个只给自己用的旅行规划 App（PWA），可以装到手机主屏幕上，第一次用于 2026 年圣诞的哥本哈根、斯德哥尔摩之行（柏林先存在「以后想去」）。

- **网址**：https://frenkiewoo-dot.github.io/Travel/
- **数据**：全部存在手机本地（IndexedDB），不上传任何服务器；仓库里没有任何个人数据
- **离线**：App 本身和看过的地图区域都会缓存，断网也能打开
- **使用说明**：App 里「更多 → 使用说明」，每个功能都有步骤和例子

---

## 功能（第 1–8 步，全部完成）

| 页面 | 功能 |
| --- | --- |
| 首页（行程） | 真实地图（荷兰、德国、丹麦、瑞典、挪威…）；「本次旅行」入口；整条路线（火车/大巴实线，飞机点线）；GPS 蓝点；点城市飞进 3D 街区；景点建筑染成淡金色 |
| 今日旅程 / 每日日程 | 当天所有站点编号显示在地图上，沿真实街道画出步行路线；每两站间的步行时间，步行超过 15 分钟时还显示公交时间和线路；每站可以填时间；从景点列表添加；顺路排序；上移/下移/删除；在地图上编辑；App 内导航 / Google Maps；平安夜和圣诞节提醒 |
| 城际交通 | 每段交通列出可选方式（火车 / 大巴 / 飞机）：运营商、路线、大致时长、价格区间、班次、预订链接、节日提醒、信息来源；选定一种、标记已订；可以自己添加方式 |
| 未来旅程 | 小地图显示剩下的路线；按天列出之后每天的城市、交通、安排 |
| 地图 | 搜索店铺/景点/地址；放图钉（拖右边的图钉、长按地图、点搜索结果或地图上的店铺）；图钉可拖动、改名、排序、删除；自动连成步行路线；顺路排序；存到某一天的日程 |
| 导航 | App 内逐路口步行导航：下一个转向（第几个路口、往哪拐、进入哪条街）、当前街道、剩余距离；地图跟随并朝向前进方向；偏离路线自动重新规划；到达提示；中文语音播报；屏幕常亮；「模拟行走」预览 |
| 本次旅行 | 按时间顺序安排目的地：日期、住几晚；每个目的地的住宿（含预订截图）；目的地之间的交通（航班号 / 车次、起飞到达时间、机票截图）；把城市移出本次旅行（资料保留在「以后想去」）或加回来；基本信息（名称、出发日期、人数） |
| 城市 | 底部导航新标签：本次旅行的城市（按国家分组，带日期和住宿状态）+ 以后想去的城市；点进去就是城市详情 |
| 城市详情 | 标签：酒店 / 景点 / 日程 / 交通 / 地图。交通标签：圣诞期间提醒、车站机场怎么进城（选定住处后一键查到住处的公交路线）、票种价格、推荐 App、小贴士、我的笔记。酒店景点可自己添加（搜索地址或在小地图上点选）、编辑、删除；状态：候选 / 已选定 / 已预订；选定住宿后一键隐藏或删除其余候选；推荐项目带「推荐 · 需核实」标签；景点可加入某一天的日程；城市地图上酒店和景点用不同图标，已选定的高亮 |
| 票夹 | 上传车票图片 / PDF / 截图（PDF 自动转成图片并裁掉白边）；填运营商、出发时间、车次、座位、订单号、备注；关联到某段城际交通（可同时标记已订）；按行程顺序分组显示；断网也能看；全屏白底显示二维码（可放大、翻页、屏幕常亮），底部大字显示订单号和座位 |
| 预算 | 已花（换算成欧元）vs 总预算，还剩多少；六个分类（交通 / 住宿 / 餐饮 / 门票 / 购物 / 其他）计划 vs 实际，超支提醒；「记一笔」：金额、币种（欧元 / 丹麦克朗 / 瑞典克朗 / 挪威克朗，旅途中默认当地货币）、分类、备注、日期；汇率可手动改；总预算和计划都可以不填、随时改 |
| 常用链接 | 交通、市内交通、地图、订房、城市旅游等常用网站；可以添加自己的链接 |
| 备份与恢复 | 导出一个 JSON 文件（含车票图片和 PDF），iPhone 上可以存到「文件」或发给自己；从备份恢复；票夹和「更多」里会提醒多久没备份了 |
| 推荐青旅和景点 | 哥本哈根、斯德哥尔摩各 4 家便宜青旅和 10 个以上景点 / 圣诞市场，柏林（以后去）3 家青旅和 8 个地点；每个都有地址、坐标、门票、开放时间、建议时长、官网和信息来源；重点核实了 12/24–26 的开放情况（红色节日提醒）；不确定的都标了「约」或「需核实」 |
| 使用说明 | 16 节：每个功能在哪里、能做什么、怎么用（分步骤）、一个具体例子、「去试试」直达按钮；目录、全部展开；每节可以标记「我测过了」，显示测试进度 |
| 更多 | 使用说明、本次旅行、常用链接、备份与恢复入口；深色/浅色/跟随系统；存储状态；建设进度 |
| 电脑上测试 | 屏幕宽度 ≥ 640px 时，App 显示成屏幕中间 430px 宽的手机窗口；弹出面板、全屏车票都只铺满这个窗口 |

出发日期还没定时，所有日期都显示为「旅途第 N 天」。

---

## 在电脑上测试

1. 电脑浏览器（推荐 Chrome 或 Edge）打开 https://frenkiewoo-dot.github.io/Travel/
2. App 会显示成屏幕中间一个手机宽度的窗口
3. 先打开「更多 → 使用说明」，按目录一节一节试，测完点「我测过了」
4. 鼠标代替手指：
   - 点 = 单击；拖动 = 按住左键拖
   - 长按地图（放图钉）= 右键单击
   - 旋转 / 倾斜地图 = 按住右键拖，或按住 Ctrl 再拖；缩放 = 滚轮
5. 更像手机：Chrome 按 F12 → 左上角手机图标（设备模拟）→ 选 iPhone
6. 想回到初始状态：浏览器设置里删除这个网站的数据，再刷新

电脑上的数据只在这台电脑的浏览器里，和手机是分开的。想把电脑上整理好的数据带到手机：电脑「导出备份」→ 发到手机 → 手机「从备份恢复」。

## 以后装到手机上（测试完再装）

- **iPhone**：Safari 打开网址 → 底部分享按钮 →「添加到主屏幕」→ 以后从主屏幕图标打开（全屏，像普通 App；数据也更不容易被系统清理）
- **Android**：Chrome 打开网址 → 右上角菜单 →「安装应用」或「添加到主屏幕」

---

## 推荐内容从哪来

- 交通方式、城市指南、推荐青旅和景点都在 `src/data/content.ts`，全部是公开信息，每条都带信息来源链接
- 调研时间：2026 年 11 月。价格是参考价（淡季、多人间），圣诞期间可能更贵；开放时间部分来自往年，出发前请点每个地点的「官网」再确认
- 主要来源：Visit Copenhagen、Visit Stockholm、berlin.de 的圣诞市场页面；各博物馆官网（国家博物馆、瓦萨沉船博物馆、北欧民俗博物馆、历史博物馆、现代美术馆、市政厅）；哥本哈根博物馆 2026 手册；Royal Djurgården 圣诞开放时间；copenhagentourism.org、hostelz.com、berlintourism.org 的青旅价格

---

## 技术栈

| 用途 | 选择 | 理由 |
| --- | --- | --- |
| 打包 | Vite | 快、配置简单 |
| 界面 | React + TypeScript | 组件化，类型检查能提前发现错误 |
| 样式 | Tailwind CSS v4 | 颜色和间距统一管理（颜色变量在 `src/styles/index.css`） |
| 地图 | MapLibre GL JS 6 | 开源免费，支持旋转、倾斜、3D 建筑 |
| 地图数据 | OpenFreeMap（OpenStreetMap） | 免费、不需要 key |
| 步行路线 / 导航 | OSRM（routing.openstreetmap.de） | 免费、不需要 key，带逐步转向信息 |
| 地点搜索 | Photon（photon.komoot.io） | 免费、不需要 key，基于 OpenStreetMap |
| 公交时间 | Transitous（api.transitous.org，基于 MOTIS） | 免费、不需要 key、社区运营；只在步行较远时查询，结果缓存在手机里 |
| 语音播报 | 浏览器自带的 SpeechSynthesis | 用手机自带的中文语音，不需要联网 |
| PDF 转图片 | pdf.js（Mozilla） | 上传 PDF 车票时才加载，第一次用到后缓存 |
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
    pins.ts             图钉（地图标签的草稿，或某一天的日程）
    tickets.ts          票夹：保存车票和文件、删除、读取
    trip.ts             修改行程：城市增删排序（自动整理交通和日程）、酒店景点增删改、交通方式
    content.ts          把推荐内容包合并进手机数据（不覆盖你改过的、不加回你删掉的）
  data/
    content.ts          推荐内容包：行程结构、城际交通方式、市内交通指南、推荐青旅和景点（公开信息，带来源链接）
  lib/countries.ts      国家代码 → 国名
  lib/
    itinerary.ts        行程计算：每天在哪、旅途第几天
    geo.ts              距离、顺路排序、弧线、路线解码
    routing.ts          步行路线（联网 + 本地缓存 + 离线估算）
    navigation.ts       导航：逐步指引、中文转向描述、实时进度、偏离判断
    search.ts           地点搜索、根据坐标查地名
    gmaps.ts            生成 Google Maps 多站导航链接
    transit.ts          公交时间（Transitous）
    speech.ts           语音播报
    useWakeLock.ts      导航时屏幕常亮
    files.ts            处理上传的车票文件（大图缩小、PDF 转图片）
    money.ts            货币、汇率、花费分类
    backup.ts           导出 / 导入备份
    pdf.ts              PDF 每页转成 PNG 并裁掉白边
    theme.ts            深色/浅色模式
    useGeolocation.ts   GPS 定位
  map/
    mapStyle.ts         地图配色（奶油风）和 3D 建筑
    useMap.ts           创建地图的钩子
    layers.ts           图层工具、景点建筑高亮
    markers.ts          城市/景点/编号/我的位置 标记
    tripRoute.ts        城市之间的路线
    walkRoute.ts        步行路线的画法（实线/虚线）
  components/
    Sheet.tsx           底部弹出面板、表单字段、分段选择
    LocationPicker.tsx  选位置：搜索地址 / 在小地图上点选
    PlaceForm.tsx       酒店景点表单
    PlaceCard.tsx       酒店景点卡片
    StopForm.tsx        城市表单、加减数字控件
    TicketForm.tsx      车票表单
    TicketCard.tsx      票根样式的车票卡片
    TicketViewer.tsx    全屏显示车票
    Icon.tsx 等         图标、底部导航、地图按钮
  pages/                各个页面（GuidePage.tsx 是使用说明，加了新功能记得在里面加一节）
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
   - 实际例子：第 5 步加票夹时，`db.version(2)` 新增了 `tickets` 和 `ticketFiles` 两张表；第 6 步加预算时，`db.version(3)` 新增了 `expenses` 表（只加表、不改旧数据，所以不需要 `upgrade`）
   - 新加了表的话，也要加进 `src/lib/backup.ts` 的 `TABLES`，备份才会包含它
3. **更新推荐内容**（交通方式、城市指南、推荐地点等公开信息）：改 `src/data/content.ts`，把 `CONTENT_VERSION` 加 1。手机下次打开 App 会自动合并：
   - 交通方式、城市指南更新成新版，你自己添加的方式和已选的方式都保留
   - 推荐地点（`RECOMMENDED_PLACES`）：新的 ID 会加进去；已有的只补空白字段，你改过的不覆盖；你删掉的不会再加回来；已经选定住宿的城市，新推荐的青旅默认隐藏
4. **更新使用说明**：改 `src/pages/GuidePage.tsx` 里的 `SECTIONS`，每一节写「在哪里 / 能做什么 / 怎么用 / 例子」。
5. **改颜色**：只改 `src/styles/index.css` 顶部的颜色变量；地图配色在 `src/map/mapStyle.ts` 的 `LIGHT` / `DARK`。

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

地图数据 © [OpenStreetMap](https://www.openstreetmap.org/copyright) 贡献者；地图服务 [OpenFreeMap](https://openfreemap.org/)；步行路线 [OSRM](https://project-osrm.org/) / [FOSSGIS](https://routing.openstreetmap.de/)；地点搜索 [Photon](https://photon.komoot.io/)。
