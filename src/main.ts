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
  type PlanetInfo,
} from './ui/index.js';
import {
  loadSkinsConfig,
  preloadAllAssets,
  type SkinsData,
  type RenderSkinType,
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
import { registerMember4Scenes } from './canvas/scenes/registerMember4Scenes.js';
import {
  createMember4Integration,
  type Member4Integration,
} from './integration/index.js';

// ---- 全局状态 ----

let skinsConfig: SkinsData | null = null;
let currentSkinType: RenderSkinType = 'cartoon';
let currentPanelInfo: PlanetInfo | null = null;
let member4: Member4Integration | null = null;
let canvasRuntime: CanvasRuntime | null = null;
let canvasInteractions: CanvasInteractionController | null = null;
let unbindCanvasControls: (() => void) | null = null;
let unbindAnimationStatus: (() => void) | null = null;
let unregisterMember1Scenes: (() => void) | null = null;
let unregisterMember4Scenes: (() => void) | null = null;
let unbindSceneSync: (() => void) | null = null;

type ExperienceId =
  | 'overview'
  | 'earth-first-person'
  | 'eclipse'
  | 'comet'
  | 'magnetic'
  | 'solar-rain'
  | 'orbit-game';

const EXPERIENCE_BUTTONS: ReadonlyArray<readonly [string, ExperienceId]> = [
  ['btn-view-overview', 'overview'],
  ['btn-view-earth', 'earth-first-person'],
  ['btn-eclipse', 'eclipse'],
  ['btn-comet', 'comet'],
  ['btn-magnetic', 'magnetic'],
  ['btn-solar-rain', 'solar-rain'],
  ['btn-orbit-game', 'orbit-game'],
];

// ---- 应用启动 ----

async function init(): Promise<void> {
  console.log('🚀 SolarKids 启动中...');
  console.log(`📱 当前设备: ${getDeviceType()}`);

  // 注入换肤面板的额外样式
  injectSkinStyles();

  member4 = await createMember4Integration();
  member4.applyDocumentLanguage();

  // 加载皮肤配置
  try {
    skinsConfig = await loadSkinsConfig();
    const savedSkinId = member4.getState().skinId;
    if (skinsConfig.skins[savedSkinId]) {
      skinsConfig.activeSkin = savedSkinId;
    } else {
      member4.store.setSkin(skinsConfig.activeSkin);
    }
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
    showToast(
      member4?.getLanguage() === 'en'
        ? `Layout changed to ${type}`
        : `已切换为${type === 'mobile' ? '手机' : type === 'tablet' ? '平板' : '电脑'}布局`
    );
  });

  // 初始化 Canvas（成员3负责填充）
  initCanvas();

  console.log('✅ SolarKids 启动完成');
  prepareWelcomeScreen();
}

function prepareWelcomeScreen(): void {
  const screen = document.getElementById('welcome-screen');
  const app = document.getElementById('app');
  const button = document.getElementById(
    'btn-enter-app'
  ) as HTMLButtonElement | null;
  const buttonLabel = button?.querySelector<HTMLElement>('[data-i18n]');

  if (!screen || !button) {
    app?.removeAttribute('inert');
    showToast(`🌍 ${translate('toast.welcome')}`);
    return;
  }

  if (buttonLabel) {
    buttonLabel.dataset.i18n = 'action.start';
    buttonLabel.textContent = translate('action.start');
  }
  button.disabled = false;
  button.focus({ preventScroll: true });

  button.addEventListener(
    'click',
    () => {
      button.disabled = true;
      screen.classList.add('welcome-screen--leaving');
      document.body.classList.remove('welcome-active');
      app?.removeAttribute('inert');

      if (
        canvasRuntime &&
        (canvasRuntime.animation.status === 'idle' ||
          canvasRuntime.animation.status === 'stopped')
      ) {
        canvasRuntime.animation.start();
        setPlayButtonState(true);
      }

      window.setTimeout(() => {
        screen.remove();
        document.getElementById('main-canvas')?.focus({ preventScroll: true });
        showToast(`🌍 ${translate('toast.welcome')}`);
      }, 560);
    },
    { once: true }
  );
}

// ---- 控制栏绑定 ----

function bindControlBar(): void {
  bindControls({
    'btn-play': el => {
      const btn = el as HTMLButtonElement;
      const isPlaying = btn.getAttribute('aria-pressed') !== 'true';
      setPlayButtonState(isPlaying);
      showToast(
        isPlaying
          ? `▶️ ${translate('toast.play')}`
          : `⏸️ ${translate('toast.pause')}`
      );
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
      showToast(`🔍 ${translate('toast.zoomIn')}`);
    },

    'btn-zoom-out': () => {
      document.dispatchEvent(new CustomEvent('solarkids:zoom', { detail: { delta: 0.8 } }));
      showToast(`🔎 ${translate('toast.zoomOut')}`);
    },

    'btn-reset-view': () => {
      document.dispatchEvent(new CustomEvent('solarkids:resetView'));
      showToast(`🏠 ${translate('toast.resetView')}`);
    },

    'btn-view-overview': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showOverview'));
      canvasInteractions?.showOverview();
      setActiveExperience('overview');
      showToast(`🌌 ${translate('toast.overview')}`);
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
          ? `🌍 ${translate('toast.earthView')}`
          : translate('toast.earthViewUnavailable')
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
      showToast(
        visible
          ? `🪐 ${translate('toast.orbitsShown')}`
          : `🪐 ${translate('toast.orbitsHidden')}`
      );
    },

    'btn-eclipse': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showEclipse'));
      setActiveExperience('eclipse');
      showToast(`🌑 ${translate('nav.eclipse')}`);
    },

    'btn-comet': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showComet'));
      setActiveExperience('comet');
      showToast(`☄️ ${translate('nav.comet')}`);
    },

    'btn-magnetic': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showMagnetic'));
      setActiveExperience('magnetic');
      showToast(`🧲 ${translate('nav.magnetic')}`);
    },

    'btn-solar-rain': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showSolarRain'));
      setActiveExperience('solar-rain');
      showToast(`🌧️ ${translate('nav.solarRain')}`);
    },

    'btn-orbit-game': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showOrbitGame'));
      setActiveExperience('orbit-game');
      showToast(`🎯 ${translate('nav.game')}`);
    },

    'btn-skin': () => {
      if (skinsConfig) {
        showSkinPicker(skinsConfig, async (skinId, skinConfig) => {
          console.log(`🎨 切换皮肤: ${skinConfig.name}`);
          showToast(`🎨 ${translate('toast.skinChanged')}`);

          // 预加载新皮肤素材
          skinsConfig!.activeSkin = skinId;
          member4?.store.setSkin(skinId);
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
        }, translate);
      }
    },

    'btn-lang': () => {
      member4?.toggleLanguage();
      member4?.applyDocumentLanguage();
      renderPanel(currentPanelInfo);
      applyCanvasLanguage();
      canvasRuntime?.renderOnce();
      showToast(`🌐 ${translate('toast.languageChanged')}`);
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
      `❓ ${translate('help.title')}`,
      `
      <div style="line-height:2;">
        <p>🖱️ ${translate('help.drag')}</p>
        <p>⇧ ${translate('help.pan')}</p>
        <p>🔍 ${translate('help.zoom')}</p>
        <p>🤏 ${translate('help.gesture')}</p>
        <p>👆 ${translate('help.planet')}</p>
        <p>🌌 ${translate('help.view')}</p>
        <p>⌨️ ${translate('help.keyboard')}</p>
        <p>▶️ ${translate('help.play')}</p>
        <p>🎨 ${translate('help.skin')}</p>
        <p>🌐 ${translate('help.language')}</p>
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
    getSkinType: getTopicSkinType,
    translate,
  });
  unregisterMember4Scenes?.();
  unregisterMember4Scenes = registerMember4Scenes(canvasRuntime, {
    getSkinType: getTopicSkinType,
    store: member4!.store,
    translate,
  });

  unbindCanvasControls?.();
  unbindCanvasControls = bindCanvasControlEvents(canvasRuntime);
  unbindAnimationStatus?.();
  unbindAnimationStatus = canvasRuntime.animation.onStateChange(status => {
    setPlayButtonState(status === 'running');
  });
  canvasRuntime.scenes.register(
    createSolarSystemScene({ updatePanel: renderPanel, showToast, translate })
  );
  canvasRuntime.scenes.register(
    createCometScene({ updatePanel: renderPanel, showToast, translate })
  );
  canvasRuntime.scenes.switchTo('solar-system');
  canvasInteractions?.dispose();
  canvasInteractions = new CanvasInteractionController(canvasRuntime, {
    onViewChange: updateViewControls,
  });
  applyCanvasLanguage();

  unbindSceneSync?.();
  unbindSceneSync = canvasRuntime.scenes.onChange(({ sceneId }) => {
    setViewStatusVisibility(sceneId === 'solar-system');
    if (isExperienceId(sceneId)) {
      setActiveExperience(sceneId);
    }
    updateTopicPanel(sceneId);
  });

  const redrawSceneAssets = (): void => {
    canvasRuntime?.renderOnce();
  };
  const recordSelectedBody: EventListener = event => {
    const bodyId = (
      event as CustomEvent<{ bodyId?: string }>
    ).detail?.bodyId;
    if (bodyId) member4?.store.markPlanetVisited(bodyId);
  };
  document.addEventListener('solarkids:sceneAssetReady', redrawSceneAssets);
  document.addEventListener('solarkids:bodySelected', recordSelectedBody);

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
      document.removeEventListener(
        'solarkids:bodySelected',
        recordSelectedBody
      );
      unbindSceneSync?.();
      unbindSceneSync = null;
      unbindCanvasControls?.();
      unbindCanvasControls = null;
      unregisterMember1Scenes?.();
      unregisterMember1Scenes = null;
      unregisterMember4Scenes?.();
      unregisterMember4Scenes = null;
      canvasRuntime?.dispose();
      canvasRuntime = null;
    },
    { once: true }
  );
}

function updateViewControls(view: Readonly<CanvasViewState>): void {
  const labels: Record<string, string> = {
    overview: translate('view.overview'),
    focus: `${translate('view.focus')} · ${getBodyLabel(view.focusTargetId)}`,
    'earth-first-person': translate('view.earthFirstPerson'),
  };
  const status = document.getElementById('canvas-view-status');
  if (status) {
    status.textContent = `${translate('view.label')}：${labels[view.mode]}`;
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
  if (!bodyId) return translate('body.celestial');
  if (bodyId === 'comet') return translate('body.comet');
  const key = `planet.${bodyId}.name`;
  const translated = translate(key);
  return translated === key ? bodyId : translated;
}

function setViewStatusVisibility(visible: boolean): void {
  const status = document.getElementById('canvas-view-status');
  if (status) status.hidden = !visible;
}

function updateTopicPanel(sceneId: string | null): void {
  if (sceneId === 'eclipse') {
    renderPanel({
      id: 'scene.eclipse',
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
    renderPanel({
      id: 'scene.magnetic',
      name: 'Magnetic Field Lab',
      nameCN: '太阳与地球磁场',
      emoji: '🧲',
      desc: '发光粒子沿磁力线运动，帮助观察太阳磁场与地球磁场保护屏障。',
      stats: [
        { label: '模式', value: '太阳 / 地球' },
        { label: '快捷键', value: '1 / 2 / 3' },
      ],
    });
  } else if (sceneId === 'solar-rain') {
    renderPanel({
      id: 'scene.solar-rain',
      name: 'Solar Wind Lab',
      nameCN: '太阳风实验室',
      emoji: '☀️',
      desc: '观察太阳风从太阳向外传播，以及地球磁场如何改变带电粒子的路线。',
      stats: [
        { label: '三种观察', value: '辐射 / 屏障 / 极光' },
        { label: '关键概念', value: '带电粒子与磁层' },
      ],
    });
  } else if (sceneId === 'orbit-game') {
    renderPanel({
      id: 'scene.orbit-game',
      name: 'Orbit Explorer Game',
      nameCN: '轨道探索小游戏',
      emoji: '🎯',
      desc: '拖动地球，观察它与原轨道之间的变化。',
      stats: [
        { label: '目标', value: '拖出明显变化' },
        { label: '最高分', value: '100' },
      ],
    });
  }
}

function renderPanel(info: PlanetInfo | null): void {
  currentPanelInfo = info;
  updatePanel(member4?.localizeInfo(info) ?? info);
}

function translate(key: string): string {
  return member4?.translate(key) ?? key;
}

function getTopicSkinType(): 'svg' | 'png' {
  return currentSkinType === 'realistic' ? 'png' : 'svg';
}

function applyCanvasLanguage(): void {
  const canvas = document.getElementById('main-canvas');
  canvas?.setAttribute('aria-label', translate('canvas.ariaLabel'));
  if (canvasInteractions) updateViewControls(canvasInteractions.view);
}

// ---- 启动 ----

document.addEventListener('DOMContentLoaded', init);
