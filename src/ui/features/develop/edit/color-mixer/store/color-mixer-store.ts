import { create } from 'zustand';
import type { ColorMode, ChannelValues, HslChannel } from './types';
import { defaultChannelValues } from './types';

type ColorMixerStore = {
  mode: ColorMode;
  hue: ChannelValues;
  saturation: ChannelValues;
  luminance: ChannelValues;
  setMode: (mode: ColorMode) => void;
  setValue: (mode: ColorMode, channel: HslChannel, value: number) => void;
  reset: () => void;
};

export const useColorMixerStore = create<ColorMixerStore>((set) => ({
  mode: 'saturation',
  hue: defaultChannelValues(),
  saturation: defaultChannelValues(),
  luminance: defaultChannelValues(),
  setMode: (mode) => set({ mode }),
  setValue: (mode, channel, value) =>
    set((state) => ({ [mode]: { ...state[mode], [channel]: value } })),
  reset: () => set({
    hue: defaultChannelValues(),
    saturation: defaultChannelValues(),
    luminance: defaultChannelValues(),
  }),
}));
