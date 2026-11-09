const fonts = [
  new FontFace('Roboto Condensed', 'url(/assets/fonts/roboto-condensed.ttf)', { weight: '100 900', display: 'swap' }),
  new FontFace('Graduate', 'url(/assets/fonts/graduate.ttf)', { weight: '400', display: 'swap' }),
]

export const fontsReady = Promise.allSettled(fonts.map((font) => {
  document.fonts.add(font)
  return font.load()
}))
