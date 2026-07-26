import type {
  CanvasViewport,
  CelestialBodyState,
  Point2D,
  Point3D,
} from './types.js';

export interface EarthObserverProjection {
  point: Point2D;
  visible: boolean;
  rightAscension: number;
  declination: number;
  hourAngle: number;
  azimuth: number;
  altitude: number;
  distance: number;
}

export interface EarthObserverProjectionOptions {
  localSiderealAngle: number;
  observerLatitude: number;
  lookYaw?: number;
  lookPitch?: number;
  zoom?: number;
}

/** J2000 平黄赤交角的教学近似值。 */
export const EARTH_OBLIQUITY_RADIANS = degreesToRadians(23.43928);

/**
 * 将日心黄道三维坐标转换成地表观察者的高度角、方位角和屏幕坐标。
 *
 * 计算顺序：
 * 1. 天体日心坐标减去地球日心坐标，得到地心黄道方向。
 * 2. 应用地球黄赤交角，转换到赤道坐标并求赤经、赤纬。
 * 3. 使用观察者纬度和当地恒星时转换到地平坐标。
 * 4. 将方位角和高度角投影到可环顾的二维天空。
 */
export function projectBodyToEarthSky(
  earth: Readonly<CelestialBodyState>,
  target: Readonly<CelestialBodyState>,
  viewport: Readonly<CanvasViewport>,
  options: Readonly<EarthObserverProjectionOptions>
): EarthObserverProjection {
  const earthPosition = getBodyPosition3D(earth);
  const targetPosition = getBodyPosition3D(target);
  const ecliptic = {
    x: targetPosition.x - earthPosition.x,
    y: targetPosition.y - earthPosition.y,
    z: targetPosition.z - earthPosition.z,
  };
  const distance = vectorLength(ecliptic);
  const equatorial = rotateEclipticToEquatorial(ecliptic);
  const equatorialLength = Math.max(1e-12, vectorLength(equatorial));
  const rightAscension = normalizeAngle(
    Math.atan2(equatorial.y, equatorial.x)
  );
  const declination = Math.asin(
    clamp(equatorial.z / equatorialLength, -1, 1)
  );
  const hourAngle = normalizeSignedAngle(
    options.localSiderealAngle - rightAscension
  );
  const latitude = clamp(
    options.observerLatitude,
    -Math.PI / 2,
    Math.PI / 2
  );
  const horizontal = equatorialToHorizontal(
    hourAngle,
    declination,
    latitude
  );

  const lookYaw = options.lookYaw ?? 0;
  const lookPitch = clamp(options.lookPitch ?? 0, -Math.PI / 3, Math.PI / 3);
  const zoom = clamp(options.zoom ?? 1, 0.5, 4);
  const centerAzimuth = normalizeAngle(Math.PI + lookYaw);
  const relativeAzimuth = normalizeSignedAngle(
    horizontal.azimuth - centerAzimuth
  );
  const horizontalFov = Math.min(
    Math.PI * 1.7,
    Math.PI / Math.max(0.72, zoom)
  );
  const horizonY = getEarthObserverHorizonY(viewport.height, lookPitch);
  const verticalScale = (viewport.height * 0.58 * zoom) / (Math.PI / 2);
  const point = {
    x:
      viewport.width / 2 +
      (relativeAzimuth / (horizontalFov / 2)) * (viewport.width / 2),
    y: horizonY - horizontal.altitude * verticalScale,
  };
  const visible =
    horizontal.altitude >= -0.025 &&
    Math.abs(relativeAzimuth) <= horizontalFov / 2 + 0.08 &&
    point.x >= -48 &&
    point.x <= viewport.width + 48 &&
    point.y >= -64 &&
    point.y <= horizonY + 36;

  return {
    point,
    visible,
    rightAscension,
    declination,
    hourAngle,
    azimuth: horizontal.azimuth,
    altitude: horizontal.altitude,
    distance,
  };
}

export function equatorialToHorizontal(
  hourAngle: number,
  declination: number,
  latitude: number
): { azimuth: number; altitude: number } {
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const sinDeclination = Math.sin(declination);
  const cosDeclination = Math.cos(declination);
  const sinAltitude =
    sinLatitude * sinDeclination +
    cosLatitude * cosDeclination * Math.cos(hourAngle);
  const altitude = Math.asin(clamp(sinAltitude, -1, 1));

  const east = -cosDeclination * Math.sin(hourAngle);
  const north =
    sinDeclination * cosLatitude -
    cosDeclination * Math.cos(hourAngle) * sinLatitude;
  const azimuth = normalizeAngle(Math.atan2(east, north));
  return { azimuth, altitude };
}

export function rotateEclipticToEquatorial(
  vector: Readonly<Point3D>
): Point3D {
  const cosObliquity = Math.cos(EARTH_OBLIQUITY_RADIANS);
  const sinObliquity = Math.sin(EARTH_OBLIQUITY_RADIANS);
  return {
    x: vector.x,
    y: vector.y * cosObliquity - vector.z * sinObliquity,
    z: vector.y * sinObliquity + vector.z * cosObliquity,
  };
}

export function getEarthObserverHorizonY(
  viewportHeight: number,
  lookPitch: number
): number {
  const pitch = clamp(lookPitch, -Math.PI / 3, Math.PI / 3);
  return clamp(
    viewportHeight * 0.76 +
      (pitch / (Math.PI / 3)) * viewportHeight * 0.2,
    viewportHeight * 0.48,
    viewportHeight * 0.94
  );
}

export function getObserverSiderealAngle(
  earth: Readonly<CelestialBodyState>
): number {
  const sidereal = earth.metadata?.observerSiderealAngle;
  if (typeof sidereal === 'number' && Number.isFinite(sidereal)) {
    return normalizeAngle(sidereal);
  }
  return normalizeAngle(earth.rotation);
}

export function getObserverLatitude(
  earth: Readonly<CelestialBodyState>
): number {
  const latitudeDegrees = earth.metadata?.observerLatitudeDegrees;
  return typeof latitudeDegrees === 'number' &&
    Number.isFinite(latitudeDegrees)
    ? degreesToRadians(clamp(latitudeDegrees, -90, 90))
    : degreesToRadians(35);
}

export function getBodyPosition3D(
  body: Readonly<CelestialBodyState>
): Point3D {
  return body.position3D
    ? { ...body.position3D }
    : { x: body.position.x, y: body.position.y, z: 0 };
}

export function normalizeObserverAngle(radians: number): number {
  return normalizeSignedAngle(radians);
}

function vectorLength(vector: Readonly<Point3D>): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalizeAngle(radians: number): number {
  const fullTurn = Math.PI * 2;
  return ((radians % fullTurn) + fullTurn) % fullTurn;
}

function normalizeSignedAngle(radians: number): number {
  const fullTurn = Math.PI * 2;
  return ((radians + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
