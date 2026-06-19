/// <reference types="vite/client" />

declare global {
  interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
    webkitCompassHeading?: number;
  }
}

interface DeviceOrientationEventStatic {
  prototype: DeviceOrientationEvent;
  new (type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEvent;
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

declare var DeviceOrientationEvent: DeviceOrientationEventStatic;

export {};
