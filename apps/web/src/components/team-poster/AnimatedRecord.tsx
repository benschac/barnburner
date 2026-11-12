import { Fragment } from 'react'
import { View, styled, useMedia } from 'tamagui'
import { Row, Score } from './primitives'

const DigitScore = styled(Score, {
  w: '100%', h: '100%',
  fontSize: 'score sm:hero print:hero', lineHeight: 'score sm:hero print:hero',
  color: 'bright', text: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: 0,
})

function Digit({ value }: { value: string }) {
  const media = useMedia()
  return (
    <View position="relative" w="8 sm:12 print:12" h="12 sm:card print:card" overflow="hidden" shrink={0}>
      <DigitScore position="absolute" l="0" t="0" display={media.reducedMotion ? 'block' : 'none print:block'}>{value}</DigitScore>
      {!media.reducedMotion && (
        <View position="absolute" l="0" t="0" w="100%" h="1000%" display="flex print:none"
          y={`${-Number(value) * 10}%`} transition="240ms cubic-bezier(0.23, 1, 0.32, 1)">
          {Array.from('0123456789', (numeral) => (
            <DigitScore key={numeral} display="block" h="10%" shrink={0}
              select={numeral === value ? 'text' : 'none'}>{numeral}</DigitScore>
          ))}
        </View>
      )}
    </View>
  )
}

export function AnimatedRecord({ record }: { record: string }) {
  const parts = record.split('-')
  const [wins, losses, overtime] = parts
  return (
    <Row render="h1" m="0" p="0" aria-label={`${wins} wins, ${losses} losses, ${overtime} overtime losses`}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <Score aria-hidden={true} w="4 sm:6 print:6" text="center" fontSize="score sm:hero print:hero"
            lineHeight="score sm:hero print:hero" color="bright" shrink={0}>-</Score>}
          <Row aria-hidden={true}>
            {Array.from(part.padStart(2, '0'), (value, place) => <Digit value={value} key={place} />)}
          </Row>
        </Fragment>
      ))}
    </Row>
  )
}
