import type { CanvasRuntime } from '../CanvasRuntime.js';
import { createEclipseScene } from './eclipseScene.js';
import { createMagneticScene } from './magneticScene.js';

/**
 * 注册成员1负责的日月食与磁场专题。
 * 返回统一解绑函数，应用销毁时调用。
 */
export function registerMember1Scenes(runtime: CanvasRuntime): () => void {
  const unregisterEclipse = runtime.scenes.register(createEclipseScene());
  const unregisterMagnetic = runtime.scenes.register(createMagneticScene());

  return () => {
    unregisterMagnetic();
    unregisterEclipse();
  };
}
