import type { CanvasRuntime } from './CanvasRuntime.js';

const SPEED_LEVELS = [0.25, 0.4, 0.6, 0.8, 1, 1.25, 1.5, 2, 3, 4] as const;

export function speedLevelToTimeScale(level: number): number {
  const index = Math.min(
    SPEED_LEVELS.length - 1,
    Math.max(0, Math.round(level) - 1)
  );
  return SPEED_LEVELS[index];
}

/**
 * 兼容现有 UI 的 DOM 事件，后续 UI 也可以直接调用 runtime 公共 API。
 * 返回解绑函数，场景销毁时必须调用。
 */
export function bindCanvasControlEvents(
  runtime: CanvasRuntime,
  target: Document = document
): () => void {
  const onTogglePlay: EventListener = () => runtime.animation.toggle();
  const onSpeedChange: EventListener = event => {
    const level =
      (event as CustomEvent<{ speed?: number }>).detail?.speed ?? 5;
    runtime.animation.setTimeScale(speedLevelToTimeScale(level));
  };
  const onZoom: EventListener = event => {
    const factor =
      (event as CustomEvent<{ delta?: number }>).detail?.delta ?? 1;
    runtime.camera.zoomBy(factor);
  };
  const onResetView: EventListener = () => runtime.camera.reset();
  const onShowEclipse: EventListener = () =>
    toggleIfRegistered(runtime, 'eclipse');
  const onShowComet: EventListener = () =>
    toggleIfRegistered(runtime, 'comet');
  const onShowMagnetic: EventListener = () =>
    toggleIfRegistered(runtime, 'magnetic');
  const onShowSolarWind: EventListener = () =>
    toggleIfRegistered(runtime, 'solar-wind');
  const onShowOrbitGame: EventListener = () =>
    toggleIfRegistered(runtime, 'orbit-game');
  const onSkinChange: EventListener = event => {
    runtime.events.emit(
      'skinChange',
      (event as CustomEvent<unknown>).detail
    );
  };

  const bindings: Array<[string, EventListener]> = [
    ['solarkids:togglePlay', onTogglePlay],
    ['solarkids:speedChange', onSpeedChange],
    ['solarkids:zoom', onZoom],
    ['solarkids:resetView', onResetView],
    ['solarkids:showEclipse', onShowEclipse],
    ['solarkids:showComet', onShowComet],
    ['solarkids:showMagnetic', onShowMagnetic],
    ['solarkids:showSolarWind', onShowSolarWind],
    ['solarkids:showOrbitGame', onShowOrbitGame],
    ['solarkids:skinChange', onSkinChange],
  ];

  for (const [type, listener] of bindings) {
    target.addEventListener(type, listener);
  }

  return () => {
    for (const [type, listener] of bindings) {
      target.removeEventListener(type, listener);
    }
  };
}

function toggleIfRegistered(runtime: CanvasRuntime, sceneId: string): void {
  if (runtime.scenes.has(sceneId)) {
    runtime.scenes.switchTo(
      runtime.scenes.activeSceneId === sceneId ? null : sceneId
    );
  }
}
