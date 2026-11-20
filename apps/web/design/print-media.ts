// `@media print` has no typed form in Tamagui's config: the `media` type only takes feature
// objects such as `{ minWidth: 1206 }`, while Tamagui itself hands a string query to the
// stylesheet unchanged (mediaObjectToString). This file holds that one cast and nothing else, so
// the lint override for it in oxlint.config.ts exempts no other code.
//
// SAFETY: tests/print-media.test.ts fails if Tamagui stops passing a string query through.
export const printMedia = "print" as unknown as Record<string, string>;
