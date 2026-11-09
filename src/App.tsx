import { useState } from 'react'
import { Button, Text, View } from 'tamagui'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <View
      render="main"
      minH="100vh"
      items="center"
      justify="center"
      backgroundColor="background"
      p="4 md:8"
    >
      <View
        w="100%"
        maxW={560}
        p="6 md:10"
        gap="4"
        rounded="2xl"
        backgroundColor="color-2"
        borderWidth={1}
        borderColor="color-5"
      >
        <Text render="h1" m={0} fontSize="3xl" fontWeight="700" color="color">
          NHL Reddit Stats
        </Text>
        <Text fontSize="base" lineHeight={1.5} color="color-11">
          Your Tamagui v3 app is ready. Press the button to try it.
        </Text>
        <Button
          self="flex-start"
          theme="accent"
          backgroundColor="background hover:background-hover"
          onPress={() => setCount((value) => value + 1)}
        >
          Count is {count}
        </Button>
      </View>
    </View>
  )
}
