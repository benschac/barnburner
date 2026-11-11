import { Image, Text, View, styled } from 'tamagui'

export const Copy = styled(Text, {
  fontFamily: 'body', fontSize: 'body', lineHeight: 'caption', fontWeight: '400',
  color: 'color', m: '0', p: '0',
})
export const Heading = styled(Copy, {
  render: 'h2', fontFamily: 'heading', fontSize: 'title', lineHeight: 'title', fontWeight: '700',
})
export const RuledHeading = styled(Heading, {
  fontSize: 'title', h: '10', mb: '2', borderBottomWidth: 2, borderBottomColor: 'rule',
})
export const Score = styled(Copy, { fontFamily: 'score', fontWeight: '400' })
export const Row = styled(View, { flexDirection: 'row', items: 'center', shrink: 0 })
export const List = styled(View, { render: 'ul', m: '0', p: '0', listStyle: 'none' })
export const Label = styled(Copy, {
  render: 'h3', color: 'gold', fontSize: 'caption', lineHeight: 'caption', letterSpacing: 1, fontWeight: '600',
})
export const Logo = styled(Image, { w: '8', h: '8', objectFit: 'contain', shrink: 0 })
export const TableCell = styled(Copy, { style: { display: 'table-cell' }, verticalAlign: 'middle', fontSize: 'label', lineHeight: 'detail' })
export const ColumnHeading = styled(TableCell, {
  render: 'th', color: 'muted', fontSize: 'caption', lineHeight: 'caption', fontWeight: '500', text: 'right', pr: '1.5',
})
export const BannerLayer = styled(View, {
  position: 'absolute', l: '0', t: '0', h: 'playoffChart',
  clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
})
