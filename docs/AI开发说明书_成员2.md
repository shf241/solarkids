# SolarKids AI 开发说明书——成员2

## 基本信息

- 姓名：陶羿轩
- 成员编号：成员2
- 负责模块：UI 视觉系统、响应式布局、素材管理系统、公共 Canvas 绘制函数、皮肤切换、UI 工具库，以及开屏和加分项弹窗的视觉接入
- 负责文档：`docs/AI开发说明书_成员2.md`、`docs/视觉设计说明.md`
- 开发分支：`feature/ui-responsive`（后合并至 `dev`）
- 开发时间：2026-07-22 至 2026-07-31

> 本文随成员2开发分支提交到远程仓库，并在后续开发过程中持续更新。

---

## 一、产品设计过程

### 1.1 负责内容

本人主要负责：

- UI 视觉系统：整体配色方案、CSS 变量体系、深空主题风格。
- 响应式布局：PC（≥1024px）、iPad（768-1023px）、手机（<768px）三档断点。
- 页面骨架：`index.html` 结构、Canvas 容器 `#canvas-container`、侧边信息面板 `#side-panel`、底部控制栏 `#control-bar`。
- 素材管理系统：皮肤配置加载、双套素材预加载与缓存、自动降级为 SVG 占位图。
- 皮肤切换 UI：卡通/写实两套皮肤的切换面板。
- 公共绘制函数：行星渲染（`drawPlanet`）、太阳渲染（`drawSun`）、星空背景（`drawSpace`）、轨道计算（`getCompressedOrbit`、`getResponsiveOrbitScale`）等底层 Canvas 绘制。
- UI 工具库：Toast 提示（`showToast`）、Modal 弹窗（`showModal`）、设备检测（`getDeviceType`）、控制栏事件绑定（`bindControls`）。
- CustomEvent 事件体系：`solarkids:togglePlay`、`solarkids:speedChange`、`solarkids:zoom`、`solarkids:resetView`、`solarkids:skinChange` 等，连接 UI 控制栏与 Canvas 场景。

### 1.2 功能目标

- 为 SolarKids 项目提供统一的视觉风格和可复用的 UI 基础设施。
- 保证整套 UI 在 PC、平板、手机三种设备上均能正常使用。
- 为成员3的 Canvas 场景系统提供稳定的公共绘制接口，使场景开发无需关心底层渲染细节。
- 支持卡通和写实两套皮肤的无缝切换，切换过程中素材不闪烁。
- 素材加载失败时自动降级，不影响画面完整性。

### 1.3 初步设计方案
以下方案由学生设计，AI 根据方案生成代码：

- 页面布局：CSS Grid 两列布局，左侧 Canvas 主画面，右侧 320px 信息面板。移动端单列，面板置于底部。
- 视觉风格：深空主题，以深蓝紫色为底色，行星和轨道使用明亮颜色形成对比，适合儿童审美。
- 控制栏：底部固定工具栏，分为播放控制、视角控制、功能切换、设置四个组，每组用分隔符区分。
- 信息面板：顶部显示天体名称/emoji，中间为简短描述，底部为统计信息表格。
- 素材方案：JSON 配置文件声明每种皮肤的素材路径，启动时预加载全部素材到内存缓存，Canvas 渲染时从缓存取用。
- 按钮设计：图标 + 短文字，触摸目标 ≥44px，hover 高亮 + active 缩放反馈。
- 换肤流程：用户点击换肤按钮 → Modal 弹出选择 → 预加载新皮肤素材 → 清空旧缓存 → dispatch `solarkids:skinChange` 事件 → Canvas 重绘。
- 开屏流程：显示星空欢迎层 → 等待词典、皮肤和 Canvas 初始化 → 启用“开始探索” → 淡出欢迎层并启动公共动画。
- 加分项入口：在设置组增加机器人和卫星图标，分别打开 AI 顾问和多人学习房弹窗，沿用同一按钮、输入框和焦点样式。

---

## 二、用户分析过程

### 2.1 目标用户

- 主要用户：7-12 岁儿童
- 知识基础：对太阳、地球、行星有基本概念，但不了解轨道、公转、彗星等天文知识
- 操作设备：电脑浏览器、平板、手机
- 使用特点：更容易被图形和颜色吸引，喜欢点击和拖动，对长段文字耐心较低，需要明确的视觉反馈

### 2.2 用户需求

本人负责的 UI 和渲染模块需要满足以下用户需求：

- 主界面以大面积的太阳系动画为核心，文字信息以卡片形式简短呈现。
- 按钮图标清晰、触摸目标足够大（≥44×44px），适合小手操作。
- 切换皮肤时过渡平滑，不应出现空白或闪烁。
- 手机端信息面板不能占用过多空间，需保证太阳系画面可见。
- 操作提示（如"点击一颗行星"）文字简短，字体可读。

### 2.3 可能出现的问题

- 手机屏幕上太阳系太小，面板占据过多空间。
- 素材加载失败导致画面出现空白区域。
- 皮肤切换时旧图片未清除，导致画面混合两种皮肤风格。
- 响应式断点切换时布局错乱。
- 轨道图例和标签文字在手机上过大，遮挡画面。
- 中英文切换后部分文字未更新（后续在成员4的翻译系统接入后发现并修复）。

---

## 三、AI 生成内容

### 3.1 AI 使用方式

1. 向 AI 说明页面布局、视觉风格和功能目标。
2. 要求 AI 先检查现有项目结构（如 `index.html`、`tsconfig.json`）再生成代码。
3. AI 生成或修改代码后，用 `npx tsc --noEmit` 验证编译。
4. 在浏览器中查看实际渲染效果。
5. 发现问题后向 AI 描述具体表现，要求定位并修复。
6. 人工确认后通过 Git 提交。

### 3.2 AI 生成内容记录

| 序号 | 开发任务 | 涉及文件或模块 | 函数、类或接口 | AI 生成内容 |
| --- | --- | --- | --- | --- |
| 1 | 页面骨架与样式系统 | `index.html`、`src/style.css` | CSS Grid 布局、87 个 CSS 变量、响应式断点、按钮系统 | 生成完整页面结构和深空主题样式 |
| 2 | 素材管理系统 | `src/ui/assetLoader.ts` | `loadSkinsConfig`、`preloadAllAssets`、`getCachedImage`、`clearAssetCache`、`generatePlaceholderSVG` | 设计并实现素材加载、缓存、降级流水线 |
| 3 | 皮肤配置 | `src/data/skins.json` | 皮肤配置 JSON 结构 | 生成配置模板（卡通/写实，含素材路径和颜色） |
| 4 | 太阳系渲染引擎 | `src/ui/solarSystemPreview.ts` | `drawSpace`、`drawSun`、`drawPlanet`、`drawComet`、`drawOrbits`、`drawHint`、`getCompressedOrbit`、`getResponsiveOrbitScale`、`PlanetPreview`、`PreviewCallbacks` | 生成完整行星渲染管线、轨道计算、交互逻辑 |
| 5 | 换肤面板 | `src/ui/skinPicker.ts` | `showSkinPicker`、`injectSkinStyles`、`getSkinPreviewEmoji` | 生成换肤 Modal UI 和样式注入 |
| 6 | UI 工具库 | `src/ui/index.ts` | `showToast`、`showModal`、`updatePanel`、`getDeviceType`、`onDeviceChange`、`bindControls`、`setPanelSkinType`、`PlanetInfo` | 生成工具函数和控制栏绑定 |
| 7 | 主入口集成 | `src/main.ts` | 启动流程、事件绑定、CustomEvent 体系 | 生成应用初始化、控制栏绑定、事件 dispatch 逻辑 |
| 8 | 中英文翻译补全 | `src/data/language.json`、`src/canvas/solarSystemScene.ts`、`src/canvas/cometScene.ts` | `t()`、`ct()`、`isEnglish()`、`cometIsEnglish()`、`localizeName()`、`BODY_VISIT_CONTENT_EN` | 生成 50+ 翻译键和动态语言检测函数 |
| 9 | 欢迎页与加分项入口 | `index.html`、`src/style.css`、`src/main.ts`、`src/data/language.json` | `#welcome-screen`、`prepareWelcomeScreen`、`bindControls` | 接入 Kevin 的欢迎页，并补充 AI 顾问、WebSocket 学习房的图标入口和中英文标签。 |

### 3.3 具体生成内容

#### 3.3.1 页面骨架与样式系统

- 开发目标：根据学生设计的页面布局和视觉风格，搭建 SolarKids 主页面结构，定义深空主题 CSS 变量体系。
- 提示词概述：学生提供布局方案（Grid 两列、控制栏四分组、移动端单列）和视觉方向（深蓝紫色调、儿童友好配色），要求 AI 生成对应的 HTML 结构和 CSS 代码。
- 涉及文件：`index.html`、`src/style.css`
- 涉及模块：页面布局、CSS 变量系统
- 涉及函数或类：CSS Grid 布局、87 个 CSS 变量、响应式断点（767px/1023px）
- AI 生成内容：根据学生设计生成页面骨架（Canvas 容器、侧边信息面板、底部控制栏四个分组）；生成 766 行 CSS 含深空背景色、行星色、UI 功能色、间距/圆角/阴影系统、按钮系统（`.btn`、`.btn--icon`、`.btn--ghost`、`.btn--active`）、`focus-visible` 焦点样式、`prefers-reduced-motion` 无障碍适配。
- 是否直接采用：修改后采用
- 未直接采用的原因：按钮分组和文案需要根据实际功能调整（如"日食"→"日食/月食"）；颜色和间距由学生在浏览器中反复验证后微调

#### 3.3.2 素材管理系统

- 开发目标：管理两套皮肤素材的加载、缓存和降级。
- 提示词概述：要求 AI 设计素材加载流水线，支持预加载、缓存、换肤清空、失败降级。
- 涉及文件：`src/ui/assetLoader.ts`、`src/data/skins.json`
- 涉及模块：素材加载与管理
- 涉及函数或类：`loadSkinsConfig`、`preloadAllAssets`、`loadPlanetAsset`、`getCachedImage`、`clearAssetCache`、`generatePlaceholderSVG`、`preloadTopicAssets`、`PlanetId`、`SkinType`、`RenderSkinType`、`SkinConfig`、`SkinsData`
- AI 生成内容：JSON 配置驱动的素材管理流水线（221 行），含缓存去重、批量预加载、SVG DataURL 占位图自动生成（径向渐变球体 + 土星光环/地球大陆/太阳光晕等特征标记）、专题场景素材预加载。
- 是否直接采用：修改后采用
- 未直接采用的原因：需对接成员3的实际素材目录结构（`cartoon_skin/`、`skins/`）

#### 3.3.3 太阳系静态预览与渲染

- 开发目标：实现 Canvas 2D 太阳系行星渲染，作为其他成员的底层绘制基础设施。
- 提示词概述：要求 AI 实现包含所有行星的静态太阳系预览，含轨道、贴图渲染、悬停高亮、点击交互。
- 涉及文件：`src/ui/solarSystemPreview.ts`
- 涉及模块：Canvas 太阳系渲染
- 涉及函数或类：`PLANETS`、`drawSpace`、`drawSun`、`drawPlanet`、`drawComet`、`drawPlanetFeatures`、`drawSaturnRing`、`drawOrbits`、`drawHint`、`getCompressedOrbit`、`getResponsiveOrbitScale`、`PlanetPreview`、`PreviewCallbacks`
- AI 生成内容：988 行太阳系渲染引擎——行星数据、绘制函数（星空、太阳、行星贴图/手绘降级、彗星、轨道、提示文字）、AU 到像素的平方根压缩算法、响应式轨道缩放、Pointer Events 交互（悬停高亮+点击选中+面板更新）、皮肤状态管理（`setSkinType`/`getSkinType` + `solarkids:skinChange` 事件监听）。
- 是否直接采用：修改后采用
- 未直接采用的原因：土星环裁剪逻辑需特殊处理；彗星尺寸需缩小；轨道样式从虚线改为白色实线

#### 3.3.4 主入口集成与事件体系

- 开发目标：编写应用启动流程，建立 UI 与 Canvas 之间的 CustomEvent 通信体系。
- 提示词概述：要求 AI 编写 main.ts 入口，绑定控制栏按钮，dispatch 事件给 Canvas。
- 涉及文件：`src/main.ts`
- 涉及模块：应用入口与控制栏
- 涉及函数或类：启动流程（加载配置→预加载→初始化 Canvas）、`bindControls`、CustomEvent dispatch
- AI 生成内容：完整启动流程、控制栏 8+ 按钮绑定（播放/暂停、速度滑块、缩放 1.2×/0.8×、重置视角、皮肤切换、语言切换、帮助弹窗）、`solarkids:togglePlay` / `solarkids:speedChange` / `solarkids:zoom` / `solarkids:resetView` / `solarkids:showEclipse` / `solarkids:showComet` / `solarkids:showMagnetic` / `solarkids:skinChange` 事件体系。
- 是否直接采用：修改后采用
- 未直接采用的原因：后续由成员4扩展场景入口按钮和翻译函数

#### 3.3.5 欢迎页与加分项弹窗接入

- 开发目标：让首次进入先经过清晰的欢迎页，并在主界面提供 AI 天文问答和多人学习房入口。
- 提示词概述：保留 Kevin 已提交的欢迎页结构和视觉风格，只补充两个加分项入口；弹窗要能在 PC、平板和手机上使用，且不遮挡主画布。
- 涉及文件：`index.html`、`src/style.css`、`src/main.ts`、`src/bonus/astronomyAdvisor.ts`、`src/bonus/learningRoom.ts`、`src/data/language.json`
- 涉及模块：欢迎页、AI 天文问答顾问、WebSocket 多人学习房
- 涉及函数或类：`prepareWelcomeScreen`、`LearningRoomClient`、`openAstronomyAdvisor`、`openLearningRoom`、`answerAstronomyQuestion`
- AI 生成内容：生成入口绑定、儿童友好问答卡片、房间状态/在线人数/活动列表 UI、移动端单列表单和弹窗样式。
- 是否直接采用：修改后采用。
- 未直接采用的原因：AI 初稿需要补充本地回退、连接状态透明显示、输入清理、重复活动去重和无服务端测试兼容。

---

## 四、学生修改内容

### 4.1 修改记录总表

| 序号 | 原始问题 | 文件或模块 | 函数或代码位置 | 学生修改方法 | 修改结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 土星 PNG 素材含光环，`ctx.arc()` clip 会把光环裁掉 | `src/ui/solarSystemPreview.ts` | `drawPlanet` | 对 Saturn 特殊处理：跳过 clip，扩大 drawImage 区域 | 土星环完整显示 |
| 2 | 哈雷彗星 SVG 过大 | `src/ui/solarSystemPreview.ts` | 彗星绘制逻辑 | 缩小彗星绘制尺寸 | 彗星比例与行星协调 |
| 3 | 写实模式使用代码绘制深空背景，与素材不匹配 | `src/ui/solarSystemPreview.ts` | `drawSpace` | 写实模式下使用 `background.png` 贴图替代代码渐变 | 写实背景正确显示 |
| 4 | 轨道虚线在移动端辨识度差 | `src/ui/solarSystemPreview.ts` | `drawOrbits` | 将虚线改为白色实线 | 轨道在手机上清晰可见 |
| 5 | 冥王星缺少素材 | `src/ui/solarSystemPreview.ts` | 素材加载逻辑 | 寻找并导入冥王星 PNG/SVG 素材 | 两套皮肤均正常渲染冥王星 |
| 6 | 手机端信息面板过高，太阳系画面太小 | `src/style.css` | 移动端面板样式 | 手机端 `max-height` 从 30vh 改为 20vh | 太阳系可见区域增大 |
| 7 | `tsconfig.json` 中 `"types": ["node"]` 导致编译失败（`@types/node` 未安装） | `tsconfig.json` | compilerOptions | 移除 `"types": ["node"]`，排除 `tests/` 目录 | 编译通过 |
| 8 | 切换英文后轨道图例、地表观测、彗星面板、探访面板仍显示中文 | `src/canvas/solarSystemScene.ts`、`src/canvas/cometScene.ts` | `drawOrbitLegend`、`drawOrbitTooltip`、地球观测绘制逻辑、`getBodySummaryInfo`、`getBodyDetailInfo`、`getHalleyInfo`、彗星面板绘制 | 在 `language.json` 新增 50+ 翻译键；添加 `t()`/`ct()`/`isEnglish()`/`cometIsEnglish()`/`localizeName()` 动态语言函数；替换所有硬编码中文 | 中英文切换全部正确 |
| 9 | 彗星场景中文模式显示英文（静态 `_cometEnglish` 标志在场景创建时固化） | `src/canvas/cometScene.ts` | `getHalleyInfo`、`_cometEnglish` | 删除静态 `_cometEnglish`，改为 `cometIsEnglish()` 动态函数（每次调用时比较 `translate('body.sun') !== '太阳'`） | 切换语言后彗星面板即时更新 |
| 10 | 英文模式下行星百科为空 | `src/canvas/solarSystemScene.ts` | `BODY_VISIT_CONTENT` | 为 11 个天体编写 `BODY_VISIT_CONTENT_EN` 完整英文百科 | 英文模式显示完整百科 |

### 4.2 具体修改说明

#### 4.2.1 素材视觉效果调整

- 原始问题：AI 生成的绘制函数将所有行星统一用 `ctx.arc()` clip 裁剪为圆形，但土星的 PNG 贴图本身包含光环，裁剪后光环消失；哈雷彗星 SVG 默认尺寸过大；轨道虚线在手机上辨识度低。
- 发现方式：浏览器中切换皮肤并观察各行星渲染效果。
- 涉及文件：`src/ui/solarSystemPreview.ts`
- 涉及模块：太阳系渲染引擎
- 涉及函数或接口：`drawPlanet`、`drawOrbits`、彗星绘制逻辑
- 学生修改内容：
  1. 在 `drawPlanet` 中对 Saturn 做特殊判断：跳过 `ctx.arc()` clip，使用更大的 drawImage 区域完整展示光环。
  2. 缩小哈雷彗星的绘制尺寸，使其视觉比例与其他行星协调。
  3. 将轨道从虚线改为白色实线，提高在手机上的辨识度。
  4. 写实模式下使用 `background.png` 贴图替代代码生成的渐变背景。
- 修改原因：保证卡通和写实两套皮肤下所有天体视觉正确。
- 修改结果：土星环完整显示、彗星比例协调、轨道清晰、写实背景正确。
- 验证方式：分别在卡通和写实皮肤下观察每个天体的渲染效果。

#### 4.2.2 中英文翻译补全

- 原始问题：成员4在 `main.ts` 中建立了翻译系统并通过 `callbacks.translate` 注入场景，但成员3的场景代码（`solarSystemScene.ts`、`cometScene.ts`）中大量使用硬编码中文，导致切换英文后轨道图例、地表观测标签、指南针、探访面板标题/内容、彗星状态面板、操作提示等 7 类 UI 文字仍显示中文。
- 发现方式：浏览器中切换中英文，逐一检查各 UI 区域的文字变化。
- 涉及文件：`src/data/language.json`、`src/canvas/solarSystemScene.ts`、`src/canvas/cometScene.ts`
- 涉及模块：Canvas 太阳系场景、Canvas 彗星场景、翻译数据
- 涉及函数或接口：`drawOrbitLegend`、`drawOrbitTooltip`、`getBodySummaryInfo`、`getBodyDetailInfo`、`getHalleyInfo`、彗星面板绘制、地球观测绘制、指南针绘制、`drawHint`
- 学生修改内容：
  1. 在 `language.json` 中新增 50+ 翻译键（`orbit.earth/moon`、`visitor.*`、`earthObs.*`、`compass.*`、`comet.*`、`stat.*`、`hint.clickPlanet`、`body.sun`）。
  2. 在 `solarSystemScene.ts` 中添加 `t(key, fallback)` 辅助函数和 `isEnglish()` 动态检测函数（每次调用时比较 `translate('body.sun') !== '太阳'`，而非在场景创建时固化）。
  3. 添加 `localizeName(preview)` 辅助函数，根据语言返回 `preview.name` 或 `preview.nameCN`。
  4. 将所有硬编码中文替换为 `t('key', 'fallback')` 调用。
  5. 为 11 个天体编写 `BODY_VISIT_CONTENT_EN` 完整英文百科（概览 + 统计 + 3 段知识点）。
  6. 在 `cometScene.ts` 中添加 `cometIsEnglish()` 动态函数和 `ct(key, fallback)` 辅助函数，彗星面板所有标签改用 `ct('comet.xxx')` 调用。
- 修改原因：翻译系统已经存在但场景代码没有对接，需要补齐调用。
- 修改结果：中英文切换后所有 UI 文字正确翻译，彗星面板即时更新。
- 验证方式：分别在中英文模式下进入太阳系总览、地球地表视角、哈雷彗星场景，检查所有文字标签和面板内容。

#### 4.2.3 彗星场景语言检测修复

- 原始问题：彗星场景使用静态 `_cometEnglish` 标志（在 `createCometScene` 时赋值一次），切换语言后 `getHalleyInfo()` 仍返回旧语言的内容，导致中文模式下显示英文解释。
- 发现方式：中文模式下进入彗星场景，右侧面板显示英文标签和描述。
- 涉及文件：`src/canvas/cometScene.ts`
- 涉及模块：哈雷彗星场景
- 涉及函数或接口：`getHalleyInfo`、`_cometEnglish`、`cometIsEnglish`
- 学生修改内容：
  1. 删除静态 `_cometEnglish` 变量。
  2. 新增 `cometIsEnglish()` 函数，每次调用时动态计算 `_cometTranslate?.('body.sun') !== '太阳'`。
  3. 将 `getHalleyInfo()` 中的 `_cometEnglish` 判断改为 `cometIsEnglish()`。
- 修改原因：与 `solarSystemScene.ts` 中 `isEnglish()` 的设计一致——语言检测必须在每次调用时动态评估，不能固化为模块级静态标志。
- 修改结果：彗星面板随语言切换即时更新。
- 验证方式：先中文→进彗星→切换英文→回彗星→切换中文→回彗星，确认每次面板文字正确。

#### 4.2.4 移动端 UI 优化

- 原始问题：手机端信息面板 `max-height: 30vh` 过高，太阳系画面被挤压得太小。
- 发现方式：手机浏览器中实际测试。
- 涉及文件：`src/style.css`
- 涉及模块：响应式布局
- 涉及位置：`@media (max-width: 767px)` 内面板样式
- 学生修改内容：手机端 `max-height` 从 `30vh` 改为 `20vh`。
- 修改原因：给太阳系动画留出更多可视空间。
- 修改结果：手机端太阳系可见区域明显增大。
- 验证方式：手机浏览器中确认太阳系占比和面板可读性平衡。

### 4.3 人工修改与 AI 生成内容的区别

- AI 主要完成：根据学生设计生成代码骨架、CSS 变量体系初稿、素材加载流水线实现、行星绘制函数实现、工具函数编写。
- 学生主要判断：整体 UI 视觉设计（配色方案、布局结构、组件样式）、视觉比例调整（土星环、彗星尺寸、轨道样式）、响应式断点参数确定、翻译键命名规范。
- 学生重新设计：页面布局和视觉风格、模块接口和类型系统，定义各模块之间的调用约定。
- 学生最终验证：浏览器中逐项检查视觉效果、中英文切换完整性、手机真机测试、编译验证。

---

## 五、用户体验优化过程

### 5.1 测试方式

- 电脑浏览器测试（Chrome、Edge）
- 手机浏览器测试（移动端 < 768px）
- 平板测试（iPad 768-1023px）
- 卡通和写实皮肤切换测试
- 中英文切换测试
- 播放、暂停、缩放、重置按钮功能测试
- 场景切换测试（太阳系总览 ↔ 彗星 ↔ 地表观测）
- TypeScript 编译验证

### 5.2 体验问题与优化

| 体验问题 | 优化方式 | 最终效果 |
| --- | --- | --- |
| 手机端信息面板过高，太阳系画面太小 | 手机端面板 `max-height` 从 30vh 降至 20vh | 太阳系可视面积增大，同时面板信息可读 |
| 轨道图例和标签在手机上过大 | 在 `drawOrbitLegend` 中对 <768px 使用 90×40px box、9px 字体 | 图例不遮挡画面 |
| 切换皮肤后出现短暂空白 | `clearAssetCache` → `preloadAllAssets` 完成后再 dispatch `solarkids:skinChange` | 换肤无闪烁 |
| 素材缺失时画面出现空白天体 | `generatePlaceholderSVG` 自动生成径向渐变占位图 | 素材加载失败不影响画面完整性 |
| 按钮触摸目标太小 | 所有 `.btn--icon` 最小尺寸 44×44px | 手机上可正常点击 |
| 写实模式背景与代码绘制不符 | 写实模式使用 `background.png` 贴图 | 背景与行星风格统一 |
| 中英文切换不完整 | 为所有硬编码中文添加翻译键和 `t()` 调用 | 全界面文字正确翻译 |
| 页面加载时主界面可能在初始化未完成前被操作 | 采用 `#welcome-screen`、`inert` 和禁用的“开始探索”按钮，完成初始化后再放行 | 首次进入顺序清楚，主动画不会提前启动 |
| 两个加分项入口会让设置组过长 | 使用机器人/卫星图标，移动端保持图标化并复用 40px 触控尺寸 | 不新增横向滚动，入口仍可发现 |
| AI 或协作功能不可用时页面被阻断 | AI 使用离线知识卡片；多人房回退 BroadcastChannel 并显示状态 | 单人学习不依赖外部服务 |

### 5.3 优化结果

- 操作清晰度：所有按钮有 hover 高亮 + active 缩放 + `aria-pressed` 状态，触摸目标 ≥44px。
- 动画可理解性：轨道白色实线清晰、图例标注明确、提示文字引导操作。
- 页面美观度：深空主题统一配色、87 个 CSS 变量保证一致性、两套皮肤风格协调。
- 手机端适配：三档响应式断点覆盖，面板比例合理，太阳系画面占比充足。
- 运行稳定性：素材降级机制保证不出现空白天体，编译零错误。

---

## 六、设计决策说明

### 6.1 主要设计决策

| 设计问题 | 最终选择 | 选择原因 |
| --- | --- | --- |
| 素材加载方式 | fetch + 运行时缓存 + 降级 SVG 占位图 | 支持动态换肤，素材缺失不破坏画面 |
| UI 与 Canvas 通信 | CustomEvent（`solarkids:*`） | UI 控制栏和 Canvas 场景解耦，各成员独立开发 |
| 类型定义位置 | 独立 `src/data/types.ts` | 避免 assetLoader.ts 与 skins.ts 之间的循环引用 |
| 土星环渲染 | 跳过 `ctx.arc()` clip，扩大 drawImage 区域 | PNG 贴图自带光环，clip 会裁掉 |
| AU 到像素映射 | 平方根压缩 `sqrt(distanceAU) * scale` | 既保留相对距离关系，又保证所有行星在可视范围内 |
| 皮肤切换流程 | 先预加载新皮肤 → 再清空缓存 → 最后 dispatch 事件 | 避免切换过程中出现空白帧 |
| 语言检测方式 | 动态函数 `isEnglish()` 每次调用时计算 | 避免场景创建时固化的静态标志在切换语言后失效 |
| 首次进入时机 | 等待初始化后在欢迎页启用按钮 | 防止 Canvas 未准备好时误触，并让儿童明确知道下一步 |
| AI 顾问实现方式 | 前端可解释知识卡片匹配 | 不把 API Key 放进浏览器，离线课堂也可用 |
| 多人学习传输 | 独立 WebSocket 客户端 + 无依赖 Node 服务端 | 实时状态清晰，服务未启动时仍能同浏览器演示 |

### 6.2 科学性与教学表达

本人负责的 UI 和渲染模块主要涉及视觉呈现，不直接涉及天文教学内容。但以下设计选择与教学表达相关：

- 轨道距离使用平方根压缩而非真实比例：真实比例下内行星过于拥挤、外行星间距过大，压缩后所有行星均匀分布在画面中，便于儿童观察整体结构。
- 行星大小在代码中使用固定像素半径（非真实比例）：以保证每个行星都可被看清和点击。
- 土星环未按真实倾角渲染：保持水平环以简化视觉，突出土星的辨识特征。

### 6.3 AI 使用原则

- AI 用于辅助生成代码、CSS 样式和文档初稿。
- 学生负责提出需求、设计接口、检查问题、视觉验收和决定最终方案。
- AI 输出不能未经验证直接作为最终成果。
- 最终功能以实际代码编译通过和浏览器运行结果为准。

### 6.4 个人总结

- 本人完成的主要工作：整体 UI 视觉设计（页面布局、配色方案、组件样式）、CSS 变量体系（87 个变量）、响应式三档断点、素材管理流水线（加载/缓存/降级）、太阳系渲染引擎（10 个绘制函数、轨道计算、贴图集成）、换肤系统、UI 工具库、CustomEvent 事件体系、接口与类型系统设计、50+ 翻译键补全、动态语言检测、11 个天体英文百科、移动端 UI 优化。
- 开发过程中遇到的主要问题：素材 CORS 限制、土星环裁剪、皮肤切换闪烁、循环依赖、硬编码中文残留、静态语言标志失效。
- AI 提供的主要帮助：根据设计生成代码骨架、CSS 变量体系初稿、渲染函数实现、翻译键批量生成。
- 本人完成的关键修改：UI 视觉设计、接口与类型定义、素材视觉效果调整、动态语言检测机制、英文百科编写、移动端布局参数调优。
- 后续仍可继续改进的内容：素材系统改为离线可用（内联或 import）、真机触控体验验收、合并 main 前视觉走查。

---

## 附：公共接口汇总

成员2的代码作为基础设施层被全组依赖：

| 模块 | 导出 | 被引用者 |
|------|------|---------|
| `solarSystemPreview.ts` | `PLANETS`, `drawPlanet`, `drawSun`, `drawSpace`, `drawHint`, `drawSaturnRingBack/Front`, `getCompressedOrbit`, `getResponsiveOrbitScale`, `getSkinType`, `setSkinType`, `PlanetPreview`, `PreviewCallbacks` | 成员3（`solarSystemScene.ts`、`cometScene.ts`），成员4（`main.ts`） |
| `assetLoader.ts` | `SkinType`, `RenderSkinType`, `SkinsData`, `SkinConfig`, `PlanetId`, `getCachedImage`, `loadSkinsConfig`, `preloadAllAssets`, `clearAssetCache` | 成员1（日食/磁场场景），成员3（太阳系场景），成员4（main.ts、太阳风/轨道游戏场景） |
| `skinPicker.ts` | `showSkinPicker`, `injectSkinStyles` | 成员4（main.ts） |
| `index.ts` | `showToast`, `updatePanel`, `showModal`, `getDeviceType`, `onDeviceChange`, `bindControls`, `setPanelSkinType`, `PlanetInfo` | 成员3（场景回调），成员4（main.ts、integration） |
| `style.css` | 87 个 CSS 变量、响应式网格布局、按钮系统 | 全局（index.html 直接引用，skinPicker 内联样式中引用变量） |
