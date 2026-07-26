/**
 * 换肤面板
 * 提供卡通/写实两套皮肤切换的 UI
 */

import { showModal } from './index.js';
import type { SkinsData, SkinConfig } from './assetLoader.js';
import { getSkinList, clearAssetCache } from './assetLoader.js';

/** 弹出换肤选择面板 */
export function showSkinPicker(
  config: SkinsData,
  onSwitch: (skinId: string, skinConfig: SkinConfig) => void
): void {
  const currentId = config.activeSkin;
  const skins = getSkinList(config);

  const skinCards = skins
    .map(
      s => `
      <div class="skin-card ${s.id === currentId ? 'skin-card--active' : ''}"
           data-skin-id="${s.id}">
        <div class="skin-card__preview">
          ${getSkinPreviewEmoji(s.id)}
        </div>
        <div class="skin-card__name">${s.name}</div>
        ${s.id === currentId ? '<span class="badge">当前</span>' : ''}
      </div>`
    )
    .join('');

  const content = `
    <div class="skin-picker">
      <p class="tooltip" style="margin-bottom:var(--space-md)">
        选择一套皮肤，太阳系会立刻换上新装 ✨
      </p>
      <div class="skin-picker__grid">${skinCards}</div>
      <p class="tooltip" style="margin-top:var(--space-md)">
        💡 两种模式共享球面动画，只替换天体、光环和星空纹理
      </p>
    </div>
  `;

  const modal = showModal('🎨 天体换肤', content);

  // 绑定点击事件
  modal.querySelectorAll('.skin-card').forEach(card => {
    card.addEventListener('click', () => {
      const skinId = (card as HTMLElement).dataset.skinId;
      if (!skinId || skinId === config.activeSkin) return;

      // 更新配置
      config.activeSkin = skinId;
      clearAssetCache();

      // 通知外部
      const newSkin = config.skins[skinId];
      onSwitch(skinId, newSkin);

      // 刷新面板 UI
      modal.querySelectorAll('.skin-card').forEach(c => {
        const id = (c as HTMLElement).dataset.skinId;
        c.classList.toggle('skin-card--active', id === skinId);
        const badge = c.querySelector('.badge');
        if (id === skinId && !badge) {
          const b = document.createElement('span');
          b.className = 'badge';
          b.textContent = '当前';
          c.appendChild(b);
        }
      });
    });
  });
}

function getSkinPreviewEmoji(id: string): string {
  return id === 'cartoon' ? '🌈 🎨 ⭐' : '🔭 🌍 📸';
}

// ---- 换肤卡片样式（注入到 document） ----

const SKIN_STYLE_ID = 'solarkids-skin-style';

export function injectSkinStyles(): void {
  if (document.getElementById(SKIN_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SKIN_STYLE_ID;
  style.textContent = `
    .skin-picker__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-md);
    }
    .skin-card {
      background: var(--color-space-deep);
      border: 2px solid rgba(255,255,255,0.08);
      border-radius: var(--radius-lg);
      padding: var(--space-lg) var(--space-md);
      text-align: center;
      cursor: pointer;
      transition: all var(--transition-base);
      position: relative;
    }
    .skin-card:hover {
      border-color: var(--color-accent);
      transform: translateY(-2px);
      box-shadow: var(--shadow-glow-blue);
    }
    .skin-card--active {
      border-color: var(--color-sun-yellow);
      box-shadow: var(--shadow-glow-yellow);
    }
    .skin-card__preview {
      font-size: 2rem;
      margin-bottom: var(--space-sm);
    }
    .skin-card__name {
      font-size: var(--font-sm);
      font-weight: 600;
      margin-bottom: var(--space-xs);
    }
    .skin-card .badge {
      position: absolute;
      top: var(--space-sm);
      right: var(--space-sm);
      background: var(--color-sun-yellow);
      color: #060b1f;
    }

    @media (max-width: 767px) {
      .skin-picker__grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}
