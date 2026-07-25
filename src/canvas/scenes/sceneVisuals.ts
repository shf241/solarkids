import type { Point2D } from '../types.js';
import {
  getCachedImage,
  type PlanetId,
  type SkinType,
} from '../../ui/assetLoader.js';

export interface SceneButton {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawSpaceBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent = '#243a73'
): void {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    20,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  gradient.addColorStop(0, accent);
  gradient.addColorStop(0.52, '#101a40');
  gradient.addColorStop(1, '#040817');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < 110; index += 1) {
    const x = pseudoRandom(index * 7 + 11) * width;
    const y = pseudoRandom(index * 13 + 29) * height;
    const radius = 0.45 + pseudoRandom(index * 19 + 3) * 1.25;
    const alpha = 0.2 + pseudoRandom(index * 23 + 5) * 0.55;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawSceneHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  title: string,
  subtitle: string,
  accent: string
): void {
  const compact = width < 620;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${compact ? 20 : 26}px "Microsoft YaHei", sans-serif`;
  ctx.fillText(title, compact ? 18 : 28, compact ? 16 : 22);

  ctx.fillStyle = accent;
  ctx.fillRect(compact ? 18 : 28, compact ? 47 : 58, compact ? 42 : 54, 3);

  ctx.fillStyle = 'rgba(220, 231, 255, 0.78)';
  ctx.font = `${compact ? 11 : 13}px "Microsoft YaHei", sans-serif`;
  ctx.fillText(
    subtitle,
    compact ? 70 : 94,
    compact ? 41 : 51,
    Math.max(120, width - (compact ? 88 : 120))
  );
}

export function createToolbarButtons(
  width: number,
  labels: ReadonlyArray<{ id: string; label: string }>,
  y = 78
): SceneButton[] {
  const compact = width < 620;
  const gap = compact ? 6 : 8;
  const availableWidth = Math.min(width - (compact ? 24 : 48), 560);
  const buttonWidth = Math.max(
    compact ? 64 : 82,
    (availableWidth - gap * (labels.length - 1)) / labels.length
  );
  const totalWidth = buttonWidth * labels.length + gap * (labels.length - 1);
  const startX = Math.max(compact ? 12 : 24, (width - totalWidth) / 2);
  const height = compact ? 32 : 36;

  return labels.map((item, index) => ({
    ...item,
    x: startX + index * (buttonWidth + gap),
    y: compact ? y - 6 : y,
    width: buttonWidth,
    height,
  }));
}

export function drawToolbar(
  ctx: CanvasRenderingContext2D,
  buttons: readonly SceneButton[],
  activeIds: ReadonlySet<string>,
  accent: string
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 13px "Microsoft YaHei", sans-serif';

  for (const button of buttons) {
    const active = activeIds.has(button.id);
    roundedRect(ctx, button.x, button.y, button.width, button.height, 10);
    ctx.fillStyle = active ? accent : 'rgba(15, 25, 60, 0.82)';
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255,255,255,0.72)' : 'rgba(165,190,240,0.3)';
    ctx.lineWidth = active ? 1.5 : 1;
    ctx.stroke();
    ctx.fillStyle = active ? '#08132f' : '#dce8ff';
    ctx.fillText(
      button.label,
      button.x + button.width / 2,
      button.y + button.height / 2
    );
  }
}

export function hitButton(
  buttons: readonly SceneButton[],
  point: Point2D
): SceneButton | null {
  return (
    buttons.find(
      button =>
        point.x >= button.x &&
        point.x <= button.x + button.width &&
        point.y >= button.y &&
        point.y <= button.y + button.height
    ) ?? null
  );
}

export function getCanvasPoint(
  canvas: HTMLCanvasElement,
  event: PointerEvent
): Point2D {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function drawTimeline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  labels: readonly [string, string, string],
  accent: string
): void {
  const left = Math.max(24, width * 0.12);
  const right = Math.min(width - 24, width * 0.88);
  const y = height - (width < 620 ? 34 : 42);
  const normalized = clamp(progress, 0, 1);

  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(181, 202, 240, 0.22)';
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();

  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left + (right - left) * normalized, y);
  ctx.stroke();

  const markerX = left + (right - left) * normalized;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(markerX, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = '11px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(220, 231, 255, 0.72)';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(labels[0], left, y - 8);
  ctx.textAlign = 'center';
  ctx.fillText(labels[1], (left + right) / 2, y - 8);
  ctx.textAlign = 'right';
  ctx.fillText(labels[2], right, y - 8);
}

export function drawInfoChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  accent: string
): void {
  ctx.font = '600 12px "Microsoft YaHei", sans-serif';
  const width = ctx.measureText(text).width + 24;
  roundedRect(ctx, x, y, width, 30, 15);
  ctx.fillStyle = 'rgba(7, 14, 38, 0.82)';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#eef5ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + 15);
}

export function drawBodyLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number
): void {
  ctx.font = '600 13px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(239, 245, 255, 0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

export function drawSkinnedBody(
  ctx: CanvasRenderingContext2D,
  planetId: PlanetId,
  skinType: SkinType,
  x: number,
  y: number,
  radius: number
): boolean {
  const image = getCachedImage(planetId, skinType);
  if (!image || !image.complete || image.naturalWidth <= 0) return false;

  const scale = planetId === 'sun' ? 2.45 : 2;
  const size = radius * scale;
  ctx.save();
  ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
  ctx.restore();
  return true;
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
