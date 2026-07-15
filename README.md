# Excel 工具箱

浏览器里的 Excel 快捷操作，纯前端实现，文件不上传服务器。

## 功能

- **首页**：卡片式列出所有工具的入口，后续新增功能只需在 `src/features.js` 追加一项。
- **合并 xlsx**：选中多个 xlsx，为每个 sheet 指定新的名字（默认使用原名，可一键改成文件名），一键合并并下载。
- **合并到一个 sheet**：把多个 xlsx 或同一文件的多个 sheet 全部拼到同一张 sheet 里，中间用可配置的空行分隔，每个 sheet 保留自己的标题。支持勾选、上下调整顺序、可选跳过后续 sheet 的标题、可选添加"来源"列（左/右，格式可选）。
- **CSV 转 xlsx**：拖入多个 CSV/TSV，自动探测编码（UTF-8 / GB18030 / Big5 / Shift-JIS 等）和分隔符，可切换。支持两种输出模式：合并到一个 xlsx（每个 CSV 一个 sheet），或每个 CSV 单独一个 xlsx（多文件自动打包 zip）。
- **xlsx 转 CSV**：拖入一个或多个 xlsx，勾选要导出的 sheet，设置分隔符和输出编码（UTF-8 / UTF-8 with BOM），单个 sheet 直接下载 CSV，多个 sheet 自动打包 zip。

## 路由

URL 使用简单的 hash 路由，方便直接分享链接：

- `#/`              — 首页
- `#/merge`         — 合并 xlsx
- `#/merge-sheets`  — 合并到一个 sheet
- `#/csv-to-xlsx`   — CSV 转 xlsx
- `#/xlsx-to-csv`   — xlsx 转 CSV

## 本地开发

```bash
npm install
npm run dev       # 启动开发服务器 http://127.0.0.1:5173
npm run build     # 打包到 dist/
npm run preview   # 预览打包结果
```

## Docker 部署

多阶段构建：Node 20 编译 → nginx 1.27 (alpine) 提供静态文件。

```bash
# 构建镜像
docker build -t excelweb .

# 运行（把容器 80 端口映射到本地 8080）
docker run --rm -p 8080:80 --name excelweb excelweb
```

访问 http://127.0.0.1:8080/ 即可。

镜像内约定：

- 前端产物拷贝到 `/usr/share/nginx/html`。
- nginx 配置见 `docker/nginx.conf`，开启了 gzip，对 `/assets/*` 使用一年长缓存，`index.html` 不缓存，其他路径统一回落到 `index.html`。

## 目录结构

```
excelweb/
├── Dockerfile
├── docker/
│   └── nginx.conf
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── App.vue                 # 顶部 header + hash 路由
    ├── main.js
    ├── features.js             # 工具注册表（新增功能只改这里 + 增加组件）
    ├── styles.css              # 全局基础样式
    ├── components/
    │   ├── Home.vue            # 首页卡片
    │   ├── MergeXlsx.vue       # 合并 xlsx 页面
    │   ├── MergeSheets.vue     # 合并到一个 sheet 页面
    │   ├── CsvToXlsx.vue       # CSV 转 xlsx 页面
    │   └── XlsxToCsv.vue       # xlsx 转 CSV 页面
    └── utils/
        ├── sheetName.js        # sheet 名字校验 / 去重工具
        └── csv.js              # CSV 编码 / 分隔符 / 下载工具
```

## 新增功能的做法

1. 在 `src/components/` 新建一个组件，例如 `SplitXlsx.vue`。
2. 在 `src/features.js` 的 `features` 数组里追加一项：

   ```js
   import SplitXlsx from './components/SplitXlsx.vue'

   {
     key: 'split',
     title: '拆分 xlsx',
     description: '把一个 xlsx 按 sheet 拆分成多个文件',
     icon: '✂️',
     tags: ['拆分'],
     component: SplitXlsx,
   }
   ```

3. 就能通过 `#/split` 访问，首页也会自动出现一张新卡片。

## 技术栈

- Vue 3 + Vite
- [SheetJS (`xlsx`)](https://sheetjs.com/) 负责读写 xlsx / CSV
- [JSZip](https://stuk.github.io/jszip/) 用于多文件打包下载（动态 import，只在多文件导出时才加载）
- nginx (Docker 部署)

SheetJS 社区版对复杂样式（条件格式、图表、图片等）支持有限，主要保留单元格数据、公式和基础格式。
