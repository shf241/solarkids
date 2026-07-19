# SolarKids

SolarKids 是一个面向儿童的天体运行教学 Web 软件。

## 项目要求

- 使用 HTML5、CSS3、JavaScript、TypeScript、Canvas、SVG
- 支持 PC、iPad、手机响应式布局
- 使用 LocalStorage 和 JSON 保存学习设置与数据
- 禁止使用 Three.js、Unity WebGL、Babylon.js 直接替代核心实现

## 推荐分支

- `main`：最终稳定版本
- `dev`：日常整合版本
- `feature/product-flow`：产品设计、用户流程、交互文档
- `feature/ui-responsive`：视觉设计、SVG、响应式界面
- `feature/canvas-orbit`：Canvas 天体运行、彗星轨道、动画渲染
- `feature/storage-game`：LocalStorage、多语言、小游戏模式、整合测试

## 协作规则

每位成员在自己的 `feature/*` 分支开发，完成阶段功能后合并到 `dev`，测试通过后再合并到 `main`。

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

具体接入方式见 `docs/成员4模块对接说明.md`。

