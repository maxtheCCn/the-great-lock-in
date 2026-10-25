import {
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

const background = '#060908';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0.06 },
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.34,
      resizeOptions: { background },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.24,
      resizeOptions: { background },
    },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.72,
        resizeOptions: { background, fit: 'contain' },
        linkMediaOptions: { log: true, addMediaScreen: true, xhtml: false, basePath: '/' },
        png: { compressionLevel: 9, quality: 70 },
        name: (landscape, size, dark) =>
          `splash/apple-splash-${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark-' : ''}${size.width}x${size.height}.png`,
      },
      ['iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 14 Plus', 'iPhone 13 mini', 'iPhone SE 4.7"'],
    ),
  },
  images: ['public/logo.svg'],
});
