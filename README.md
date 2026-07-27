# SolarKids

SolarKids 是一个面向儿童的天体运行教学 Web 软件。

## 开发环境

需要 Node.js、npm 和现代浏览器。

```bash
npm install
npm run build
npm run serve
```

开发期间可以运行：

```bash
npm run dev
```

## 项目要求

- 使用 HTML5、CSS3、JavaScript、TypeScript、Canvas、SVG
- 支持 PC、iPad、手机响应式布局
- 使用 LocalStorage 和 JSON 保存学习设置与数据
- 禁止使用 Three.js、Unity WebGL、Babylon.js 直接替代核心实现

## 当前分支

- `main`：最终稳定版本
- `dev`：唯一日常整合入口
- `feature/eclipse-magnetic`：日月食与磁场专题
- `feature/ui-integration`：儿童友好 UI、响应式和专题界面整合
- `feature/canvas-orbit`：天体运行、哈雷彗星、视角交互和公共动画接口
- `feature/storage-game`：LocalStorage、多语言、学习进度和小游戏
- `feature/solar-wind`：太阳风专题

## 协作规则

每位成员从最新 `dev` 建立自己的 `feature/*` 分支，阶段功能通过 PR 合并到 `dev`；统一测试通过后，再由组长将 `dev` 合并到 `main`。

## Canvas 公共运行时

公共动画接口位于 `src/canvas/`，提供：

- 唯一的 `requestAnimationFrame` 动画控制器
- 统一时钟和时间倍率
- 主场景注册与切换
- 专题动画图层挂载
- 二维相机和坐标转换
- 鼠标、触控、双指与键盘交互
- 太阳系总览和地球地表第一视角
- 天体状态共享仓库
- 运行时事件通知

接口说明见 [`docs/Canvas动画与场景接口说明.md`](./docs/Canvas动画与场景接口说明.md)。

## 开发与验证

安装开发依赖：

```bash
npm install
```

验证成员4的 Storage、多语言和小游戏纯逻辑模块：

```bash
npm run typecheck
npm test
npm run build
```

模块入口：

- `src/storage/index.ts`：语言、皮肤、学习进度和游戏记录。
- `src/i18n/index.ts`：中英文文案读取和切换。
- `src/game/index.ts`：轨道拖动小游戏的纯逻辑。
- `src/data/language.json`：界面与八大行星双语内容。

成员4的职责、实现接口、AI协作过程和验收证据统一见
[`docs/AI开发说明_成员4.md`](./docs/AI开发说明_成员4.md)。
