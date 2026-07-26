import type { Point2D, Point3D } from './types.js';
import type { PlanetViewOrientation } from './EquirectangularPlanetRenderer.js';

const RING_TEXTURE_SIZE = 512;
const INNER_RADIUS = 1.18;
const OUTER_RADIUS = 2.24;
const DEFAULT_OPENING = 0.28;

type RingHalf = 'back' | 'front';
type RingTextureAxis = 'horizontal' | 'vertical';

export interface SaturnRingRendererOptions {
  textureSrc: string;
  radialAxis?: RingTextureAxis;
}

/**
 * 将一维土星环径向纹理生成俯视圆环，再按球体 Arcball 四元数投影。
 *
 * 光环按相对观察者的深度拆为前后两半，允许球体正确遮挡后半环。
 */
export class SaturnRingRenderer {
  private readonly image = new Image();
  private readonly textureSrc: string;
  private readonly radialAxis: RingTextureAxis;
  private readonly ringCanvas = document.createElement('canvas');
  private readonly ringContext: CanvasRenderingContext2D;
  private readyCallback: (() => void) | null = null;
  private loading = false;
  private ready = false;
  private failed = false;

  constructor(options: SaturnRingRendererOptions) {
    this.textureSrc = options.textureSrc;
    this.radialAxis = options.radialAxis ?? 'horizontal';
    this.ringCanvas.width = RING_TEXTURE_SIZE;
    this.ringCanvas.height = RING_TEXTURE_SIZE;
    const context = this.ringCanvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true,
    });
    if (!context) {
      throw new Error('无法创建土星环离屏 Canvas');
    }
    this.ringContext = context;
    this.image.decoding = 'async';
    this.image.onload = () => {
      this.buildRingTexture();
      this.readyCallback?.();
    };
    this.image.onerror = () => {
      this.failed = true;
      this.readyCallback?.();
      console.warn(`土星环纹理加载失败: ${this.textureSrc}`);
    };
  }

  setTextureReadyCallback(callback: (() => void) | null): void {
    this.readyCallback = callback;
    if (callback && (this.ready || this.failed)) {
      queueMicrotask(callback);
    }
  }

  drawBack(
    context2D: CanvasRenderingContext2D,
    center: Readonly<Point2D>,
    planetRadius: number,
    orientation: PlanetViewOrientation,
    axialTilt: number
  ): boolean {
    return this.drawHalf(
      context2D,
      center,
      planetRadius,
      orientation,
      axialTilt,
      'back'
    );
  }

  drawFront(
    context2D: CanvasRenderingContext2D,
    center: Readonly<Point2D>,
    planetRadius: number,
    orientation: PlanetViewOrientation,
    axialTilt: number
  ): boolean {
    return this.drawHalf(
      context2D,
      center,
      planetRadius,
      orientation,
      axialTilt,
      'front'
    );
  }

  private drawHalf(
    context2D: CanvasRenderingContext2D,
    center: Readonly<Point2D>,
    planetRadius: number,
    orientation: PlanetViewOrientation,
    axialTilt: number,
    half: RingHalf
  ): boolean {
    this.ensureLoading();
    if (!this.ready || planetRadius <= 0) return false;

    const basis = getProjectedRingBasis(orientation, axialTilt);
    if (
      Math.hypot(basis.major.z, basis.minor.z) < 1e-7 &&
      half === 'front'
    ) {
      return true;
    }
    const clipPolygon = clipSquareToDepthHalf(
      basis.major.z,
      basis.minor.z,
      half === 'front'
    );
    if (clipPolygon.length < 3) return true;

    context2D.save();
    context2D.translate(center.x, center.y);
    context2D.transform(
      basis.major.x * planetRadius * OUTER_RADIUS,
      basis.major.y * planetRadius * OUTER_RADIUS,
      basis.minor.x * planetRadius * OUTER_RADIUS,
      basis.minor.y * planetRadius * OUTER_RADIUS,
      0,
      0
    );
    context2D.beginPath();
    context2D.moveTo(clipPolygon[0].x, clipPolygon[0].y);
    for (let index = 1; index < clipPolygon.length; index += 1) {
      context2D.lineTo(clipPolygon[index].x, clipPolygon[index].y);
    }
    context2D.closePath();
    context2D.clip();
    context2D.imageSmoothingEnabled = true;
    context2D.imageSmoothingQuality = 'high';
    context2D.drawImage(this.ringCanvas, -1, -1, 2, 2);
    context2D.restore();
    return true;
  }

  private ensureLoading(): void {
    if (this.loading || this.failed) return;
    this.loading = true;
    this.image.src = this.textureSrc;
  }

  private buildRingTexture(): void {
    try {
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = this.image.naturalWidth;
      sourceCanvas.height = this.image.naturalHeight;
      const sourceContext = sourceCanvas.getContext('2d', {
        willReadFrequently: true,
      });
      if (!sourceContext) throw new Error('无法读取土星环纹理');
      sourceContext.drawImage(this.image, 0, 0);
      const source = sourceContext.getImageData(
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
      );
      const output = this.ringContext.createImageData(
        RING_TEXTURE_SIZE,
        RING_TEXTURE_SIZE
      );
      const innerNormalized = INNER_RADIUS / OUTER_RADIUS;
      const sourceCenterX = Math.floor(source.width / 2);
      const sourceCenterY = Math.floor(source.height / 2);
      const radialLimit =
        this.radialAxis === 'horizontal'
          ? source.width - 1
          : source.height - 1;
      const radialCenter =
        this.radialAxis === 'horizontal'
          ? sourceCenterX
          : sourceCenterY;
      let radialEnd = radialCenter;
      for (
        let coordinate = radialCenter;
        coordinate <= radialLimit;
        coordinate += 1
      ) {
        const sampleX =
          this.radialAxis === 'horizontal'
            ? coordinate
            : sourceCenterX;
        const sampleY =
          this.radialAxis === 'vertical'
            ? coordinate
            : sourceCenterY;
        const alpha =
          source.data[(sampleY * source.width + sampleX) * 4 + 3];
        if (alpha > 2) radialEnd = coordinate;
      }

      for (let y = 0; y < RING_TEXTURE_SIZE; y += 1) {
        const normalizedY =
          ((y + 0.5) / RING_TEXTURE_SIZE) * 2 - 1;
        for (let x = 0; x < RING_TEXTURE_SIZE; x += 1) {
          const normalizedX =
            ((x + 0.5) / RING_TEXTURE_SIZE) * 2 - 1;
          const radialDistance = Math.hypot(
            normalizedX,
            normalizedY
          );
          if (
            radialDistance < innerNormalized ||
            radialDistance > 1
          ) {
            continue;
          }
          const radialAmount =
            (radialDistance - innerNormalized) /
            (1 - innerNormalized);
          const sourceX =
            this.radialAxis === 'horizontal'
              ? Math.min(
                  source.width - 1,
                  Math.round(
                    sourceCenterX +
                      radialAmount *
                        (radialEnd - sourceCenterX)
                  )
                )
              : sourceCenterX;
          const sourceY =
            this.radialAxis === 'vertical'
              ? Math.min(
                  source.height - 1,
                  Math.round(
                    sourceCenterY +
                      radialAmount *
                        (radialEnd - sourceCenterY)
                  )
                )
              : sourceCenterY;
          const sourceIndex =
            (sourceY * source.width + sourceX) * 4;
          const outputIndex =
            (y * RING_TEXTURE_SIZE + x) * 4;
          output.data[outputIndex] = source.data[sourceIndex];
          output.data[outputIndex + 1] =
            source.data[sourceIndex + 1];
          output.data[outputIndex + 2] =
            source.data[sourceIndex + 2];
          output.data[outputIndex + 3] =
            source.data[sourceIndex + 3];
        }
      }
      this.ringContext.putImageData(output, 0, 0);
      this.ready = true;
    } catch {
      this.failed = true;
      console.warn(`土星环纹理处理失败: ${this.textureSrc}`);
    }
  }
}

function getProjectedRingBasis(
  orientation: PlanetViewOrientation,
  axialTilt: number
): { major: Point3D; minor: Point3D } {
  const angle = axialTilt;
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const openingSide = Math.sqrt(
    Math.max(0, 1 - DEFAULT_OPENING * DEFAULT_OPENING)
  );
  const major = {
    x: cosAngle,
    y: sinAngle,
    z: 0,
  };
  const minor = {
    x: -DEFAULT_OPENING * sinAngle,
    y: DEFAULT_OPENING * cosAngle,
    z: openingSide,
  };
  return {
    major: rotatePoint(major, orientation),
    minor: rotatePoint(minor, orientation),
  };
}

function rotatePoint(
  point: Readonly<Point3D>,
  quaternion: PlanetViewOrientation
): Point3D {
  const { x, y, z, w } = quaternion;
  return {
    x:
      (1 - 2 * (y * y + z * z)) * point.x +
      2 * (x * y - z * w) * point.y +
      2 * (x * z + y * w) * point.z,
    y:
      2 * (x * y + z * w) * point.x +
      (1 - 2 * (x * x + z * z)) * point.y +
      2 * (y * z - x * w) * point.z,
    z:
      2 * (x * z - y * w) * point.x +
      2 * (y * z + x * w) * point.y +
      (1 - 2 * (x * x + y * y)) * point.z,
  };
}

function clipSquareToDepthHalf(
  depthX: number,
  depthY: number,
  keepFront: boolean
): Point2D[] {
  const square: Point2D[] = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
  const direction = keepFront ? 1 : -1;
  const isInside = (point: Readonly<Point2D>): boolean =>
    (depthX * point.x + depthY * point.y) * direction >= -1e-7;
  const result: Point2D[] = [];

  for (let index = 0; index < square.length; index += 1) {
    const start = square[index];
    const end = square[(index + 1) % square.length];
    const startInside = isInside(start);
    const endInside = isInside(end);
    if (startInside) result.push(start);
    if (startInside === endInside) continue;
    const startDepth = depthX * start.x + depthY * start.y;
    const endDepth = depthX * end.x + depthY * end.y;
    const amount = startDepth / (startDepth - endDepth);
    result.push({
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount,
    });
  }
  return result;
}
