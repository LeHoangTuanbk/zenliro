export type HslChannel =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'purple'
  | 'magenta';

export type ColorMode = 'hue' | 'saturation' | 'luminance';
export type ChannelValues = Record<HslChannel, number>;

export const HSL_CHANNELS: HslChannel[] = [
  'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta',
];

export const defaultChannelValues = (): ChannelValues => ({
  red: 0, orange: 0, yellow: 0, green: 0,
  aqua: 0, blue: 0, purple: 0, magenta: 0,
});

export const CHANNEL_COLORS: Record<HslChannel, string> = {
  red:     '#e05555',
  orange:  '#e08833',
  yellow:  '#d4cc44',
  green:   '#55a055',
  aqua:    '#44aabb',
  blue:    '#5577e0',
  purple:  '#8855cc',
  magenta: '#cc55aa',
};
