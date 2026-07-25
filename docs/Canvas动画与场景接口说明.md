# SolarKids Canvas 动画与场景接口说明

本文说明成员3维护的公共 Canvas 动画骨架。当前版本只提供运行时和接口，不包含模块1、模块5、模块6的完整业务实现。

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
├── CanvasRuntime.ts        # 公共运行时入口
├── EventBus.ts             # 模块间事件通知
├── LayerManager.ts         # 可叠加专题动画层
├── SceneManager.ts         # 互斥主场景管理
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

主场景是互斥的，一次只运行一个，例如太阳系总览、日月食专题或彗星专题。

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

专题按钮请求未注册场景时不会报错；对应模块注册完成后，现有 UI 事件会自动切换场景。

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
  velocity: { x: 0, y: 24 },
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

模块6将在此基础上补充鼠标拖拽、触控缩放、天体聚焦和地球第一视角。

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

现有 `solarSystemPreview.ts` 暂时继续负责静态预览。公共运行时没有激活场景时不会清空或覆盖现有 Canvas。

模块1开始开发后，应将静态预览逐步迁移为 `solar-system` 场景；迁移完成后再移除旧预览中的独立缩放、重置和窗口监听逻辑。

## 十一、协作约束

- 不允许专题模块创建新的永久 `requestAnimationFrame` 循环。
- 不允许专题模块直接修改公共相机内部状态。
- 不允许专题模块直接修改其他模块写入的天体状态。
- `mount`、`enter` 中添加的事件监听，必须在 `unmount`、`exit` 中移除。
- 修改公共类型或接口前，需要在群内说明影响范围。
- `src/main.ts`、`package.json` 和公共 Canvas 文件发生变化时，PR 中必须明确列出。
