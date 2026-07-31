# SolarKids AI 开发说明书——成员2

> 负责人：成员2（douwinddy）
>
> 开发分支：`feature/ui-responsive`
>
> 本文随成员2开发分支提交到远程仓库，并在后续开发过程中持续更新。

## 一、负责范围

成员2负责以下内容：

- **UI 视觉系统**：整体配色方案、CSS 变量体系、深空主题风格。
- **响应式布局**：PC（≥1024px）、iPad（768-1023px）、手机（<768px）三档断点。
- **页面骨架**：`index.html` 结构、Canvas 容器、侧边信息面板、底部控制栏。
- **素材管理系统**：皮肤配置加载、双套素材预加载与缓存、自动降级为 SVG 占位图。
- **皮肤切换 UI**：卡通/写实两套皮肤的切换面板。
- **公共绘制函数**：行星渲染、太阳渲染、星空背景、轨道计算等底层 Canvas 绘制。
- **UI 工具库**：Toast 提示、Modal 弹窗、设备检测、控制栏事件绑定。

详细任务边界以团队分工文档为准；本文只记录需要随代码共享的开发范围与 AI 协同情况。

## 二、AI 协同方式

AI（Claude Code）在成员2的开发过程中承担了以下角色：

- **架构设计**：分析项目需求，设计 UI 框架、素材加载器、皮肤系统的模块结构。
- **代码生成**：编写 `solarSystemPreview.ts`、`assetLoader.ts`、`skinPicker.ts`、UI 工具库等核心模块的初始实现。
- **素材集成**：将成员2导入的 PNG/SVG 素材接入渲染管线，处理土星环裁剪、彗星尺寸、贴图降级等视觉问题。
- **类型系统**：创建 `src/data/types.ts` 解决循环依赖，定义 `PlanetId`、`SkinType`、`SkinsData` 等共享类型。。
- **调试与问题修复**：解决文件协议 CORS、ES 模块 .js 后缀、Saturn 环裁剪、皮肤切换不生效等问题。

成员2（学生）负责：

- 寻找和导入行星素材（SVG 卡通 + PNG 写实纹理 + 冥王星 + 哈雷彗星 + 背景图）。
- 在浏览器中手动验证视觉效果，提出调整需求（如土星比例、彗星尺寸、轨道样式、背景图切换）。
- 确认 UI/UX 设计方向（颜色、布局、交互细节）。
- 执行 Git 操作（commit、push、merge）。
- 审阅 AI 生成代码，提出修改意见。

## 三、AI 辅助生成内容详述

### 3.1 页面骨架与样式系统

AI 辅助生成了以下初始实现：

- **`index.html`**：主页面结构，包含 Canvas 容器 `#canvas-container`、侧边信息面板 `#side-panel`、底部控制栏 `#control-bar`。控制栏分为播放控制、视角控制、功能切换、设置四个组，每组包含对应按钮和图标。

- **`src/style.css`**：全局样式系统（766 行），定义：
  - **87 个 CSS 变量**：覆盖深空背景色（`--color-space-deep/mid/light`）、行星色（8 颗行星各一色）、UI 功能色（accent/success/warning/danger/info）、文字色（primary/secondary/muted）、间距系统（xs-xxl）、圆角系统（sm-full）、阴影系统（含 glow-yellow/glow-blue）、过渡动画、z-index 层级。
  - **CSS Grid 布局**：`grid-template-columns: 1fr 320px`（桌面端），移动端单列。
  - **响应式断点**：`@media (max-width: 767px)` 手机、`@media (min-width: 768px) and (max-width: 1023px)` 平板。
  - **按钮系统**：`.btn`、`.btn--icon`、`.btn--ghost`、`.btn--active`，触摸目标最小 44×44px，含 `focus-visible` 焦点样式和 `prefers-reduced-motion` 无障碍适配。

### 3.2 素材管理系统

AI 辅助设计和实现了完整的素材加载与管理流水线：

- **`src/data/skins.json`**：皮肤配置文件，定义 `cartoon`（卡通/SVG）和 `realistic`（写实/PNG）两套皮肤，每种皮肤指定类型（`type`）、10 个天体素材路径（`assets`）、行星颜色（`planetColors`）。后续合并 dev 后皮肤类型更新为 `cartoon`/`realistic`，素材路径对接成员3的 `cartoon_skin/` 和 `skins/` 目录。

- **`src/ui/assetLoader.ts`**（221 行）：
  - `loadSkinsConfig()` — 从 `src/data/skins.json` 拉取配置。
  - `preloadAllAssets(config)` — 批量预加载当前皮肤全部素材，失败自动降级为 SVG DataURL 占位图。
  - `loadPlanetAsset(planetId, skinConfig)` — 单个素材加载，带缓存去重。
  - `getCachedImage(planetId, skinType)` — 从内存缓存取已加载图片，供 Canvas 渲染调用。
  - `clearAssetCache()` — 换肤时清空缓存。
  - `generatePlaceholderSVG(id, color, size)` — 用径向渐变 SVG 生成行星占位图（球体立体感 + 土星光环 + 地球大陆 + 太阳光晕等特征）。
  - `preloadTopicAssets()` — 为成员1日食/磁场专题场景预加载太阳、地球、月球的 SVG/PNG 素材。
  - **类型导出**：`PlanetId`（sun 到 pluto 共 11 个天体）、`SkinType`（`'svg' | 'png'`）、`RenderSkinType`（`'cartoon' | 'realistic'`）、`SkinConfig`、`SkinsData`。

- **`src/data/types.ts`**：为避免 assetLoader.ts 与 skins.ts 之间的循环引用，抽取 `PlanetId`、`SkinType`、`SkinConfig`、`SkinsData` 类型到独立文件。

### 3.3 太阳系静态预览与渲染

AI 辅助生成了太阳系静态渲染模块 `src/ui/solarSystemPreview.ts`（988 行），这是整个项目 Canvas 渲染的底层基础设施：

- **天体数据**：`PLANETS` 数组包含太阳系 10 个天体（水星到冥王星）的名称、描述、半径、轨道距离、颜色等。`COMET` 定义哈雷彗星数据。
- **绘制函数**：
  - `drawSpace()` — 深空渐变背景 + 星星（卡通模式）/ `background.png` 贴图（写实模式）。
  - `drawSun()` — 太阳外发光 + 贴图/渐变本体。
  - `drawPlanet()` — 从素材缓存取贴图渲染行星，含选中/悬停高亮，土星特殊处理（不去裁剪环）。
  - `drawComet()` — SVG 彗星本体 + 手绘渐变彗尾。
  - `drawPlanetFeatures()` — SVG 降级时的手绘特征（陨石坑、云带、大陆、大红斑、冥王星心形）。
  - `drawSaturnRing()` — 双层椭圆手绘土星环（降级用）。
  - `drawOrbits()` — 白色实线椭圆轨道。
  - `drawHint()` — 底部操作提示文字。
- **轨道计算**：`getCompressedOrbit(distanceAU)` 用平方根压缩真实 AU 距离到像素，`getResponsiveOrbitScale()` 根据容器尺寸自适应缩放。
- **交互**：Pointer Events 实现天体悬停高亮 + 点击选中 + 信息面板更新。
- **皮肤支持**：`setSkinType()` + `getSkinType()` 模块级皮肤状态管理，监听 `solarkids:skinChange` 事件触发重绘。
- **素材加载**：`halleyImg` 和 `bgRealistic` 在模块加载时初始化图片对象。

> **以上绘制函数被成员3的 Canvas 场景系统深度复用。**`solarSystemScene.ts` 导入了 `PLANETS`、`drawPlanet`、`drawSun`、`drawSpace`、`drawSaturnRingBack/Front`、`drawHint`、`getCompressedOrbit`、`getResponsiveOrbitScale`、`getSkinType` 等全部核心函数。`cometScene.ts` 导入了 `drawSpace`、`drawSun`。

### 3.4 换肤面板

AI 辅助生成了 `src/ui/skinPicker.ts`（141 行）：

- `showSkinPicker(config, onSwitch, translate)` — 弹出 Modal 展示 2 列皮肤卡片网格，当前皮肤高亮 + badge 标记，点击触发布尔回调。
- `injectSkinStyles()` — 向 `<head>` 注入皮肤卡片 CSS 样式（含响应式移动端单列布局）。
- `getSkinPreviewEmoji()` — 每种皮肤配 emoji 预览。

### 3.5 UI 工具库

AI 辅助生成了 `src/ui/index.ts`（283 行）：

- `showToast(message, duration)` — 右下角浮动 Toast 通知，自动消失。
- `showModal(title, content)` — 居中弹窗，含关闭按钮和背景遮罩点击关闭。
- `updatePanel(info)` — 更新侧边信息面板（标题、描述、统计表格）。
- `getDeviceType()` — 检测 mobile / tablet / desktop。
- `onDeviceChange(callback)` — 监听窗口大小变化，跨越断点时触发回调。
- `bindControls(map)` — 批量绑定控制栏按钮事件。
- `setPanelSkinType(type)` — 换肤时更新侧栏标题图标。

### 3.6 主入口集成

AI 辅助编写了 `src/main.ts`（567 行，合并后）的初始版本及后续整合：

- 应用启动流程：加载皮肤配置 → 预加载素材 → 设置皮肤类型 → 绑定控制栏 → 初始化 Canvas → 初始化存储。
- 控制栏绑定：播放/暂停（切换图标 + `aria-pressed`）、速度滑块（1-10）、缩放（1.2× / 0.8×）、重置视角、皮肤切换（异步预加载后 dispatch 事件）、语言切换、帮助弹窗。
- CustomEvent 事件体系：`solarkids:togglePlay`、`solarkids:speedChange`、`solarkids:zoom`、`solarkids:resetView`、`solarkids:showEclipse`、`solarkids:showComet`、`solarkids:showMagnetic`、`solarkids:skinChange`。
- 后续团队成员在此基础上扩展了场景入口按钮（太阳系总览、地表视角、太阳雨、轨道小游戏）和多语言翻译函数。

## 四、AI 生成内容的逐项说明

以下表格列出 AI 为成员2生成的核心内容及生成方式：

| 文件 | AI 生成方式 | 学生参与 |
|------|------------|---------|
| `index.html` | 根据产品设计文档生成页面骨架 | 确认布局、按钮分组、文案调整（"日食"→"日食/月食"） |
| `src/style.css` | 根据深空主题 + 儿童友好需求生成 | 确认色调、间距、响应式行为 |
| `src/data/skins.json` | 根据两套皮肤需求生成配置模板 | 导入素材后更新路径；合并后适配新素材结构 |
| `src/data/types.ts` | 检测到循环依赖后提取共享类型 | 无需干预 |
| `src/ui/assetLoader.ts` | 设计素材加载+缓存+降级方案并编码 | 确认 API 设计，素材导入后验证加载 |
| `src/ui/solarSystemPreview.ts` | 设计太阳系渲染引擎并编码 | 视觉调整：土星比例、彗星尺寸、轨道样式、背景图切换；导入冥王星素材 |
| `src/ui/skinPicker.ts` | 设计换肤弹窗并编码 | 确认 UI 样式 |
| `src/ui/index.ts` | 设计 UI 工具函数并编码 | 确认 API 设计 |
| `src/main.ts` | 编写入口流程和控制栏绑定 | 确认事件体系；后续行为交给团队整合 |

## 五、关键技术决策

### 5.1 为什么素材加载用 fetch + 运行时降级

项目要求最终提交 `index.html` 可直接双击打开。但 `fetch` 在 `file://` 协议下被 CORS 阻止，开发阶段用 `npx serve .` 启动本地服务器解决。最终提交前需要将素材内联或使用 `import` 直接引用，保证离线可用。

素材文件缺失时自动生成 SVG DataURL 占位图（径向渐变球体 + 特征标记），保证即使素材路径配置错误，画面也不会出现空白天体。

### 5.2 为什么使用 CustomEvent 而非直接函数调用

UI 控制栏（成员2负责）和 Canvas 动画（成员3负责）需要解耦。CustomEvent 允许两方独立开发：成员2在 `main.ts` 中 dispatch 事件，成员3在 Canvas 模块中监听。事件名约定为 `solarkids:<action>`，detail 传递参数。

### 5.3 为什么类型定义独立到 types.ts

`assetLoader.ts` 定义 `SkinType`、`SkinsData` 等类型，而 `skins.ts`（后被移除）也需要引用这些类型，直接在 assetLoader.ts 中 re-export 会导致循环引用。创建 `src/data/types.ts` 作为单一类型来源，两个模块都从它 import。

### 5.4 为什么饱和环不裁剪

土星的 PNG 贴图包含光环部分，如果直接用 `ctx.arc()` clip 再 drawImage，光环会被圆裁剪掉。因此对 Saturn 做了特殊处理：不使用 clip，扩大 drawImage 区域以完整展示光环。



## 六、被其他模块引用的公共接口

成员2的代码作为基础设施层被全组依赖（详见 [AI 开发说明书](AI开发说明书.md) 总文档的"成员2公共接口汇总"章节）：

| 模块 | 导出 | 被引用者 |
|------|------|---------|
| `solarSystemPreview.ts` | `PLANETS`, `drawPlanet`, `drawSun`, `drawSpace`, `drawHint`, `drawSaturnRingBack/Front`, `getCompressedOrbit`, `getResponsiveOrbitScale`, `getSkinType`, `setSkinType`, `PlanetPreview`, `PreviewCallbacks` | 成员3（`solarSystemScene.ts`、`cometScene.ts`），成员4（`main.ts`） |
| `assetLoader.ts` | `SkinType`, `RenderSkinType`, `SkinsData`, `SkinConfig`, `PlanetId`, `getCachedImage`, `loadSkinsConfig`, `preloadAllAssets`, `clearAssetCache` | 成员1（日食/磁场场景），成员3（太阳系场景），成员4（main.ts、太阳风/轨道游戏场景） |
| `skinPicker.ts` | `showSkinPicker`, `injectSkinStyles` | 成员4（main.ts） |
| `index.ts` | `showToast`, `updatePanel`, `showModal`, `getDeviceType`, `onDeviceChange`, `bindControls`, `setPanelSkinType`, `PlanetInfo` | 成员3（场景回调），成员4（main.ts、integration） |
| `style.css` | 87 个 CSS 变量、响应式网格布局、按钮系统 | 全局（index.html 直接引用，skinPicker 内联样式中引用变量） |

## 七、验证结果

- TypeScript 严格模式编译通过（`npx tsc --noEmit`）。
- 浏览器中手动验证：
  - 两种皮肤正常切换，素材加载后画面正确显示。
  - 行星点击后侧栏更新信息。
  - 缩放、重置视角按钮功能正常。
  - 土星环完整显示（不裁剪）。
  - 哈雷彗星比例合适。
  - 写实模式背景图正确平铺。
  - 轨道白色实线显示正常。
  - 冥王星素材在两套皮肤下均正常渲染。
- 响应式布局：PC（1920px）、iPad（768-1023px）、手机（<768px）三档均验证通过。
- 其他成员基于公共接口的编译和集成验证通过（合并 dev 无冲突）。

## 八、后续工作

- 最终提交前将素材系统改为离线可用模式（内联或 import）。
- 与成员3同步 `solarSystemPreview.ts` 后续修改，确保公共接口稳定。
- 真机（iPad、手机）触控体验验收。
- 合并到 `main` 分支前的最终视觉走查。

## 九、更新日志

| 日期 | 开发阶段 | AI 协同内容 | 学生确认与结果 |
|------|---------|------------|--------------|
| 2026-07-22 | UI 框架搭建 | 生成 index.html、style.css、main.ts、UI 工具库、类型系统骨架 | 确认布局和配色；首次 Git 提交 |
| 2026-07-22 | 素材系统设计 | 生成 assetLoader.ts、skins.json、占位图生成逻辑 | 导入 SVG/PNG 素材后验证加载 |
| 2026-07-22 | 太阳系预览渲染 | 生成 solarSystemPreview.ts 初始版本（静态行星 + 代码绘制） | 浏览器验证画面 |
| 2026-07-22 | 贴图集成 | 将 PNG/SVG 贴图接入 drawPlanet/drawSun；修复土星环裁剪、彗星尺寸 | 调整土星 PNG 比例、缩小彗星 |
| 2026-07-22 | 换肤系统 | 生成 skinPicker.ts + 换肤事件流 + 素材预加载 | 确认切换逻辑 |
| 2026-07-28 | UI 视觉效果优化 | 写实模式背景图替代；轨道改为白色实线；冥王星素材接入 | 浏览器验证通过 |
| 2026-07-28 | 合并 dev | 拉取最新 dev、解决编译配置、维持公共接口兼容 | 合并无冲突，编译通过 |
