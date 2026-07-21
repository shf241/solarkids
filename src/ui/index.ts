/**
 * SolarKids UI 模块
 * 成员2：UI 视觉与响应式负责人
 *
 * 包含：面板管理、弹窗系统、陀螺仪提示、响应式检测
 */

// ---- 类型定义 ----

export interface PlanetInfo {
  name: string;
  nameCN: string;
  emoji: string;
  desc: string;
  stats: { label: string; value: string }[];
}

// ---- 面板管理 ----

/** 更新侧边面板显示的行星信息 */
export function updatePanel(info: PlanetInfo | null): void {
  const nameEl = document.getElementById('planet-name');
  const descEl = document.getElementById('planet-desc');
  const statsEl = document.getElementById('planet-stats');

  if (!nameEl || !descEl || !statsEl) return;

  if (!info) {
    nameEl.textContent = '🌍 选择一颗行星';
    descEl.textContent = '点击画布中的天体，查看详细信息';
    statsEl.innerHTML = '';
    return;
  }

  nameEl.textContent = `${info.emoji} ${info.nameCN}`;
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
