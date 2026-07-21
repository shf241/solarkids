/**
 * SolarKids 主入口
 * 负责初始化各模块并启动应用
 */

import {
  showToast,
  getDeviceType,
  onDeviceChange,
  updatePanel,
  bindControls,
} from './ui/index.js';
import { loadSkinsConfig, preloadAllAssets, type SkinsData } from './ui/assetLoader.js';
import { showSkinPicker, injectSkinStyles } from './ui/skinPicker.js';
import { initSolarSystemPreview } from './ui/solarSystemPreview.js';

// ---- 全局状态 ----

let skinsConfig: SkinsData | null = null;
let currentPlanet: string | null = null;

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
      const isPaused = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(isPaused));
      const icon = btn.querySelector<HTMLImageElement>('.control-icon');
      if (icon) {
        icon.src = isPaused ? 'assets/svg/icon-pause.svg' : 'assets/svg/icon-play.svg';
      }
      showToast(isPaused ? '▶️ 已播放' : '⏸️ 已暂停');
      // TODO: 通知成员3的 Canvas 动画
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

    'btn-eclipse': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showEclipse'));
      showToast('🌑 日食/月食模拟');
    },

    'btn-comet': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showComet'));
      showToast('☄️ 哈雷彗星模拟');
    },

    'btn-magnetic': () => {
      document.dispatchEvent(new CustomEvent('solarkids:showMagnetic'));
      showToast('🧲 磁场演示');
    },

    'btn-skin': () => {
      if (skinsConfig) {
        showSkinPicker(skinsConfig, (skinId, skinConfig) => {
          console.log(`🎨 切换皮肤: ${skinConfig.name}`);
          showToast(`已切换为 ${skinConfig.name}`);

          // 通知 Canvas 重绘
          document.dispatchEvent(
            new CustomEvent('solarkids:skinChange', {
              detail: { skinId, skinConfig },
            })
          );
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
        <p><b>🖱️ 鼠标拖拽</b> — 旋转视角</p>
        <p><b>🖱️ 滚轮</b> — 缩放画面</p>
        <p><b>👆 点击天体</b> — 查看详情</p>
        <p><b>▶️ 播放/暂停</b> — 控制动画</p>
        <p><b>⏩ 速度滑块</b> — 调整运行速度</p>
        <p><b>🎨 换肤按钮</b> — 切换卡通/写实模式</p>
        <p><b>🌐 语言按钮</b> — 中英文切换</p>
      </div>
      `
    );
  });
}

// ---- Canvas 占位（成员3：核心动画负责人） ----

function initCanvas(): void {
  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const container = document.getElementById('canvas-container');
  if (!canvas || !container) return;

  initSolarSystemPreview(canvas, container, { updatePanel, showToast });
}

// ---- 存储占位（成员4：数据存储负责人） ----

function initStorage(): void {
  // TODO: 成员4 填充 LocalStorage 模块
  // 建议调用: import { initStorage } from './storage/index';
}

// ---- 启动 ----

document.addEventListener('DOMContentLoaded', init);
