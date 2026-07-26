/**
 * SolarKids 主入口
 * 负责初始化各模块并启动应用
 */

import {
  showToast,
  getDeviceType,
  onDeviceChange,
  setPanelSkinType,
  updatePanel,
  bindControls,
} from './ui/index.js';
import {
  loadSkinsConfig,
  preloadAllAssets,
  type SkinsData,
  type SkinType,
} from './ui/assetLoader.js';
import { showSkinPicker, injectSkinStyles } from './ui/skinPicker.js';
import { setSkinType } from './ui/solarSystemPreview.js';
import {
  bindCanvasControlEvents,
  CanvasInteractionController,
  createCanvasRuntime,
  type CanvasRuntime,
  type CanvasViewState,
} from './canvas/index.js';
import { createCometScene } from './canvas/cometScene.js';
import { createSolarSystemScene } from './canvas/solarSystemScene.js';
import { registerMember1Scenes } from './canvas/scenes/registerMember1Scenes.js';

// ---- 全局状态 ----

let skinsConfig: SkinsData | null = null;
let currentSkinType: SkinType = 'cartoon';
let canvasRuntime: CanvasRuntime | null = null;
let canvasInteractions: CanvasInteractionController | null = null;
let unbindCanvasControls: (() => void) | null = null;
let unbindAnimationStatus: (() => void) | null = null;
let unregisterMember1Scenes: (() => void) | null = null;
let unbindSceneSync: (() => void) | null = null;

type ExperienceId =
  | 'overview'
  | 'earth-first-person'
  | 'eclipse'
  | 'comet'
  | 'magnetic'
  | 'solar-rain';

const EXPERIENCE_BUTTONS: ReadonlyArray<readonly [string, ExperienceId]> = [
  ['btn-view-overview', 'overview'],
  ['btn-view-earth', 'earth-first-person'],
  ['btn-eclipse', 'eclipse'],
  ['btn-comet', 'comet'],
  ['btn-magnetic', 'magnetic'],
  ['btn-solar-rain', 'solar-rain'],
];

// ---- 应用启动 ----

async function init(): Promise<void> {
  console.log('🚀 SolarKids 启动中...');
  console.log(`📱 当前设备: ${getDeviceType()}`);

  // 注入换肤面板的额外样式
  injectSkinStyles();

  // 加载皮肤配置
  try {
    skinsConfig = await loadSkinsConfig();
    console.log(`🎨 当前皮肤: ${skinsConfig.skins[skinsConfig.activeSkin].name}`);

    // 预加载当前皮肤素材（失败会自动降级为占位图）
    await preloadAllAssets(skinsConfig);
    console.log('✅ 素材就绪（缺失素材已用占位图替代）');

    // 告诉渲染器当前皮肤类型
    const activeSkinType = skinsConfig.skins[skinsConfig.activeSkin].type;
    currentSkinType = activeSkinType;
    setSkinType(activeSkinType);
    setPanelSkinType(activeSkinType);
    console.log(`🖼️ 渲染器皮肤: ${activeSkinType}`);
  } catch (e) {
    console.warn('⚠️ 皮肤配置加载失败，使用默认配置', e);
  }

  // 绑定控制栏按钮
  bindControlBar();

  // 监听设备切换
  onDeviceChange(type => {
    console.log(`📱 设备切换为: ${type}`);
    showToast(`已切换为${type === 'mobile' ? '手机' : type === 'tablet' ? '平板' : '电脑'}布局`);
  });

  // 初始化 Canvas（成员3负责填充）
  initCanvas();

  // 初始化存储（成员4负责填充）
  initStorage();

  console.log('✅ SolarKids 启动完成');
  showToast('🌍 欢迎来到 SolarKids！点击行星开始探索吧');
}

// ---- 控制栏绑定 ----

function bindControlBar(): void {
  bindControls({
    'btn-play': el => {
      const btn = el as HTMLButtonElement;
      const isPlaying = btn.getAttribute('aria-pressed') !== 'true';
      setPlayButtonState(isPlaying);
      showToast(isPlaying ? '▶️ 已播放' : '⏸️ 已暂停');
      document.dispatchEvent(new CustomEvent('solarkids:togglePlay'));
    },

    'btn-speed-up': () => {
      const slider = document.getElementById('speed-slider') as HTMLInputElement;
      if (slider) {
        slider.value = String(Math.min(10, Number(slider.value) + 1));
        updateSpeed();
      }
    },

    'btn-speed-down': () => {
      const slider = document.getElementById('speed-slider') as HTMLInputElement;
      if (slider) {
        slider.value = String(Math.max(1, Number(slider.value) - 1));
        updateSpeed();
      }
    },

    'btn-zoom-in': () => {
      document.dispatchEvent(new CustomEvent('solarkids:zoom', { detail: { delta: 1.2 } }));
      showToast('🔍 放大');
    },

    'btn-zoom-out': () => {
      document.dispatchEvent(new CustomEvent('solarkids:zoom', { detail: { delta: 0.8 } }));
      showToast('🔎 缩小');
    },

    'btn-reset-view': () => {
      document.dispatchEvent(new CustomEvent('solarkids:resetView'));
      showToast('🏠 视角已重置');
    },

    'btn-view-overview': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showOverview'));
      canvasInteractions?.showOverview();
      setActiveExperience('overview');
      showToast('🌌 已切换到太阳系总览');
    },

    'btn-view-earth': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showOverview'));
      const switched = canvasInteractions?.showEarthFirstPerson() ?? false;
      if (
        switched &&
        canvasRuntime &&
        (canvasRuntime.animation.status === 'idle' ||
          canvasRuntime.animation.status === 'stopped')
      ) {
        canvasRuntime.animation.start();
        setPlayButtonState(true);
      }
      if (switched) setActiveExperience('earth-first-person');
      showToast(
        switched
          ? '🌍 已站在地球表面观察天空'
          : '地表视角仅在太阳系总览中可用'
      );
    },

    'btn-toggle-orbits': el => {
      const button = el as HTMLButtonElement;
      const visible = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(visible));
      document.dispatchEvent(
        new CustomEvent('solarkids:toggleOrbits', {
          detail: { visible },
        })
      );
      showToast(visible ? '🪐 已显示轨道' : '🪐 已隐藏轨道');
    },

    'btn-eclipse': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showEclipse'));
      setActiveExperience('eclipse');
      showToast('🌑 日食/月食模拟');
    },

    'btn-comet': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showComet'));
      setActiveExperience('comet');
      showToast('☄️ 哈雷彗星模拟');
    },

    'btn-magnetic': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showMagnetic'));
      setActiveExperience('magnetic');
      showToast('🧲 磁场演示');
    },

    'btn-solar-rain': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showSolarRain'));
      setActiveExperience('solar-rain');
      showToast('🌧️ 太阳雨入口已预留，现象动画待实现');
    },

    'btn-skin': () => {
      if (skinsConfig) {
        showSkinPicker(skinsConfig, async (skinId, skinConfig) => {
          console.log(`🎨 切换皮肤: ${skinConfig.name}`);
          showToast(`已切换为 ${skinConfig.name}`);

          // 预加载新皮肤素材
          skinsConfig!.activeSkin = skinId;
          await preloadAllAssets(skinsConfig!);
          currentSkinType = skinConfig.type;
          setSkinType(currentSkinType);
          setPanelSkinType(currentSkinType);
          console.log(`🖼️ 渲染器皮肤: ${currentSkinType}`);

          // 通知 Canvas 重绘
          document.dispatchEvent(
            new CustomEvent('solarkids:skinChange', {
              detail: { skinId, skinConfig },
            })
          );
          canvasRuntime?.renderOnce();
        });
      }
    },

    'btn-lang': () => {
      // TODO: 成员4 填充多语言切换
      showToast('🌐 语言切换（待成员4实现）');
    },

    'btn-help': () => {
      showHelpModal();
    },
  });

  // 速度滑块变化
  const slider = document.getElementById('speed-slider');
  if (slider) {
    slider.addEventListener('input', updateSpeed);
  }
}

function setPlayButtonState(isPlaying: boolean): void {
  const button = document.getElementById('btn-play') as HTMLButtonElement | null;
  if (!button) return;
  button.setAttribute('aria-pressed', String(isPlaying));
  const icon = button.querySelector<HTMLImageElement>('.control-icon');
  if (icon) {
    icon.src = isPlaying
      ? 'assets/svg/icon-pause.svg'
      : 'assets/svg/icon-play.svg';
  }
}

function updateSpeed(): void {
  const slider = document.getElementById('speed-slider') as HTMLInputElement;
  if (!slider) return;
  const speed = Number(slider.value);
  document.dispatchEvent(
    new CustomEvent('solarkids:speedChange', { detail: { speed } })
  );
}

// ---- 帮助弹窗 ----

function showHelpModal(): void {
  // 使用动态 import 避免循环依赖
  import('./ui/index.js').then(({ showModal }) => {
    showModal(
      '❓ 操作帮助',
      `
      <div style="line-height:2;">
        <p><b>🖱️ 鼠标/单指拖拽</b> — 在总览中旋转太阳系</p>
        <p><b>⇧ Shift + 鼠标拖拽</b> — 平移画面</p>
        <p><b>🖱️ 滚轮</b> — 以指针位置为中心缩放</p>
        <p><b>🤏 双指手势</b> — 平移和缩放</p>
        <p><b>👆 点击天体</b> — 查看详情</p>
        <p><b>🌌 太阳系总览/地表视角</b> — 切换太阳系与地表观察</p>
        <p><b>🖱️ 地表视角拖拽</b> — 环顾天空，滚轮调整视野</p>
        <p><b>⌨️ 键盘</b> — 方向键平移，+/- 缩放，0/E 切换视角</p>
        <p><b>▶️ 播放/暂停</b> — 控制动画</p>
        <p><b>⏩ 速度滑块</b> — 调整运行速度</p>
        <p><b>🎨 换肤按钮</b> — 切换卡通/写实模式</p>
        <p><b>🌐 语言按钮</b> — 中英文切换</p>
      </div>
      `
    );
  });
}

// ---- Canvas 公共运行时（成员3：核心动画负责人） ----

function initCanvas(): void {
  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const container = document.getElementById('canvas-container');
  if (!canvas || !container) return;

  canvasRuntime = createCanvasRuntime({
    canvas,
    container,
    autoClear: true,
    animation: {
      timeScale: 1,
      maxDeltaMs: 100,
    },
    camera: {
      minZoom: 0.5,
      maxZoom: 4,
    },
  });

  // 注册成员1专题与成员3场景；所有动画由公共运行时统一调度。
  unregisterMember1Scenes?.();
  unregisterMember1Scenes = registerMember1Scenes(canvasRuntime, {
    getSkinType: () => (currentSkinType === 'realistic' ? 'png' : 'svg'),
  });

  unbindCanvasControls?.();
  unbindCanvasControls = bindCanvasControlEvents(canvasRuntime);
  unbindAnimationStatus?.();
  unbindAnimationStatus = canvasRuntime.animation.onStateChange(status => {
    setPlayButtonState(status === 'running');
  });
  canvasRuntime.scenes.register(
    createSolarSystemScene({ updatePanel, showToast })
  );
  canvasRuntime.scenes.register(
    createCometScene({ updatePanel, showToast })
  );
  canvasRuntime.scenes.switchTo('solar-system');
  canvasInteractions?.dispose();
  canvasInteractions = new CanvasInteractionController(canvasRuntime, {
    onViewChange: updateViewControls,
  });

  unbindSceneSync?.();
  unbindSceneSync = canvasRuntime.scenes.onChange(({ sceneId }) => {
    if (isExperienceId(sceneId)) {
      setActiveExperience(sceneId);
    }
    updateTopicPanel(sceneId);
  });

  const redrawSceneAssets = (): void => {
    canvasRuntime?.renderOnce();
  };
  document.addEventListener('solarkids:sceneAssetReady', redrawSceneAssets);

  window.addEventListener(
    'beforeunload',
    () => {
      canvasInteractions?.dispose();
      canvasInteractions = null;
      unbindAnimationStatus?.();
      unbindAnimationStatus = null;
      document.removeEventListener(
        'solarkids:sceneAssetReady',
        redrawSceneAssets
      );
      unbindSceneSync?.();
      unbindSceneSync = null;
      unbindCanvasControls?.();
      unbindCanvasControls = null;
      unregisterMember1Scenes?.();
      unregisterMember1Scenes = null;
      canvasRuntime?.dispose();
      canvasRuntime = null;
    },
    { once: true }
  );
}

function updateViewControls(view: Readonly<CanvasViewState>): void {
  const labels: Record<string, string> = {
    overview: '太阳系总览',
    focus: `聚焦 · ${getBodyLabel(view.focusTargetId)}`,
    'earth-first-person': '地球地表观察',
  };
  const status = document.getElementById('canvas-view-status');
  if (status) {
    status.textContent = `视角：${labels[view.mode]}`;
  }

  const sceneId = canvasRuntime?.scenes.activeSceneId;
  if (sceneId === 'solar-system') {
    setActiveExperience(
      view.mode === 'earth-first-person' ? 'earth-first-person' : 'overview'
    );
  } else if (isExperienceId(sceneId)) {
    setActiveExperience(sceneId);
  }
}

function setActiveExperience(activeId: ExperienceId): void {
  for (const [buttonId, experienceId] of EXPERIENCE_BUTTONS) {
    const button = document.getElementById(buttonId);
    button?.setAttribute(
      'aria-pressed',
      String(experienceId === activeId)
    );
  }
}

function isExperienceId(value: string | null | undefined): value is ExperienceId {
  return EXPERIENCE_BUTTONS.some(([, experienceId]) => experienceId === value);
}

function getBodyLabel(bodyId: string | null): string {
  const labels: Record<string, string> = {
    sun: '太阳',
    mercury: '水星',
    venus: '金星',
    earth: '地球',
    moon: '月球',
    mars: '火星',
    jupiter: '木星',
    saturn: '土星',
    uranus: '天王星',
    neptune: '海王星',
    comet: '哈雷彗星',
  };
  return bodyId ? labels[bodyId] ?? bodyId : '天体';
}

function updateTopicPanel(sceneId: string | null): void {
  if (sceneId === 'eclipse') {
    updatePanel({
      id: 'eclipse',
      name: 'Eclipse Lab',
      nameCN: '日食与月食实验室',
      emoji: '🌑',
      desc: '切换日食、月食和观察视角，看看太阳、地球、月球排成一线时光影如何变化。',
      stats: [
        { label: '快捷键', value: '1 / 2 切换' },
        { label: '视角', value: 'V 键切换' },
      ],
    });
  } else if (sceneId === 'magnetic') {
    updatePanel({
      id: 'magnetic',
      name: 'Magnetic Field Lab',
      nameCN: '太阳与地球磁场',
      emoji: '🧲',
      desc: '发光粒子沿磁力线运动，帮助观察太阳磁场与地球磁场保护屏障。',
      stats: [
        { label: '模式', value: '太阳 / 地球' },
        { label: '快捷键', value: '1 / 2 / 3' },
      ],
    });
  }
}

// ---- 存储占位（成员4：数据存储负责人） ----

function initStorage(): void {
  // TODO: 成员4 填充 LocalStorage 模块
  // 建议调用: import { initStorage } from './storage/index';
}

// ---- 启动 ----

document.addEventListener('DOMContentLoaded', init);
