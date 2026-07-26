import type { Point2D } from './types.js';

const FULL_TURN = Math.PI * 2;
const MIN_RENDER_SIZE = 48;
const MAX_RENDER_SIZE = 512;
const ROTATION_CACHE_STEPS = 120;
const LIGHT_CACHE_STEPS = 180;
const MAX_SOURCE_WIDTH = 1024;

export interface EquirectangularPlanetRendererOptions {
  textureSrc: string;
  /** 自转角速度，单位为弧度/秒。 */
  rotationSpeed: number;
  /** 太阳等自身发光天体不使用太阳方向漫反射。 */
  lightingModel?: 'diffuse' | 'emissive';
}

export interface PlanetSphereDrawOptions {
  hovered?: boolean;
  selected?: boolean;
  /** 从天体中心指向光源的画面角度，单位为弧度。 */
  lightAngle?: number;
  /** 自转轴相对画面竖直方向的倾角，单位为弧度。 */
  axialTilt?: number;
}

type SphereLookup = {
  size: number;
  axialTilt: number;
  orientationX: number;
  orientationY: number;
  orientationZ: number;
  orientationW: number;
  longitude: Float32Array;
  textureV: Float32Array;
  normalX: Float32Array;
  normalY: Float32Array;
  normalZ: Float32Array;
  edgeAlpha: Float32Array;
};

type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type PlanetViewOrientation = Readonly<Quaternion>;

/**
 * 使用 Canvas 2D 将 2:1 等距柱状投影纹理反向映射到可见半球。
 *
 * 输出在自适应分辨率离屏 Canvas 中生成；球面经纬度和法线查找表会复用，
 * 每帧只更新自转经度、纹理采样和基于法线点积的明暗。
 */
export class EquirectangularPlanetRenderer {
  private readonly image = new Image();
  private readonly textureSrc: string;
  private readonly lightingModel: 'diffuse' | 'emissive';
  private readonly renderCanvas = document.createElement('canvas');
  private readonly renderContext: CanvasRenderingContext2D;
  private textureReadyCallback: (() => void) | null = null;
  private textureFailed = false;
  private textureLoading = false;
  private sourcePixels: Uint8ClampedArray | null = null;
  private sourceWidth = 0;
  private sourceHeight = 0;
  private lookup: SphereLookup | null = null;
  private renderImageData: ImageData | null = null;
  private lastRenderKey = '';
  private textureOffsetValue = 0;
  private rotationAngleValue = 0;
  private rotationSpeedValue: number;
  private viewOrientation: Quaternion = {
    x: 0,
    y: 0,
    z: 0,
    w: 1,
  };

  constructor(options: EquirectangularPlanetRendererOptions) {
    this.textureSrc = options.textureSrc;
    this.lightingModel = options.lightingModel ?? 'diffuse';
    this.rotationSpeedValue = options.rotationSpeed;
    const renderContext = this.renderCanvas.getContext('2d', {
      alpha: true,
    });
    if (!renderContext) {
      throw new Error('无法创建行星离屏 Canvas');
    }
    this.renderContext = renderContext;
    this.image.decoding = 'async';
    this.image.onload = () => {
      this.prepareTextureSource();
      this.textureReadyCallback?.();
    };
    this.image.onerror = () => {
      this.markTextureFailed();
    };
  }

  get rotationAngle(): number {
    return this.rotationAngleValue;
  }

  /** 归一化后的纹理经度偏移，范围为 [0, 1)。 */
  get textureOffset(): number {
    return this.textureOffsetValue;
  }

  get rotationSpeed(): number {
    return this.rotationSpeedValue;
  }

  /** 当前由 Arcball 控制的球体朝向，供光环等附属结构同步旋转。 */
  get viewQuaternion(): PlanetViewOrientation {
    return { ...this.viewOrientation };
  }

  set rotationSpeed(value: number) {
    if (!Number.isFinite(value)) {
      throw new TypeError('rotationSpeed 必须是有限数值');
    }
    this.rotationSpeedValue = value;
  }

  setTextureReadyCallback(callback: (() => void) | null): void {
    this.textureReadyCallback = callback;
    if (callback && (this.isTextureReady() || this.textureFailed)) {
      queueMicrotask(callback);
    }
  }

  /** 使用公共动画时钟提供的 deltaTime 更新自转，不依赖公转累计时间。 */
  update(deltaTimeMs: number): void {
    const deltaTimeSeconds = Math.max(0, deltaTimeMs) / 1000;
    const angleDelta = this.rotationSpeedValue * deltaTimeSeconds;
    this.rotationAngleValue = normalizeTurn(
      this.rotationAngleValue + angleDelta
    );
    this.textureOffsetValue = normalizeUnit(
      this.textureOffsetValue + angleDelta / FULL_TURN
    );
  }

  reset(rotationAngle = 0): void {
    this.rotationAngleValue = normalizeTurn(rotationAngle);
    this.textureOffsetValue = this.rotationAngleValue / FULL_TURN;
    this.viewOrientation = { x: 0, y: 0, z: 0, w: 1 };
    this.lookup = null;
    this.lastRenderKey = '';
  }

  /**
   * 虚拟轨迹球旋转：让按下的球面点跟随指针移动，而不是按轴累加角度。
   */
  rotateTrackball(
    from: Readonly<Point2D>,
    to: Readonly<Point2D>
  ): void {
    if (
      !Number.isFinite(from.x) ||
      !Number.isFinite(from.y) ||
      !Number.isFinite(to.x) ||
      !Number.isFinite(to.y)
    ) {
      return;
    }
    const fromVector = projectToTrackball(from);
    const toVector = projectToTrackball(to);
    const delta = quaternionFromUnitVectors(
      fromVector,
      toVector
    );
    this.viewOrientation = normalizeQuaternion(
      multiplyQuaternions(delta, this.viewOrientation)
    );
    this.lookup = null;
    this.lastRenderKey = '';
  }

  draw(
    context2D: CanvasRenderingContext2D,
    center: Readonly<Point2D>,
    radius: number,
    options: PlanetSphereDrawOptions = {}
  ): void {
    if (radius <= 0) return;
    this.ensureTextureLoading();
    this.drawSelectionState(context2D, center, radius, options);

    context2D.save();
    context2D.beginPath();
    context2D.arc(center.x, center.y, radius, 0, FULL_TURN);
    context2D.clip();

    if (this.isTextureReady()) {
      const renderSize = getRenderSize(context2D, radius);
      this.updateSphereBuffer(
        renderSize,
        options.lightAngle ?? -2.35,
        options.axialTilt ?? 0
      );
      context2D.imageSmoothingEnabled = true;
      context2D.imageSmoothingQuality = 'high';
      context2D.drawImage(
        this.renderCanvas,
        center.x - radius,
        center.y - radius,
        radius * 2,
        radius * 2
      );
    } else {
      this.drawFallbackSurface(context2D, center, radius);
    }
    context2D.restore();
  }

  private ensureTextureLoading(): void {
    if (this.textureLoading || this.textureFailed) return;
    this.textureLoading = true;
    this.image.src = this.textureSrc;
  }

  private prepareTextureSource(): void {
    try {
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = Math.min(
        this.image.naturalWidth,
        MAX_SOURCE_WIDTH
      );
      sourceCanvas.height = Math.round(
        sourceCanvas.width *
          (this.image.naturalHeight / this.image.naturalWidth)
      );
      const sourceContext = sourceCanvas.getContext('2d', {
        willReadFrequently: true,
      });
      if (!sourceContext) {
        throw new Error('无法读取行星纹理');
      }
      sourceContext.drawImage(
        this.image,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
      );
      const imageData = sourceContext.getImageData(
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
      );
      this.sourcePixels = imageData.data;
      this.sourceWidth = sourceCanvas.width;
      this.sourceHeight = sourceCanvas.height;
      this.lastRenderKey = '';
    } catch {
      this.markTextureFailed();
    }
  }

  private markTextureFailed(): void {
    this.textureFailed = true;
    console.warn(`行星纹理加载失败: ${this.textureSrc}`);
    this.textureReadyCallback?.();
  }

  private isTextureReady(): boolean {
    return (
      this.sourcePixels !== null &&
      this.sourceWidth > 0 &&
      this.sourceHeight > 0
    );
  }

  private updateSphereBuffer(
    size: number,
    lightAngle: number,
    axialTilt: number
  ): void {
    const rotationStep =
      Math.round(this.textureOffsetValue * ROTATION_CACHE_STEPS) %
      ROTATION_CACHE_STEPS;
    const lightStep =
      this.lightingModel === 'emissive'
        ? 0
        : Math.round(
            normalizeTurn(lightAngle) / FULL_TURN * LIGHT_CACHE_STEPS
          ) % LIGHT_CACHE_STEPS;
    const tiltStep = Math.round(axialTilt * 1000);
    const renderKey = `${size}:${rotationStep}:${lightStep}:${tiltStep}`;
    if (renderKey === this.lastRenderKey) return;

    const quantizedRotation =
      rotationStep / ROTATION_CACHE_STEPS * FULL_TURN;
    const quantizedLightAngle =
      lightStep / LIGHT_CACHE_STEPS * FULL_TURN;
    const lookup = this.getSphereLookup(size, axialTilt);
    const imageData = this.getRenderImageData(size);
    const output = imageData.data;
    const source = this.sourcePixels;
    if (!source) return;

    const lightZ = 0.28;
    const lightLength = Math.hypot(1, lightZ);
    const lightX = Math.cos(quantizedLightAngle) / lightLength;
    const lightY = Math.sin(quantizedLightAngle) / lightLength;
    const normalizedLightZ = lightZ / lightLength;

    for (let index = 0; index < lookup.normalZ.length; index += 1) {
      const outputIndex = index * 4;
      const normalZ = lookup.normalZ[index];
      if (normalZ < 0) {
        output[outputIndex + 3] = 0;
        continue;
      }

      const longitude =
        lookup.longitude[index] + quantizedRotation;
      const textureU = normalizeUnit(longitude / FULL_TURN + 0.5);
      const sourceX = Math.min(
        this.sourceWidth - 1,
        Math.floor(textureU * this.sourceWidth)
      );
      const sourceY = Math.min(
        this.sourceHeight - 1,
        Math.floor(lookup.textureV[index] * this.sourceHeight)
      );
      const sourceIndex =
        (sourceY * this.sourceWidth + sourceX) * 4;

      const diffuse =
        this.lightingModel === 'emissive'
          ? 1
          : Math.max(
              0,
              lookup.normalX[index] * lightX +
                lookup.normalY[index] * lightY +
                normalZ * normalizedLightZ
            );
      const brightness =
        this.lightingModel === 'emissive'
          ? 0.78 + normalZ * 0.22
          : (0.16 + diffuse * 0.84) * (0.7 + normalZ * 0.3);
      const nightBlue =
        this.lightingModel === 'emissive' ? 0 : (1 - diffuse) * 10;

      output[outputIndex] = source[sourceIndex] * brightness;
      output[outputIndex + 1] =
        source[sourceIndex + 1] * brightness + nightBlue * 0.45;
      output[outputIndex + 2] =
        source[sourceIndex + 2] * brightness + nightBlue;
      output[outputIndex + 3] = 255 * lookup.edgeAlpha[index];
    }

    this.renderContext.putImageData(imageData, 0, 0);
    this.lastRenderKey = renderKey;
  }

  private getSphereLookup(size: number, axialTilt: number): SphereLookup {
    if (
      this.lookup &&
      this.lookup.size === size &&
      Math.abs(this.lookup.axialTilt - axialTilt) < 0.0005 &&
      Math.abs(
        this.lookup.orientationX - this.viewOrientation.x
      ) < 0.0005 &&
      Math.abs(
        this.lookup.orientationY - this.viewOrientation.y
      ) < 0.0005 &&
      Math.abs(
        this.lookup.orientationZ - this.viewOrientation.z
      ) < 0.0005 &&
      Math.abs(
        this.lookup.orientationW - this.viewOrientation.w
      ) < 0.0005
    ) {
      return this.lookup;
    }

    const pixelCount = size * size;
    const longitude = new Float32Array(pixelCount);
    const textureV = new Float32Array(pixelCount);
    const normalX = new Float32Array(pixelCount);
    const normalY = new Float32Array(pixelCount);
    const normalZ = new Float32Array(pixelCount);
    const edgeAlpha = new Float32Array(pixelCount);
    normalZ.fill(-1);

    const cosTilt = Math.cos(axialTilt);
    const sinTilt = Math.sin(axialTilt);
    const inverseOrientation = {
      x: -this.viewOrientation.x,
      y: -this.viewOrientation.y,
      z: -this.viewOrientation.z,
      w: this.viewOrientation.w,
    };
    const inverseMatrix = quaternionToMatrix(inverseOrientation);
    for (let y = 0; y < size; y += 1) {
      const screenY = ((y + 0.5) / size) * 2 - 1;
      for (let x = 0; x < size; x += 1) {
        const screenX = ((x + 0.5) / size) * 2 - 1;
        const radiusSquared =
          screenX * screenX + screenY * screenY;
        if (radiusSquared > 1) continue;

        const index = y * size + x;
        const z = Math.sqrt(Math.max(0, 1 - radiusSquared));
        // 先逆变换用户轨迹球方向，再逆变换轴倾角；光照法线保持屏幕方向。
        const orientedX =
          inverseMatrix[0] * screenX +
          inverseMatrix[1] * screenY +
          inverseMatrix[2] * z;
        const orientedY =
          inverseMatrix[3] * screenX +
          inverseMatrix[4] * screenY +
          inverseMatrix[5] * z;
        const orientedZ =
          inverseMatrix[6] * screenX +
          inverseMatrix[7] * screenY +
          inverseMatrix[8] * z;
        const tiltedX =
          orientedX * cosTilt + orientedY * sinTilt;
        const tiltedY =
          -orientedX * sinTilt + orientedY * cosTilt;
        longitude[index] = Math.atan2(tiltedX, orientedZ);
        textureV[index] =
          clamp(0.5 - Math.asin(-tiltedY) / Math.PI, 0, 1);
        normalX[index] = screenX;
        normalY[index] = screenY;
        normalZ[index] = z;
        edgeAlpha[index] = clamp(
          (1 - Math.sqrt(radiusSquared)) * size * 0.72,
          0,
          1
        );
      }
    }

    this.lookup = {
      size,
      axialTilt,
      orientationX: this.viewOrientation.x,
      orientationY: this.viewOrientation.y,
      orientationZ: this.viewOrientation.z,
      orientationW: this.viewOrientation.w,
      longitude,
      textureV,
      normalX,
      normalY,
      normalZ,
      edgeAlpha,
    };
    return this.lookup;
  }

  private getRenderImageData(size: number): ImageData {
    if (
      this.renderImageData &&
      this.renderCanvas.width === size &&
      this.renderCanvas.height === size
    ) {
      return this.renderImageData;
    }
    this.renderCanvas.width = size;
    this.renderCanvas.height = size;
    this.renderImageData = this.renderContext.createImageData(size, size);
    this.lastRenderKey = '';
    return this.renderImageData;
  }

  private drawFallbackSurface(
    context2D: CanvasRenderingContext2D,
    center: Readonly<Point2D>,
    radius: number
  ): void {
    const fallback = context2D.createRadialGradient(
      center.x - radius * 0.3,
      center.y - radius * 0.3,
      radius * 0.08,
      center.x,
      center.y,
      radius
    );
    fallback.addColorStop(0, '#63c7ff');
    fallback.addColorStop(0.58, '#1677bd');
    fallback.addColorStop(1, '#073b72');
    context2D.fillStyle = fallback;
    context2D.fillRect(
      center.x - radius,
      center.y - radius,
      radius * 2,
      radius * 2
    );
  }

  private drawSelectionState(
    context2D: CanvasRenderingContext2D,
    center: Readonly<Point2D>,
    radius: number,
    options: PlanetSphereDrawOptions
  ): void {
    if (!options.hovered && !options.selected) return;
    context2D.save();
    context2D.strokeStyle = options.selected ? '#f7c948' : '#5bc0eb';
    context2D.lineWidth = options.selected ? 3 : 2;
    context2D.beginPath();
    context2D.arc(center.x, center.y, radius + 8, 0, FULL_TURN);
    context2D.stroke();
    context2D.restore();
  }
}

function getRenderSize(
  context2D: CanvasRenderingContext2D,
  radius: number
): number {
  const transform = context2D.getTransform();
  const scale = Math.max(
    Math.hypot(transform.a, transform.b),
    Math.hypot(transform.c, transform.d),
    1
  );
  const requested = Math.ceil(radius * 2 * scale);
  const aligned = Math.ceil(requested / 8) * 8;
  return clamp(aligned, MIN_RENDER_SIZE, MAX_RENDER_SIZE);
}

function projectToTrackball(
  point: Readonly<Point2D>
): { x: number; y: number; z: number } {
  const lengthSquared = point.x * point.x + point.y * point.y;
  if (lengthSquared <= 1) {
    return {
      x: point.x,
      y: point.y,
      z: Math.sqrt(1 - lengthSquared),
    };
  }
  const inverseLength = 1 / Math.sqrt(lengthSquared);
  return {
    x: point.x * inverseLength,
    y: point.y * inverseLength,
    z: 0,
  };
}

function quaternionFromUnitVectors(
  from: Readonly<{ x: number; y: number; z: number }>,
  to: Readonly<{ x: number; y: number; z: number }>
): Quaternion {
  const dot = clamp(
    from.x * to.x + from.y * to.y + from.z * to.z,
    -1,
    1
  );
  if (dot < -0.999999) {
    const axis =
      Math.abs(from.x) < Math.abs(from.z)
        ? { x: 0, y: -from.z, z: from.y }
        : { x: -from.y, y: from.x, z: 0 };
    return normalizeQuaternion({ ...axis, w: 0 });
  }
  return normalizeQuaternion({
    x: from.y * to.z - from.z * to.y,
    y: from.z * to.x - from.x * to.z,
    z: from.x * to.y - from.y * to.x,
    w: 1 + dot,
  });
}

function multiplyQuaternions(
  left: Readonly<Quaternion>,
  right: Readonly<Quaternion>
): Quaternion {
  return {
    x:
      left.w * right.x +
      left.x * right.w +
      left.y * right.z -
      left.z * right.y,
    y:
      left.w * right.y -
      left.x * right.z +
      left.y * right.w +
      left.z * right.x,
    z:
      left.w * right.z +
      left.x * right.y -
      left.y * right.x +
      left.z * right.w,
    w:
      left.w * right.w -
      left.x * right.x -
      left.y * right.y -
      left.z * right.z,
  };
}

function normalizeQuaternion(
  quaternion: Readonly<Quaternion>
): Quaternion {
  const length = Math.hypot(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w
  );
  if (length < 1e-8) return { x: 0, y: 0, z: 0, w: 1 };
  return {
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length,
  };
}

function quaternionToMatrix(
  quaternion: Readonly<Quaternion>
): readonly number[] {
  const { x, y, z, w } = quaternion;
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ];
}

function normalizeTurn(angle: number): number {
  return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

function normalizeUnit(value: number): number {
  return ((value % 1) + 1) % 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
