import { BlurMethod } from "expo-blur";

export interface GlassmorphismConfig {
  intensity: number;
  blurMethod: BlurMethod;
  tint: 'light' | 'dark' | 'default';
  opacity: number;
  blurReductionFactor?: number;
}

export const BLUR_CONFIG: {
  header: GlassmorphismConfig;
  tabBar: GlassmorphismConfig;
  cards: GlassmorphismConfig;
  miniatures: GlassmorphismConfig;
} = {
  header: {
    intensity: 20,
    blurMethod: 'dimezisBlurView',
    tint: 'default',
    opacity: 0.6,
  },
  tabBar: {
    intensity: 20,
    blurMethod: 'dimezisBlurView',
    tint: 'default',
    opacity: 0.6,
  },
  cards: {
    intensity: 50,
    blurMethod: 'none',
    tint: 'default',
    opacity: 0.2,
  },
  miniatures: {
    intensity: 50,
    blurMethod: 'none',
    tint: 'default',
    opacity: 0.2,
  }
};
