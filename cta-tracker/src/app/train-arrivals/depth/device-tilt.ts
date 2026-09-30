/**
 * The gyroscope, for the 3D styles that can follow the phone: Diorama turns its model with it and
 * Holo Card moves the light across its foil.
 *
 * Plain TypeScript rather than a service: each component owns one for as long as tilt is on, and
 * the mapping from a reading to what the style does (`tiltToOrbit`, `tiltToCard`) stays in
 * depth-geometry.ts, where it is tested.
 */

export interface TiltReading {
  beta: number;
  gamma: number;
}

type OrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Whether to offer tilt at all. Desktop browsers have the API but no gyroscope to feed it, so only
 * a touch screen counts. Browser-only: call it from `afterNextRender`, never during prerendering.
 */
export function tiltAvailable(): boolean {
  return typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}

export class DeviceTilt {
  private baseline: TiltReading | null = null;
  private readonly listener = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) {
      return;
    }
    const reading = { beta: event.beta, gamma: event.gamma };
    // The first reading is how the rider is holding the phone; everything is relative to it.
    this.baseline ??= reading;
    this.onReading(reading, this.baseline);
  };

  constructor(private readonly onReading: (reading: TiltReading, baseline: TiltReading) => void) {}

  /**
   * Starts listening, asking for iOS's motion permission first. iOS asks once per origin and only
   * from a tap, so call this from a click handler. Resolves false when the rider declines.
   */
  async start(): Promise<boolean> {
    const api = DeviceOrientationEvent as OrientationEventWithPermission;
    try {
      if (typeof api.requestPermission === 'function' && await api.requestPermission() !== 'granted') {
        return false;
      }
    } catch {
      return false;
    }
    this.baseline = null;
    window.addEventListener('deviceorientation', this.listener);
    return true;
  }

  stop(): void {
    window.removeEventListener('deviceorientation', this.listener);
  }
}
