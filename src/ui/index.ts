/**
 * SolarKids UI 模块
 * 成员2：UI 视觉与响应式负责人
 *
 * 包含：面板管理、弹窗系统、陀螺仪提示、响应式检测
 */

// ---- 类型定义 ----

export interface PlanetInfo {
  id?: string;
  name: string;
  nameCN: string;
  emoji: string;
  desc: string;
  stats: { label: string; value: string }[];
  sections?: { title: string; content: string }[];
  actions?: {
    id: string;
    label: string;
    variant?: 'primary' | 'secondary';
  }[];
}

// ---- 面板管理 ----

type PanelSkinType = 'cartoon' | 'realistic';

let panelSkinType: PanelSkinType = 'cartoon';
let activePanelInfo: PlanetInfo | null = null;
const PANEL_ICON_BODY_IDS = new Set([
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
]);

/** 换肤时同步更新侧栏标题图标，不重建百科正文。 */
export function setPanelSkinType(type: PanelSkinType): void {
  panelSkinType = type;
  const nameEl = document.getElementById('planet-name');
  if (nameEl) renderPanelTitle(nameEl, activePanelInfo);
}

/** 更新侧边面板显示的行星信息 */
export function updatePanel(info: PlanetInfo | null): void {
  const sidePanel = document.getElementById('side-panel');
  const nameEl = document.getElementById('planet-name');
  const descEl = document.getElementById('planet-desc');
  const statsEl = document.getElementById('planet-stats');
  const sectionsEl = document.getElementById('planet-sections');
  const actionsEl = document.getElementById('planet-actions');

  if (
    !sidePanel ||
    !nameEl ||
    !descEl ||
    !statsEl ||
    !sectionsEl ||
    !actionsEl
  ) {
    return;
  }

  activePanelInfo = info;
  sidePanel.classList.toggle(
    'side-panel--detail',
    Boolean(info?.sections?.length)
  );
  if (!info) {
    renderPanelTitle(nameEl, null);
    descEl.textContent = '点击画布中的天体，查看详细信息';
    statsEl.innerHTML = '';
    sectionsEl.innerHTML = '';
    actionsEl.innerHTML = '';
    return;
  }

  renderPanelTitle(nameEl, info);
  descEl.textContent = info.desc;
  statsEl.innerHTML = info.stats
    .map(
      s => `
      <div class="planet-info__stat">
        <div class="planet-info__stat-label">${s.label}</div>
        <div class="planet-info__stat-value">${s.value}</div>
      </div>`
    )
    .join('');
  sectionsEl.innerHTML = (info.sections ?? [])
    .map(
      section => `
        <section class="planet-info__section">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.content)}</p>
        </section>
      `
    )
    .join('');
  actionsEl.innerHTML = (info.actions ?? [])
    .map(
      action => `
        <button
          class="planet-info__action ${
            action.variant === 'secondary'
              ? 'planet-info__action--secondary'
              : ''
          }"
          type="button"
          data-panel-action="${escapeHtml(action.id)}"
        >
          ${escapeHtml(action.label)}
        </button>
      `
    )
    .join('');
  for (const button of actionsEl.querySelectorAll<HTMLButtonElement>(
    '[data-panel-action]'
  )) {
    button.addEventListener('click', () => {
      document.dispatchEvent(
        new CustomEvent('solarkids:panelAction', {
          detail: {
            actionId: button.dataset.panelAction,
            bodyId: info.id,
          },
        })
      );
    });
  }
}

function renderPanelTitle(
  nameEl: HTMLElement,
  info: PlanetInfo | null
): void {
  const bodyId = info?.id ?? 'earth';
  const iconSrc = getPanelIconSource(bodyId);
  nameEl.classList.add('planet-info__title');
  nameEl.replaceChildren();

  if (iconSrc) {
    const icon = document.createElement('img');
    icon.className = 'planet-info__title-icon';
    icon.src = iconSrc;
    icon.alt = '';
    icon.decoding = 'async';
    nameEl.appendChild(icon);
  } else if (info?.emoji) {
    const emoji = document.createElement('span');
    emoji.className = 'planet-info__title-emoji';
    emoji.textContent = info.emoji;
    nameEl.appendChild(emoji);
  }

  const label = document.createElement('span');
  label.className = 'planet-info__title-text';
  label.textContent = info?.nameCN ?? '选择一颗行星';
  nameEl.appendChild(label);
}

function getPanelIconSource(bodyId: string): string | null {
  if (bodyId === 'comet') return 'assets/svg/halley.svg';
  if (!PANEL_ICON_BODY_IDS.has(bodyId)) return null;
  return panelSkinType === 'cartoon'
    ? `assets/svg/${bodyId}.svg`
    : `assets/images/${bodyId}.png`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character
  );
}

// ---- 弹窗（Modal）系统 ----

/** 创建并显示弹窗 */
export function showModal(title: string, content: string, onClose?: () => void): HTMLElement {
  const container = document.getElementById('modal-container');
  if (!container) throw new Error('modal-container not found');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h2 class="modal__title">${title}</h2>
    <div class="modal__body">${content}</div>
    <button class="modal__close">✕</button>
  `;

  overlay.appendChild(modal);
  container.appendChild(overlay);

  const close = () => {
    overlay.remove();
    onClose?.();
  };

  modal.querySelector('.modal__close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  // ESC 关闭
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  return modal;
}

/** 关闭所有弹窗 */
export function closeAllModals(): void {
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
}

// ---- Toast 提示 ----

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** 显示底部浮动提示 */
export function showToast(message: string, duration = 2000): void {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  toastTimer = setTimeout(() => toast.remove(), duration);
}

// ---- 响应式检测 ----

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/** 获取当前设备类型 */
export function getDeviceType(): DeviceType {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/** 监听设备类型变化 */
export function onDeviceChange(cb: (type: DeviceType) => void): void {
  let current = getDeviceType();
  window.addEventListener('resize', () => {
    const next = getDeviceType();
    if (next !== current) {
      current = next;
      cb(next);
    }
  });
}

// ---- 控制栏按钮辅助 ----

/** 为控制栏按钮快速绑定事件 */
export function bindBtn(id: string, action: (el: HTMLElement) => void): void {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', () => action(el));
  }
}

/** 为所有控制栏按钮批量绑定 */
export function bindControls(
  handlers: Partial<Record<string, (el: HTMLElement) => void>>
): void {
  Object.entries(handlers).forEach(([id, fn]) => {
    if (fn) bindBtn(id, fn);
  });
}
