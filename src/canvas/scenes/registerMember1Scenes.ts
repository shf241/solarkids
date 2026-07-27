import type { CanvasRuntime } from '../CanvasRuntime.js';
import type { SkinType } from '../../ui/assetLoader.js';
import { createEclipseScene } from './eclipseScene.js';
import { createMagneticScene } from './magneticScene.js';

export interface Member1SceneOptions {
  getSkinType: () => SkinType;
  translate: (key: string) => string;
}

/**
 * 注册成员1负责的日月食与磁场专题。
 * 返回统一解绑函数，应用销毁时调用。
 */
export function registerMember1Scenes(
  runtime: CanvasRuntime,
  options: Member1SceneOptions
): () => void {
  const unregisterEclipse = runtime.scenes.register(
    createEclipseScene(options)
  );
  const unregisterMagnetic = runtime.scenes.register(
    createMagneticScene(options)
  );

  return () => {
    unregisterMagnetic();
    unregisterEclipse();
  };
}
