import { UserStateStore } from '../../storage/index.js';
import type { SkinType } from '../../ui/assetLoader.js';
import type { CanvasRuntime } from '../CanvasRuntime.js';
import { createOrbitGameScene } from './orbitGameScene.js';
import { createSolarWindScene } from './solarWindScene.js';

export interface Member4SceneOptions {
  getSkinType: () => SkinType;
  store: UserStateStore;
  translate: (key: string) => string;
}

export function registerMember4Scenes(
  runtime: CanvasRuntime,
  options: Member4SceneOptions,
): () => void {
  const unregisterSolarWind = runtime.scenes.register(
    createSolarWindScene(options),
  );
  const unregisterOrbitGame = runtime.scenes.register(
    createOrbitGameScene(options),
  );

  return () => {
    unregisterOrbitGame();
    unregisterSolarWind();
  };
}
