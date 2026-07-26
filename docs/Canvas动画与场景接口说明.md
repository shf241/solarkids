# SolarKids Canvas 动画与场景接口说明

本文说明成员3维护的公共 Canvas 动画骨架，以及已经接入的模块1太阳系场景、模块5哈雷彗星场景和模块6交互与视角控制。

## 一、设计目标

- 页面中只存在一个 `requestAnimationFrame` 主循环。
- 主场景、专题场景和叠加动画共享统一时间倍率。
- 日月食、磁场和太阳风模块不直接控制主循环。
- 场景退出时有统一的资源清理入口。
- 世界坐标、屏幕坐标和相机状态由公共模块管理。
- 成员1和成员4可以通过稳定接口读取天体状态和挂载专题效果。

## 二、目录结构

```text
src/canvas/
├── AnimationClock.ts       # 真实时间、模拟时间和时间倍率
├── AnimationController.ts  # 唯一 requestAnimationFrame 控制器
├── Camera2D.ts             # 相机和坐标转换
├── CanvasInteractions.ts   # 模块6手势、键盘和视角跟随
├── CanvasRuntime.ts        # 公共运行时入口
├── cometScene.ts           # 模块5哈雷彗星轨道与动态彗尾
├── EarthObserverView.ts    # 地球地表观察者天空投影
├── EquirectangularPlanetRenderer.ts # 可复用的等距柱状纹理球渲染器
├── SaturnRingRenderer.ts   # 土星环纹理、三维投影与前后遮挡
├── EventBus.ts             # 模块间事件通知
├── LayerManager.ts         # 可叠加专题动画层
├── SceneManager.ts         # 互斥主场景管理
├── solarSystemScene.ts     # 模块1太阳系总览场景
├── WorldState.ts           # 天体状态共享仓库
├── controlBridge.ts        # 兼容当前 UI DOM 事件
├── index.ts                # 对外统一导出
└── types.ts                # 公共类型
```

## 三、运行时入口

应用由 `src/main.ts` 创建唯一运行时：

```ts
const runtime = createCanvasRuntime({
  canvas,
  container,
  animation: {
    timeScale: 1,
    maxDeltaMs: 100,
  },
  camera: {
    minZoom: 0.5,
    maxZoom: 4,
  },
});
```

其他模块可以获取当前运行时：

```ts
import { getCanvasRuntime } from '../canvas/index.js';

const runtime = getCanvasRuntime();
if (!runtime) return;
```

## 四、统一动画控制

```ts
runtime.animation.start();
runtime.animation.pause();
runtime.animation.resume();
runtime.animation.toggle();
runtime.animation.stop();
runtime.animation.reset();
runtime.animation.setTimeScale(2);
```

`FrameSnapshot` 提供：

- `timestampMs`：浏览器帧时间戳。
- `deltaMs`：应用时间倍率后的帧间隔。
- `unscaledDeltaMs`：真实帧间隔。
- `elapsedMs`：累计模拟时间。
- `timeScale`：当前时间倍率。
- `frameNumber`：重置后的帧序号。

切换浏览器标签页后，单帧时间会被限制，避免行星突然跳跃。

## 五、主场景

主场景是互斥的，一次只运行一个，例如太阳系总览、日月食专题、彗星专题、磁场专题或太阳雨专题。

```ts
import type { CanvasScene } from '../canvas/index.js';

const scene: CanvasScene = {
  id: 'solar-system',

  enter(context) {
    // 绑定本场景资源。
  },

  update(frame, context) {
    // 使用 frame.deltaMs 更新天体状态。
  },

  render(frame, context) {
    const { context2D, camera } = context;
    camera.applyTransform(context2D);
    // 绘制世界坐标中的内容。
  },

  resize(viewport, context) {
    // 响应画布尺寸变化。
  },

  reset(context) {
    // 恢复本场景初始状态。
  },

  exit(context) {
    // 解绑事件和临时资源。
  },
};

runtime.scenes.register(scene);
runtime.scenes.switchTo('solar-system');
```

底部入口将“太阳系总览”“地表视角”“日食/月食”“彗星”“磁场”“太阳雨”并列显示，并统一使用 `aria-pressed` 表示选中状态；任意时刻只有一个入口高亮。专题按钮请求未注册场景时不会报错；对应模块注册完成后，现有 UI 事件会自动切换场景。

各入口使用的 DOM 事件和目标如下：

| 入口 | DOM 事件 | 目标 |
| --- | --- | --- |
| 太阳系总览 | `solarkids:showOverview` | 切换到 `solar-system` 场景和总览相机 |
| 地表视角 | `solarkids:showOverview` 后调用交互控制器 | 切换到 `solar-system` 场景和 `earth-first-person` 相机 |
| 日食/月食 | `solarkids:showEclipse` | `eclipse` 场景 |
| 彗星 | `solarkids:showComet` | `comet` 场景 |
| 磁场 | `solarkids:showMagnetic` | `magnetic` 场景 |
| 太阳雨 | `solarkids:showSolarRain` | 预留的 `solar-rain` 场景 |

“太阳雨”当前仅完成入口和事件桥接，不注册场景、不包含粒子或物理动画。后续实现只需注册 `id: 'solar-rain'` 的 `CanvasScene`，无需再次修改控制栏协议。

## 六、专题动画层

磁场线、太阳风、教学标注等可以作为叠加层挂载，不必替换太阳系主场景。

```ts
import type { CanvasLayer } from '../canvas/index.js';

const solarWindLayer: CanvasLayer = {
  id: 'solar-wind',
  order: 20,

  update(frame, context) {
    const earth = context.world.getBody('earth');
    if (!earth) return;
    // 更新太阳风粒子。
  },

  render(frame, context) {
    // 绘制叠加效果。
  },

  unmount(context) {
    // 清理事件和缓存。
  },
};

const removeLayer = runtime.layers.register(solarWindLayer);
runtime.layers.setEnabled('solar-wind', true);

// 不再使用时：
removeLayer();
```

图层按 `order` 从小到大绘制。

## 七、天体状态共享

模块1负责写入太阳、地球、月球和行星状态：

```ts
runtime.world.setBody({
  id: 'earth',
  position: { x: 120, y: 0 },
  position3D: { x: 1, y: 0, z: 0 },
  velocity: { x: 0, y: 24 },
  displayPosition: { x: 96, y: 0 },
  displayVelocity: { x: 0, y: 11 },
  rotation: 0.6,
  orbitAngle: 1.2,
  radius: 13,
  visible: true,
});
```

成员1、成员4只读取公开状态：

```ts
const earth = runtime.world.getBody('earth');
const sun = runtime.world.getBody('sun');
```

`position` 和 `velocity` 保留总览使用的物理/逻辑坐标；`position3D`
保存地表观测使用的日心黄道三维坐标。响应式场景可以额外写入
`displayPosition` 和 `displayVelocity`，供相机准确跟随教学投影后的画面位置。
`getBody()` 返回副本，专题模块不应直接修改其他模块的数据。

## 八、相机和坐标转换

```ts
runtime.camera.zoomBy(1.2);
runtime.camera.panByScreen(20, -10);
runtime.camera.rotateBy(Math.PI / 12);
runtime.camera.setMode('focus', 'earth');
runtime.camera.reset();

const screenPoint = runtime.camera.worldToScreen({ x: 100, y: 30 });
const worldPoint = runtime.camera.screenToWorld(screenPoint);
```

场景绘制世界坐标内容前可以调用：

```ts
context.camera.applyTransform(context.context2D);
```

模块6由 `CanvasInteractionController` 统一接入：

```ts
const interactions = new CanvasInteractionController(runtime, {
  onViewChange(view) {
    console.log(view.mode, view.focusTargetId);
  },
});

interactions.showOverview();
interactions.focusBody('earth');
interactions.showEarthFirstPerson();

// 页面销毁时：
interactions.dispose();
```

当前交互包括：

- 太阳系总览中，鼠标左键或单指拖动：使用 Arcball 四元数旋转整个太阳系；轨道和天体共享同一三维视角。
- 按住 `Shift` 并用鼠标左键拖动：平移画面，避免与总览旋转手势冲突。
- 滚轮：以指针位置为锚点缩放。
- 双指：只进行中心点平移和指距缩放，不再用双指夹角旋转太阳系。
- 底部入口栏将“太阳系总览”“地表视角”和四个现象入口并列；六个入口互斥高亮。独立“聚焦”按钮已移除，天体探访仍使用内部平滑聚焦能力。
- 点击太阳、月球或任一行星后，侧栏先显示统一样式的基础百科和探访按钮；探访后相机使用公共动画帧在约 900ms 内平滑移动，目标天体同步放大到画布较短边约 55% 的直径。
- 探访入场期间会临时抵消相机倍率以稳定平滑过渡；进入稳定探访状态后以 `3.6×` 为缩放基准，滚轮、缩放按钮和双指缩放会同时改变星空背景、目标球体及土星环尺寸。
- 探访球体的 Arcball 命中半径会随当前相机倍率同步变化，放大或缩小后仍可从可见球面位置抓取旋转。
- 探访模式下单指或鼠标拖动继续控制球体 Arcball；双指手势优先控制背景与球体的整体平移、缩放，不会被球体旋转手势截获。
- 探访模式中，从球体外的背景开始拖动只平移相机，不退出 `focus` 状态；再次从平移后的球体内部开始拖动仍会进入 Arcball 旋转。
- 球体旋转命中和 Arcball 归一化使用目标天体经过当前相机变换后的实际屏幕中心，不再固定假设球体始终位于画布中心。
- 探访开始后只绘制目标天体，隐藏其他天体、彗星和全部轨道；场景公转和全部自动自转冻结。
- 探访期间包括地球自转在内的全部自动运动冻结；返回总览后，所有天体从冻结状态继续运行，不按全局累计时间突然跳跃。
- 任一天体探访完成后，卡通和写实模式都可从球面内启动 Arcball 虚拟轨迹球旋转；抓取点通过四元数跟随指针移动，不再按鼠标位移简单累加 `yaw/pitch`。
- 太阳系总览不绘制彗星；哈雷彗星只保留在独立 `comet` 场景中。
- 星空背景使用 `assets/skins/2k_stars_milky_way.jpg`，在世界空间重复铺设，并与相机缩放、平移和二维旋转同步。
- “地表视角”：观察者位于地球表面，画面显示地平线、大气层以及从地球方向看到的太阳、月球和行星。
- 地表视角与总览共用 `EquirectangularPlanetRenderer`，不再调用旧的扁平天体贴图逻辑；卡通和写实皮肤均保持球形纹理、明暗与自转效果。
- 地表视角中的土星使用独立光环纹理，并按照后半环、土星球体、前半环的顺序绘制，避免球面纹理被错误拉伸成包含光环的矩形贴片。
- 地表视角中的行星受光方向根据太阳和目标天体在天空投影中的相对方向计算。
- 地表模式下拖动或使用方向键可环顾天空，滚轮和双指缩放用于调整视野。
- 普通模式下方向键平移，`+/-` 缩放，`0/E` 切换太阳系总览和地表视角。

拖动超过阈值后会抑制点击，防止误选天体。普通聚焦模式中手动平移或旋转会退出跟随；地表第一视角中拖动只用于环顾天空，不会退出该模式。

地表视角采用 2.5D 天文教学模型：

- 各行星和月球以日心黄道三维坐标写入 `position3D`，并包含轨道倾角和升交点方向。
- 以地球为观察原点，用目标天体位置减去地球位置得到地心黄道方向。
- 使用约 `23.44°` 的地球黄赤交角，将方向转换为赤经和赤纬。
- 使用当地恒星时和观察纬度转换为高度角和方位角；当前默认观察位置为北纬 `35°`。
- 天体在不同倾角、赤纬和相对运动下形成不同天空轨迹，地平线以下的天体不显示。
- 当前仍使用圆轨道和压缩教学时间，不计算轨道偏心率、真实日期地点、岁差章动及大气折射，因此适合展示空间关系，不作为精密天文预报。

## 九、事件

```ts
const off = runtime.events.on('sceneChange', change => {
  console.log(change.previousSceneId, change.sceneId);
});

off();
```

当前事件包括：

- `animationStateChange`
- `cameraChange`
- `sceneChange`
- `worldStateChange`
- `skinChange`

## 十、当前兼容方式

模块1已经通过 `createSolarSystemScene()` 注册为 `solar-system` 主场景。场景由公共动画控制器更新，并将太阳、行星、地球和月球状态写入 `runtime.world`。

旧的 `initSolarSystemPreview()` 绘制实现暂时保留在代码中作为视觉绘制函数来源，但页面入口不再启动它的独立绘制和事件监听。后续可以在视觉资源迁移完成后清理旧兼容代码。

模块1当前提供：

- 太阳、八大行星和月球的教学压缩运行；冥王星暂时从场景和皮肤预加载列表移除。
- 八大行星的物理数据使用真实地球半径比和真实半长轴 AU；Canvas 显示半径使用 `max(3.5, 6 × radiusEarths^0.6)`，轨道半径使用 `42 + 40.3 × distanceAU^0.68`，比旧版手工半径和平方根轨道映射更接近真实相对层次。
- 天体大小与轨道距离采用两套明确的非线性显示尺度，并非绝对同尺度模型；太阳和月球另设可读性边界。
- 公转周期采用真实周期比例；地球年压缩为 36 秒，其他天体按真实年数换算。
- 自转周期采用真实相对比例并保留顺逆方向；地球日单独压缩为 2.4 秒，便于观察。
- 卡通和写实模式使用同一个球面渲染器；太阳、月球和八大行星分别读取 `assets/cartoon_skin/*-cartoon.png` 与 `assets/skins/2k_*` 经纬纹理进行反向球面映射。
- 各天体的独立 `rotationAngle` 按公共帧 `deltaMs` 和真实相对自转周期更新采样经度，不改变公转位置。
- 月球和八大行星使用球面法线与太阳方向的点积计算漫反射明暗；太阳使用自发光模型和边缘亮度衰减，不出现黑暗半球。
- 两种模式分别使用 `assets/cartoon_skin/saturn-ring-cartoon.png` 和 `assets/skins/2k_saturn_ring_alpha.png` 生成俯视透明圆环；环平面与球体共享 Arcball 四元数，并按深度拆分前后半环。
- 2K 素材读取时建立最多 1024×512 的采样缓冲；球面离屏输出根据实际显示直径、相机缩放和 DPR 在 48–512 像素间自适应，聚焦画面不再固定使用 192×192。
- 两种模式均以纹理经度偏移表达自转，不再绘制黄色自转箭头。
- 金星和天王星在两种皮肤下都按负自转周期反向采样。
- 地球与月球的父子轨道关系，月球状态通过 `metadata.parentId` 标记。
- 世界状态保存未投影的轨道平面坐标，画面只在渲染阶段应用响应式轨道倾角。
- 天体状态写入 `WorldStateStore`，供日月食、磁场和太阳风专题读取。
- 点击天体查看信息、播放/暂停、速度倍率、缩放和视角重置。
- 使用控制栏“轨道”按钮显示或隐藏行星、月球和彗星轨迹。
- 行星、地球、月球和彗星轨迹统一使用虚线，保留地球亮青色与月球亮黄色的强调色。
- 总览普通轨道线宽约为 `0.65px`，地球/月球强调轨道约为 `1.1px`，hover 状态约为 `1.8px`；虚线段同步缩短，避免轨道抢占天体视觉层级。
- 卡通星空读取 `assets/cartoon_skin/stars-milky-way-cartoon-small-stars.png`，大型装饰星已替换为细小星点；原背景文件保留但不再作为当前入口。
- 地球轨道使用亮青色，月球轨道使用亮黄色，通过右下角图例说明颜色含义。
- 鼠标悬停地球或月球轨道时高亮轨道，并在指针旁显示轨道名称。
- 轨道隐藏时同步隐藏图例和悬停提示。
- 基于公共相机的 Canvas 坐标转换和点击命中检测。
- 太阳、月球和八大行星均支持统一样式的基础百科、探访按钮和详细资料两级内容；返回按钮会恢复探访前的太阳系总览。
- 侧栏标题统一显示皮肤对应的天体图标和中文名称：卡通模式使用 `assets/svg`，写实模式使用 `assets/images`；换肤时只更新标题图标，不清空当前百科内容。

模块5已经通过 `createCometScene()` 注册为 `comet` 主场景：

- 点击控制栏“彗星”按钮进入哈雷彗星场景；需要返回时点击并列的“太阳系总览”入口。
- 使用开普勒方程计算高偏心率椭圆轨道，近日点附近速度自然增大。
- 真实轨道周期压缩为 48 秒，直接使用公共动画时钟，速度滑块可以统一加速或慢放。
- 根据日彗距离连续计算彗尾活跃度，动态改变彗尾长度、宽度、透明度和颜色。
- 彗尾方向始终背离太阳。
- 物理距离采用 0.96714 偏心率；画面偏心率压缩为 0.82，避免彗星与太阳贴图重叠。
- 实时状态写入 `runtime.world.getBody('comet')`，元数据包含距离、轨道进度、彗尾活跃度、长度和颜色。
- 画面显示近日点、远日点、当前距离、彗尾活跃度和公共时间倍率。

## 十一、协作约束

- 不允许专题模块创建新的永久 `requestAnimationFrame` 循环。
- 不允许专题模块直接修改公共相机内部状态。
- 不允许专题模块直接修改其他模块写入的天体状态。
- `mount`、`enter` 中添加的事件监听，必须在 `unmount`、`exit` 中移除。
- 修改公共类型或接口前，需要在群内说明影响范围。
- `src/main.ts`、`package.json` 和公共 Canvas 文件发生变化时，PR 中必须明确列出。
