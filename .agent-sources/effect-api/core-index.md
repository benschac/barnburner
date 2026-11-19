# effect core API index

Generated from the type declarations of the installed `effect@4.1.2` by `scripts/index-effect-core.mjs`. Run `bun install` first.

Each row is one export of `import { <Module> } from 'effect'`. Its JSDoc, examples, and signature are lines Start to End of `node_modules/effect/dist/<Module>.d.ts`.

Search by name or by intent, then read that range:

```sh
rg -n '^\| Array \| (sort|dedupe|groupBy) \|' .agent-sources/effect-api/core-index.md
rg -in 'duplicate|sorts' .agent-sources/effect-api/core-index.md
sed -n '<Start>,<End>p' node_modules/effect/dist/<Module>.d.ts
```

For a native pattern and its Effect replacement, start with [native-to-effect.md](native-to-effect.md).

| Module | Export | Start | End | Summary |
| --- | --- | ---: | ---: | --- |
| Arbitrary | TypeId | 8 | 15 | Runtime type identifier for `Arbitrary` values. |
| Arbitrary | TypeId | 16 | 23 | Type of the runtime identifier for `Arbitrary` values. |
| Arbitrary | Arbitrary | 24 | 43 | Represents a pure description of values that can be generated and shrunk. |
| Arbitrary | SchemaOptions | 44 | 58 | Configures Schema-derived generation. |
| Arbitrary | ArrayOptions | 59 | 74 | Configures the lengths generated and preserved during shrinking by {@link array}. |
| Arbitrary | isArbitrary | 75 | 86 | Checks whether a value is an `Arbitrary`. |
| Arbitrary | SampleOptions | 87 | 105 | Configures direct sampling from an `Arbitrary`. |
| Arbitrary | SampleError | 106 | 123 | Describes sampling exhaustion before the requested number of values was generated. |
| Arbitrary | Replay | 124 | 145 | Opaque string token that replays a falsification and its complete shrink path. |
| Arbitrary | CheckOptions | 146 | 185 | Configures property checking, shrinking, and replay. |
| Arbitrary | GlobalOptions | 186 | 196 | Independent defaults for property checking and sampling, excluding replay tokens. |
| Arbitrary | configureGlobal | 197 | 214 | Replaces the defaults used by {@link checkEffect} and {@link sampleEffect}. |
| Arbitrary | ReturnedFalse | 215 | 224 | Identifies a property that returned `false`. |
| Arbitrary | PropertyError | 225 | 235 | Preserves a typed failure produced by an effectful property. |
| Arbitrary | PropertyFailure | 236 | 243 | Represents the reason a property was falsified. |
| Arbitrary | Passed | 244 | 255 | Reports that every requested property run passed. |
| Arbitrary | Falsified | 256 | 280 | Reports a generated failure and its shrunk input. |
| Arbitrary | Exhausted | 281 | 298 | Reports that bounded generation discarded too many candidates. |
| Arbitrary | ReplayMismatch | 299 | 315 | Reports that replay coordinates no longer reproduce the recorded failure class. |
| Arbitrary | CheckResult | 316 | 327 | Represents every ordinary outcome of property checking. |
| Arbitrary | formatCheckFailure | 328 | 339 | Formats an unsuccessful property-check result as a diagnostic message, returning `undefined` for a passed result. |
| Arbitrary | schema | 340 | 364 | Derives an `Arbitrary` from the decoded `Type` of a Schema. |
| Arbitrary | Constant | 365 | 381 | Creates an `Arbitrary` that always generates `value` and has no shrink candidates. |
| Arbitrary | array | 382 | 429 | Generates variable-length arrays from an existing element `Arbitrary`. |
| Arbitrary | map | 430 | 469 | Transforms every generated value and its shrink candidates. |
| Arbitrary | filter | 470 | 560 | Keeps generated values and shrink candidates that satisfy a predicate or refinement. |
| Arbitrary | filterMap | 561 | 618 | Transforms accepted generated values and discards rejected values. |
| Arbitrary | flatMap | 619 | 694 | Sequentially selects an `Arbitrary` from a generated value. |
| Arbitrary | all | 695 | 724 | Combines Arbitraries into one `Arbitrary` whose generated value mirrors the input shape. |
| Arbitrary | sampleEffect | 725 | 736 | Generates a bounded collection of values from an `Arbitrary`. |
| Arbitrary | checkEffect | 737 | 766 | Checks a pure or effectful property and shrinks the first falsification. |
| Array | Array | 11 | 31 | Exposes the global array constructor. |
| Array | ReadonlyArrayTypeLambda | 32 | 41 | Type lambda for `ReadonlyArray`, used for higher-kinded type operations. |
| Array | NonEmptyReadonlyArray | 42 | 68 | A readonly array guaranteed to have at least one element. |
| Array | NonEmptyArray | 69 | 101 | A mutable array guaranteed to have at least one element. |
| Array | make | 102 | 129 | Creates a `NonEmptyArray` from one or more elements. |
| Array | allocate | 130 | 156 | Creates a new `Array` of the specified length with all slots uninitialized. |
| Array | makeBy | 157 | 244 | Creates a `NonEmptyArray` of length `n` where element `i` is computed by `f(i)`. |
| Array | range | 245 | 271 | Creates a `NonEmptyArray` containing a range of integers, inclusive on both ends. |
| Array | replicate | 272 | 356 | Creates a `NonEmptyArray` containing a value repeated `n` times. |
| Array | fromIterable | 357 | 385 | Converts an `Iterable` to an `Array`. |
| Array | ensure | 386 | 416 | Normalizes a value that is either a single element or an array into an array. |
| Array | fromRecord | 417 | 445 | Converts a record into an array of `[key, value]` tuples. |
| Array | fromOption | 446 | 468 | Converts an `Option` to an array: `Some(a)` becomes `[a]`, `None` becomes `[]`. |
| Array | match | 469 | 661 | Pattern-matches on an array, handling empty and non-empty cases separately. |
| Array | matchLeft | 662 | 773 | Pattern-matches on an array from the left, providing the first element and the remaining elements separately. |
| Array | matchRight | 774 | 885 | Pattern-matches on an array from the right, providing all elements except the last and the last element separately. |
| Array | prepend | 886 | 958 | Adds a single element to the front of an iterable, returning a `NonEmptyArray`. |
| Array | prependAll | 959 | 1094 | Prepends all elements from a prefix iterable to the front of an array. |
| Array | append | 1095 | 1167 | Adds a single element to the end of an iterable, returning a `NonEmptyArray`. |
| Array | appendAll | 1168 | 1308 | Concatenates two iterables into a single array. |
| Array | scan | 1309 | 1396 | Folds left-to-right while keeping every intermediate accumulator value. |
| Array | scanRight | 1397 | 1484 | Folds right-to-left while keeping every intermediate accumulator value. |
| Array | isArray | 1485 | 1572 | Checks whether a value is an `Array`. |
| Array | isArrayEmpty | 1573 | 1592 | Checks whether a mutable `Array` is empty, narrowing the type to `[]`. |
| Array | isReadonlyArrayEmpty | 1593 | 1612 | Checks whether a `ReadonlyArray` is empty, narrowing the type to `readonly []`. |
| Array | isArrayNonEmpty | 1613 | 1638 | Checks whether a mutable `Array` is non-empty, narrowing the type to `NonEmptyArray`. |
| Array | isReadonlyArrayNonEmpty | 1639 | 1664 | Checks whether a `ReadonlyArray` is non-empty, narrowing the type to `NonEmptyReadonlyArray`. |
| Array | length | 1665 | 1684 | Returns the number of elements in a `ReadonlyArray`. |
| Array | get | 1685 | 1778 | Reads an element at the given index safely, returning `Option.some` or `Option.none` if the index is out of bounds. |
| Array | getUnsafe | 1779 | 1866 | Reads an element at the given index, throwing if the index is out of bounds. |
| Array | unprepend | 1867 | 1895 | Splits a non-empty array into its first element and the remaining elements. |
| Array | unappend | 1896 | 1925 | Splits a non-empty array into all elements except the last, and the last element. |
| Array | head | 1926 | 1950 | Returns the first element of an array safely wrapped in `Option.some`, or `Option.none` if the array is empty. |
| Array | headNonEmpty | 1951 | 1974 | Returns the first element of a `NonEmptyReadonlyArray` directly (no `Option` wrapper). |
| Array | last | 1975 | 1999 | Returns the last element of an array safely wrapped in `Option.some`, or `Option.none` if the array is empty. |
| Array | lastNonEmpty | 2000 | 2023 | Returns the last element of a `NonEmptyReadonlyArray` directly (no `Option` wrapper). |
| Array | tail | 2024 | 2051 | Returns all elements except the first safely, wrapped in an `Option`. |
| Array | tailNonEmpty | 2052 | 2074 | Returns all elements except the first of a `NonEmptyReadonlyArray`. |
| Array | init | 2075 | 2103 | Returns all elements except the last safely, wrapped in an `Option`. |
| Array | initNonEmpty | 2104 | 2126 | Returns all elements except the last of a `NonEmptyReadonlyArray`. |
| Array | take | 2127 | 2214 | Keeps the first `n` elements, creating a new array. |
| Array | takeRight | 2215 | 2299 | Keeps the last `n` elements, creating a new array. |
| Array | takeWhile | 2300 | 2455 | Takes elements from the start while the predicate holds, stopping at the first element that fails. |
| Array | takeWhileFilter | 2456 | 2519 | Takes elements from the start while a `Filter` succeeds, collecting transformed values. |
| Array | span | 2520 | 2680 | Splits an iterable into two arrays: the longest prefix where the predicate holds, and the remaining elements. |
| Array | drop | 2681 | 2771 | Removes the first `n` elements, creating a new array. |
| Array | dropRight | 2772 | 2853 | Removes the last `n` elements, creating a new array. |
| Array | dropWhile | 2854 | 2935 | Drops elements from the start while the predicate holds, returning the rest. |
| Array | dropWhileFilter | 2936 | 2999 | Drops elements from the start while a `Filter` succeeds. |
| Array | findFirstIndex | 3000 | 3075 | Returns the index of the first element matching the predicate, wrapped in an `Option`. |
| Array | findLastIndex | 3076 | 3148 | Returns the index of the last element matching the predicate, wrapped in an `Option`. |
| Array | findFirst | 3149 | 3373 | Returns the first element matching a predicate, refinement, or mapping function, wrapped in `Option`. |
| Array | findFirstWithIndex | 3374 | 3584 | Returns the first selected value together with its index, wrapped in an `Option`. |
| Array | findLast | 3585 | 3788 | Returns the last element matching a predicate, refinement, or mapping function, wrapped in `Option`. |
| Array | insertAt | 3789 | 3873 | Inserts an element at the specified index safely, returning a new `NonEmptyArray` wrapped in an `Option`. |
| Array | replace | 3874 | 3958 | Replaces the element at the specified index safely with a new value, returning the updated array in `Option.some`. |
| Array | modify | 3959 | 4061 | Applies a function to the element at the specified index safely, returning the updated array in `Option.some`. |
| Array | remove | 4062 | 4140 | Removes the element at the specified index, returning a new array. |
| Array | reverse | 4141 | 4165 | Reverses an iterable into a new array. |
| Array | sort | 4166 | 4278 | Sorts an array by the given `Order`, returning a new array. |
| Array | sortWith | 4279 | 4395 | Sorts an array by a derived key using a mapping function and an `Order` for that key. |
| Array | sortBy | 4396 | 4439 | Sorts an array by multiple `Order`s applied in sequence: the first order is used first; ties are broken by the second order, and so on. |
| Array | zip | 4440 | 4580 | Pairs elements from two iterables by position. |
| Array | zipWith | 4581 | 4701 | Combines elements from two iterables pairwise using a function. |
| Array | unzip | 4702 | 4719 | Splits an array of pairs into two arrays. |
| Array | intersperse | 4720 | 4828 | Places a separator element between every pair of elements. |
| Array | modifyHeadNonEmpty | 4829 | 4901 | Applies a function to the first element of a non-empty array, returning a new array. |
| Array | setHeadNonEmpty | 4902 | 4974 | Replaces the first element of a non-empty array with a new value. |
| Array | modifyLastNonEmpty | 4975 | 5050 | Applies a function to the last element of a non-empty array, returning a new array. |
| Array | setLastNonEmpty | 5051 | 5123 | Replaces the last element of a non-empty array with a new value. |
| Array | rotate | 5124 | 5248 | Transforms an array by rotating it `n` steps. |
| Array | containsWith | 5249 | 5276 | Returns a membership-test function using a custom equivalence. |
| Array | contains | 5277 | 5349 | Checks whether an array contains a value, using `Equal.asEquivalence()` for comparison. |
| Array | chop | 5350 | 5470 | Applies a function repeatedly to consume prefixes of the array and collect the values it produces. |
| Array | splitAt | 5471 | 5555 | Splits an iterable into two arrays at the given index. |
| Array | splitAtNonEmpty | 5556 | 5640 | Splits a non-empty array into two parts at the given index. |
| Array | split | 5641 | 5722 | Splits an iterable into `n` roughly equal-sized chunks. |
| Array | splitWhere | 5723 | 5798 | Splits an iterable at the first element matching the predicate. |
| Array | copy | 5799 | 5895 | Creates a shallow copy of an array. |
| Array | pad | 5896 | 5983 | Pads or truncates an array to exactly `n` elements, filling with `fill` if the array is shorter, or slicing if longer. |
| Array | chunksOf | 5984 | 6112 | Splits an iterable into chunks of length `n`. |
| Array | window | 6113 | 6206 | Creates overlapping sliding windows of size `n`. |
| Array | groupWith | 6207 | 6303 | Groups consecutive equal elements using a custom equivalence function. |
| Array | group | 6304 | 6331 | Groups consecutive equal elements using `Equal.asEquivalence()`. |
| Array | groupBy | 6332 | 6458 | Groups elements into a record by a key-returning function. |
| Array | unionWith | 6459 | 6634 | Computes the union of two iterables using a custom equivalence. |
| Array | union | 6635 | 6760 | Computes the union of two iterables using `Equal.asEquivalence()`. |
| Array | intersectionWith | 6761 | 6793 | Computes the intersection of two arrays using a custom equivalence. |
| Array | intersection | 6794 | 6872 | Computes the intersection of two arrays using `Equal.asEquivalence()`. |
| Array | differenceWith | 6873 | 6901 | Computes elements in the first array that are not in the second, using a custom equivalence. |
| Array | difference | 6902 | 6980 | Computes elements in the first array that are not in the second, using `Equal.asEquivalence()`. |
| Array | empty | 6981 | 7003 | Creates an empty array. |
| Array | of | 7004 | 7022 | Wraps a single value in a `NonEmptyArray`. |
| Array | ReadonlyArray | 7023 | 7120 | Utility types for working with `ReadonlyArray` at the type level. |
| Array | map | 7121 | 7202 | Transforms each element using a function, returning a new array. |
| Array | flatMap | 7203 | 7319 | Maps each element to an array and flattens the results into a single array. |
| Array | flatten | 7320 | 7342 | Flattens a nested array of arrays into a single array. |
| Array | getSomes | 7343 | 7366 | Extracts all `Some` values from an iterable of `Option`s, discarding `None`s. |
| Array | getFailures | 7367 | 7391 | Extracts all failure values from an iterable of `Result`s, discarding successes. |
| Array | getSuccesses | 7392 | 7416 | Extracts all success values from an iterable of `Result`s, discarding failures. |
| Array | filterMap | 7417 | 7501 | Keeps transformed values for elements where a `Filter` succeeds. |
| Array | filter | 7502 | 7647 | Keeps only elements satisfying a predicate (or refinement). |
| Array | partition | 7648 | 7741 | Splits an iterable using a `Filter` into successes and failures. |
| Array | separate | 7742 | 7773 | Separates an iterable of `Result`s into success values and failure values. |
| Array | reduce | 7774 | 7855 | Folds an iterable from left to right into a single value. |
| Array | reduceRight | 7856 | 7937 | Folds an iterable from right to left into a single value. |
| Array | liftPredicate | 7938 | 7983 | Lifts a predicate into an array: returns `[value]` if the predicate holds, `[]` otherwise. |
| Array | liftOption | 7984 | 8014 | Lifts an `Option`-returning function into one that returns an array: `Some(a)` becomes `[a]`, `None` becomes `[]`. |
| Array | fromNullishOr | 8015 | 8040 | Converts a nullable value to an array: `null`/`undefined` becomes `[]`, anything else becomes `[value]`. |
| Array | liftNullishOr | 8041 | 8066 | Lifts a nullable-returning function into one that returns an array: `null`/`undefined` becomes `[]`, anything else becomes `[value]`. |
| Array | flatMapNullishOr | 8067 | 8142 | Maps each element with a nullable-returning function, keeping only non-null / non-undefined results. |
| Array | liftResult | 8143 | 8175 | Lifts a `Result`-returning function into one that returns an array: failures produce `[]`, successes produce `[value]`. |
| Array | every | 8176 | 8301 | Checks whether all elements satisfy the predicate. |
| Array | some | 8302 | 8365 | Checks whether at least one element satisfies the predicate. |
| Array | extend | 8366 | 8450 | Applies a function to each suffix of the array (starting from each index), collecting the results. |
| Array | min | 8451 | 8511 | Returns the minimum element of a non-empty array according to the given `Order`. |
| Array | max | 8512 | 8572 | Returns the maximum element of a non-empty array according to the given `Order`. |
| Array | unfold | 8573 | 8593 | Builds an array by repeatedly applying a function to a seed value. |
| Array | makeOrder | 8594 | 8615 | Creates an `Order` for arrays based on an element `Order`. |
| Array | makeEquivalence | 8616 | 8637 | Creates an `Equivalence` for arrays based on an element `Equivalence`. |
| Array | forEach | 8638 | 8716 | Runs a side-effect for each element. |
| Array | dedupeWith | 8717 | 8817 | Removes duplicates using a custom equivalence, preserving the order of the first occurrence. |
| Array | dedupe | 8818 | 8842 | Removes duplicates using `Equal.asEquivalence()`, preserving the order of the first occurrence. |
| Array | dedupeAdjacentWith | 8843 | 8930 | Removes consecutive duplicate elements using a custom equivalence. |
| Array | dedupeAdjacent | 8931 | 8954 | Removes consecutive duplicate elements using `Equal.asEquivalence()`. |
| Array | join | 8955 | 9009 | Joins string elements with a separator. |
| Array | mapAccum | 9010 | 9103 | Maps over an array while threading an accumulator through each step, returning both the final state and the mapped array. |
| Array | cartesianWith | 9104 | 9191 | Computes the cartesian product of two arrays, applying a combiner to each pair. |
| Array | cartesian | 9192 | 9273 | Computes the cartesian product of two arrays, returning all pairs as tuples. |
| Array | Do | 9274 | 9310 | Provides the starting point for the "do simulation" — an array comprehension pattern. |
| Array | bind | 9311 | 9420 | Adds a new array variable to a do-notation scope, producing the cartesian product with all previous bindings. |
| Array | bindTo | 9421 | 9512 | Wraps each array element in an object with the given key, starting a do-notation scope. |
| Array | let | 9513 | 9555 | Adds a computed plain value to the do-notation scope without introducing a new array dimension. |
| Array | getReadonlyReducerConcat | 9556 | 9565 | Returns a `Reducer` that combines `ReadonlyArray` values by concatenation. |
| Array | makeReducerConcat | 9566 | 9575 | Returns a `Reducer` that combines `Array` values by concatenation. |
| Array | countBy | 9576 | 9661 | Computes the number of elements in an iterable that satisfy a predicate. |
| BigDecimal | BigDecimal | 22 | 49 | Represents an arbitrary precision decimal number. |
| BigDecimal | isBigDecimal | 50 | 73 | Checks whether a given value is a `BigDecimal`. |
| BigDecimal | make | 74 | 106 | Creates a `BigDecimal` from a `bigint` value and a safe integer scale. |
| BigDecimal | normalize | 107 | 133 | Normalizes a given `BigDecimal` by removing trailing zeros. |
| BigDecimal | scale | 134 | 254 | Changes a `BigDecimal` to the specified scale. |
| BigDecimal | sum | 255 | 345 | Provides an addition operation on `BigDecimal`s. |
| BigDecimal | sumAll | 346 | 376 | Takes an `Iterable` of `BigDecimal`s and returns their sum as a single `BigDecimal`. |
| BigDecimal | multiply | 377 | 452 | Provides a multiplication operation on `BigDecimal`s. |
| BigDecimal | multiplyAll | 453 | 478 | Takes an `Iterable` of `BigDecimal`s and returns their multiplication as a single `BigDecimal`. |
| BigDecimal | subtract | 479 | 560 | Provides a subtraction operation on `BigDecimal`s. |
| BigDecimal | divide | 561 | 663 | Divides `BigDecimal`s safely. |
| BigDecimal | divideUnsafe | 664 | 763 | Provides an unsafe division operation on `BigDecimal`s. |
| BigDecimal | Order | 764 | 790 | Provides an `Order` instance for `BigDecimal` that allows comparing and sorting BigDecimal values. |
| BigDecimal | isLessThan | 791 | 869 | Returns `true` if the first argument is less than the second, otherwise `false`. |
| BigDecimal | isLessThanOrEqualTo | 870 | 948 | Checks whether a given `BigDecimal` is less than or equal to the provided one. |
| BigDecimal | isGreaterThan | 949 | 1027 | Returns `true` if the first argument is greater than the second, otherwise `false`. |
| BigDecimal | isGreaterThanOrEqualTo | 1028 | 1106 | Checks whether a given `BigDecimal` is greater than or equal to the provided one. |
| BigDecimal | between | 1107 | 1200 | Checks whether a `BigDecimal` is between a `minimum` and `maximum` value (inclusive). |
| BigDecimal | clamp | 1201 | 1312 | Restricts the given `BigDecimal` to be within the range specified by the `minimum` and `maximum` values. |
| BigDecimal | min | 1313 | 1388 | Returns the minimum between two `BigDecimal`s. |
| BigDecimal | max | 1389 | 1464 | Returns the maximum between two `BigDecimal`s. |
| BigDecimal | sign | 1465 | 1486 | Determines the sign of a given `BigDecimal`. |
| BigDecimal | abs | 1487 | 1508 | Determines the absolute value of a given `BigDecimal`. |
| BigDecimal | negate | 1509 | 1529 | Provides a negate operation on `BigDecimal`s. |
| BigDecimal | remainder | 1530 | 1644 | Computes the decimal remainder safely when one operand is divided by a second operand. |
| BigDecimal | remainderUnsafe | 1645 | 1741 | Returns the decimal remainder left over when one operand is divided by a non-zero second operand. |
| BigDecimal | Equivalence | 1742 | 1767 | Provides an `Equivalence` instance for `BigDecimal` that determines equality between BigDecimal values. |
| BigDecimal | equals | 1768 | 1849 | Checks whether two `BigDecimal`s are equal. |
| BigDecimal | fromBigInt | 1850 | 1875 | Creates a `BigDecimal` from a `bigint` value. |
| BigDecimal | fromNumberUnsafe | 1876 | 1905 | Creates a `BigDecimal` from a finite `number`. |
| BigDecimal | fromNumber | 1906 | 1939 | Creates a `BigDecimal` safely from a finite `number`. |
| BigDecimal | fromString | 1940 | 1970 | Parses a decimal string into a `BigDecimal` safely. |
| BigDecimal | fromStringUnsafe | 1971 | 2000 | Parses a decimal string into a `BigDecimal`, throwing if the string is invalid. |
| BigDecimal | format | 2001 | 2030 | Formats a `BigDecimal` as a string. |
| BigDecimal | toExponential | 2031 | 2052 | Formats a given `BigDecimal` as a `string` in scientific notation. |
| BigDecimal | toNumberUnsafe | 2053 | 2081 | Converts a `BigDecimal` to a JavaScript `number`. |
| BigDecimal | isInteger | 2082 | 2103 | Checks whether a given `BigDecimal` is an integer. |
| BigDecimal | isZero | 2104 | 2124 | Checks whether a given `BigDecimal` is `0`. |
| BigDecimal | isNegative | 2125 | 2146 | Checks whether a given `BigDecimal` is negative. |
| BigDecimal | isPositive | 2147 | 2168 | Checks whether a given `BigDecimal` is positive. |
| BigDecimal | RoundingMode | 2169 | 2199 | Rounding modes for `BigDecimal`. |
| BigDecimal | round | 2200 | 2317 | Computes a rounded `BigDecimal` at the given scale with the specified rounding mode. |
| BigDecimal | truncate | 2318 | 2414 | Computes a truncated `BigDecimal` at the given scale. |
| BigDecimal | ceil | 2415 | 2523 | Computes the ceiling of a `BigDecimal` at the given scale. |
| BigDecimal | floor | 2524 | 2616 | Computes the floor of a `BigDecimal` at the given scale. |
| BigInt | BigInt | 18 | 47 | Exposes the global bigint constructor for JavaScript bigint coercion. |
| BigInt | isBigInt | 48 | 68 | Checks whether a value is a `bigint`. |
| BigInt | sum | 69 | 138 | Provides an addition operation on `bigint`s. |
| BigInt | multiply | 139 | 205 | Provides a multiplication operation on `bigint`s. |
| BigInt | subtract | 206 | 266 | Provides a subtraction operation on `bigint`s. |
| BigInt | divide | 267 | 357 | Divides one `bigint` by another safely. |
| BigInt | divideUnsafe | 358 | 457 | Divides one `bigint` by another, throwing if the divisor is zero. |
| BigInt | increment | 458 | 477 | Returns the result of adding `1n` to a `bigint`. |
| BigInt | decrement | 478 | 497 | Returns the result of subtracting `1n` from a `bigint`. |
| BigInt | Order | 498 | 524 | Provides an `Order` instance for `bigint` that allows comparing and sorting BigInt values. |
| BigInt | Equivalence | 525 | 546 | Equivalence instance for bigints using strict equality (`===`). |
| BigInt | isLessThan | 547 | 613 | Returns `true` if the first argument is less than the second, otherwise `false`. |
| BigInt | isLessThanOrEqualTo | 614 | 680 | Returns a function that checks if a given `bigint` is less than or equal to the provided one. |
| BigInt | isGreaterThan | 681 | 747 | Returns `true` if the first argument is greater than the second, otherwise `false`. |
| BigInt | isGreaterThanOrEqualTo | 748 | 814 | Returns a function that checks if a given `bigint` is greater than or equal to the provided one. |
| BigInt | between | 815 | 899 | Checks whether a `bigint` is between a `minimum` and `maximum` value (inclusive). |
| BigInt | clamp | 900 | 1002 | Restricts the given `bigint` to be within the range specified by the `minimum` and `maximum` values. |
| BigInt | min | 1003 | 1069 | Returns the minimum between two `bigint`s. |
| BigInt | max | 1070 | 1136 | Returns the maximum between two `bigint`s. |
| BigInt | sign | 1137 | 1158 | Determines the sign of a given `bigint`. |
| BigInt | abs | 1159 | 1180 | Determines the absolute value of a given `bigint`. |
| BigInt | gcd | 1181 | 1253 | Determines the greatest common divisor of two `bigint`s. |
| BigInt | lcm | 1254 | 1326 | Determines the least common multiple of two `bigint`s. |
| BigInt | sqrtUnsafe | 1327 | 1361 | Returns the integer square root of a non-negative `bigint`. |
| BigInt | sqrt | 1362 | 1393 | Computes the integer square root of a `bigint` safely. |
| BigInt | sumAll | 1394 | 1417 | Takes an `Iterable` of `bigint`s and returns their sum as a single `bigint`. |
| BigInt | multiplyAll | 1418 | 1440 | Takes an `Iterable` of `bigint`s and returns their product as a single `bigint`. |
| BigInt | toNumber | 1441 | 1470 | Converts a `bigint` to a `number` safely. |
| BigInt | fromString | 1471 | 1499 | Parses a string into a `bigint` safely. |
| BigInt | fromNumber | 1500 | 1530 | Converts a number to a `bigint`. |
| BigInt | remainder | 1531 | 1615 | Returns the JavaScript remainder of dividing one `bigint` by another. |
| BigInt | ReducerSum | 1616 | 1634 | Reducer for combining `bigint`s using addition. |
| BigInt | ReducerMultiply | 1635 | 1653 | Reducer for combining `bigint`s using multiplication. |
| BigInt | CombinerMax | 1654 | 1668 | Combiner that returns the maximum `bigint`. |
| BigInt | CombinerMin | 1669 | 1684 | Combiner that returns the minimum `bigint`. |
| Boolean | Boolean | 16 | 44 | Exposes the global boolean constructor for JavaScript truthiness coercion. |
| Boolean | isBoolean | 45 | 65 | Checks whether a value is a `boolean`. |
| Boolean | match | 66 | 141 | Chooses between two lazy branches based on a boolean value. |
| Boolean | Order | 142 | 165 | Provides an `Order` instance for `boolean` that allows comparing and sorting boolean values. |
| Boolean | Equivalence | 166 | 187 | Equivalence instance for booleans using strict equality (`===`). |
| Boolean | not | 188 | 208 | Negates the given boolean: `!self` |
| Boolean | and | 209 | 290 | Combines two booleans using logical AND: `self && that`. |
| Boolean | nand | 291 | 360 | Combines two booleans using NAND: `!(self && that)`. |
| Boolean | or | 361 | 430 | Combines two booleans using OR: `self \|\| that`. |
| Boolean | nor | 431 | 500 | Combines two booleans using NOR: `!(self \|\| that)`. |
| Boolean | xor | 501 | 570 | Combines two booleans using XOR: `(!self && that) \|\| (self && !that)`. |
| Boolean | eqv | 571 | 640 | Combines two booleans using EQV (aka XNOR): `!xor(self, that)`. |
| Boolean | implies | 641 | 710 | Combines two booleans using an implication: `(!self \|\| that)`. |
| Boolean | every | 711 | 734 | Checks whether every boolean in a collection is `true`. |
| Boolean | some | 735 | 758 | Checks whether at least one boolean in a collection is `true`. |
| Boolean | ReducerAnd | 759 | 783 | Reducer for combining `boolean`s using AND. |
| Boolean | ReducerOr | 784 | 804 | Reducer for combining `boolean`s using OR. |
| Brand | Brand | 8 | 28 | A generic interface that defines a branded type. |
| Brand | Constructor | 29 | 70 | A constructor for a branded type that provides validation and safe construction methods. |
| Brand | BrandError | 71 | 120 | Error returned when a branded type is constructed from an invalid value. |
| Brand | Brand | 121 | 168 | Namespace containing type-level helpers for working with branded types and brand constructors. |
| Brand | Branded | 169 | 176 | A type alias for creating branded types more concisely. |
| Brand | nominal | 177 | 193 | Returns a `Constructor` that **does not apply any runtime checks** and just returns the provided value. |
| Brand | make | 194 | 208 | Returns a `Constructor` that can construct a branded type from an unbranded value using the provided `filter` predicate as validation of ... |
| Brand | check | 209 | 232 | Creates a branded type `Constructor` from one or more schema checks. |
| Brand | all | 233 | 255 | Combines one or more brand constructors to form a single branded type. |
| ByteSize | ByteSize | 8 | 15 | Represents an exact, non-negative number of bytes. |
| ByteSize | Input | 16 | 33 | Values accepted by byte-size decoding operations. |
| ByteSize | DecimalUnit | 34 | 41 | Canonical decimal byte unit symbols. |
| ByteSize | BinaryUnit | 42 | 49 | Canonical binary byte unit symbols. |
| ByteSize | Unit | 50 | 57 | Canonical decimal and binary byte unit symbols. |
| ByteSize | FormatOptions | 58 | 74 | Options controlling compact byte-size formatting. |
| ByteSize | zero | 75 | 82 | The byte size containing zero bytes. |
| ByteSize | fromStringUnsafe | 83 | 98 | Parses a byte-size string and throws for invalid syntax, unsupported units, or quantities that do not represent non-negative integral bytes. |
| ByteSize | fromString | 99 | 113 | Parses a byte-size string, returning `None` for invalid syntax, unsupported units, or quantities that do not represent non-negative integ... |
| ByteSize | fromInputUnsafe | 114 | 121 | Decodes a trusted input into a byte size and throws for invalid input. |
| ByteSize | fromInput | 122 | 129 | Decodes an input into a byte size, returning `None` for invalid input. |
| ByteSize | bytes | 130 | 137 | Creates a byte size from a non-negative byte count. |
| ByteSize | kilobytes | 138 | 145 | Creates a decimal kilobyte value. |
| ByteSize | megabytes | 146 | 153 | Creates a decimal megabyte value. |
| ByteSize | gigabytes | 154 | 161 | Creates a decimal gigabyte value. |
| ByteSize | terabytes | 162 | 169 | Creates a decimal terabyte value. |
| ByteSize | petabytes | 170 | 177 | Creates a decimal petabyte value. |
| ByteSize | exabytes | 178 | 185 | Creates a decimal exabyte value. |
| ByteSize | zettabytes | 186 | 193 | Creates a decimal zettabyte value. |
| ByteSize | yottabytes | 194 | 201 | Creates a decimal yottabyte value. |
| ByteSize | ronnabytes | 202 | 209 | Creates a decimal ronnabyte value. |
| ByteSize | quettabytes | 210 | 217 | Creates a decimal quettabyte value. |
| ByteSize | kibibytes | 218 | 225 | Creates a binary kibibyte value. |
| ByteSize | mebibytes | 226 | 233 | Creates a binary mebibyte value. |
| ByteSize | gibibytes | 234 | 241 | Creates a binary gibibyte value. |
| ByteSize | tebibytes | 242 | 249 | Creates a binary tebibyte value. |
| ByteSize | pebibytes | 250 | 257 | Creates a binary pebibyte value. |
| ByteSize | exbibytes | 258 | 265 | Creates a binary exbibyte value. |
| ByteSize | zebibytes | 266 | 273 | Creates a binary zebibyte value. |
| ByteSize | yobibytes | 274 | 281 | Creates a binary yobibyte value. |
| ByteSize | isByteSize | 282 | 289 | Checks whether a value is a byte size. |
| ByteSize | isZero | 290 | 297 | Checks whether a byte size is zero. |
| ByteSize | toBigInt | 298 | 305 | Returns the exact byte count as a bigint. |
| ByteSize | toNumber | 306 | 313 | Converts a byte size to a safe integer, returning `None` when it is too large. |
| ByteSize | toNumberUnsafe | 314 | 321 | Converts a byte size to a safe integer and throws when it is too large. |
| ByteSize | toUnit | 322 | 346 | Converts a byte size to an approximate number of the specified unit. |
| ByteSize | Order | 347 | 354 | Provides an order for byte sizes. |
| ByteSize | Equivalence | 355 | 362 | Provides an equivalence for byte sizes. |
| ByteSize | between | 363 | 393 | Returns whether a byte size is in an inclusive range. |
| ByteSize | min | 394 | 418 | Returns the smaller byte size. |
| ByteSize | max | 419 | 443 | Returns the larger byte size. |
| ByteSize | clamp | 444 | 474 | Constrains a byte size to an inclusive range. |
| ByteSize | isLessThan | 475 | 499 | Checks whether the first byte size is less than the second. |
| ByteSize | isLessThanOrEqualTo | 500 | 524 | Checks whether the first byte size is at most the second. |
| ByteSize | isGreaterThan | 525 | 549 | Checks whether the first byte size is greater than the second. |
| ByteSize | isGreaterThanOrEqualTo | 550 | 574 | Checks whether the first byte size is at least the second. |
| ByteSize | equals | 575 | 599 | Checks whether two byte sizes contain the same count. |
| ByteSize | sum | 600 | 624 | Adds two byte sizes exactly. |
| ByteSize | subtract | 625 | 649 | Subtracts byte sizes, returning `None` on underflow. |
| ByteSize | subtractUnsafe | 650 | 674 | Subtracts byte sizes and throws on underflow. |
| ByteSize | times | 675 | 699 | Multiplies a byte size by a non-negative integer scalar. |
| ByteSize | divide | 700 | 724 | Divides a byte size by a positive integer, discarding any remainder. |
| ByteSize | format | 725 | 732 | Formats a byte size with canonical decimal or binary unit symbols. |
| ByteSize | ReducerSum | 733 | 740 | Reducer that sums byte sizes from zero. |
| ByteSize | CombinerMax | 741 | 748 | Combiner that keeps the largest byte size. |
| ByteSize | CombinerMin | 749 | 758 | Combiner that keeps the smallest byte size. |
| Bytes | concat | 12 | 37 | Joins byte chunks into one new `Uint8Array`. |
| Bytes | Equivalence | 38 | 59 | Compares byte sequences for equality, byte by byte. |
| Bytes | Order | 60 | 79 | Orders byte sequences lexicographically by unsigned byte value, placing a prefix before any longer sequence that starts with it. |
| Cache | Cache | 10 | 99 | A cache interface that provides a mutable key-value store with automatic TTL management, capacity limits, and lookup functions for cache ... |
| Cache | Entry | 100 | 129 | Represents a low-level cache entry containing a deferred lookup result and an optional expiration timestamp. |
| Cache | makeWith | 130 | 180 | Creates a cache with dynamic time-to-live based on the result and key. |
| Cache | make | 181 | 255 | Creates a cache with a fixed time-to-live for all entries. |
| Cache | get | 256 | 547 | Retrieves the value for a key, invoking the lookup function on a cache miss or expired entry. |
| Cache | getOption | 548 | 860 | Reads an existing cache entry without invoking the lookup function. |
| Cache | getSuccess | 861 | 915 | Retrieves the value associated with the specified key from the cache, only if it contains a resolved successful value. |
| Cache | set | 916 | 1252 | Sets the value associated with the specified key in the cache. |
| Cache | has | 1253 | 1550 | Checks whether the cache contains an entry for the specified key. |
| Cache | invalidate | 1551 | 1704 | Invalidates the entry associated with the specified key in the cache. |
| Cache | invalidateWhen | 1705 | 1906 | Invalidates the entry associated with the specified key in the cache when the predicate returns true for the cached value. |
| Cache | refresh | 1907 | 2210 | Forces a refresh of the value associated with the specified key in the cache. |
| Cache | invalidateAll | 2211 | 2260 | Invalidates all entries in the cache. |
| Cache | size | 2261 | 2303 | Retrieves the approximate number of entries in the cache. |
| Cache | keys | 2304 | 2337 | Retrieves all active keys from the cache, automatically filtering out expired entries. |
| Cache | values | 2338 | 2371 | Retrieves all successfully cached values from the cache, excluding failed lookups and expired entries. |
| Cache | entries | 2372 | 2390 | Retrieves all key-value pairs from the cache as an iterable. |
| Cause | TypeId | 23 | 30 | Unique brand for `Cause` values, used for runtime type checks via {@link isCause}. |
| Cause | ReasonTypeId | 31 | 38 | Unique brand for `Reason` values, used for runtime type checks via {@link isReason}. |
| Cause | Cause | 39 | 77 | A structured representation of how an Effect failed. |
| Cause | isCause | 78 | 94 | Checks whether an arbitrary value is a `Cause`. |
| Cause | isReason | 95 | 112 | Checks whether an arbitrary value is a `Reason` (`Fail`, `Die`, or `Interrupt`). |
| Cause | Reason | 113 | 143 | A single entry inside a `Cause`'s `reasons` array. |
| Cause | isFailReason | 144 | 169 | Narrows a `Reason` to `Fail`. |
| Cause | isDieReason | 170 | 195 | Narrows a `Reason` to `Die`. |
| Cause | isInterruptReason | 196 | 221 | Narrows a `Reason` to `Interrupt`. |
| Cause | Cause | 222 | 266 | Companion namespace for the `Cause` interface. |
| Cause | Reason | 267 | 290 | Companion namespace for the `Reason` type. |
| Cause | Die | 291 | 326 | An untyped defect — typically a programming error or an uncaught exception. |
| Cause | Fail | 327 | 361 | A typed, expected error produced by `Effect.fail`. |
| Cause | Interrupt | 362 | 388 | A fiber interruption signal, optionally carrying the ID of the fiber that initiated the interruption. |
| Cause | fromReasons | 389 | 426 | Creates a `Cause` from an array of `Reason` values. |
| Cause | empty | 427 | 454 | Represents a `Cause` with an empty `reasons` array. |
| Cause | fail | 455 | 478 | Creates a `Cause` containing a single `Fail` reason with the given typed error. |
| Cause | die | 479 | 502 | Creates a `Cause` containing a single `Die` reason with the given defect. |
| Cause | interrupt | 503 | 522 | Creates a `Cause` containing a single `Interrupt` reason, optionally carrying the interrupting fiber's ID. |
| Cause | makeFailReason | 523 | 546 | Creates a standalone `Fail` reason (not wrapped in a `Cause`). |
| Cause | makeDieReason | 547 | 570 | Creates a standalone `Die` reason (not wrapped in a `Cause`). |
| Cause | makeInterruptReason | 571 | 595 | Creates a standalone `Interrupt` reason (not wrapped in a `Cause`), optionally carrying the interrupting fiber's ID. |
| Cause | hasInterruptsOnly | 596 | 620 | Returns `true` if every reason in the cause is an `Interrupt` (and there is at least one reason). |
| Cause | map | 621 | 723 | Transforms the typed error values inside a `Cause` using the provided function. |
| Cause | combine | 724 | 817 | Merges two causes into a single cause whose `reasons` array is the union of both inputs (de-duplicated by value equality). |
| Cause | squash | 818 | 858 | Collapses a `Cause` into a single `unknown` value, picking the "most important" failure in this order: |
| Cause | hasFails | 859 | 883 | Returns `true` if the cause contains at least one `Fail` reason. |
| Cause | findFail | 884 | 910 | Returns a `Result` whose success value is the first `Fail` reason in the cause, including its annotations. |
| Cause | findError | 911 | 937 | Returns a `Result` whose success value is the first typed error value `E` from a `Fail` reason in the cause. |
| Cause | findErrorOption | 938 | 962 | Returns the first typed error value `E` from a cause wrapped in `Option.some`, or `Option.none` if no `Fail` reason exists. |
| Cause | hasDies | 963 | 987 | Returns `true` if the cause contains at least one `Die` reason. |
| Cause | findDie | 988 | 1013 | Returns a `Result` whose success value is the first `Die` reason in the cause, including its annotations. |
| Cause | findDefect | 1014 | 1039 | Returns a `Result` whose success value is the first defect value from a `Die` reason in the cause. |
| Cause | hasInterrupts | 1040 | 1060 | Returns `true` if the cause contains at least one `Interrupt` reason. |
| Cause | findInterrupt | 1061 | 1085 | Returns a `Result` whose success value is the first `Interrupt` reason in the cause, including its annotations. |
| Cause | interruptors | 1086 | 1115 | Collects the defined fiber IDs from all `Interrupt` reasons in the cause into a `ReadonlySet`. |
| Cause | filterInterruptors | 1116 | 1146 | Returns a `Result` whose success value is the set of defined fiber IDs from the cause's `Interrupt` reasons. |
| Cause | prettyErrors | 1147 | 1191 | Converts a `Cause` into an `Array<Error>` suitable for logging or rethrowing. |
| Cause | pretty | 1192 | 1236 | Formats a `Cause` as a human-readable string for logging or debugging. |
| Cause | YieldableError | 1237 | 1269 | Base interface for error classes that can be yielded directly inside `Effect.gen`. |
| Cause | isNoSuchElementError | 1270 | 1286 | Checks whether an arbitrary value is a `NoSuchElementError`. |
| Cause | NoSuchElementErrorTypeId | 1287 | 1294 | Unique brand for `NoSuchElementError`. |
| Cause | NoSuchElementError | 1295 | 1321 | An error indicating that an expected value was absent. |
| Cause | NoSuchElementError | 1322 | 1344 | Constructs a `NoSuchElementError` with an optional message. |
| Cause | isDone | 1345 | 1361 | Checks whether an arbitrary value is a `Done` signal. |
| Cause | DoneTypeId | 1362 | 1369 | Unique brand for `Done` values. |
| Cause | Done | 1370 | 1411 | A graceful completion signal for queues and streams. |
| Cause | Done | 1412 | 1434 | Companion namespace for the `Done` interface. |
| Cause | Done | 1435 | 1448 | Creates a `Done` signal with an optional value. |
| Cause | done | 1449 | 1473 | Creates an Effect that fails with a `Done` error. |
| Cause | TimeoutErrorTypeId | 1474 | 1481 | Unique brand for `TimeoutError`. |
| Cause | isTimeoutError | 1482 | 1498 | Checks whether an arbitrary value is a `TimeoutError`. |
| Cause | TimeoutError | 1499 | 1514 | An error indicating that an operation exceeded its time limit. |
| Cause | TimeoutError | 1515 | 1530 | Constructs a `TimeoutError` with an optional message. |
| Cause | IllegalArgumentErrorTypeId | 1531 | 1538 | Unique brand for `IllegalArgumentError`. |
| Cause | isIllegalArgumentError | 1539 | 1555 | Checks whether an arbitrary value is an `IllegalArgumentError`. |
| Cause | IllegalArgumentError | 1556 | 1571 | An error indicating that a function received an argument that violates its contract (e.g. |
| Cause | IllegalArgumentError | 1572 | 1587 | Constructs an `IllegalArgumentError` with an optional message. |
| Cause | isExceededCapacityError | 1588 | 1604 | Checks whether an arbitrary value is an `ExceededCapacityError`. |
| Cause | ExceededCapacityErrorTypeId | 1605 | 1612 | Unique brand for `ExceededCapacityError`. |
| Cause | ExceededCapacityError | 1613 | 1633 | An error indicating that a bounded resource (queue, pool, semaphore, etc.) has exceeded its capacity. |
| Cause | ExceededCapacityError | 1634 | 1655 | Constructs an `ExceededCapacityError` with an optional message. |
| Cause | AsyncFiberErrorTypeId | 1656 | 1664 | Unique brand present on `AsyncFiberError` values and used by `isAsyncFiberError` for runtime checks. |
| Cause | isAsyncFiberError | 1665 | 1684 | Checks whether an arbitrary value is an `AsyncFiberError`. |
| Cause | AsyncFiberError | 1685 | 1718 | An error that occurs when trying to run an async fiber with Effect.runSync. |
| Cause | AsyncFiberError | 1719 | 1744 | Constructs an `AsyncFiberError` for a fiber that could not be resolved synchronously. |
| Cause | UnknownErrorTypeId | 1745 | 1752 | Unique brand for `UnknownError`. |
| Cause | isUnknownError | 1753 | 1769 | Checks whether an arbitrary value is an `UnknownError`. |
| Cause | UnknownError | 1770 | 1786 | A wrapper for errors whose type is not statically known. |
| Cause | UnknownError | 1787 | 1804 | Constructs an `UnknownError`. |
| Cause | annotate | 1805 | 1917 | Attaches metadata to every reason in a `Cause`. |
| Cause | reasonAnnotations | 1918 | 1945 | Reads the annotations from a single `Reason` as a `Context`. |
| Cause | annotations | 1946 | 1980 | Reads the merged annotations from all reasons in a `Cause`. |
| Cause | StackTrace | 1981 | 2005 | Context annotation used to store the stack frame captured at the point of failure. |
| Cause | InterruptorStackTrace | 2006 | 2030 | Context annotation used to store the stack frame captured at the point of interruption. |
| Channel | TypeId | 35 | 42 | String literal type used as the unique brand for `Channel` values. |
| Channel | TypeId | 43 | 51 | Runtime identifier stored on `Channel` values and used by `isChannel` to recognize them. |
| Channel | isChannel | 52 | 69 | Checks whether a value is a `Channel`. |
| Channel | Channel | 70 | 129 | A `Channel` is a nexus of I/O operations, which supports both reading and writing. |
| Channel | ChannelUnify | 130 | 147 | Type-level unification support for `Channel` values. |
| Channel | ChannelUnifyIgnore | 148 | 167 | Marker used by `Unify` while resolving `Channel` values. |
| Channel | Variance | 168 | 184 | Phantom variance marker for the type parameters of `Channel`. |
| Channel | VarianceStruct | 185 | 207 | Structural encoding used by `Variance` to record each `Channel` type parameter's variance. |
| Channel | fromTransform | 208 | 226 | Creates a `Channel` from a transformation function that operates on upstream pulls. |
| Channel | transformPull | 227 | 252 | Transforms a Channel by applying a function to its Pull implementation. |
| Channel | fromPull | 253 | 276 | Creates a `Channel` from an `Effect` that produces a `Pull`. |
| Channel | fromTransformBracket | 277 | 293 | Creates a `Channel` from a transformation function that operates on upstream pulls, but also provides a forked scope that closes when the... |
| Channel | toTransform | 294 | 312 | Converts a `Channel` back to its underlying transformation function. |
| Channel | DefaultChunkSize | 313 | 328 | The default chunk size used by channels for batching operations. |
| Channel | callback | 329 | 355 | Creates a `Channel` that interacts with a callback function using a queue. |
| Channel | callbackArray | 356 | 379 | Creates a `Channel` that interacts with a callback function using a queue, emitting arrays. |
| Channel | suspend | 380 | 396 | Creates a `Channel` that lazily evaluates to another channel. |
| Channel | acquireUseRelease | 397 | 425 | Acquires a resource, uses it to build a `Channel`, and guarantees that `release` runs with the channel's `Exit` when the channel complete... |
| Channel | acquireRelease | 426 | 510 | Acquires a resource, emits the acquired value as a single channel element, and registers `release` in the channel scope. |
| Channel | fromIterator | 511 | 528 | Creates a `Channel` from an iterator. |
| Channel | fromArray | 529 | 545 | Creates a `Channel` that emits all elements from an array. |
| Channel | fromChunk | 546 | 563 | Creates a `Channel` that emits all elements from a chunk. |
| Channel | fromIteratorArray | 564 | 616 | Creates a `Channel` from an iterator that emits arrays of elements. |
| Channel | fromIterable | 617 | 634 | Creates a `Channel` that emits all elements from an iterable. |
| Channel | fromIterableArray | 635 | 657 | Creates a `Channel` that emits arrays of elements from an iterable. |
| Channel | succeed | 658 | 674 | Creates a `Channel` that emits a single value and then ends. |
| Channel | end | 675 | 691 | Creates a `Channel` that immediately ends with the specified value. |
| Channel | endSync | 692 | 699 | Creates a `Channel` that immediately ends with the lazily evaluated value. |
| Channel | sync | 700 | 721 | Creates a `Channel` that emits a single value computed by a lazy evaluation. |
| Channel | empty | 722 | 748 | Represents a `Channel` that emits no elements. |
| Channel | never | 749 | 777 | Represents a `Channel` that never completes. |
| Channel | fail | 778 | 794 | Constructs a channel that fails immediately with the specified error. |
| Channel | failSync | 795 | 824 | Constructs a channel that fails immediately with the specified lazily evaluated error. |
| Channel | failCause | 825 | 847 | Constructs a channel that fails immediately with the specified `Cause`. |
| Channel | failCauseSync | 848 | 874 | Constructs a channel that fails immediately with the specified lazily evaluated `Cause`. |
| Channel | die | 875 | 892 | Constructs a channel that fails immediately with the specified defect. |
| Channel | fromEffect | 893 | 911 | Uses an effect to write a single value to the channel. |
| Channel | fromEffectDone | 912 | 924 | Creates a channel that evaluates an effect and uses its successful value as the channel's done value without emitting any output elements. |
| Channel | fromEffectDrain | 925 | 932 | Uses an effect and discards its result. |
| Channel | fromEffectTake | 933 | 946 | Creates a channel from an effect that produces a `Take`. |
| Channel | fromQueue | 947 | 969 | Creates a channel from a queue. |
| Channel | fromQueueArray | 970 | 992 | Creates a channel from a queue that emits arrays of elements. |
| Channel | identity | 993 | 1001 | Creates a channel that forwards upstream input elements, input errors, and the upstream done value unchanged. |
| Channel | fromSubscription | 1002 | 1049 | Creates a channel from a PubSub subscription. |
| Channel | fromSubscriptionArray | 1050 | 1161 | Creates a channel from a PubSub subscription that outputs arrays of values. |
| Channel | fromPubSub | 1162 | 1264 | Creates a channel from a PubSub that outputs individual values. |
| Channel | fromPubSubArray | 1265 | 1404 | Creates a channel from a PubSub that outputs arrays of values. |
| Channel | fromPubSubTake | 1405 | 1417 | Subscribes to a `PubSub` of `Take` values and exposes them as a channel. |
| Channel | fromSchedule | 1418 | 1425 | Creates a Channel from a Schedule. |
| Channel | fromReadableStream | 1426 | 1461 | Creates a channel from a lazily supplied Web `ReadableStream`. |
| Channel | fromWritableStream | 1462 | 1498 | Creates a channel that writes upstream values to a lazily supplied Web `WritableStream`. |
| Channel | fromTransformStream | 1499 | 1534 | Creates a channel backed by a Web `TransformStream`, writing upstream values while emitting transformed values from its readable side. |
| Channel | fromAsyncIterable | 1535 | 1551 | Creates a channel that pulls values from an `AsyncIterable`. |
| Channel | fromAsyncIterableArray | 1552 | 1569 | Creates a channel from an `AsyncIterable`, emitting each yielded value as a single-element non-empty array. |
| Channel | map | 1570 | 1696 | Maps the output of this channel using the specified function. |
| Channel | mapDone | 1697 | 1721 | Maps the done value of this channel using the specified function. |
| Channel | mapDoneEffect | 1722 | 1761 | Maps the done value of this channel using the specified effectful function. |
| Channel | mapEffect | 1762 | 1870 | Maps each output element with an effectful function, preserving the source channel's done value. |
| Channel | mapInput | 1871 | 1898 | Returns a new channel which is the same as this one but applies the given function to the input channel’s input elements. |
| Channel | mapInputError | 1899 | 1926 | Returns a new channel which is the same as this one but applies the given function to the input errors. |
| Channel | tap | 1927 | 2042 | Applies a side effect function to each output element of the channel, returning a new channel that emits the same elements. |
| Channel | flatMap | 2043 | 2163 | Maps each output element to a channel and flattens the child channel outputs. |
| Channel | concatWith | 2164 | 2242 | Concatenates this channel with another channel created from the terminal value of this channel. |
| Channel | concat | 2243 | 2327 | Concatenates this channel with another channel, so that the second channel starts emitting values after the first channel has completed. |
| Channel | combine | 2328 | 2385 | Combines two channels with a stateful pull function. |
| Channel | orElseIfEmpty | 2386 | 2431 | Runs a fallback channel if this channel completes without emitting any output elements. |
| Channel | flatten | 2432 | 2461 | Flattens a channel of channels. |
| Channel | flattenArray | 2462 | 2491 | Flattens a channel that outputs arrays into a channel that outputs individual elements. |
| Channel | flattenTake | 2492 | 2505 | Flattens a channel that emits `Take` values into a channel that emits the `Take` outputs directly. |
| Channel | drain | 2506 | 2528 | Creates a new channel that consumes all output from the source channel but emits nothing, preserving only the completion value. |
| Channel | repeat | 2529 | 2553 | Repeats this channel according to the provided schedule. |
| Channel | forever | 2554 | 2561 | Repeats this channel forever. |
| Channel | schedule | 2562 | 2610 | Runs a schedule step for each output element while preserving the emitted elements. |
| Channel | filter | 2611 | 2761 | Filters the output elements of a channel using a predicate function. |
| Channel | filterMap | 2762 | 2831 | Filters and maps output elements using a `Filter`. |
| Channel | filterEffect | 2832 | 2889 | Filters output elements with an effectful predicate. |
| Channel | filterMapEffect | 2890 | 2962 | Filters and maps output elements using an effectful `Filter`. |
| Channel | filterArray | 2963 | 3153 | Filters arrays of elements emitted by a channel, applying the filter to each element within the arrays and only emitting non-empty filter... |
| Channel | filterMapArray | 3154 | 3196 | Filters and maps each element inside emitted non-empty arrays using a `Filter`. |
| Channel | filterArrayEffect | 3197 | 3257 | Filters each element inside emitted non-empty arrays with an effectful predicate. |
| Channel | filterMapArrayEffect | 3258 | 3318 | Filters and maps each element inside emitted non-empty arrays using an effectful `Filter`. |
| Channel | mapAccum | 3319 | 3443 | Maps over a channel statefully with an accumulator, where each element can produce multiple output values. |
| Channel | scan | 3444 | 3540 | Transforms a channel statefully by scanning over its output with an accumulator function. |
| Channel | scanEffect | 3541 | 3694 | Transforms a channel statefully by scanning over its output with an effectful accumulator function. |
| Channel | catchCause | 3695 | 3809 | Catches any cause of failure from the channel and allows recovery by creating a new channel based on the caught cause. |
| Channel | catchDefect | 3810 | 3900 | Recovers from defects using the provided function. |
| Channel | tapCause | 3901 | 3958 | Runs an effect with the full failure `Cause` when the channel fails, then fails the returned channel with the original cause. |
| Channel | catchCauseIf | 3959 | 4031 | Catches causes of failure that match a specific filter, allowing conditional error recovery based on the type of failure. |
| Channel | catchCauseFilter | 4032 | 4104 | Recovers from channel failures whose full `Cause` is selected by a `Filter`. |
| Channel | catch | 4105 | 4124 | Recovers from typed channel errors by running a fallback channel. |
| Channel | tapError | 4125 | 4167 | Runs an effect when the channel fails with a typed error, then preserves the original channel failure. |
| Channel | catchIf | 4168 | 4318 | Recovers from typed channel errors that match a predicate or refinement. |
| Channel | catchFilter | 4319 | 4406 | Recovers from typed channel errors selected by a `Filter`. |
| Channel | catchTag | 4407 | 4467 | Recovers from tagged channel errors whose `_tag` matches one or more tags. |
| Channel | catchReason | 4468 | 4594 | Catches a specific reason within a tagged error. |
| Channel | catchReasons | 4595 | 4669 | Catches multiple reasons within a tagged error using an object of handlers. |
| Channel | unwrapReason | 4670 | 4766 | Promotes nested reason errors into the channel error, replacing the parent error. |
| Channel | mapError | 4767 | 4806 | Transforms the typed errors of a channel using the specified function. |
| Channel | orDie | 4807 | 4834 | Converts all errors in the channel to defects (unrecoverable failures). |
| Channel | ignore | 4835 | 4864 | Ignores all errors in the channel, converting them to an empty channel. |
| Channel | ignoreCause | 4865 | 4892 | Ignores all errors in the channel including defects, converting them to an empty channel. |
| Channel | retry | 4893 | 4938 | Returns a new channel that retries this channel according to the specified schedule whenever it fails. |
| Channel | switchMap | 4939 | 5053 | Maps each output element to a channel and emits values from the most recent active child channels. |
| Channel | mergeAll | 5054 | 5176 | Merges multiple channels with specified concurrency and buffering options. |
| Channel | HaltStrategy | 5177 | 5193 | Represents strategies for halting merged channels when one completes or fails. |
| Channel | merge | 5194 | 5273 | Returns a new channel, which is the merge of this channel and the specified channel. |
| Channel | mergeEffect | 5274 | 5331 | Runs an effect concurrently with a channel while emitting only the channel's output elements. |
| Channel | splitLines | 5332 | 5359 | Splits upstream string chunks into lines, recognizing `\n`, `\r\n`, and standalone `\r` as line terminators. |
| Channel | decodeText | 5360 | 5374 | Decodes incoming `Uint8Array` chunks into strings using `TextDecoder`. |
| Channel | encodeText | 5375 | 5386 | Encodes incoming string chunks into `Uint8Array` values using `TextEncoder`. |
| Channel | pipeTo | 5387 | 5477 | Returns a new channel that pipes the output of this channel into the specified channel. |
| Channel | pipeToOrFail | 5478 | 5568 | Returns a new channel that pipes the output of this channel into the specified channel and preserves this channel's failures without prov... |
| Channel | unwrap | 5569 | 5597 | Constructs a `Channel` from a scoped effect that will result in a `Channel` if successful. |
| Channel | scoped | 5598 | 5606 | Runs a channel with a scope provided for the duration of the channel execution, removing the channel's `Scope` requirement. |
| Channel | embedInput | 5607 | 5709 | Runs an input handler against the upstream pull while the wrapped channel runs without receiving upstream input directly. |
| Channel | buffer | 5710 | 5801 | Buffers individual output elements in a queue with the configured `capacity` so a faster producer can progress independently of a slower ... |
| Channel | bufferArray | 5802 | 5899 | Buffers array output elements in a queue with the configured `capacity` so a faster producer can progress independently of a slower consu... |
| Channel | interruptWhen | 5900 | 5957 | Interrupts a channel when another effect completes. |
| Channel | haltWhen | 5958 | 6003 | Stops a channel when the specified effect completes or fails. |
| Channel | onError | 6004 | 6043 | Attaches a finalizer that runs only when the channel exits with failure. |
| Channel | onExit | 6044 | 6134 | Returns a channel with an exit-aware finalizer that is guaranteed to run once the channel begins execution, whether it succeeds or fails. |
| Channel | onStart | 6135 | 6174 | Runs an effect before the channel starts. |
| Channel | onFirst | 6175 | 6232 | Runs an effect the first time the channel emits an output element. |
| Channel | onEnd | 6233 | 6275 | Runs an effect when the channel completes successfully. |
| Channel | ensuring | 6276 | 6366 | Returns a channel with a finalizer effect that is guaranteed to run once the channel begins execution, whether it succeeds or fails. |
| Channel | contextWith | 6367 | 6374 | Creates a channel from the specified services. |
| Channel | provideContext | 6375 | 6402 | Provides a `Context` to the channel, removing the corresponding service requirements from the returned channel. |
| Channel | provideService | 6403 | 6430 | Provides a concrete service for a context key, removing that service requirement from the returned channel. |
| Channel | provideServiceEffect | 6431 | 6485 | Provides a service to the channel after obtaining it from an effect. |
| Channel | provide | 6486 | 6535 | Provides a `Layer` or `Context` to the channel, removing the corresponding service requirements. |
| Channel | updateContext | 6536 | 6578 | Transforms the current context before running the channel. |
| Channel | updateService | 6579 | 6618 | Updates a service in the current context before running the channel. |
| Channel | withSpan | 6619 | 6658 | Runs the channel inside a tracing span with the specified name and options. |
| Channel | Do | 6659 | 6666 | The starting channel for Do notation, emitting an empty object. |
| Channel | let | 6667 | 6683 | Adds a computed field to each object emitted by a channel. |
| Channel | bind | 6684 | 6739 | Adds a field to each object emitted by a channel by running another channel derived from that object. |
| Channel | bindTo | 6740 | 6795 | Wraps each output element in an object under the specified field name. |
| Channel | runCount | 6796 | 6821 | Runs a channel and counts the number of elements it outputs. |
| Channel | runDrain | 6822 | 6848 | Runs a channel and discards all output elements, returning only the final result. |
| Channel | runForEach | 6849 | 6942 | Runs a channel and applies an effect to each output element. |
| Channel | runForEachWhile | 6943 | 6985 | Runs a channel and applies an effectful predicate to each output element until the predicate returns `false`. |
| Channel | mkUint8Array | 6986 | 7012 | Concatenates a channel's `Uint8Array` chunks into a single `Uint8Array`. |
| Channel | runCollect | 7013 | 7038 | Runs a channel and collects all output elements into an array. |
| Channel | runHead | 7039 | 7052 | Runs a channel until the first output element is available, returning it in an `Option`. |
| Channel | runLast | 7053 | 7066 | Runs a channel to completion and returns the last output element in an `Option`. |
| Channel | runFold | 7067 | 7145 | Runs a channel and folds over all output elements with an accumulator. |
| Channel | runFoldEffect | 7146 | 7203 | Runs a channel and effectfully folds all output elements with an accumulator. |
| Channel | toPull | 7204 | 7236 | Converts a channel to a scoped `Pull` for low-level consumption. |
| Channel | toPullScoped | 7237 | 7265 | Converts a channel to a Pull within an existing scope. |
| Channel | runIntoQueue | 7266 | 7308 | Runs a channel and offers each output element into a queue. |
| Channel | runIntoQueueArray | 7309 | 7354 | Runs a channel that emits non-empty arrays and offers each array element into a queue. |
| Channel | toQueue | 7355 | 7470 | Creates a scoped queue and forks the channel to feed it for concurrent consumption. |
| Channel | toQueueArray | 7471 | 7523 | Creates a scoped queue and forks an array-emitting channel to feed it. |
| Channel | toPubSub | 7524 | 7581 | Converts a channel to a PubSub for concurrent consumption. |
| Channel | runIntoPubSub | 7582 | 7625 | Runs a channel and publishes each output element to a `PubSub`. |
| Channel | toPubSubArray | 7626 | 7689 | Converts an array-emitting channel to a scoped `PubSub` for concurrent consumption. |
| Channel | runIntoPubSubArray | 7690 | 7739 | Runs an array-emitting channel and publishes each array element to a `PubSub`. |
| Channel | toPubSubTake | 7740 | 7800 | Converts a channel to a scoped `PubSub` of `Take` values. |
| ChannelSchema | encode | 15 | 36 | Creates a channel that encodes non-empty chunks of schema values into the schema's encoded representation. |
| ChannelSchema | encodeUnknown | 37 | 52 | Creates an `encode` channel variant whose encoded output chunks are typed as `unknown`. |
| ChannelSchema | decode | 53 | 74 | Creates a channel that decodes non-empty chunks from the schema's encoded representation into schema values. |
| ChannelSchema | decodeUnknown | 75 | 95 | Creates a `decode` channel variant for schema-decoding channel boundaries. |
| ChannelSchema | duplex | 96 | 177 | Wraps a channel so callers work with typed input and output chunks while the wrapped channel uses encoded chunks. |
| ChannelSchema | duplexUnknown | 178 | 251 | Wraps a bidirectional channel whose encoded chunks are typed as `unknown`. |
| Chunk | Chunk | 29 | 55 | A Chunk is an immutable, ordered collection optimized for efficient concatenation and access patterns. |
| Chunk | NonEmptyChunk | 56 | 74 | A non-empty Chunk guaranteed to contain at least one element. |
| Chunk | ChunkTypeLambda | 75 | 117 | Type lambda for Chunk, used for higher-kinded type operations. |
| Chunk | makeEquivalence | 118 | 140 | Creates an `Equivalence` for chunks that compares chunk lengths and then compares corresponding elements with the provided element equiva... |
| Chunk | isChunk | 141 | 204 | Checks whether `u` is a `Chunk<unknown>` |
| Chunk | empty | 205 | 220 | Creates an empty `Chunk`. |
| Chunk | make | 221 | 236 | Builds a `NonEmptyChunk` from an non-empty collection of elements. |
| Chunk | of | 237 | 252 | Builds a `NonEmptyChunk` from a single element. |
| Chunk | fromIterable | 253 | 268 | Creates a new `Chunk` from an iterable collection of values. |
| Chunk | toArray | 269 | 292 | Converts a `Chunk` into an `Array`. |
| Chunk | toReadonlyArray | 293 | 318 | Converts a `Chunk` into a `ReadonlyArray`. |
| Chunk | reverse | 319 | 344 | Reverses the order of elements in a `Chunk`. |
| Chunk | get | 345 | 432 | Gets the value at an index in a `Chunk` safely, returning `None` when the index is out of bounds. |
| Chunk | fromArrayUnsafe | 433 | 463 | Wraps an array into a chunk without copying. |
| Chunk | fromNonEmptyArrayUnsafe | 464 | 493 | Wraps a non-empty array into a non-empty chunk without copying. |
| Chunk | getUnsafe | 494 | 590 | Gets an element at the specified index without returning an `Option`. |
| Chunk | append | 591 | 678 | Appends the specified element to the end of the `Chunk`. |
| Chunk | prepend | 679 | 742 | Prepends an element to the front of a `Chunk`, creating a new `NonEmptyChunk`. |
| Chunk | take | 743 | 797 | Takes the first up to `n` elements from the chunk. |
| Chunk | drop | 798 | 852 | Drops the first up to `n` elements from the chunk. |
| Chunk | dropRight | 853 | 907 | Drops the last `n` elements. |
| Chunk | dropWhile | 908 | 959 | Drops all elements so long as the predicate returns true. |
| Chunk | prependAll | 960 | 1060 | Prepends the specified prefix chunk to the beginning of the specified chunk. |
| Chunk | appendAll | 1061 | 1201 | Concatenates two chunks, combining their elements. |
| Chunk | filterMap | 1202 | 1286 | Returns a filtered and mapped subset of the elements. |
| Chunk | filter | 1287 | 1402 | Returns a filtered subset of the elements. |
| Chunk | filterMapWhile | 1403 | 1478 | Transforms all elements of the chunk for as long as the specified function succeeds. |
| Chunk | compact | 1479 | 1495 | Filters out optional values |
| Chunk | flatMap | 1496 | 1616 | Applies a function to each element in a chunk and returns a new chunk containing the concatenated mapped elements. |
| Chunk | forEach | 1617 | 1713 | Iterates over each element of a `Chunk` and applies a function to it. |
| Chunk | flatten | 1714 | 1742 | Flattens a chunk of chunks into a single chunk by concatenating all chunks. |
| Chunk | chunksOf | 1743 | 1866 | Groups elements in chunks of up to `n` elements. |
| Chunk | intersection | 1867 | 1963 | Creates a `Chunk` of values that are included in both chunks. |
| Chunk | isEmpty | 1964 | 1980 | Determines if the chunk is empty. |
| Chunk | isNonEmpty | 1981 | 1997 | Determines if the chunk is not empty. |
| Chunk | head | 1998 | 2014 | Returns the first element of this chunk safely if it exists. |
| Chunk | headUnsafe | 2015 | 2046 | Returns the first element of this chunk. |
| Chunk | headNonEmpty | 2047 | 2069 | Returns the first element of this non empty chunk. |
| Chunk | last | 2070 | 2086 | Returns the last element of this chunk safely if it exists. |
| Chunk | lastUnsafe | 2087 | 2118 | Returns the last element of this chunk. |
| Chunk | lastNonEmpty | 2119 | 2141 | Returns the last element of this non empty chunk. |
| Chunk | Chunk | 2142 | 2284 | A namespace containing utility types for Chunk operations. |
| Chunk | map | 2285 | 2353 | Transforms the elements of a chunk using the specified mapping function. |
| Chunk | mapAccum | 2354 | 2450 | Maps over the chunk statefully, producing new elements of type `B`. |
| Chunk | partition | 2451 | 2526 | Splits a chunk using a `Filter` into successes and failures. |
| Chunk | separate | 2527 | 2564 | Separates a chunk of `Result` values into a chunk of successes and a chunk of failures. |
| Chunk | size | 2565 | 2580 | Retrieves the size of the chunk. |
| Chunk | sort | 2581 | 2653 | Sorts the elements of a `Chunk` in increasing order, creating a new `Chunk`. |
| Chunk | sortWith | 2654 | 2750 | Sorts the elements of a `Chunk` based on a projection function. |
| Chunk | splitAt | 2751 | 2838 | Returns two splits of this chunk at the specified index. |
| Chunk | splitNonEmptyAt | 2839 | 2941 | Splits a `NonEmptyChunk` at `n`, returning a non-empty prefix and the remaining suffix. |
| Chunk | split | 2942 | 3041 | Splits a chunk into up to `n` chunks, distributing elements in order. |
| Chunk | splitWhere | 3042 | 3132 | Splits this chunk on the first element that matches this predicate. |
| Chunk | tail | 3133 | 3154 | Returns every element after the first safely, or `None` when the chunk is empty. |
| Chunk | tailNonEmpty | 3155 | 3177 | Returns every element after the first from a non-empty chunk. |
| Chunk | takeRight | 3178 | 3250 | Takes the last `n` elements. |
| Chunk | takeWhile | 3251 | 3371 | Takes all elements so long as the predicate returns true. |
| Chunk | union | 3372 | 3441 | Computes the union of two chunks using Effect equality. |
| Chunk | dedupe | 3442 | 3467 | Removes duplicate elements from a `Chunk`, preserving the first occurrence of each value. |
| Chunk | dedupeAdjacent | 3468 | 3488 | Deduplicates adjacent elements that are identical. |
| Chunk | unzip | 3489 | 3521 | Takes a `Chunk` of pairs and returns two corresponding `Chunk`s. |
| Chunk | zipWith | 3522 | 3591 | Zips this chunk pointwise with the specified chunk using the specified combiner. |
| Chunk | zip | 3592 | 3661 | Zips this chunk pointwise with the specified chunk. |
| Chunk | remove | 3662 | 3731 | Deletes the element at the specified index, creating a new `Chunk`. |
| Chunk | modify | 3732 | 3804 | Applies a function to the element at the specified index safely, creating a new `Chunk`, or returns `None` if the index is out of bounds. |
| Chunk | replace | 3805 | 3877 | Changes the element at the specified index safely, creating a new `Chunk`, or returns `None` if the index is out of bounds. |
| Chunk | makeBy | 3878 | 3941 | Returns a non-empty `Chunk` of length `n` with element `i` initialized by `f(i)`. |
| Chunk | range | 3942 | 3963 | Creates a non-empty `Chunk` of consecutive integers from `start` through `end`, inclusive. |
| Chunk | contains | 3964 | 4042 | Returns a function that checks if a `Chunk` contains a given value using the default `Equivalence`. |
| Chunk | containsWith | 4043 | 4076 | Returns a function that checks if a `Chunk` contains a given value using a provided `isEquivalent` function. |
| Chunk | findFirst | 4077 | 4222 | Returns the first element that satisfies the specified predicate, or `None` if no such element exists. |
| Chunk | findFirstIndex | 4223 | 4292 | Returns the first index for which a predicate holds. |
| Chunk | findLast | 4293 | 4408 | Finds the last element for which a predicate holds. |
| Chunk | findLastIndex | 4409 | 4478 | Returns the last index for which a predicate holds. |
| Chunk | every | 4479 | 4614 | Checks whether a predicate holds true for every `Chunk` element. |
| Chunk | some | 4615 | 4690 | Checks whether a predicate holds true for some `Chunk` element. |
| Chunk | join | 4691 | 4769 | Joins the elements together with "sep" in the middle. |
| Chunk | reduce | 4770 | 4842 | Reduces the elements of a chunk from left to right. |
| Chunk | reduceRight | 4843 | 4927 | Reduces the elements of a chunk from right to left. |
| Chunk | differenceWith | 4928 | 4962 | Creates a `Chunk` of values not included in the other given `Chunk` using the provided `isEquivalent` function. |
| Chunk | difference | 4963 | 5046 | Creates a `Chunk` of values not included in the other given `Chunk`. |
| Clock | Clock | 14 | 149 | Represents a time-based clock which provides functionality related to time and scheduling. |
| Clock | Clock | 150 | 189 | Context reference for the active time service in the environment. |
| Clock | clockWith | 190 | 225 | Accesses the current Clock service and uses it to run the provided function. |
| Clock | currentTimeMillis | 226 | 265 | Returns an Effect that succeeds with the current Unix time in milliseconds. |
| Clock | currentTimeNanos | 266 | 305 | Returns an Effect that succeeds with the current Unix time in nanoseconds. |
| Clock | monotonicTimeNanos | 306 | 327 | Returns an Effect that succeeds with the current monotonic time in nanoseconds. |
| Combiner | Combiner | 14 | 51 | Represents a strategy for combining two values of the same type `A`. |
| Combiner | make | 52 | 80 | Creates a `Combiner` from a binary function. |
| Combiner | flip | 81 | 109 | Reverses the argument order of a combiner's `combine` method. |
| Combiner | min | 110 | 140 | Creates a `Combiner` that returns the smaller of two values according to the provided `Order`. |
| Combiner | max | 141 | 171 | Creates a `Combiner` that returns the larger of two values according to the provided `Order`. |
| Combiner | first | 172 | 198 | Creates a `Combiner` that always returns the first (left) argument. |
| Combiner | last | 199 | 225 | Creates a `Combiner` that always returns the last (right) argument. |
| Combiner | constant | 226 | 255 | Creates a `Combiner` that ignores both arguments and always returns the given constant value. |
| Combiner | intercalate | 256 | 288 | Wraps a `Combiner` so that a separator value is inserted between every pair of combined elements. |
| Config | isConfig | 9 | 30 | Returns `true` if `u` is a `Config` instance. |
| Config | ConfigError | 31 | 59 | Represents the error type produced when config loading or validation fails. |
| Config | Config | 60 | 85 | A recipe for extracting a typed value `T` from a `ConfigProvider`. |
| Config | map | 86 | 170 | Transforms the parsed value of a config with a pure function. |
| Config | flatMap | 171 | 357 | Lets you sequence multiple configs that depend on each other or branch to multiple different configs depending on the parent. |
| Config | mapEffect | 358 | 439 | Transforms the parsed value with a function that may fail. |
| Config | orElse | 440 | 572 | Provides a fallback config when parsing fails with a `ConfigError`. |
| Config | all | 573 | 622 | Combines multiple configs into a single config that parses all of them. |
| Config | withDefault | 623 | 734 | Provides a fallback value when the config is absent. |
| Config | option | 735 | 769 | Makes a config optional: returns `Some(value)` on success and `None` when the config is absent. |
| Config | Success | 770 | 785 | Extracts the successfully parsed value type from a `Config`. |
| Config | Wrap | 786 | 808 | Utility type that recursively replaces primitives with `Config` in a nested structure. |
| Config | unwrap | 809 | 845 | Constructs a `Config<T>` from a value matching `Wrap<T>`. |
| Config | schema | 846 | 937 | Creates a `Config<T>` from a `Schema.Codec`. |
| Config | fail | 938 | 950 | Creates a config that always fails with the given error. |
| Config | succeed | 951 | 976 | Creates a config that always succeeds with the given value, ignoring the provider entirely. |
| Config | String | 977 | 1006 | Creates a config for a single string value. |
| Config | NonEmptyString | 1007 | 1025 | Creates a config for a non-empty string value. |
| Config | Number | 1026 | 1045 | Creates a config for a numeric value (including `NaN`, `Infinity`). |
| Config | Finite | 1046 | 1064 | Creates a config for a finite number (rejects `NaN` and `Infinity`). |
| Config | Int | 1065 | 1083 | Creates a config for an integer value. |
| Config | Literal | 1084 | 1110 | Creates a config that only accepts a specific literal value. |
| Config | Literals | 1111 | 1138 | Creates a config that only accepts one of the specified literal values. |
| Config | Array | 1139 | 1169 | Creates a config for array values that may also be read from a separated string. |
| Config | Array | 1170 | 1170 |  |
| Config | Record | 1171 | 1213 | Creates a config for record values that may also be read from a separated key-value string. |
| Config | Record | 1214 | 1214 |  |
| Config | Boolean | 1215 | 1250 | Creates a config for a boolean value parsed from common string representations. |
| Config | Duration | 1251 | 1290 | Creates a config for a `Duration` value parsed from a human-readable string. |
| Config | ByteSize | 1291 | 1303 | Creates a config for an exact, human-readable byte-size value. |
| Config | Port | 1304 | 1339 | Creates a config for a port number (integer in 1–65535). |
| Config | LogLevel | 1340 | 1374 | Creates a config for a log level string. |
| Config | Redacted | 1375 | 1412 | Creates a config for a redacted string value. |
| Config | URL | 1413 | 1452 | Creates a config for a `URL` value parsed from a string. |
| Config | Date | 1453 | 1483 | Creates a config for a `Date` value parsed from a string. |
| Config | nested | 1484 | 1645 | Scopes a config under a named prefix. |
| ConfigProvider | Node | 20 | 66 | A discriminated union describing the shape of a configuration value at a given path. |
| ConfigProvider | makeValue | 67 | 94 | Creates a `Value` node representing a terminal string leaf. |
| ConfigProvider | makeRecord | 95 | 130 | Creates a `Record` node representing an object-like container with known child keys. |
| ConfigProvider | makeArray | 131 | 163 | Creates an `Array` node representing an indexed container with a known length. |
| ConfigProvider | SourceError | 164 | 202 | Typed error indicating that a configuration source could not be read. |
| ConfigProvider | Path | 203 | 226 | An ordered sequence of string or numeric segments that addresses a node in the configuration tree. |
| ConfigProvider | ConfigProvider | 227 | 296 | The core interface for loading raw configuration data. |
| ConfigProvider | ConfigProvider | 297 | 332 | Context reference for the active raw configuration provider, registered in the context with a default value of `fromEnv()`. |
| ConfigProvider | make | 333 | 380 | Creates a `ConfigProvider` from a raw lookup function. |
| ConfigProvider | orElse | 381 | 513 | Returns a provider that falls back to `that` when `self` returns `undefined` for a path. |
| ConfigProvider | mapInput | 514 | 655 | Transforms the path segments before they reach the underlying store. |
| ConfigProvider | constantCase | 656 | 690 | Converts all string path segments to `CONSTANT_CASE` before lookup. |
| ConfigProvider | nested | 691 | 823 | Scopes a provider so that all lookups are prefixed with the given path segments. |
| ConfigProvider | layer | 824 | 860 | Provides a layer that installs a `ConfigProvider` as the active provider for all downstream effects, replacing any previously installed p... |
| ConfigProvider | layerAdd | 861 | 905 | Creates a Layer that composes a new `ConfigProvider` with the currently active one, rather than replacing it. |
| ConfigProvider | fromUnknown | 906 | 962 | Creates a `ConfigProvider` backed by an in-memory JavaScript value (typically a parsed JSON object). |
| ConfigProvider | fromEnvRecord | 963 | 994 | Creates a `ConfigProvider` backed by an explicit environment record. |
| ConfigProvider | fromEnv | 995 | 1052 | Creates a `ConfigProvider` backed by environment variables. |
| ConfigProvider | fromDotEnvContents | 1053 | 1103 | Creates a `ConfigProvider` by parsing the string contents of a `.env` file. |
| ConfigProvider | fromDotEnv | 1104 | 1158 | Creates a `ConfigProvider` by reading and parsing a `.env` file from the file system. |
| ConfigProvider | fromDir | 1159 | 1224 | Creates a `ConfigProvider` that reads configuration from a directory tree on disk, where each file is a leaf value and each directory is ... |
| Console | Console | 16 | 43 | Represents a console interface for logging, debugging, timing, and grouping output. |
| Console | Console | 44 | 81 | Context reference for the current console service in the Effect system, allowing access to the active console implementation from within ... |
| Console | consoleWith | 82 | 110 | Creates an Effect that provides access to the current console service and lets you perform operations with it within an Effect context. |
| Console | assert | 111 | 138 | Writes the supplied assertion message to the console as an error when `condition` is false; when `condition` is true, no console output i... |
| Console | clear | 139 | 176 | Runs the current console service's clear operation. |
| Console | count | 177 | 208 | Logs and increments the counter associated with `label`, using the console's default counter when no label is provided. |
| Console | countReset | 209 | 242 | Resets the counter associated with the specified label back to zero. |
| Console | debug | 243 | 274 | Writes a debug message through the current `Console` service. |
| Console | dir | 275 | 305 | Displays an interactive list of the properties of the specified object, optionally using console-specific inspection options for debuggin... |
| Console | dirxml | 306 | 330 | Displays an interactive tree of descendant XML or HTML elements, which is particularly useful for inspecting DOM elements in browser envi... |
| Console | error | 331 | 364 | Writes an error-level message to the console, typically displayed with error styling by the active console implementation. |
| Console | group | 365 | 408 | Creates a scoped console group, optionally collapsed and labeled, and closes it automatically when the Effect scope is finalized. |
| Console | info | 409 | 442 | Writes an informational message to the console, typically displayed with info styling by the active console implementation. |
| Console | log | 443 | 474 | Logs a general-purpose message to the console. |
| Console | table | 475 | 508 | Displays tabular data as a formatted table in the console, optionally limited to selected properties. |
| Console | time | 509 | 542 | Starts a scoped timer for `label` and automatically ends it when the Effect scope is finalized. |
| Console | timeLog | 543 | 576 | Logs the elapsed time for an existing timer without stopping it, allowing progress reports for long-running operations. |
| Console | trace | 577 | 604 | Writes the current stack trace to the console to show how the current point in the code was reached. |
| Console | warn | 605 | 637 | Writes a warning-level message to the console, typically displayed with warning styling by the active console implementation. |
| Console | withGroup | 638 | 684 | Runs an Effect inside an optionally labeled or collapsed console group, starting the group before execution and ending it after the Effec... |
| Console | withTime | 685 | 718 | Runs an Effect with a console timer, starting the timer before execution and ending it after the Effect completes. |
| Context | ServiceTypeId | 21 | 29 | String literal type used as the runtime type identifier for `Context` service keys. |
| Context | ServiceTypeId | 30 | 38 | Runtime type identifier attached to `Context` service keys and used by `isKey` to recognize them. |
| Context | Key | 39 | 66 | Typed identifier for a service stored in a `Context`. |
| Context | Service | 67 | 100 | Context key with helper methods for working with a service. |
| Context | ServiceClass | 101 | 123 | Class-style service key produced by `Context.Service<Self, Shape>()("Id")`. |
| Context | ServiceClass | 124 | 144 | Namespace containing helper types for class-style `Context.Service` declarations. |
| Context | Service | 145 | 362 | Creates a `Context` service key. |
| Context | Reference | 363 | 400 | Service key with a lazily computed default value. |
| Context | Service | 401 | 494 | Namespace containing utility types for `Context` service keys. |
| Context | Context | 495 | 529 | Immutable collection of service implementations used for dependency injection in Effect programs. |
| Context | makeUnsafe | 530 | 579 | Creates a `Context` from an existing service map. |
| Context | isContext | 580 | 612 | Checks whether the provided argument is a `Context`. |
| Context | isKey | 613 | 627 | Checks whether the provided argument is a `Key`. |
| Context | isReference | 628 | 648 | Checks whether the provided argument is a `Reference`. |
| Context | empty | 649 | 663 | Returns an empty `Context`. |
| Context | make | 664 | 683 | Creates a new `Context` with a single service associated to the key. |
| Context | add | 684 | 798 | Adds a service to a given `Context`. |
| Context | addUnsafe | 799 | 806 | Adds a service by key to a given `Context` using a string key. |
| Context | addOrOmit | 807 | 918 | Adds or removes a service depending on an `Option`. |
| Context | getOrElse | 919 | 1066 | Gets the service for a key, or evaluates the fallback when a non-reference key is absent. |
| Context | getOrUndefined | 1067 | 1130 | Returns the service currently stored for a key, or `undefined` when the key is absent. |
| Context | getUnsafe | 1131 | 1242 | Gets the service for a key, throwing if an absent non-reference key cannot be resolved. |
| Context | get | 1243 | 1371 | Gets a service from the context that corresponds to the given key. |
| Context | getOption | 1372 | 1477 | Gets the service for a key safely wrapped in an `Option`. |
| Context | merge | 1478 | 1586 | Merges two `Context`s into one. |
| Context | mergeAll | 1587 | 1627 | Merges any number of `Context`s into one. |
| Context | pick | 1628 | 1660 | Returns a new `Context` that contains only the specified services. |
| Context | omit | 1661 | 1693 | Returns a new `Context` with the specified service keys removed. |
| Context | Reference | 1694 | 1745 | Creates a context key with a default value. |
| Cron | DstOverlapPolicy | 9 | 61 | Chooses which occurrences of a repeated wall-clock time a `Cron` schedule includes. |
| Cron | Cron | 62 | 114 | Represents a cron schedule with time constraints and timezone information. |
| Cron | isCron | 115 | 153 | Checks whether a given value is a Cron instance. |
| Cron | make | 154 | 255 | Creates a Cron instance from time constraints. |
| Cron | CronParseError | 256 | 293 | Represents an error that occurs when parsing a cron expression fails. |
| Cron | isCronParseError | 294 | 324 | Checks whether a given value is a CronParseError instance. |
| Cron | parse | 325 | 366 | Parses a cron expression safely into a `Cron` instance, returning a `Result` instead of throwing. |
| Cron | parseUnsafe | 367 | 398 | Parses a cron expression into a `Cron` instance, throwing on failure. |
| Cron | format | 399 | 430 | Formats a `Cron` instance as a cron expression. |
| Cron | match | 431 | 468 | Returns `true` when a date/time matches a `Cron` schedule. |
| Cron | next | 469 | 503 | Returns the next scheduled date/time for the given Cron instance. |
| Cron | prev | 504 | 529 | Returns the previous scheduled date/time for the given Cron instance. |
| Cron | sequence | 530 | 570 | Returns an infinite iterator that yields dates matching the Cron schedule. |
| Cron | Equivalence | 571 | 616 | Equivalence instance for comparing the timezone, field restrictions, and day-matching mode of two `Cron` schedules. |
| Cron | equals | 617 | 760 | Checks whether two `Cron` instances have equal timezone values, field restrictions, and day-matching modes. |
| Data | Class | 16 | 48 | Provides a base class for immutable data types. |
| Data | TaggedClass | 49 | 84 | Provides a base class for immutable data types with a `_tag` discriminator. |
| Data | TaggedEnum | 85 | 134 | Transforms a record of variant definitions into a discriminated union type. |
| Data | TaggedEnum | 135 | 490 | Namespace for `TaggedEnum` utility types. |
| Data | taggedEnum | 491 | 709 | Creates constructors and matchers for a `TaggedEnum` type. |
| Data | Error | 710 | 751 | Provides a base class for yieldable errors. |
| Data | TaggedError | 752 | 804 | Creates a tagged error class with a `_tag` discriminator. |
| DateTime | DateTime | 27 | 35 | A `DateTime` represents a point in time. |
| DateTime | Utc | 36 | 52 | Represents a `DateTime` stored as an absolute UTC instant with no associated time zone. |
| DateTime | Zoned | 53 | 73 | Represents a `DateTime` with an associated `TimeZone`. |
| DateTime | DateTime | 74 | 237 | Companion namespace containing the public helper types used by `DateTime` constructors, parts APIs, formatting, and date/time arithmetic. |
| DateTime | TimeZone | 238 | 249 | Represents a time zone used by `DateTime.Zoned`. |
| DateTime | TimeZone | 250 | 301 | Companion namespace containing the public variant and protocol types for `TimeZone`. |
| DateTime | Disambiguation | 302 | 371 | A `Disambiguation` is used to resolve ambiguities when a `DateTime` is ambiguous, such as during a daylight saving time transition. |
| DateTime | isDateTime | 372 | 386 | Checks whether a value is a `DateTime`. |
| DateTime | isTimeZone | 387 | 402 | Checks whether a value is a `TimeZone`. |
| DateTime | isTimeZoneOffset | 403 | 418 | Checks whether a value is an offset-based `TimeZone`. |
| DateTime | isTimeZoneNamed | 419 | 434 | Checks whether a value is a named `TimeZone` (IANA time zone). |
| DateTime | isUtc | 435 | 450 | Checks whether a `DateTime` is a UTC `DateTime` (no time zone information). |
| DateTime | isZoned | 451 | 466 | Checks whether a `DateTime` is a zoned `DateTime` (has time zone information). |
| DateTime | Equivalence | 467 | 492 | Provides an `Equivalence` for comparing two `DateTime` values for equality. |
| DateTime | Order | 493 | 519 | Provides an `Order` for comparing and sorting `DateTime` values. |
| DateTime | clamp | 520 | 604 | Returns a `DateTime` constrained between a minimum and maximum value. |
| DateTime | fromDateUnsafe | 605 | 624 | Create a `DateTime` from a `Date`. |
| DateTime | makeUnsafe | 625 | 660 | Create a `DateTime` from supported input values. |
| DateTime | fromEpochSeconds | 661 | 676 | Creates a `DateTime.Utc` from the number of seconds since the Unix epoch. |
| DateTime | makeZonedUnsafe | 677 | 718 | Create a `DateTime.Zoned` using `DateTime.makeUnsafe` and a time zone. |
| DateTime | makeZoned | 719 | 760 | Creates a `DateTime.Zoned` safely from an input and a time zone. |
| DateTime | make | 761 | 797 | Creates a `DateTime` safely from supported input values. |
| DateTime | makeZonedFromString | 798 | 825 | Parses an ISO zoned date-time string into a `DateTime.Zoned` safely. |
| DateTime | now | 826 | 842 | Gets the current time using the `Clock` service and converts it to a `DateTime`. |
| DateTime | nowAsDate | 843 | 860 | Gets the current time from the `Clock` service and returns it as a JavaScript `Date`. |
| DateTime | nowUnsafe | 861 | 886 | Gets the current time using `Date.now`. |
| DateTime | toUtc | 887 | 917 | Converts a `DateTime` to a UTC `DateTime`. |
| DateTime | setZone | 918 | 981 | Sets the time zone of a `DateTime`, returning a new `DateTime.Zoned`. |
| DateTime | setZoneOffset | 982 | 1057 | Adds a fixed offset time zone to a `DateTime`. |
| DateTime | zoneMakeNamedUnsafe | 1058 | 1086 | Attempts to create a named time zone from an IANA time zone identifier. |
| DateTime | zoneMakeOffset | 1087 | 1113 | Create a fixed offset time zone. |
| DateTime | zoneMakeNamed | 1114 | 1134 | Creates a named time zone safely from an IANA time zone identifier. |
| DateTime | zoneMakeNamedEffect | 1135 | 1161 | Creates a named time zone effectfully from an IANA time zone identifier. |
| DateTime | zoneMakeLocal | 1162 | 1182 | Create a named time zone from the system's local time zone. |
| DateTime | zoneFromString | 1183 | 1204 | Tries to parse a `TimeZone` from a string safely. |
| DateTime | zoneToString | 1205 | 1221 | Formats a `TimeZone` as a string. |
| DateTime | setZoneNamed | 1222 | 1288 | Sets the time zone of a `DateTime` safely from an IANA time zone identifier. |
| DateTime | setZoneNamedUnsafe | 1289 | 1355 | Sets the time zone of a `DateTime` from an IANA time zone identifier. |
| DateTime | distance | 1356 | 1434 | Computes the difference between two `DateTime` values, returning a `Duration` representing the amount of time between them. |
| DateTime | min | 1435 | 1492 | Returns the earlier of two `DateTime` values. |
| DateTime | max | 1493 | 1550 | Returns the later of two `DateTime` values. |
| DateTime | isGreaterThan | 1551 | 1611 | Checks whether the first `DateTime` is after the second `DateTime`. |
| DateTime | isGreaterThanOrEqualTo | 1612 | 1678 | Checks whether the first `DateTime` is after or equal to the second `DateTime`. |
| DateTime | isLessThan | 1679 | 1739 | Checks whether the first `DateTime` is before the second `DateTime`. |
| DateTime | isLessThanOrEqualTo | 1740 | 1806 | Checks whether the first `DateTime` is before or equal to the second `DateTime`. |
| DateTime | between | 1807 | 1873 | Checks whether a `DateTime` is between two other `DateTime` values (inclusive). |
| DateTime | isFuture | 1874 | 1895 | Checks effectfully if a `DateTime` is in the future compared to the current time. |
| DateTime | isFutureUnsafe | 1896 | 1921 | Checks synchronously if a `DateTime` is in the future compared to the current time. |
| DateTime | isPast | 1922 | 1943 | Checks effectfully if a `DateTime` is in the past compared to the current time. |
| DateTime | isPastUnsafe | 1944 | 1969 | Checks synchronously if a `DateTime` is in the past compared to the current time. |
| DateTime | toDateUtc | 1970 | 1993 | Gets the UTC `Date` of a `DateTime`. |
| DateTime | toDate | 1994 | 2023 | Converts a `DateTime` to a `Date`, applying the time zone first. |
| DateTime | zonedOffset | 2024 | 2048 | Computes the time zone offset of a `DateTime.Zoned` in milliseconds. |
| DateTime | zonedOffsetIso | 2049 | 2072 | Formats the time zone offset of a `DateTime.Zoned` as an ISO string. |
| DateTime | toEpochMillis | 2073 | 2093 | Gets the milliseconds since the Unix epoch of a `DateTime`. |
| DateTime | toEpochSeconds | 2094 | 2115 | Converts a `DateTime` to the number of seconds since the Unix epoch. |
| DateTime | removeTime | 2116 | 2139 | Removes the time aspect of a `DateTime`, first adjusting for the time zone. |
| DateTime | toParts | 2140 | 2162 | Gets the time-zone-adjusted parts of a `DateTime` as an object. |
| DateTime | toPartsUtc | 2163 | 2187 | Gets the UTC parts of a `DateTime` as an object. |
| DateTime | getPartUtc | 2188 | 2251 | Gets one UTC part of a `DateTime` as a number. |
| DateTime | getPart | 2252 | 2321 | Gets one time-zone-adjusted part of a `DateTime` as a number. |
| DateTime | setParts | 2322 | 2403 | Sets time-zone-adjusted parts on a `DateTime`. |
| DateTime | setPartsUtc | 2404 | 2483 | Sets UTC parts on a `DateTime`. |
| DateTime | CurrentTimeZone | 2484 | 2513 | Context service that supplies the ambient `TimeZone` for APIs that work in the current zone, such as `DateTime.setZoneCurrent` and `DateT... |
| DateTime | setZoneCurrent | 2514 | 2533 | Sets the time zone of a `DateTime` to the current time zone, which is determined by the `CurrentTimeZone` service. |
| DateTime | withCurrentZone | 2534 | 2597 | Provides the `CurrentTimeZone` to an effect. |
| DateTime | withCurrentZoneLocal | 2598 | 2616 | Provides the `CurrentTimeZone` to an effect, using the system's local time zone. |
| DateTime | withCurrentZoneOffset | 2617 | 2677 | Provides the `CurrentTimeZone` to an effect, using an offset. |
| DateTime | withCurrentZoneNamed | 2678 | 2750 | Provides the `CurrentTimeZone` to an effect using an IANA time zone identifier. |
| DateTime | nowInCurrentZone | 2751 | 2768 | Gets the current time as a `DateTime.Zoned`, using the `CurrentTimeZone`. |
| DateTime | mutate | 2769 | 2872 | Modifies a `DateTime` with a mutable local `Date` copy. |
| DateTime | mutateUtc | 2873 | 2960 | Modifies a `DateTime` with a mutable UTC `Date` copy. |
| DateTime | mapEpochMillis | 2961 | 3024 | Transforms a `DateTime` by applying a function to the number of milliseconds since the Unix epoch. |
| DateTime | withDate | 3025 | 3103 | Applies a function to a JavaScript `Date` representing the `DateTime` and returns the function's result. |
| DateTime | withDateUtc | 3104 | 3179 | Applies a function to a JavaScript `Date` representing the `DateTime`'s UTC instant and returns the function's result. |
| DateTime | match | 3180 | 3282 | Pattern match on a `DateTime` to handle `Utc` and `Zoned` cases differently. |
| DateTime | addDuration | 3283 | 3397 | Adds the given `Duration` to a `DateTime`. |
| DateTime | subtractDuration | 3398 | 3455 | Subtracts the given `Duration` from a `DateTime`. |
| DateTime | add | 3456 | 3528 | Adds the given `amount` of `unit` to a `DateTime`. |
| DateTime | subtract | 3529 | 3586 | Subtracts the given `amount` of `unit` from a `DateTime`. |
| DateTime | startOf | 3587 | 3663 | Converts a `DateTime` to the start of the given `part`. |
| DateTime | endOf | 3664 | 3740 | Converts a `DateTime` to the end of the given `part`. |
| DateTime | nearest | 3741 | 3817 | Converts a `DateTime` to the nearest given `part`. |
| DateTime | format | 3818 | 3921 | Formats a `DateTime` with `Intl.DateTimeFormat`. |
| DateTime | formatLocal | 3922 | 4004 | Formats a `DateTime` with `Intl.DateTimeFormat` using the system local time zone and locale. |
| DateTime | formatUtc | 4005 | 4105 | Formats a `DateTime` with `Intl.DateTimeFormat` using the UTC time zone. |
| DateTime | formatIntl | 4106 | 4229 | Formats a `DateTime` as a string using the `Intl.DateTimeFormat` API. |
| DateTime | formatIso | 4230 | 4254 | Formats a `DateTime` as a UTC ISO string. |
| DateTime | formatIsoDate | 4255 | 4280 | Formats a `DateTime` as a time zone adjusted ISO date string. |
| DateTime | formatIsoDateUtc | 4281 | 4306 | Formats a `DateTime` as a UTC ISO date string. |
| DateTime | formatIsoOffset | 4307 | 4333 | Formats a `DateTime.Zoned` as an ISO string with an offset. |
| DateTime | formatIsoZoned | 4334 | 4363 | Formats a `DateTime.Zoned` as a string. |
| DateTime | layerCurrentZone | 4364 | 4392 | Create a Layer from the given time zone. |
| DateTime | layerCurrentZoneOffset | 4393 | 4420 | Create a Layer from the given time zone offset. |
| DateTime | layerCurrentZoneNamed | 4421 | 4448 | Create a Layer from the given IANA time zone identifier. |
| DateTime | layerCurrentZoneLocal | 4449 | 4477 | Create a Layer from the system's local time zone. |
| Deferred | Deferred | 19 | 57 | A `Deferred` represents an asynchronous variable that can be set exactly once, with the ability for an arbitrary number of fibers to susp... |
| Deferred | isDeferred | 58 | 70 | Checks whether a value is a `Deferred`. |
| Deferred | Deferred | 71 | 104 | Companion namespace containing type-level metadata for `Deferred`. |
| Deferred | makeUnsafe | 105 | 126 | Creates an empty `Deferred` synchronously outside the `Effect` runtime. |
| Deferred | make | 127 | 152 | Creates a new `Deferred`. |
| Deferred | await | 153 | 190 | Retrieves the value of the `Deferred`, suspending the fiber running the workflow until the result is available. |
| Deferred | complete | 191 | 299 | Runs the supplied `Effect` and attempts to complete the `Deferred` with its memoized result. |
| Deferred | completeWith | 300 | 423 | Attempts to complete the `Deferred` with the specified effect directly. |
| Deferred | done | 424 | 535 | Completes the `Deferred` with the specified `Exit` value, which will be propagated to all fibers waiting on the value of the `Deferred`. |
| Deferred | fail | 536 | 635 | Attempts to complete the `Deferred` with the specified error. |
| Deferred | failSync | 636 | 741 | Computes an error when the returned effect is run, then attempts to complete the `Deferred` with that error. |
| Deferred | failCause | 742 | 841 | Attempts to complete the `Deferred` with the specified `Cause`. |
| Deferred | failCauseSync | 842 | 947 | Computes a `Cause` when the returned effect is run, then attempts to complete the `Deferred` with that cause. |
| Deferred | die | 948 | 1050 | Attempts to complete the `Deferred` with a defect. |
| Deferred | dieSync | 1051 | 1156 | Computes a defect when the returned effect is run, then attempts to complete the `Deferred` with that defect. |
| Deferred | interrupt | 1157 | 1192 | Attempts to complete the `Deferred` with interruption by the current fiber. |
| Deferred | interruptWith | 1193 | 1295 | Attempts to complete the `Deferred` with interruption by the specified `FiberId`. |
| Deferred | isDone | 1296 | 1324 | Returns `true` if this `Deferred` has already been completed with a value or an error, `false` otherwise. |
| Deferred | isDoneUnsafe | 1325 | 1340 | Returns whether this `Deferred` has already been completed synchronously. |
| Deferred | poll | 1341 | 1372 | Returns the current completion effect as an `Option`. |
| Deferred | succeed | 1373 | 1472 | Attempts to complete the `Deferred` with the specified value. |
| Deferred | sync | 1473 | 1575 | Computes a value when the returned effect is run, then attempts to complete the `Deferred` with that value. |
| Deferred | doneUnsafe | 1576 | 1604 | Attempts to complete the `Deferred` synchronously with the specified completion effect. |
| Deferred | into | 1605 | 1720 | Runs an `Effect` and attempts to complete a `Deferred` with the effect's result. |
| Differ | Differ | 10 | 34 | Describes how to compute, combine, and apply patches for values of type `T`. |
| Duration | Duration | 22 | 43 | Represents a span of time with high precision, supporting operations from nanoseconds to weeks. |
| Duration | DurationValue | 44 | 76 | Tagged representation of a `Duration` value. |
| Duration | Unit | 77 | 91 | Valid time units that can be used in duration string representations. |
| Duration | Input | 92 | 118 | Valid input types that can be converted to a Duration. |
| Duration | DurationObject | 119 | 150 | An object with optional duration components that can be combined to create a Duration. |
| Duration | fromInputUnsafe | 151 | 178 | Decodes a `Duration.Input` into a `Duration`. |
| Duration | fromInput | 179 | 196 | Decodes a `Input` value into a `Duration` safely, returning `Option.none()` if decoding fails. |
| Duration | isDuration | 197 | 213 | Checks whether a value is a Duration. |
| Duration | isFinite | 214 | 230 | Checks whether a Duration is finite (not infinite). |
| Duration | isZero | 231 | 247 | Checks whether a Duration is zero. |
| Duration | isNegative | 248 | 265 | Returns `true` if the duration is negative (strictly less than zero). |
| Duration | isPositive | 266 | 283 | Returns `true` if the duration is positive (strictly greater than zero). |
| Duration | abs | 284 | 300 | Returns the absolute value of the duration. |
| Duration | negate | 301 | 317 | Returns the negated duration. |
| Duration | zero | 318 | 333 | A Duration representing zero time. |
| Duration | infinity | 334 | 349 | A Duration representing infinite time. |
| Duration | negativeInfinity | 350 | 365 | A Duration representing negative infinite time. |
| Duration | nanos | 366 | 381 | Creates a Duration from nanoseconds. |
| Duration | micros | 382 | 397 | Creates a Duration from microseconds. |
| Duration | millis | 398 | 413 | Creates a Duration from milliseconds. |
| Duration | seconds | 414 | 429 | Creates a Duration from seconds. |
| Duration | minutes | 430 | 445 | Creates a Duration from minutes. |
| Duration | hours | 446 | 461 | Creates a Duration from hours. |
| Duration | days | 462 | 477 | Creates a Duration from days. |
| Duration | weeks | 478 | 493 | Creates a Duration from weeks. |
| Duration | toMicros | 494 | 510 | Converts a Duration to microseconds. |
| Duration | toMillis | 511 | 527 | Converts a Duration to milliseconds. |
| Duration | toSeconds | 528 | 544 | Converts a Duration to seconds. |
| Duration | toMinutes | 545 | 561 | Converts a Duration to minutes. |
| Duration | toHours | 562 | 578 | Converts a Duration to hours. |
| Duration | toDays | 579 | 595 | Converts a Duration to days. |
| Duration | toWeeks | 596 | 612 | Converts a Duration to weeks. |
| Duration | toNanosUnsafe | 613 | 645 | Gets the duration in nanoseconds as a bigint. |
| Duration | toNanos | 646 | 666 | Gets the duration in nanoseconds safely as an `Option<bigint>`. |
| Duration | toHrTime | 667 | 682 | Converts a Duration to high-resolution time format [seconds, nanoseconds]. |
| Duration | match | 683 | 771 | Pattern matches on the representation of a `Duration`. |
| Duration | matchPair | 772 | 840 | Pattern matches on two `Duration`s, providing handlers that receive both values. |
| Duration | Order | 841 | 865 | Provides an `Order` instance for comparing `Duration` values. |
| Duration | between | 866 | 983 | Returns `true` if a `Duration` is greater than or equal to `minimum` and less than or equal to `maximum`, according to `Duration.Order`. |
| Duration | Equivalence | 984 | 999 | Provides an `Equivalence` instance for comparing `Duration` values. |
| Duration | min | 1000 | 1048 | Returns the smaller of two Durations. |
| Duration | max | 1049 | 1097 | Returns the larger of two Durations. |
| Duration | clamp | 1098 | 1161 | Returns a `Duration` constrained between a minimum and maximum value. |
| Duration | divide | 1162 | 1231 | Divides a `Duration` by a finite, non-zero number safely. |
| Duration | divideUnsafe | 1232 | 1325 | Divides a `Duration` by a number using fallback rules instead of returning an `Option`. |
| Duration | times | 1326 | 1395 | Returns a `Duration` multiplied by a number. |
| Duration | subtract | 1396 | 1471 | Subtracts one Duration from another. |
| Duration | sum | 1472 | 1550 | Adds two Durations together. |
| Duration | isLessThan | 1551 | 1599 | Checks whether the first Duration is less than the second. |
| Duration | isLessThanOrEqualTo | 1600 | 1657 | Checks whether the first Duration is less than or equal to the second. |
| Duration | isGreaterThan | 1658 | 1706 | Checks whether the first Duration is greater than the second. |
| Duration | isGreaterThanOrEqualTo | 1707 | 1764 | Checks whether the first Duration is greater than or equal to the second. |
| Duration | equals | 1765 | 1813 | Checks whether two Durations are equal. |
| Duration | parts | 1814 | 1853 | Decomposes a `Duration` into normalized signed components. |
| Duration | format | 1854 | 1870 | Converts a `Duration` to a human readable string. |
| Duration | formatIso | 1871 | 1898 | Formats a `Duration` as an ISO 8601 duration string. |
| Duration | fromIso | 1899 | 1931 | Parses an ISO 8601 duration string into a `Duration`. |
| Duration | ReducerSum | 1932 | 1952 | Reducer for summing `Duration`s. |
| Duration | CombinerMax | 1953 | 1967 | Combiner that returns the maximum `Duration`. |
| Duration | CombinerMin | 1968 | 1984 | Combiner that returns the minimum `Duration`. |
| Effect | TypeId | 44 | 51 | Type-level identifier for `Effect` values. |
| Effect | TypeId | 52 | 59 | Runtime identifier used to recognize `Effect` values. |
| Effect | Effect | 60 | 91 | The `Effect` interface defines a value that lazily describes a workflow or job. |
| Effect | EffectUnify | 92 | 103 | Type-level unification support for `Effect` values. |
| Effect | EffectTypeLambda | 104 | 113 | Type lambda used to represent `Effect` in higher-kinded APIs. |
| Effect | Variance | 114 | 125 | Variance interface for Effect, encoding the type parameters' variance. |
| Effect | Success | 126 | 141 | Extracts the success type from an `Effect`. |
| Effect | Error | 142 | 161 | Extracts the error type from an `Effect`. |
| Effect | Services | 162 | 177 | Extracts the required services type from an `Effect`. |
| Effect | isEffect | 178 | 194 | Checks whether a value is an `Effect`. |
| Effect | EffectIterator | 195 | 211 | Iterator interface for Effect generators, enabling Effect values to work with generator functions. |
| Effect | All | 212 | 289 | Namespace containing type utilities for the `Effect.all` function, which handles collecting multiple effects into various output structures. |
| Effect | all | 290 | 407 | Combines an iterable or record of effects into one effect whose success shape follows the input. |
| Effect | partition | 408 | 499 | Applies an effectful function to each element and partitions successes and failures. |
| Effect | reduce | 500 | 617 | Reduces elements from left to right with an effectful accumulator function. |
| Effect | validate | 618 | 775 | Applies an effectful function to each element and accumulates all failures. |
| Effect | findFirst | 776 | 845 | Returns the first element that satisfies an effectful predicate. |
| Effect | findFirstFilter | 846 | 906 | Returns the first value that passes an effectful `FilterEffect`. |
| Effect | forEach | 907 | 1111 | Executes an effectful operation for each element in an `Iterable`. |
| Effect | head | 1112 | 1137 | Returns the first element of the iterable produced by an effect, or fails with `NoSuchElementError` if the iterable is empty. |
| Effect | whileLoop | 1138 | 1167 | Executes a body effect repeatedly while a condition holds true. |
| Effect | promise | 1168 | 1217 | Creates an `Effect` that represents an asynchronous computation guaranteed to succeed. |
| Effect | tryPromise | 1218 | 1461 | Creates an `Effect` from an asynchronous computation that may throw or reject, mapping failures into the error channel. |
| Effect | succeed | 1462 | 1488 | Creates an `Effect` that always succeeds with a given value. |
| Effect | succeedNone | 1489 | 1506 | Returns an effect which succeeds with `None`. |
| Effect | succeedSome | 1507 | 1524 | Returns an effect which succeeds with the value wrapped in a `Some`. |
| Effect | suspend | 1525 | 1615 | Creates an `Effect` lazily, delaying construction until it is needed. |
| Effect | sync | 1616 | 1656 | Creates an `Effect` that represents a synchronous side-effectful computation. |
| Effect | void | 1657 | 1666 | Returns an effect that succeeds with `void`. |
| Effect | undefined | 1667 | 1676 | Returns an effect that succeeds with `undefined`. |
| Effect | callback | 1677 | 1724 | Creates an `Effect` from a callback-based asynchronous API. |
| Effect | never | 1725 | 1742 | Returns an effect that will never produce anything. |
| Effect | Do | 1743 | 1766 | Effect that succeeds with an empty record `{}`, used as the starting point for do notation chains. |
| Effect | bindTo | 1767 | 1822 | Gives a name to the success value of an `Effect`, creating a single-key record used in do notation pipelines. |
| Effect | let | 1823 | 1851 | Adds a computed plain value to the do notation record. |
| Effect | bind | 1852 | 1939 | Adds an `Effect` value to the do notation record under a given name. |
| Effect | gen | 1940 | 2112 | Provides a way to write effectful code using generator functions, simplifying control flow and error handling. |
| Effect | gen | 2113 | 2128 | Type helpers for `Effect.gen` generator return signatures. |
| Effect | fail | 2129 | 2161 | Creates an `Effect` that represents a recoverable error. |
| Effect | failSync | 2162 | 2189 | Creates an `Effect` that represents a recoverable error using a lazy evaluation. |
| Effect | failCause | 2190 | 2220 | Creates an `Effect` that represents a failure with a specific `Cause`. |
| Effect | failCauseSync | 2221 | 2248 | Creates an `Effect` that represents a failure with a `Cause` computed lazily. |
| Effect | die | 2249 | 2288 | Creates an effect that terminates a fiber with a specified error. |
| Effect | try | 2289 | 2361 | Creates an `Effect` from a synchronous computation that may throw, mapping thrown values into the error channel. |
| Effect | yieldNow | 2362 | 2385 | Yields control back to the Effect runtime, allowing other fibers to execute. |
| Effect | yieldNowWith | 2386 | 2409 | Yields control back to the Effect runtime with a specified priority, allowing other fibers to execute. |
| Effect | withFiber | 2410 | 2427 | Provides access to the current fiber within an effect computation. |
| Effect | withFiberSucceed | 2428 | 2445 | Accesses the current fiber to compute a successful value. |
| Effect | fromResult | 2446 | 2470 | Converts a `Result` to an `Effect`. |
| Effect | fromOption | 2471 | 2511 | Converts an `Option` into an `Effect`. |
| Effect | transposeOption | 2512 | 2544 | Converts an `Option` of an `Effect` into an `Effect` of an `Option`. |
| Effect | fromNullishOr | 2545 | 2571 | Converts a nullable value to an `Effect`, failing with a `NoSuchElementError` when the value is `null` or `undefined`. |
| Effect | flatMap | 2572 | 2797 | Chains effects to produce new `Effect` instances, useful for combining operations that depend on previous results. |
| Effect | flatten | 2798 | 2822 | Flattens an `Effect` that produces another `Effect` into a single effect. |
| Effect | andThen | 2823 | 3238 | Runs this effect and then runs another effect, optionally using the first effect's success value to choose the next effect. |
| Effect | tap | 3239 | 3504 | Runs a side effect with the result of an effect without changing the original value. |
| Effect | result | 3505 | 3560 | Converts both success and failure of an `Effect` into a `Result` type. |
| Effect | option | 3561 | 3606 | Converts success to `Option.some` and failure to `Option.none`. |
| Effect | exit | 3607 | 3648 | Transforms an effect to encapsulate both failure and success using the `Exit` data type. |
| Effect | map | 3649 | 3841 | Transforms the value inside an effect by applying a function to it. |
| Effect | as | 3842 | 3938 | Replaces the value inside an effect with a constant value. |
| Effect | asSome | 3939 | 3956 | Maps the success value of an `Effect` to `Some`, preserving failures. |
| Effect | asVoid | 3957 | 3974 | Maps the success value of an `Effect` to `void`, preserving failures. |
| Effect | flip | 3975 | 4005 | Swaps an effect's success and failure channels. |
| Effect | zip | 4006 | 4178 | Combines two effects into a single effect, producing a tuple with the results of both effects. |
| Effect | zipWith | 4179 | 4300 | Combines two effects sequentially and applies a function to their results to produce a single value. |
| Effect | catch | 4301 | 4337 | Handles all errors in an effect by providing a fallback effect. |
| Effect | catchTag | 4338 | 4503 | Catches and handles specific errors by their `_tag` field, which is used as a discriminator. |
| Effect | catchTags | 4504 | 4709 | Handles multiple errors in a single block of code using their `_tag` field. |
| Effect | catchReason | 4710 | 4881 | Catches a specific reason within a tagged error. |
| Effect | catchReasons | 4882 | 5039 | Catches multiple reasons within a tagged error using an object of handlers. |
| Effect | TagsWithReason | 5040 | 5063 | Type helper that keeps only error tags whose tagged error contains a tagged `reason` field. |
| Effect | unwrapReason | 5064 | 5172 | Promotes nested reason errors into the Effect error channel, replacing the parent error. |
| Effect | catchCause | 5173 | 5311 | Handles both recoverable and unrecoverable errors by providing a recovery effect. |
| Effect | catchDefect | 5312 | 5465 | Recovers from defects using a provided recovery function. |
| Effect | catchIf | 5466 | 5726 | Recovers from specific errors using a `Predicate` or `Refinement`. |
| Effect | catchFilter | 5727 | 5823 | Recovers from specific errors using a `Filter`. |
| Effect | catchNoSuchElement | 5824 | 5859 | Catches `NoSuchElementError` failures and converts them to `Option.none`. |
| Effect | catchCauseIf | 5860 | 5995 | Recovers from specific failures based on a predicate. |
| Effect | catchCauseFilter | 5996 | 6068 | Recovers from specific failures based on a `Filter`. |
| Effect | mapError | 6069 | 6201 | Transforms the failure value of an effect without changing its success value. |
| Effect | mapBoth | 6202 | 6346 | Applies transformations to both the success and error channels of an effect. |
| Effect | orDie | 6347 | 6379 | Converts typed failures from the error channel into defects, removing the error type from the returned effect. |
| Effect | tapError | 6380 | 6482 | Runs an effectful operation when the source effect fails, while preserving the original failure when the operation succeeds. |
| Effect | tapErrorTag | 6483 | 6600 | Runs an effectful handler when a failure's `_tag` matches. |
| Effect | tapCause | 6601 | 6712 | Runs an effectful operation with the full `Cause` when the source effect fails. |
| Effect | tapCauseIf | 6713 | 6812 | Executes a side effect conditionally when a failed effect's cause matches a predicate. |
| Effect | tapCauseFilter | 6813 | 6885 | Executes a side effect conditionally when a failed effect's cause passes a filter. |
| Effect | tapDefect | 6886 | 6994 | Runs an effectful operation when the source effect dies with a defect. |
| Effect | eventually | 6995 | 7029 | Retries an effect until it succeeds, discarding failures. |
| Effect | Retry | 7030 | 7077 | Type helpers for retrying effects. |
| Effect | retry | 7078 | 7463 | Retries typed failures from an effect according to a retry policy. |
| Effect | retryOrElse | 7464 | 7653 | Retries a failing effect and runs a fallback effect if retries are exhausted. |
| Effect | sandbox | 7654 | 7683 | Exposes an effect's full failure cause in the error channel as `Cause<E>`. |
| Effect | ignore | 7684 | 7746 | Discards both the success and failure values of an effect. |
| Effect | ignoreCause | 7747 | 7787 | Ignores the effect's failure cause, including defects and interruptions. |
| Effect | withExecutionPlan | 7788 | 8033 | Applies an `ExecutionPlan` to an effect, retrying with step-provided resources until it succeeds or the plan is exhausted. |
| Effect | withErrorReporting | 8034 | 8052 | Runs an effect and reports any errors to the configured `ErrorReporter`s. |
| Effect | orElseSucceed | 8053 | 8182 | Recovers from a typed failure by producing a fallback success value. |
| Effect | firstSuccessOf | 8183 | 8227 | Runs a sequence of effects and returns the result of the first successful one. |
| Effect | timeout | 8228 | 8345 | Adds a time limit to an effect, triggering a timeout if the effect exceeds the duration. |
| Effect | timeoutOption | 8346 | 8442 | Runs an effect with a time limit and represents only the timeout case as `Option.none`. |
| Effect | timeoutOrElse | 8443 | 8536 | Applies a timeout to an effect, lazily evaluating `orElse` after interrupting the source if the timeout is reached. |
| Effect | delay | 8537 | 8600 | Returns an effect that is delayed from this effect by the specified `Duration`. |
| Effect | sleep | 8601 | 8625 | Returns an effect that suspends the current fiber for the specified duration without blocking a JavaScript thread. |
| Effect | timed | 8626 | 8651 | Returns the runtime duration of an effect together with its result. |
| Effect | raceAll | 8652 | 8690 | Runs multiple effects concurrently and returns the first successful result. |
| Effect | raceAllFirst | 8691 | 8723 | Runs multiple effects concurrently and completes with the first effect to finish, whether it succeeds or fails. |
| Effect | race | 8724 | 8829 | Races two effects and returns the first successful result. |
| Effect | raceFirst | 8830 | 8959 | Races two effects and returns the result of the first one to complete, whether it succeeds or fails. |
| Effect | filter | 8960 | 9146 | Filters elements of an iterable using a predicate, refinement, or effectful predicate. |
| Effect | filterMap | 9147 | 9210 | Filters and maps elements of an iterable with a `Filter`. |
| Effect | filterMapEffect | 9211 | 9293 | Filters and maps elements of an iterable effectfully with a `FilterEffect`. |
| Effect | filterOrElse | 9294 | 9484 | Filters an effect, providing an alternative effect if the predicate fails. |
| Effect | filterMapOrElse | 9485 | 9551 | Filters an effect with a `Filter`, providing an alternative effect on failure. |
| Effect | filterOrFail | 9552 | 9840 | Filters an effect, failing with a custom error if the predicate fails. |
| Effect | filterMapOrFail | 9841 | 9951 | Filters and maps an effect with a `Filter`, failing when the filter fails. |
| Effect | when | 9952 | 10066 | Runs an effect conditionally based on the result of an effectful boolean condition. |
| Effect | match | 10067 | 10247 | Handles both success and failure cases of an effect without performing side effects. |
| Effect | matchEager | 10248 | 10395 | Handles both success and failure cases of an effect without performing side effects, with eager evaluation for resolved effects. |
| Effect | matchCause | 10396 | 10510 | Handles failures by matching the cause of failure. |
| Effect | matchCauseEager | 10511 | 10610 | Handles failures by matching the cause of failure with eager evaluation. |
| Effect | matchCauseEffectEager | 10611 | 10683 | Handles success or failure eagerly with effectful handlers when the effect is already resolved. |
| Effect | matchCauseEffect | 10684 | 10870 | Handles failures with access to the cause and allows performing side effects. |
| Effect | matchEffect | 10871 | 11051 | Handles both success and failure by running effectful handlers. |
| Effect | isFailure | 11052 | 11078 | Determines whether an effect fails. |
| Effect | isSuccess | 11079 | 11108 | Returns whether an effect completes successfully. |
| Effect | context | 11109 | 11161 | Returns the complete context. |
| Effect | contextWith | 11162 | 11220 | Transforms the current context using the provided function. |
| Effect | provide | 11221 | 11474 | Provides dependencies to an effect using layers or a context. |
| Effect | provideContext | 11475 | 11610 | Provides a context to an effect, fulfilling its service requirements. |
| Effect | setContext | 11611 | 11740 | Runs an effect with the provided context as its complete environment. |
| Effect | service | 11741 | 11770 | Accesses a service from the context. |
| Effect | serviceOption | 11771 | 11816 | Optionally accesses a service from the environment. |
| Effect | updateContext | 11817 | 11949 | Provides part of the required context while leaving the rest unchanged. |
| Effect | updateService | 11950 | 12061 | Runs an effect with a service implementation transformed by the provided function. |
| Effect | updateServiceScoped | 12062 | 12124 | Updates a service for the lifetime of the current scope and restores its previous value when the scope closes. |
| Effect | provideService | 12125 | 12324 | Provides one concrete service implementation to an effect. |
| Effect | provideServiceEffect | 12325 | 12496 | Provides one service to an effect using an effectful acquisition. |
| Effect | scope | 12497 | 12527 | Returns the current scope for resource management. |
| Effect | scoped | 12528 | 12567 | Runs an effect with a scope that closes when the effect completes. |
| Effect | scopedWith | 12568 | 12609 | Creates a scoped effect by providing access to the scope. |
| Effect | acquireRelease | 12610 | 12678 | Constructs a scoped resource from an acquisition effect and a release finalizer. |
| Effect | acquireDisposable | 12679 | 12728 | Acquires a scoped resource that implements JavaScript disposal protocols. |
| Effect | acquireUseRelease | 12729 | 12804 | Runs resource acquisition, usage, and release as one bracketed effect. |
| Effect | addFinalizer | 12805 | 12852 | Adds a finalizer to the current scope. |
| Effect | ensuring | 12853 | 12973 | Returns an effect that, if this effect _starts_ execution, then the specified `finalizer` is guaranteed to be executed, whether this effe... |
| Effect | onError | 12974 | 13061 | Runs the specified effect if this effect fails, providing the error to the effect if it exists. |
| Effect | onErrorIf | 13062 | 13152 | Runs the finalizer only when this effect fails and the `Cause` matches the provided predicate. |
| Effect | onErrorFilter | 13153 | 13207 | Runs the finalizer only when this effect fails and the cause matches the provided `Filter`. |
| Effect | onExitPrimitive | 13208 | 13230 | Runs an optional finalizer with the effect's `Exit` value when the effect completes. |
| Effect | onExit | 13231 | 13327 | Ensures that a cleanup function runs whether this effect succeeds, fails, or is interrupted. |
| Effect | onExitIf | 13328 | 13412 | Runs the cleanup effect only when the `Exit` satisfies the provided predicate. |
| Effect | onExitFilter | 13413 | 13482 | Runs the cleanup effect only when the `Exit` matches the provided `Filter`. |
| Effect | cached | 13483 | 13539 | Returns an effect that lazily computes a result and caches it for subsequent evaluations. |
| Effect | cachedWithTTL | 13540 | 13970 | Returns an effect that caches its result for a fixed duration or a duration computed from its `Exit`, known as "timeToLive" (TTL). |
| Effect | cachedInvalidateWithTTL | 13971 | 14271 | Creates a cached effect result for a fixed duration or a duration computed from its `Exit` and allows manual invalidation before expiration. |
| Effect | interrupt | 14272 | 14292 | Returns an effect that is immediately interrupted. |
| Effect | interruptible | 14293 | 14311 | Returns a new effect that allows the effect to be interruptible. |
| Effect | onInterrupt | 14312 | 14390 | Runs the specified finalizer effect if this effect is interrupted. |
| Effect | uninterruptible | 14391 | 14415 | Returns a new effect that disables interruption for the given effect. |
| Effect | uninterruptibleMask | 14416 | 14448 | Disables interruption and provides a restore function to restore the interruptible state within the effect. |
| Effect | interruptibleMask | 14449 | 14481 | Runs an effect in an interruptible region while providing `restore` for locally restoring the previous interruptibility. |
| Effect | abortSignal | 14482 | 14507 | Creates an AbortSignal that is managed by the provided scope. |
| Effect | Repeat | 14508 | 14551 | Type helpers for repeating effects. |
| Effect | forever | 14552 | 14574 | Repeats this effect forever (until the first error). |
| Effect | repeat | 14575 | 15177 | Repeats an effect based on a specified schedule or until the first failure. |
| Effect | repeatOrElse | 15178 | 15358 | Repeats an effect according to a schedule and runs a fallback effect if repetition fails before the schedule completes. |
| Effect | replicate | 15359 | 15419 | Returns an array of `n` identical effects. |
| Effect | replicateEffect | 15420 | 15592 | Performs this effect `n` times and collects results with `Effect.all` semantics. |
| Effect | schedule | 15593 | 15719 | Runs an effect repeatedly according to a schedule and returns the schedule's final output. |
| Effect | scheduleFrom | 15720 | 15840 | Runs an effect repeatedly according to a schedule that is initialized with a specific schedule input. |
| Effect | tracer | 15841 | 15861 | Returns the current tracer from the context. |
| Effect | withTracer | 15862 | 15925 | Provides a tracer to an effect. |
| Effect | withTracerEnabled | 15926 | 16004 | Enables or disables tracing for spans created by the given effect. |
| Effect | withTracerTiming | 16005 | 16068 | Enables or disables tracer timing for the given Effect. |
| Effect | annotateSpans | 16069 | 16209 | Adds an annotation to each span in this effect. |
| Effect | annotateCurrentSpan | 16210 | 16285 | Adds an annotation to the current span if available. |
| Effect | currentSpan | 16286 | 16312 | Returns the currently active local tracing span. |
| Effect | currentParentSpan | 16313 | 16342 | Returns the current parent span from the effect context. |
| Effect | spanAnnotations | 16343 | 16368 | Returns the tracing span annotations currently carried in the effect context. |
| Effect | spanLinks | 16369 | 16395 | Returns the tracing span links currently carried in the effect context. |
| Effect | linkSpans | 16396 | 16543 | Adds a link with the provided span to all spans in this effect. |
| Effect | makeSpan | 16544 | 16570 | Creates a new tracing span and returns it without managing its lifetime. |
| Effect | makeSpanScoped | 16571 | 16600 | Create a new span for tracing, and automatically close it when the Scope finalizes. |
| Effect | useSpan | 16601 | 16679 | Create a new span for tracing, and automatically close it when the effect completes. |
| Effect | withSpan | 16680 | 16743 | Wraps the effect with a child span for tracing. |
| Effect | withSpanScoped | 16744 | 16825 | Wraps the effect with a scoped child span for tracing. |
| Effect | withParentSpan | 16826 | 16892 | Adds the provided span to the current span stack. |
| Effect | request | 16893 | 17022 | Executes a request using the provided resolver. |
| Effect | requestUnsafe | 17023 | 17045 | Registers a request with a resolver and delivers the exit value via `onExit`. |
| Effect | forkChild | 17046 | 17098 | Returns an effect that forks this effect into its own separate fiber, returning the fiber immediately, without waiting for it to begin ex... |
| Effect | forkIn | 17099 | 17189 | Forks the effect in the specified scope. |
| Effect | forkScoped | 17190 | 17225 | Forks the fiber in a `Scope`, interrupting it when the scope is closed. |
| Effect | forkDetach | 17226 | 17264 | Forks the effect into a new fiber with no parent and no scope, so its lifetime is independent of the forking fiber. |
| Effect | awaitAllChildren | 17265 | 17292 | Waits for all child fibers forked by this effect to complete before this effect completes. |
| Effect | fiber | 17293 | 17315 | Accesses the fiber currently executing the effect. |
| Effect | fiberId | 17316 | 17332 | Accesses the current fiber id executing the effect. |
| Effect | RunOptions | 17333 | 17362 | Configuration options for running Effect programs, providing control over interruption and scheduling behavior. |
| Effect | runFork | 17363 | 17393 | Runs an effect in the background, returning a fiber that can be observed or interrupted. |
| Effect | runForkWith | 17394 | 17433 | Runs an effect in the background with the provided services. |
| Effect | runCallbackWith | 17434 | 17485 | Forks an effect with the provided services, registers `onExit` as a fiber observer, and returns an interruptor. |
| Effect | runCallback | 17486 | 17529 | Runs an effect asynchronously, registering `onExit` as a fiber observer and returning an interruptor. |
| Effect | runPromise | 17530 | 17568 | Executes an effect and returns the result as a `Promise`. |
| Effect | runPromiseWith | 17569 | 17604 | Executes an effect as a Promise with the provided services. |
| Effect | runPromiseExit | 17605 | 17638 | Runs an effect and returns a `Promise` that resolves to an `Exit`, which represents the outcome (success or failure) of the effect. |
| Effect | runPromiseExitWith | 17639 | 17679 | Runs an effect and returns a Promise of Exit with provided services. |
| Effect | runSync | 17680 | 17738 | Executes an effect synchronously and returns its success value. |
| Effect | runSyncWith | 17739 | 17775 | Executes an effect synchronously with provided services. |
| Effect | runSyncExit | 17776 | 17824 | Runs an effect synchronously and captures the outcome safely as an `Exit` type, which represents the outcome (success or failure) of the ... |
| Effect | runSyncExitWith | 17825 | 17869 | Runs an effect synchronously with provided services, returning an Exit result safely. |
| Effect | fn | 17870 | 18658 | Type helpers for functions built with `Effect.fn` and `Effect.fnUntraced`. |
| Effect | fnUntraced | 18659 | 18756 | Creates an Effect-returning function without tracing. |
| Effect | fn | 18757 | 18882 | Creates a reusable traced function from an Effect body. |
| Effect | clockWith | 18883 | 18905 | Retrieves the `Clock` service from the context and provides it to the specified effectful function. |
| Effect | logWithLevel | 18906 | 18940 | Creates a logger function that logs at the specified level. |
| Effect | log | 18941 | 18968 | Logs one or more messages using the default log level. |
| Effect | logFatal | 18969 | 18994 | Logs one or more messages at the FATAL level. |
| Effect | logWarning | 18995 | 19019 | Logs one or more messages at the WARNING level. |
| Effect | logError | 19020 | 19044 | Logs one or more messages at the ERROR level. |
| Effect | logInfo | 19045 | 19069 | Logs one or more messages at the INFO level. |
| Effect | logDebug | 19070 | 19098 | Logs one or more messages at the DEBUG level. |
| Effect | logTrace | 19099 | 19127 | Logs one or more messages at the TRACE level. |
| Effect | withLogger | 19128 | 19221 | Adds a logger to the set of loggers which will output logs for this effect. |
| Effect | annotateLogs | 19222 | 19407 | Adds an annotation to each log line in this effect. |
| Effect | annotateLogsScoped | 19408 | 19531 | Adds log annotations to the current scope. |
| Effect | withLogSpan | 19532 | 19643 | Adds a span to each log line in this effect. |
| Effect | track | 19644 | 19884 | Updates a metric after each effect execution, optionally mapping its `Exit` to the metric's input. |
| Effect | trackSuccesses | 19885 | 20120 | Updates the provided `Metric` every time the wrapped `Effect` succeeds with a value. |
| Effect | trackErrors | 20121 | 20366 | Updates the provided `Metric` every time the wrapped `Effect` fails with an |
| Effect | trackDefects | 20367 | 20617 | Updates the provided `Metric` every time the wrapped `Effect` fails with an |
| Effect | trackDuration | 20618 | 20848 | Updates the provided `Metric` with the `Duration` of time (in nanoseconds) that the wrapped `Effect` took to complete. |
| Effect | TransactionRetryReason | 20849 | 20862 | Why the current transaction attempt started after a previous attempt did not commit. |
| Effect | TransactionMeta | 20863 | 20900 | Journal and attempt metadata for an Effect transaction. |
| Effect | Transaction | 20901 | 20931 | Service that holds the current transaction state. |
| Effect | tx | 20932 | 20979 | Defines a transaction boundary. |
| Effect | txRetry | 20980 | 21017 | Retries the current transaction by signaling that it must be retried. |
| Effect | Effectify | 21018 | 21241 | Type helpers for converting callback-based functions into `Effect` functions. |
| Effect | effectify | 21242 | 21458 | Converts an error-first callback API into a function that returns an `Effect`. |
| Effect | satisfiesSuccessType | 21459 | 21489 | Ensures that an effect's success type extends a given type `A`. |
| Effect | satisfiesErrorType | 21490 | 21522 | Ensures that an effect's error type extends a given type `E`. |
| Effect | satisfiesServicesType | 21523 | 21552 | Ensures that an effect's requirements type extends a given type `R`. |
| Effect | mapEager | 21553 | 21655 | Applies `map` eagerly when an effect is already resolved. |
| Effect | mapErrorEager | 21656 | 21797 | Applies `mapError` eagerly when an effect is already resolved. |
| Effect | mapBothEager | 21798 | 21942 | Applies `mapBoth` eagerly when an effect is already resolved. |
| Effect | flatMapEager | 21943 | 22057 | Applies `flatMap` eagerly when an effect is already resolved. |
| Effect | catchEager | 22058 | 22238 | Applies `catch` eagerly when an effect is already resolved. |
| Effect | fnUntracedEager | 22239 | 22269 | Creates untraced function effects with eager evaluation optimization. |
| Effectable | Prototype | 12 | 61 | Create a low-level `Effect` prototype. |
| Effectable | Mixin | 62 | 109 | Returns a subclass of the provided class that inserts the Effect prototype into the inheritance chain. |
| Equal | symbol | 15 | 54 | Defines the unique string identifier for the `Equal` interface. |
| Equal | Equal | 55 | 110 | The interface for types that define their own equality logic. |
| Equal | equals | 111 | 172 | Checks whether two values are deeply structurally equal. |
| Equal | equals | 173 | 173 |  |
| Equal | isEqual | 174 | 215 | Checks whether a value implements the {@link Equal} interface. |
| Equal | asEquivalence | 216 | 243 | Wraps {@link equals} as an `Equivalence<A>`. |
| Equal | byReference | 244 | 285 | Creates a proxy that uses reference equality instead of structural equality. |
| Equal | byReferenceUnsafe | 286 | 329 | Marks an object permanently to use reference equality, without creating a proxy. |
| Equivalence | Equivalence | 3 | 48 | Represents an equivalence relation over type `A`. |
| Equivalence | EquivalenceTypeLambda | 49 | 85 | Type lambda for `Equivalence`, used for higher-kinded type operations. |
| Equivalence | make | 86 | 135 | Creates a custom equivalence relation with an optimized reference equality check. |
| Equivalence | strictEqual | 136 | 184 | Creates an equivalence relation that uses strict equality (`===`) to compare values. |
| Equivalence | String | 185 | 205 | Equivalence instance for strings using strict equality (`===`). |
| Equivalence | Number | 206 | 227 | Equivalence instance for numbers. |
| Equivalence | Boolean | 228 | 248 | Equivalence instance for booleans using strict equality (`===`). |
| Equivalence | BigInt | 249 | 269 | Equivalence instance for bigints using strict equality (`===`). |
| Equivalence | combine | 270 | 423 | Combines two equivalence relations using logical AND. |
| Equivalence | combineAll | 424 | 490 | Combines multiple equivalence relations into a single equivalence using logical AND. |
| Equivalence | mapInput | 491 | 677 | Transforms an equivalence relation by mapping the input values before comparison. |
| Equivalence | Tuple | 678 | 741 | Creates an equivalence for tuples with heterogeneous element types. |
| Equivalence | Array | 742 | 793 | Creates an equivalence for arrays where all elements are compared using the same equivalence. |
| Equivalence | Struct | 794 | 865 | Creates an equivalence for objects by comparing their properties using provided equivalences. |
| Equivalence | Record | 866 | 919 | Creates an equivalence for objects by comparing all properties using the same equivalence. |
| Equivalence | makeReducer | 920 | 958 | Creates a `Reducer` for combining `Equivalence` instances, useful for aggregating equivalences in collections. |
| Equivalence | Date | 959 | 1009 | Equivalence instance for `Date` objects that compares their `getTime()` values using `Equivalence.Number`. |
| ErrorReporter | TypeId | 22 | 34 | String literal type used as the runtime type identifier for `ErrorReporter` values. |
| ErrorReporter | TypeId | 35 | 48 | Runtime type identifier attached to `ErrorReporter` values. |
| ErrorReporter | ErrorReporter | 49 | 81 | An `ErrorReporter` receives reported failures and forwards them to an external system such as a logging service or error tracker. |
| ErrorReporter | make | 82 | 131 | Creates an `ErrorReporter` from a callback. |
| ErrorReporter | CurrentErrorReporters | 132 | 145 | Context reference that holds the set of active error reporters for the current fiber. |
| ErrorReporter | layer | 146 | 205 | Creates a `Layer` that registers one or more `ErrorReporter`s. |
| ErrorReporter | report | 206 | 237 | Runs all registered error reporters on the current fiber for a `Cause`. |
| ErrorReporter | Reportable | 238 | 290 | Interface that object errors can implement to control reporting behavior. |
| ErrorReporter | ignore | 291 | 310 | Defines the string property key used to mark an object error as ignored by error reporting. |
| ErrorReporter | ignore | 311 | 346 | Defines the runtime property key used to mark an object error as ignored by error reporting. |
| ErrorReporter | isIgnored | 347 | 362 | Returns `true` if the given value has the `ErrorReporter.ignore` annotation set to `true`. |
| ErrorReporter | severity | 363 | 380 | Defines the string property key used to override the severity level of an object error. |
| ErrorReporter | severity | 381 | 414 | Defines the runtime property key used to override the severity level of an object error. |
| ErrorReporter | getSeverity | 415 | 431 | Reads the `ErrorReporter.severity` annotation from an error object, falling back to `"Info"` when the annotation is unset or invalid. |
| ErrorReporter | attributes | 432 | 450 | Defines the string property key used to attach extra key/value metadata to an object error report. |
| ErrorReporter | attributes | 451 | 491 | Defines the runtime property key used to attach extra key/value metadata to an object error report. |
| ErrorReporter | getAttributes | 492 | 519 | Reads the `ErrorReporter.attributes` annotation from an error object, returning an empty record when unset. |
| ExecutionPlan | TypeId | 21 | 29 | String literal type used as the runtime type identifier for `ExecutionPlan` values. |
| ExecutionPlan | TypeId | 30 | 38 | Runtime type identifier attached to `ExecutionPlan` values and used by `isExecutionPlan`. |
| ExecutionPlan | isExecutionPlan | 39 | 61 | Returns `true` if a value is an `ExecutionPlan` by checking for the `ExecutionPlan.TypeId` marker. |
| ExecutionPlan | ExecutionPlan | 62 | 109 | A `ExecutionPlan` can be used with `Effect.withExecutionPlan` or `Stream.withExecutionPlan`, allowing you to provide different resources ... |
| ExecutionPlan | ConfigBase | 110 | 129 | Base type-level configuration carried by an `ExecutionPlan`. |
| ExecutionPlan | make | 130 | 160 | Create an `ExecutionPlan`, which can be used with `Effect.withExecutionPlan` or `Stream.withExecutionPlan`, allowing you to provide diffe... |
| ExecutionPlan | make | 161 | 248 | Namespace containing type helpers used by `ExecutionPlan.make`. |
| ExecutionPlan | merge | 249 | 273 | Combines multiple execution plans by concatenating their steps in order. |
| ExecutionPlan | Metadata | 274 | 289 | Metadata describing the currently running execution-plan attempt. |
| ExecutionPlan | CurrentMetadata | 290 | 303 | Context reference containing metadata for the currently running execution-plan attempt. |
| ExecutionPlan | AttemptStart | 304 | 323 | Lifecycle event emitted before an execution-plan attempt runs. |
| ExecutionPlan | AttemptSuccess | 324 | 342 | Lifecycle event emitted when an execution-plan attempt succeeds. |
| ExecutionPlan | AttemptFailure | 343 | 364 | Lifecycle event emitted when an execution-plan attempt fails. |
| ExecutionPlan | Event | 365 | 379 | Union of the lifecycle events emitted while an execution plan runs. |
| Exit | Exit | 19 | 57 | Represents the result of an Effect computation. |
| Exit | Exit | 58 | 87 | Namespace containing helper types shared by `Exit` values. |
| Exit | Success | 88 | 119 | A successful Exit containing a value. |
| Exit | Failure | 120 | 155 | A failed Exit containing a Cause. |
| Exit | isExit | 156 | 186 | Checks whether an unknown value is an Exit. |
| Exit | succeed | 187 | 214 | Creates a successful Exit containing the given value. |
| Exit | failCause | 215 | 244 | Creates a failed Exit from a Cause. |
| Exit | fail | 245 | 274 | Creates a failed Exit from a typed error value. |
| Exit | die | 275 | 305 | Creates a failed Exit from a defect (unexpected error). |
| Exit | interrupt | 306 | 332 | Creates a failed Exit representing fiber interruption. |
| Exit | void | 333 | 362 | Provides a pre-allocated successful Exit with a `void` value. |
| Exit | isSuccess | 363 | 390 | Checks whether an Exit is a Success. |
| Exit | isFailure | 391 | 418 | Checks whether an Exit is a Failure. |
| Exit | hasFails | 419 | 448 | Checks whether a failed Exit contains typed errors (Fail reasons). |
| Exit | hasDies | 449 | 478 | Checks whether a failed Exit contains defects (Die reasons). |
| Exit | hasInterrupts | 479 | 508 | Checks whether a failed Exit contains interruptions (Interrupt reasons). |
| Exit | filterSuccess | 509 | 542 | Extracts the Success variant from an Exit as a Result. |
| Exit | filterValue | 543 | 577 | Extracts the success value from an Exit as a Result. |
| Exit | filterFailure | 578 | 611 | Extracts the Failure variant from an Exit as a Result. |
| Exit | filterCause | 612 | 645 | Extracts the Cause from a failed Exit as a Result. |
| Exit | findError | 646 | 680 | Extracts the first typed error value from a failed Exit as a Result. |
| Exit | findDefect | 681 | 715 | Extracts the first defect from a failed Exit as a Result. |
| Exit | match | 716 | 815 | Pattern matches on an Exit, handling both success and failure cases. |
| Exit | map | 816 | 903 | Transforms the success value of an Exit using the given function. |
| Exit | mapError | 904 | 1012 | Transforms the typed error of a failed Exit using the given function. |
| Exit | mapBoth | 1013 | 1139 | Transforms both the success value and typed error of an Exit. |
| Exit | asVoid | 1140 | 1169 | Discards the success value of an Exit, replacing it with `void`. |
| Exit | asVoidAll | 1170 | 1200 | Combines multiple Exit values into a single `Exit<void, E>`. |
| Exit | getSuccess | 1201 | 1229 | Returns the success value of an Exit as an Option. |
| Exit | getCause | 1230 | 1258 | Returns the Cause of a failed Exit as an Option. |
| Exit | findErrorOption | 1259 | 1295 | Returns the first typed error from a failed Exit as an Option. |
| Fiber | Fiber | 24 | 81 | A runtime fiber is a lightweight thread that executes Effects. |
| Fiber | Fiber | 82 | 176 | The Fiber namespace contains utility types and functions for working with fibers. |
| Fiber | await | 177 | 215 | Waits for a fiber to complete and returns its exit value. |
| Fiber | awaitAll | 216 | 253 | Waits for all fibers in the provided iterable to complete and returns an array of their exit values. |
| Fiber | join | 254 | 288 | Joins a fiber, blocking until it completes. |
| Fiber | joinAll | 289 | 314 | Waits for all fibers to succeed and returns their values in input order. |
| Fiber | interrupt | 315 | 355 | Interrupts a fiber, causing it to stop executing and clean up any acquired resources. |
| Fiber | interruptAs | 356 | 482 | Interrupts a fiber with a specific fiber ID as the interruptor. |
| Fiber | interruptAll | 483 | 523 | Interrupts all fibers in the provided iterable, causing them to stop executing and clean up any acquired resources. |
| Fiber | interruptAllAs | 524 | 659 | Interrupts all fibers in the provided iterable using the specified fiber ID as the interrupting fiber. |
| Fiber | isFiber | 660 | 695 | Checks whether a value is a Fiber. |
| Fiber | getCurrent | 696 | 728 | Returns the current fiber if called from within a fiber context, otherwise returns `undefined`. |
| Fiber | runIn | 729 | 802 | Adds a fiber to a `Scope` and returns the same fiber. |
| FiberHandle | FiberHandle | 10 | 48 | Scoped handle that manages at most one fiber, interrupts the current fiber when the handle's scope closes, and removes managed fibers fro... |
| FiberHandle | isFiberHandle | 49 | 72 | Returns `true` if a value is a `FiberHandle` by checking for the `FiberHandle` runtime marker. |
| FiberHandle | make | 73 | 110 | Creates a scoped `FiberHandle` that can store a single fiber. |
| FiberHandle | makeRuntime | 111 | 151 | Creates a scoped run function that forks effects into a new `FiberHandle`. |
| FiberHandle | makeRuntimePromise | 152 | 193 | Creates a scoped run function that forks effects into a new `FiberHandle` and returns a `Promise` for each effect result. |
| FiberHandle | setUnsafe | 194 | 302 | Sets the fiber in a FiberHandle. |
| FiberHandle | set | 303 | 411 | Sets the fiber in the `FiberHandle`. |
| FiberHandle | getUnsafe | 412 | 445 | Retrieves the fiber from the FiberHandle synchronously. |
| FiberHandle | get | 446 | 473 | Retrieves the fiber from the FiberHandle effectfully. |
| FiberHandle | clear | 474 | 504 | Interrupts the fiber currently stored in the `FiberHandle`, if any, and leaves the handle empty. |
| FiberHandle | run | 505 | 627 | Forks an Effect and stores the resulting fiber in the `FiberHandle`. |
| FiberHandle | runtime | 628 | 676 | Captures the current runtime and returns a function for forking effects into an existing `FiberHandle`. |
| FiberHandle | runtimePromise | 677 | 714 | Captures the current runtime and returns a function for running effects in an existing `FiberHandle` as Promises. |
| FiberHandle | join | 715 | 746 | Waits for the `FiberHandle` to fail or close. |
| FiberHandle | awaitEmpty | 747 | 776 | Waits for the fiber in the FiberHandle to complete. |
| FiberMap | FiberMap | 10 | 51 | A FiberMap is a collection of fibers, indexed by a key. |
| FiberMap | isFiberMap | 52 | 78 | Returns `true` if a value is a `FiberMap`. |
| FiberMap | make | 79 | 115 | Creates a scoped `FiberMap` for storing fibers by key. |
| FiberMap | makeRuntime | 116 | 152 | Creates a scoped run function that forks effects into a new `FiberMap`. |
| FiberMap | makeRuntimePromise | 153 | 195 | Creates a scoped run function that forks effects into a new `FiberMap` and returns a `Promise` for each effect result. |
| FiberMap | setUnsafe | 196 | 334 | Adds a fiber to the `FiberMap` under a key using a synchronous, unsafe mutation. |
| FiberMap | set | 335 | 461 | Adds a fiber to the `FiberMap` under a key. |
| FiberMap | getUnsafe | 462 | 573 | Retrieves a fiber from the FiberMap synchronously. |
| FiberMap | get | 574 | 682 | Retrieves a fiber from the FiberMap effectfully. |
| FiberMap | hasUnsafe | 683 | 764 | Checks whether a key exists in the FiberMap. |
| FiberMap | has | 765 | 849 | Checks whether a key exists in the FiberMap. |
| FiberMap | remove | 850 | 946 | Removes a fiber from the FiberMap, interrupting it if it exists. |
| FiberMap | clear | 947 | 979 | Removes all fibers from the FiberMap, interrupting them. |
| FiberMap | run | 980 | 1099 | Forks an Effect and stores the resulting fiber in the `FiberMap` under a key. |
| FiberMap | runtime | 1100 | 1143 | Captures the current runtime and returns a function for forking effects into an existing `FiberMap`. |
| FiberMap | runtimePromise | 1144 | 1183 | Captures the current runtime and returns a function for running effects in an existing `FiberMap` as Promises. |
| FiberMap | size | 1184 | 1212 | Gets the number of fibers currently in the FiberMap. |
| FiberMap | join | 1213 | 1244 | Waits for the `FiberMap` to fail or close. |
| FiberMap | awaitEmpty | 1245 | 1276 | Waits for the FiberMap to be empty. |
| FiberSet | FiberSet | 8 | 46 | A FiberSet is a collection of fibers that can be managed together. |
| FiberSet | isFiberSet | 47 | 69 | Checks whether a value is a FiberSet. |
| FiberSet | make | 70 | 106 | Creates a scoped `FiberSet` for storing fibers. |
| FiberSet | makeRuntime | 107 | 140 | Creates a scoped run function that forks effects into a new `FiberSet`. |
| FiberSet | makeRuntimePromise | 141 | 181 | Creates a scoped run function that forks effects into a new `FiberSet` and returns a `Promise` for each effect result. |
| FiberSet | addUnsafe | 182 | 306 | Adds an existing fiber to the `FiberSet` using a synchronous, unsafe mutation. |
| FiberSet | add | 307 | 395 | Adds a fiber to the FiberSet. |
| FiberSet | clear | 396 | 427 | Interrupts all fibers in the `FiberSet` and clears the set. |
| FiberSet | run | 428 | 524 | Forks an Effect and adds the fiber to the FiberSet. |
| FiberSet | runtime | 525 | 560 | Captures a `Runtime` and uses it to fork effects into the `FiberSet`. |
| FiberSet | runtimePromise | 561 | 602 | Captures a `Runtime` and returns a Promise-based runner that forks effects into the `FiberSet`. |
| FiberSet | size | 603 | 631 | Gets the number of fibers currently in the FiberSet. |
| FiberSet | join | 632 | 657 | Joins all fibers in the FiberSet. |
| FiberSet | awaitEmpty | 658 | 688 | Waits until the fiber set is empty. |
| FileSystem | FileSystem | 11 | 339 | Core interface for file system operations in Effect. |
| FileSystem | OpenFlag | 340 | 372 | File open flags that determine how a file is opened and what operations are allowed. |
| FileSystem | FileSystem | 373 | 415 | Service tag for platform file-system operations. |
| FileSystem | DirectoryEntry | 416 | 429 | A directory entry with its type, independent of any symlink target. |
| FileSystem | make | 430 | 454 | Creates a FileSystem implementation from a partial implementation. |
| FileSystem | makeNoop | 455 | 508 | Creates a stub `FileSystem` implementation for tests. |
| FileSystem | layerNoop | 509 | 543 | Creates a Layer that provides a no-op FileSystem implementation for testing. |
| FileSystem | FileTypeId | 544 | 560 | Runtime type identifier attached to `FileSystem.File` handles and used by `isFile` to recognize them. |
| FileSystem | isFile | 561 | 582 | Returns `true` if a value is a `File` handle by checking for the `FileTypeId` marker. |
| FileSystem | File | 583 | 665 | Interface representing an open file handle. |
| FileSystem | File | 666 | 784 | Namespace containing types associated with open file handles, including file descriptors, entry kinds, and stat information. |
| FileSystem | SeekMode | 785 | 805 | Specifies the reference point for seeking within an open file. |
| FileSystem | WatchOptions | 806 | 824 | Options for watching files or directories. |
| FileSystem | WatchEvent | 825 | 844 | Represents file system events emitted when watching files or directories. |
| FileSystem | WatchEvent | 845 | 900 | Namespace containing the concrete event shapes emitted by `FileSystem.watch`. |
| FileSystem | WatchBackend | 901 | 945 | Service key for file system watch backend implementations. |
| Filter | Filter | 19 | 45 | Represents a filter function that can transform inputs to outputs or filter them out. |
| Filter | FilterEffect | 46 | 86 | Represents an effectful filter function that can produce Effects. |
| Filter | make | 87 | 115 | Creates a Filter from a function that returns either a `pass` or `fail` value. |
| Filter | makeEffect | 116 | 145 | Creates an effectful Filter from a function that returns an Effect. |
| Filter | mapFail | 146 | 173 | Transforms the failure value produced by a `Filter`, leaving successful results unchanged. |
| Filter | try | 174 | 184 | Creates a Filter that tries to apply a function and returns `fail` on error. |
| Filter | fromPredicate | 185 | 281 | Creates a Filter from a predicate or refinement function. |
| Filter | fromPredicateOption | 282 | 290 | Creates a `Filter` from a function that returns an `Option`; `Some(value)` passes with `value`, and `None` fails with the original input. |
| Filter | toPredicate | 291 | 306 | Converts a Filter into a predicate function. |
| Filter | string | 307 | 323 | A predefined filter that only passes through string values. |
| Filter | equalsStrict | 324 | 346 | Creates a `Filter` that passes only values strictly equal to the specified value using JavaScript `===` comparison. |
| Filter | has | 347 | 367 | Creates a `Filter` that passes inputs whose `has(key)` method returns `true` for the specified key. |
| Filter | instanceOf | 368 | 392 | Creates a filter that only passes instances of the given constructor. |
| Filter | number | 393 | 409 | A predefined filter that only passes through number values. |
| Filter | boolean | 410 | 430 | A predefined filter that only passes through boolean values. |
| Filter | bigint | 431 | 456 | A predefined filter that only passes through `bigint` primitive values. |
| Filter | symbol | 457 | 464 | A predefined filter that only passes through Symbol values. |
| Filter | date | 465 | 491 | A predefined filter that only passes through Date objects. |
| Filter | tagged | 492 | 596 | Creates a filter that checks if an input is tagged with a specific tag. |
| Filter | reason | 597 | 629 | Creates a filter that extracts a reason from a tagged error. |
| Filter | equals | 630 | 651 | Creates a filter that only passes values equal to the specified value using structural equality. |
| Filter | or | 652 | 676 | Combines two filters with logical OR semantics. |
| Filter | zipWith | 677 | 734 | Combines two filters and applies a function to their results. |
| Filter | zip | 735 | 810 | Combines two filters into a tuple of their results. |
| Filter | andLeft | 811 | 871 | Combines two filters but only returns the result of the left filter. |
| Filter | andRight | 872 | 938 | Combines two filters but only returns the result of the right filter. |
| Filter | compose | 939 | 1005 | Composes two filters sequentially, feeding the output of the first into the second. |
| Filter | composePassthrough | 1006 | 1048 | Composes two filters sequentially, passing the successful output of the first filter to the second. |
| Filter | toOption | 1049 | 1065 | Converts a `Filter` into a function that returns `Some` for passed values and `None` for filtered-out values. |
| Filter | toResult | 1066 | 1083 | Converts a `Filter` into a function that returns the underlying `Result.Result` for each input. |
| Formatter | Formatter | 1 | 30 | A callable interface representing a function that converts a `Value` into a `Format`, which defaults to `string`. |
| Formatter | format | 31 | 98 | Converts any JavaScript value into a human-readable string. |
| Formatter | formatJson | 99 | 161 | Stringifies a value to JSON safely, silently dropping circular references. |
| Function | FunctionTypeLambda | 13 | 37 | Type lambda for function types, used for higher-kinded type operations. |
| Function | dual | 38 | 233 | Creates a function that can be called in data-first style or data-last (`pipe`-friendly) style. |
| Function | apply | 234 | 260 | Applies a function to a given value. |
| Function | LazyArg | 261 | 281 | A zero-argument function that produces a value when invoked. |
| Function | FunctionN | 282 | 303 | Represents a function with multiple arguments. |
| Function | identity | 304 | 323 | Returns its input argument unchanged. |
| Function | satisfies | 324 | 351 | Ensures that the type of an expression matches some type, without changing the resulting type of that expression. |
| Function | cast | 352 | 371 | Returns the input value with a different static type. |
| Function | constant | 372 | 395 | Creates a zero-argument function that always returns the provided value. |
| Function | constTrue | 396 | 415 | Returns `true` when called. |
| Function | constFalse | 416 | 435 | Returns `false` when called. |
| Function | constNull | 436 | 455 | Returns `null` when called. |
| Function | constUndefined | 456 | 475 | Returns `undefined` when called. |
| Function | constVoid | 476 | 496 | Returns no meaningful value when called. |
| Function | flip | 497 | 519 | Reverses the order of arguments for a curried function. |
| Function | compose | 520 | 601 | Composes two functions, `ab` and `bc` into a single function that takes in an argument `a` of type `A` and returns a result of type `C`. |
| Function | absurd | 602 | 630 | Marks an impossible branch by accepting a `never` value and returning any type. |
| Function | tupled | 631 | 654 | Creates a tupled version of this function: instead of `n` arguments, it accepts a single tuple argument. |
| Function | untupled | 655 | 678 | Converts a tupled function back to an uncurried function. |
| Function | pipe | 679 | 736 | Pipes the value of an expression through a left-to-right sequence of functions. |
| Function | pipe | 737 | 737 |  |
| Function | pipe | 738 | 738 |  |
| Function | pipe | 739 | 739 |  |
| Function | pipe | 740 | 740 |  |
| Function | pipe | 741 | 741 |  |
| Function | pipe | 742 | 742 |  |
| Function | pipe | 743 | 743 |  |
| Function | pipe | 744 | 744 |  |
| Function | pipe | 745 | 745 |  |
| Function | pipe | 746 | 746 |  |
| Function | pipe | 747 | 747 |  |
| Function | pipe | 748 | 748 |  |
| Function | pipe | 749 | 749 |  |
| Function | pipe | 750 | 750 |  |
| Function | pipe | 751 | 751 |  |
| Function | pipe | 752 | 752 |  |
| Function | pipe | 753 | 753 |  |
| Function | pipe | 754 | 754 |  |
| Function | pipe | 755 | 755 |  |
| Function | flow | 756 | 789 | Performs left-to-right function composition. |
| Function | flow | 790 | 790 |  |
| Function | flow | 791 | 791 |  |
| Function | flow | 792 | 792 |  |
| Function | flow | 793 | 793 |  |
| Function | flow | 794 | 794 |  |
| Function | flow | 795 | 795 |  |
| Function | flow | 796 | 796 |  |
| Function | flow | 797 | 797 |  |
| Function | hole | 798 | 827 | Creates a compile-time placeholder for a value of any type. |
| Function | SK | 828 | 849 | Returns the second argument and discards the first. |
| Function | memoize | 850 | 876 | Creates a memoized function whose input is an object, caching results by object identity. |
| Function | memoizeIdempotent | 877 | 904 | Creates a memoized idempotent object transformation that caches both inputs and their outputs by object identity. |
| Glob | Glob | 4 | 22 | A compiled glob pattern. |
| Glob | make | 23 | 68 | Compiles a glob pattern into a reusable `Glob`. |
| Glob | match | 69 | 144 | Tests whether a `/`-separated path matches a `Glob`. |
| Glob | escape | 145 | 165 | Escapes glob syntax so a string matches only itself. |
| Graph | NodeIndex | 18 | 41 | Node index for node identification using plain numbers. |
| Graph | EdgeIndex | 42 | 61 | Edge index for edge identification using plain numbers. |
| Graph | Edge | 62 | 78 | Represents edge data containing source, target, and user data. |
| Graph | Kind | 79 | 91 | Graph type for distinguishing directed and undirected graphs. |
| Graph | IndexedNode | 92 | 102 | A node and its stable index in a graph snapshot. |
| Graph | IndexedEdge | 103 | 112 | An edge and its stable index in a graph snapshot. |
| Graph | Snapshot | 113 | 140 | Active indexed structure used to reconstruct an immutable graph. |
| Graph | Graph | 141 | 164 | Immutable graph interface. |
| Graph | Graph | 165 | 183 | Companion namespace containing type-level metadata for immutable graphs. |
| Graph | MutableGraph | 184 | 209 | Mutable graph interface. |
| Graph | MutableGraph | 210 | 228 | Companion namespace containing type-level metadata for scoped mutable graphs. |
| Graph | DirectedGraph | 229 | 249 | Immutable graph type for source-to-target relationships. |
| Graph | UndirectedGraph | 250 | 269 | Immutable graph type for relationships without source-to-target direction. |
| Graph | MutableDirectedGraph | 270 | 285 | Mutable directed graph type alias. |
| Graph | MutableUndirectedGraph | 286 | 304 | Mutable undirected graph type alias. |
| Graph | GraphError | 305 | 322 | Error thrown by graph operations when the requested graph structure is invalid, such as referencing a missing node or using unsupported e... |
| Graph | isGraph | 323 | 341 | Returns `true` if a value has the graph runtime type identifier, narrowing it to an immutable or mutable graph. |
| Graph | fromSnapshot | 342 | 377 | Reconstructs an immutable graph from its indexed active structure. |
| Graph | toSnapshot | 378 | 416 | Returns the active indexed structure of a graph. |
| Graph | make | 417 | 444 | Creates a graph constructor for the specified graph kind. |
| Graph | directed | 445 | 478 | Creates a directed graph, optionally with initial mutations. |
| Graph | undirected | 479 | 512 | Creates an undirected graph, optionally with initial mutations. |
| Graph | beginMutation | 513 | 544 | Creates a mutable copy of an immutable graph for a manual mutation scope. |
| Graph | endMutation | 545 | 574 | Converts a mutable graph back to an immutable graph, ending the mutation scope. |
| Graph | mutate | 575 | 701 | Returns an immutable graph after applying scoped mutations to a structural copy. |
| Graph | IdentityOptions | 702 | 729 | Configures node and edge identity for graph set operations. |
| Graph | compose | 730 | 895 | Composes two graphs, merging nodes by identity. |
| Graph | intersection | 896 | 1055 | Returns the intersection of two graphs, matching nodes by identity. |
| Graph | difference | 1056 | 1221 | Returns `self` without edges also present in `that`. |
| Graph | symmetricDifference | 1222 | 1396 | Returns edges present in exactly one of two graphs. |
| Graph | complement | 1397 | 1529 | Returns the complement over the existing node set. |
| Graph | NeighborhoodConfig | 1530 | 1547 | Configuration for selecting a graph neighborhood. |
| Graph | neighborhood | 1548 | 1686 | Returns the induced subgraph containing nodes within a radius of a node. |
| Graph | inducedSubgraph | 1687 | 1762 | Returns the subgraph induced by a collection of node indices. |
| Graph | sum | 1763 | 1844 | Returns the disjoint union of two graphs. |
| Graph | addNode | 1845 | 1881 | Adds a new node to a mutable graph and returns its index. |
| Graph | getNode | 1882 | 1942 | Gets the data associated with a node index safely, if it exists. |
| Graph | hasNode | 1943 | 2006 | Checks whether a node with the given index exists in the graph. |
| Graph | nodeCount | 2007 | 2031 | Returns the number of nodes in the graph. |
| Graph | findNode | 2032 | 2101 | Finds the first node that matches the given predicate. |
| Graph | findNodes | 2102 | 2171 | Finds all nodes that match the given predicate. |
| Graph | findEdge | 2172 | 2247 | Finds the first edge that matches the given predicate. |
| Graph | findEdges | 2248 | 2326 | Finds all edges that match the given predicate. |
| Graph | updateNode | 2327 | 2358 | Updates a single node's data by applying a transformation function. |
| Graph | updateEdge | 2359 | 2391 | Updates a single edge's data by applying a transformation function. |
| Graph | mapNodes | 2392 | 2431 | Transforms every node's data in a mutable graph in place using the provided mapping function. |
| Graph | mapEdges | 2432 | 2472 | Transforms every edge payload in a mutable graph in place. |
| Graph | reverse | 2473 | 2510 | Swaps source and target nodes for every edge in a mutable graph. |
| Graph | filterMapNodes | 2511 | 2547 | Filters and optionally transforms nodes in a mutable graph using a predicate function. |
| Graph | filterMapEdges | 2548 | 2584 | Filters and optionally transforms edges in a mutable graph using a predicate function. |
| Graph | filterNodes | 2585 | 2618 | Filters nodes by removing those that don't match the predicate. |
| Graph | filterEdges | 2619 | 2654 | Filters edges by removing those that don't match the predicate. |
| Graph | addEdge | 2655 | 2693 | Adds a new edge to a mutable graph and returns its index. |
| Graph | removeNode | 2694 | 2721 | Removes a node and all its incident edges from a mutable graph. |
| Graph | removeNodes | 2722 | 2745 | Removes multiple nodes and all their incident edges from a mutable graph. |
| Graph | removeEdge | 2746 | 2773 | Removes an edge from a mutable graph. |
| Graph | removeEdges | 2774 | 2796 | Removes multiple edges from a mutable graph. |
| Graph | getEdge | 2797 | 2863 | Gets the edge data associated with an edge index safely, if it exists. |
| Graph | hasEdge | 2864 | 2966 | Checks whether an edge exists between two nodes in the graph. |
| Graph | edgeCount | 2967 | 2994 | Returns the number of edges in the graph. |
| Graph | incidentEdges | 2995 | 3034 | Returns the indices of all edges incident to a node. |
| Graph | outgoingEdges | 3035 | 3074 | Returns the indices of outgoing edges for a node in a directed graph. |
| Graph | incomingEdges | 3075 | 3114 | Returns the indices of incoming edges for a node in a directed graph. |
| Graph | edgesBetween | 3115 | 3157 | Returns all edge indices connecting the supplied nodes. |
| Graph | degree | 3158 | 3197 | Returns the degree of a node in an undirected graph. |
| Graph | outDegree | 3198 | 3237 | Returns the out-degree of a node in a directed graph. |
| Graph | inDegree | 3238 | 3277 | Returns the in-degree of a node in a directed graph. |
| Graph | neighbors | 3278 | 3389 | Returns the neighboring node indices for a node. |
| Graph | successors | 3390 | 3462 | Returns the outgoing neighbor node indices for a node in a directed graph. |
| Graph | predecessors | 3463 | 3535 | Returns the incoming neighbor node indices for a node in a directed graph. |
| Graph | neighborsDirected | 3536 | 3668 | Gets directed neighbors of a node in a specific direction. |
| Graph | GraphVizOptions | 3669 | 3722 | Configuration options for GraphViz DOT format generation from graphs. |
| Graph | toGraphViz | 3723 | 3816 | Exports a graph to GraphViz DOT format for visualization. |
| Graph | MermaidNodeShape | 3817 | 3856 | Mermaid node shape types for diagram visualization. |
| Graph | MermaidDirection | 3857 | 3894 | Mermaid diagram direction types for controlling layout orientation. |
| Graph | MermaidDiagramType | 3895 | 3931 | Mermaid diagram types for different visualization formats. |
| Graph | MermaidOptions | 3932 | 3999 | Configuration options for Mermaid diagram generation from graphs. |
| Graph | toMermaid | 4000 | 4102 | Exports a graph to Mermaid diagram format for visualization. |
| Graph | Direction | 4103 | 4115 | Direction of directed edges relative to a node. |
| Graph | TraversalDirection | 4116 | 4147 | Controls how traversal follows directed edges. |
| Graph | CycleResult | 4148 | 4163 | A cycle witness containing a closed node path and its traversed edges. |
| Graph | findCycle | 4164 | 4182 | Returns one cycle in a graph, if present. |
| Graph | isAcyclic | 4183 | 4227 | Checks whether the graph is acyclic (contains no cycles). |
| Graph | isBipartite | 4228 | 4275 | Checks whether an undirected graph is bipartite. |
| Graph | BipartiteMatch | 4276 | 4292 | A pair of matched nodes and the edge that realizes the match. |
| Graph | maximumBipartiteMatching | 4293 | 4334 | Returns a maximum-cardinality matching of an undirected bipartite graph. |
| Graph | ReachabilityConfig | 4335 | 4353 | Configuration for unweighted reachability queries. |
| Graph | unweightedDistances | 4354 | 4432 | Returns minimum unweighted distances from a source to every reachable node. |
| Graph | hasPath | 4433 | 4508 | Tests whether a target is reachable from a source. |
| Graph | connectedComponents | 4509 | 4549 | Returns the connected components of an undirected graph. |
| Graph | bridges | 4550 | 4588 | Returns the edges whose removal increases the number of connected components. |
| Graph | articulationPoints | 4589 | 4626 | Returns the nodes whose removal increases the number of connected components. |
| Graph | biconnectedComponents | 4627 | 4671 | Returns the maximal biconnected node components of an undirected graph. |
| Graph | MaximumFlowConfig | 4672 | 4697 | Configuration for source-to-target flow algorithms. |
| Graph | MaximumFlowResult | 4698 | 4714 | Maximum flow value, per-edge flows, and a corresponding minimum cut. |
| Graph | MinimumCutResult | 4715 | 4732 | Minimum cut value, crossing edges, and residual-reachability partitions. |
| Graph | maximumFlow | 4733 | 4856 | Returns a maximum flow and corresponding minimum cut for a directed graph. |
| Graph | minimumCut | 4857 | 4980 | Returns a minimum cut and its node partitions for a directed graph. |
| Graph | weaklyConnectedComponents | 4981 | 5005 | Finds weakly connected components in a directed graph. |
| Graph | stronglyConnectedComponents | 5006 | 5046 | Returns the strongly connected components of a directed graph. |
| Graph | isConnected | 5047 | 5066 | Tests whether an undirected graph has at most one connected component. |
| Graph | isWeaklyConnected | 5067 | 5086 | Tests whether a directed graph has at most one weakly connected component. |
| Graph | isStronglyConnected | 5087 | 5106 | Tests whether a directed graph has at most one strongly connected component. |
| Graph | isTree | 5107 | 5123 | Tests whether a non-empty undirected graph is a tree. |
| Graph | minimumSpanningForest | 5124 | 5202 | Returns a minimum spanning forest of an undirected graph using Kruskal's algorithm. |
| Graph | transitiveReduction | 5203 | 5226 | Returns the transitive reduction of a directed acyclic graph. |
| Graph | PathResult | 5227 | 5255 | Result of a shortest path computation. |
| Graph | DijkstraConfig | 5256 | 5283 | Configuration for finding a shortest path with Dijkstra's algorithm. |
| Graph | dijkstra | 5284 | 5437 | Finds the shortest path from the configured source node to the target node using Dijkstra's algorithm. |
| Graph | AllPairsResult | 5438 | 5462 | Result of an all-pairs shortest path computation. |
| Graph | floydWarshall | 5463 | 5610 | Finds shortest paths between all pairs of nodes using the Floyd-Warshall algorithm. |
| Graph | AstarConfig | 5611 | 5639 | Configuration for finding a shortest path with the A* algorithm. |
| Graph | astar | 5640 | 5811 | Finds the shortest path from the configured source node to the target node using the A* pathfinding algorithm. |
| Graph | BellmanFordConfig | 5812 | 5833 | Configuration for finding a shortest path with the Bellman-Ford algorithm. |
| Graph | bellmanFord | 5834 | 5984 | Finds the shortest path from the configured source node to the target node using the Bellman-Ford algorithm. |
| Graph | PathWalker | 5985 | 6001 | A repeatable lazy iterable of edge-aware graph paths. |
| Graph | SimplePathsConfig | 6002 | 6025 | Configuration for lazy simple-path enumeration. |
| Graph | AllShortestPathsConfig | 6026 | 6048 | Configuration for enumerating all tied shortest paths. |
| Graph | simplePaths | 6049 | 6127 | Lazily enumerates simple source-to-target paths in depth-first edge order. |
| Graph | allShortestPaths | 6128 | 6206 | Lazily enumerates all simple paths tied for minimum total cost. |
| Graph | Walker | 6207 | 6279 | Represents an iterable wrapper used by graph traversal and listing APIs. |
| Graph | NodeWalker | 6280 | 6296 | Type alias for node iteration using Walker. |
| Graph | EdgeWalker | 6297 | 6315 | Type alias for edge iteration using Walker. |
| Graph | indices | 6316 | 6338 | Returns an iterator over the indices in the walker. |
| Graph | values | 6339 | 6361 | Returns an iterator over the values (data) in the walker. |
| Graph | entries | 6362 | 6384 | Returns an iterator over [index, data] entries in the walker. |
| Graph | SearchConfig | 6385 | 6417 | Configuration for DFS, BFS, and postorder graph traversals. |
| Graph | dfs | 6418 | 6559 | Creates a lazy depth-first traversal iterator from the configured start nodes. |
| Graph | bfs | 6560 | 6704 | Creates a lazy breadth-first traversal iterator from the configured start nodes. |
| Graph | TopoConfig | 6705 | 6728 | Configuration for the topological sort iterator. |
| Graph | topo | 6729 | 6855 | Creates a lazy topological-order iterator for a directed acyclic graph. |
| Graph | dfsPostOrder | 6856 | 7000 | Creates a lazy depth-first postorder traversal iterator from the configured start nodes. |
| Graph | nodes | 7001 | 7033 | Creates a walker over all node index and payload entries in the graph. |
| Graph | edges | 7034 | 7067 | Creates a walker over all edge index and edge entries in the graph. |
| Graph | ExternalsConfig | 7068 | 7089 | Configuration for selecting external nodes. |
| Graph | externals | 7090 | 7227 | Creates an iterator over external nodes (nodes without edges in the specified direction). |
| HKT | URI | 14 | 54 | Defines the unique symbol used to associate `TypeClass` implementations with their `TypeLambda`. |
| HKT | TypeClass | 55 | 98 | Base interface for type classes that work with Higher-Kinded Types. |
| HKT | TypeLambda | 99 | 146 | Base interface for defining Higher-Kinded Type parameters. |
| HKT | Kind | 147 | 220 | Applies type parameters to a `TypeLambda` to get the concrete type. |
| Hash | symbol | 1 | 17 | Defines the unique identifier used to identify objects that implement the Hash interface. |
| Hash | Hash | 18 | 52 | A type that represents an object that can be hashed. |
| Hash | hash | 53 | 89 | Computes a hash value for any given value. |
| Hash | random | 90 | 120 | Generates a random hash value for an object and caches it. |
| Hash | combine | 121 | 217 | Combines two hash values into a single hash value. |
| Hash | optimize | 218 | 242 | Applies bit manipulation techniques to optimize a hash value. |
| Hash | isHash | 243 | 276 | Checks whether a value implements the Hash interface. |
| Hash | number | 277 | 305 | Computes a hash value for a number. |
| Hash | string | 306 | 335 | Computes a hash value for a string using the djb2 algorithm. |
| Hash | structureKeys | 336 | 371 | Computes a hash value for an object using only the specified keys. |
| Hash | structure | 372 | 403 | Computes a structural hash for an object using Effect's object key collection. |
| Hash | array | 404 | 440 | Computes a hash value for an iterable by hashing all of its elements. |
| HashMap | HashMap | 20 | 50 | A HashMap is an immutable key-value data structure that provides efficient lookup, insertion, and deletion operations. |
| HashMap | HashMap | 51 | 201 | The HashMap namespace contains type-level utilities and helper types for working with HashMap instances. |
| HashMap | isHashMap | 202 | 265 | Checks whether a value is a HashMap. |
| HashMap | empty | 266 | 281 | Creates a new empty `HashMap`. |
| HashMap | make | 282 | 297 | Constructs a new `HashMap` from an array of key/value pairs. |
| HashMap | fromIterable | 298 | 314 | Creates a new `HashMap` from an iterable collection of key/value pairs. |
| HashMap | isEmpty | 315 | 334 | Checks whether the `HashMap` contains no entries. |
| HashMap | get | 335 | 404 | Looks up the value for the specified key in the `HashMap` safely using the internal hashing function. |
| HashMap | getHash | 405 | 495 | Looks up the value for the specified key in the `HashMap` safely using a custom hash. |
| HashMap | getUnsafe | 496 | 616 | Looks up the value for the specified key in the `HashMap` unsafely using the internal hashing function. |
| HashMap | has | 617 | 683 | Checks whether the specified key has an entry in the `HashMap`. |
| HashMap | hasHash | 684 | 780 | Checks whether the specified key has an entry in the `HashMap` using a custom hash. |
| HashMap | hasBy | 781 | 835 | Checks whether an element matching the given predicate exists in the given `HashMap`. |
| HashMap | set | 836 | 899 | Sets the specified key to the specified value using the internal hashing function. |
| HashMap | keys | 900 | 916 | Returns an `IterableIterator` of the keys within the `HashMap`. |
| HashMap | values | 917 | 933 | Returns an `IterableIterator` of the values within the `HashMap`. |
| HashMap | toValues | 934 | 963 | Returns an `Array` of the values within the `HashMap`. |
| HashMap | entries | 964 | 994 | Returns an `IterableIterator` of the entries within the `HashMap`. |
| HashMap | toEntries | 995 | 1027 | Returns an `Array<[K, V]>` of the entries within the `HashMap`. |
| HashMap | size | 1028 | 1047 | Returns the number of entries within the `HashMap`. |
| HashMap | beginMutation | 1048 | 1079 | Creates a transient mutable `HashMap` for efficient batched updates. |
| HashMap | endMutation | 1080 | 1107 | Marks the `HashMap` as immutable, completing the mutation cycle. |
| HashMap | mutate | 1108 | 1189 | Runs a batch of updates against a transient mutable copy of the `HashMap` and returns the finalized immutable result. |
| HashMap | modifyAt | 1190 | 1277 | Sets or removes the specified key using an update function. |
| HashMap | modifyHash | 1278 | 1434 | Sets or removes the specified key using a precomputed hash and an update function. |
| HashMap | modify | 1435 | 1495 | Updates the value of the specified key within the `HashMap` if it exists. |
| HashMap | union | 1496 | 1574 | Combines two `HashMap`s into one. |
| HashMap | remove | 1575 | 1635 | Removes the entry for the specified key in the `HashMap` using the internal hashing function. |
| HashMap | removeMany | 1636 | 1693 | Removes all entries in the `HashMap` which have the specified keys. |
| HashMap | setMany | 1694 | 1757 | Sets multiple key-value pairs in the `HashMap`. |
| HashMap | map | 1758 | 1818 | Maps over the entries of the `HashMap` using the specified function. |
| HashMap | flatMap | 1819 | 1900 | Maps each entry to a `HashMap` and flattens the results. |
| HashMap | forEach | 1901 | 1970 | Applies the specified function to the entries of the `HashMap`. |
| HashMap | reduce | 1971 | 2022 | Reduces the specified state over the entries of the `HashMap`. |
| HashMap | filter | 2023 | 2080 | Filters entries out of a `HashMap` using the specified predicate. |
| HashMap | compact | 2081 | 2104 | Filters out `None` values from a `HashMap` of `Options`s. |
| HashMap | filterMap | 2105 | 2177 | Maps over the entries of the `HashMap` using the specified filter and keeps only successful results. |
| HashMap | findFirst | 2178 | 2232 | Returns the first element that satisfies the specified predicate, or `None` if no such element exists. |
| HashMap | some | 2233 | 2290 | Checks whether any entry in a hashmap meets a specific condition. |
| HashMap | every | 2291 | 2350 | Checks whether all entries in a hashmap meets a specific condition. |
| HashRing | HashRing | 4 | 28 | A weighted consistent-hashing ring for assigning inputs to nodes with stable remapping as nodes are added or removed. |
| HashRing | isHashRing | 29 | 54 | Checks whether a value is a `HashRing`. |
| HashRing | make | 55 | 77 | Creates an empty `HashRing`. |
| HashRing | addMany | 78 | 121 | Adds new nodes to the ring. |
| HashRing | add | 122 | 207 | Adds a new node to the ring. |
| HashRing | remove | 208 | 283 | Removes the node from the ring. |
| HashRing | has | 284 | 350 | Checks whether the ring contains a node with the same `PrimaryKey` value. |
| HashRing | get | 351 | 367 | Gets the node which should handle the given input. |
| HashRing | getShards | 368 | 387 | Computes a balanced shard distribution across the nodes in the ring. |
| HashSet | HashSet | 19 | 50 | A HashSet is an immutable set data structure that provides efficient storage and retrieval of unique values. |
| HashSet | HashSet | 51 | 102 | The HashSet namespace contains type-level utilities and helper types for working with HashSet instances. |
| HashSet | empty | 103 | 125 | Creates an empty HashSet. |
| HashSet | make | 126 | 145 | Creates a HashSet from a variable number of values. |
| HashSet | fromIterable | 146 | 165 | Creates a HashSet from an iterable collection of values. |
| HashSet | isHashSet | 166 | 229 | Checks whether a value is a HashSet. |
| HashSet | add | 230 | 302 | Adds a value to the HashSet, returning a new HashSet. |
| HashSet | has | 303 | 411 | Checks whether the HashSet contains the specified value. |
| HashSet | remove | 412 | 484 | Removes a value from the HashSet, returning a new HashSet. |
| HashSet | size | 485 | 504 | Returns the number of values in the HashSet. |
| HashSet | isEmpty | 505 | 522 | Checks whether the HashSet is empty. |
| HashSet | union | 523 | 571 | Creates the union of two HashSets. |
| HashSet | intersection | 572 | 620 | Creates the intersection of two HashSets. |
| HashSet | difference | 621 | 669 | Creates the difference of two HashSets (elements in the first set that are not in the second). |
| HashSet | isSubset | 670 | 739 | Checks whether a HashSet is a subset of another HashSet. |
| HashSet | map | 740 | 812 | Maps each value in the HashSet using the provided function. |
| HashSet | filter | 813 | 893 | Filters the HashSet keeping only values that satisfy the predicate. |
| HashSet | some | 894 | 957 | Checks whether at least one value in the HashSet satisfies the predicate. |
| HashSet | every | 958 | 1021 | Checks whether all values in the HashSet satisfy the predicate. |
| HashSet | reduce | 1022 | 1075 | Reduces the HashSet to a single value by iterating through the values and applying an accumulator function. |
| Inspectable | NodeInspectSymbol | 1 | 35 | Defines the symbol used by Node.js for custom object inspection. |
| Inspectable | NodeInspectSymbol | 36 | 66 | The type of the Node.js inspection symbol used for custom object inspection. |
| Inspectable | Inspectable | 67 | 116 | Interface for objects that can be inspected and provide custom string representations. |
| Inspectable | toJson | 117 | 139 | Converts a value to its structured inspection representation. |
| Inspectable | toStringUnknown | 140 | 157 | Converts an unknown value to a string for diagnostics. |
| Inspectable | BaseProto | 158 | 279 | A base prototype object that implements the {@link Inspectable} interface. |
| Iterable | makeBy | 17 | 51 | Creates an iterable by applying a function to consecutive integers. |
| Iterable | range | 52 | 73 | Returns an iterable of integers starting at `start` and increasing by `1`. |
| Iterable | replicate | 74 | 137 | Returns a `Iterable` containing a value repeated the specified number of times. |
| Iterable | repeat | 138 | 198 | Repeats an iterable `n` times, yielding the full contents of `self` for each repetition. |
| Iterable | forever | 199 | 219 | Repeats an iterable without an upper bound. |
| Iterable | fromRecord | 220 | 236 | Takes a record and returns an Iterable of tuples containing its keys and values. |
| Iterable | prepend | 237 | 306 | Prepends an element to the front of an `Iterable`, creating a new `Iterable`. |
| Iterable | prependAll | 307 | 355 | Prepends the specified prefix iterable to the beginning of the specified iterable. |
| Iterable | append | 356 | 461 | Appends an element to the end of an `Iterable`, creating a new `Iterable`. |
| Iterable | appendAll | 462 | 594 | Concatenates two iterables, combining their elements. |
| Iterable | scan | 595 | 682 | Reduces an `Iterable` from the left, keeping all intermediate results instead of only the final result. |
| Iterable | isEmpty | 683 | 699 | Checks whether an `Iterable` is empty. |
| Iterable | size | 700 | 727 | Returns the number of elements in a `Iterable`. |
| Iterable | head | 728 | 757 | Gets the first element of a `Iterable` safely, or `None` if the `Iterable` is empty. |
| Iterable | headUnsafe | 758 | 793 | Gets the first element of an `Iterable` without returning an `Option`. |
| Iterable | take | 794 | 902 | Keeps only a max number of elements from the start of an `Iterable`, creating a new `Iterable`. |
| Iterable | takeWhile | 903 | 1088 | Takes the longest initial `Iterable` prefix for which all elements satisfy the specified predicate. |
| Iterable | drop | 1089 | 1194 | Drops a max number of elements from the start of an `Iterable` |
| Iterable | findFirst | 1195 | 1489 | Returns the first element that satisfies the specified predicate, or `None` if no such element exists. |
| Iterable | findLast | 1490 | 1728 | Finds the last element for which a predicate holds. |
| Iterable | zip | 1729 | 1840 | Takes two `Iterable`s and returns an `Iterable` of corresponding pairs. |
| Iterable | zipWith | 1841 | 1988 | Applies a function to pairs of elements at the same index in two `Iterable`s, collecting the results. |
| Iterable | intersperse | 1989 | 2130 | Places a separator between members of an `Iterable`. |
| Iterable | containsWith | 2131 | 2172 | Returns a function that checks if an `Iterable` contains a given value using a provided `isEquivalent` function. |
| Iterable | contains | 2173 | 2287 | Checks whether an iterable contains a value using Effect's default `Equal` equivalence. |
| Iterable | chunksOf | 2288 | 2408 | Splits an `Iterable` into length-`n` pieces. |
| Iterable | groupWith | 2409 | 2520 | Groups equal, consecutive elements of an `Iterable` into `NonEmptyArray`s using the provided `isEquivalent` function. |
| Iterable | group | 2521 | 2553 | Groups equal, consecutive elements of an `Iterable` into `NonEmptyArray`s. |
| Iterable | groupBy | 2554 | 2710 | Groups all elements by the string or symbol key returned by `f`. |
| Iterable | empty | 2711 | 2731 | Creates an empty iterable that yields no elements. |
| Iterable | of | 2732 | 2768 | Creates an iterable containing a single element. |
| Iterable | map | 2769 | 2874 | Transforms each element of an iterable using a function. |
| Iterable | flatMap | 2875 | 2995 | Applies a function to each element in an Iterable and returns a new Iterable containing the concatenated mapped elements. |
| Iterable | flatten | 2996 | 3030 | Flattens an Iterable of Iterables into a single Iterable |
| Iterable | filterMap | 3031 | 3181 | Transforms elements of an iterable using a function that returns a `Result`, keeping only successful values. |
| Iterable | filterMapWhile | 3182 | 3296 | Transforms all elements of the `Iterable` for as long as the specified function succeeds. |
| Iterable | getSomes | 3297 | 3312 | Retrieves the `Some` values from an `Iterable` of `Option`s. |
| Iterable | getFailures | 3313 | 3333 | Returns a lazy iterable containing the failure values from an iterable of `Result`s, skipping successful results. |
| Iterable | getSuccesses | 3334 | 3354 | Returns a lazy iterable containing the success values from an iterable of `Result`s, skipping failed results. |
| Iterable | filter | 3355 | 3580 | Filters an iterable to only include elements that match a predicate. |
| Iterable | flatMapNullishOr | 3581 | 3722 | Transforms elements using a function that may return null or undefined, filtering out the null/undefined results. |
| Iterable | some | 3723 | 3852 | Checks whether a predicate holds true for some `Iterable` element. |
| Iterable | unfold | 3853 | 3894 | Generates an iterable by repeatedly applying a function that produces the next element and state. |
| Iterable | forEach | 3895 | 4024 | Iterates over the `Iterable`, applying `f` to each element. |
| Iterable | reduce | 4025 | 4181 | Reduces an iterable to a single value by applying a function to each element and accumulating the result. |
| Iterable | dedupeAdjacentWith | 4182 | 4314 | Deduplicates adjacent elements that are identical using the provided `isEquivalent` function. |
| Iterable | dedupeAdjacent | 4315 | 4354 | Deduplicates adjacent elements that are identical. |
| Iterable | cartesianWith | 4355 | 4493 | Zips this Iterable crosswise with the specified Iterable using the specified combiner. |
| Iterable | cartesian | 4494 | 4605 | Zips this Iterable crosswise with the specified Iterable. |
| Iterable | countBy | 4606 | 4655 | Computes how many elements of the iterable pass the given predicate. |
| JsonPatch | JsonPatchOperation | 2 | 87 | A single JSON Patch operation. |
| JsonPatch | JsonPatch | 88 | 123 | A JSON Patch document (an ordered list of operations). |
| JsonPatch | get | 124 | 166 | Computes a structural patch that transforms `oldValue` into `newValue`. |
| JsonPatch | apply | 167 | 210 | Applies a JSON Patch to a JSON document. |
| JsonPointer | escapeToken | 10 | 43 | Escapes a JSON Pointer reference token according to RFC 6901 by encoding special characters so the token can be safely used as a segment ... |
| JsonPointer | unescapeToken | 44 | 77 | Decodes a JSON Pointer reference token according to RFC 6901 escaping rules. |
| JsonPointer | parseUriFragment | 78 | 113 | Parses a JSON Pointer URI fragment into decoded path tokens. |
| JsonPointer | formatUriFragment | 114 | 144 | Formats path tokens as a JSON Pointer URI fragment. |
| JsonSchema | JsonSchema | 1 | 19 | A plain object representing a single JSON Schema node. |
| JsonSchema | Dialect | 20 | 42 | The set of JSON Schema dialects supported by this module. |
| JsonSchema | Type | 43 | 54 | The JSON Schema primitive type names. |
| JsonSchema | Definitions | 55 | 75 | A record of named JSON Schema definitions, keyed by definition name. |
| JsonSchema | Document | 76 | 121 | A structured container for a single JSON Schema and its associated definitions. |
| JsonSchema | MultiDocument | 122 | 145 | Like {@link Document}, but carries multiple root schemas that share a single definitions pool. |
| JsonSchema | META_SCHEMA_URI_DRAFT_04 | 146 | 159 | Represents the `$schema` meta-schema URI for JSON Schema Draft-04. |
| JsonSchema | META_SCHEMA_URI_DRAFT_07 | 160 | 180 | Represents the `$schema` meta-schema URI for JSON Schema Draft-07. |
| JsonSchema | META_SCHEMA_URI_DRAFT_2020_12 | 181 | 200 | Represents the `$schema` meta-schema URI for JSON Schema Draft 2020-12. |
| JsonSchema | fromSchemaDraft07 | 201 | 255 | Parses a raw Draft-07 JSON Schema into a `Document<"draft-2020-12">`. |
| JsonSchema | fromSchemaDraft2020_12 | 256 | 290 | Parses a raw Draft-2020-12 JSON Schema into a `Document<"draft-2020-12">`. |
| JsonSchema | fromSchemaOpenApi3_1 | 291 | 335 | Parses a raw OpenAPI 3.1 JSON Schema into a `Document<"draft-2020-12">`. |
| JsonSchema | fromSchemaOpenApi3_0 | 336 | 386 | Parses a raw OpenAPI 3.0 JSON Schema into a `Document<"draft-2020-12">`. |
| JsonSchema | toDocumentDraft07 | 387 | 438 | Converts a `Document<"draft-2020-12">` to a `Document<"draft-07">`. |
| JsonSchema | toDocumentDraft04 | 439 | 485 | Converts a `Document<"draft-2020-12">` to a `Document<"draft-04">`. |
| JsonSchema | toMultiDocumentOpenApi3_1 | 486 | 539 | Converts a `MultiDocument<"draft-2020-12">` to a `MultiDocument<"openapi-3.1">`. |
| Latch | Latch | 12 | 118 | A reusable coordination primitive that lets fibers wait until they are released by the latch. |
| Latch | makeUnsafe | 119 | 154 | Creates a `Latch` synchronously, outside of `Effect`. |
| Latch | make | 155 | 189 | Creates a `Latch` inside `Effect`. |
| Latch | open | 190 | 209 | Opens the latch and releases fibers waiting on it. |
| Latch | openUnsafe | 210 | 232 | Opens the latch synchronously and releases fibers waiting on it. |
| Latch | release | 233 | 253 | Releases the fibers currently waiting on a closed latch without opening it. |
| Latch | await | 254 | 282 | Waits for the latch to be opened. |
| Latch | close | 283 | 303 | Closes the latch so future `await` and `whenOpen` calls suspend. |
| Latch | closeUnsafe | 304 | 327 | Closes the latch synchronously so future `await` and `whenOpen` calls suspend. |
| Latch | whenOpen | 328 | 400 | Waits on the latch, then runs the provided effect. |
| Latch | isOpen | 401 | 413 | Checks whether the latch is currently open or closed. |
| Layer | Layer | 27 | 50 | A `Layer` describes how to build one or more services for dependency injection. |
| Layer | LayerUnify | 51 | 68 | Type-level hook that allows `Layer` values to participate in `Unify` inference. |
| Layer | LayerUnifyIgnore | 69 | 78 | Type-level marker used by `Unify` for `Layer` types that should be ignored during unification. |
| Layer | Variance | 79 | 92 | The variance interface for Layer type parameters. |
| Layer | Any | 93 | 122 | A type-level constraint for working with any `Layer` type. |
| Layer | Services | 123 | 138 | Extracts the service requirements (`RIn`) from a `Layer` type. |
| Layer | Error | 139 | 154 | Extracts the error type (`E`) from a `Layer` type. |
| Layer | Success | 155 | 171 | Extracts the service output type (`ROut`) from a `Layer` type. |
| Layer | MemoMap | 172 | 215 | A `MemoMap` is used to memoize layer construction and ensure sharing of layers. |
| Layer | isLayer | 216 | 241 | Returns `true` if the specified value is a `Layer`, `false` otherwise. |
| Layer | fromBuild | 242 | 276 | Constructs a `Layer` from a function that uses a `MemoMap` and `Scope` to build the layer. |
| Layer | fromBuildMemo | 277 | 311 | Constructs a `Layer` from a function that uses a `MemoMap` and `Scope` to build the layer, with automatic memoization. |
| Layer | makeMemoMapUnsafe | 312 | 345 | Constructs a `MemoMap` synchronously so it can be used to build additional layers. |
| Layer | forkMemoMapUnsafe | 346 | 364 | Constructs a child `MemoMap` synchronously, allowing it to reuse layers already memoized in the parent while isolating any new layer allo... |
| Layer | makeMemoMap | 365 | 398 | Constructs a `MemoMap` effectfully so it can be used to build additional layers. |
| Layer | forkMemoMap | 399 | 418 | Constructs a child `MemoMap` effectfully, allowing it to reuse layers already memoized in the parent while isolating any new layer alloca... |
| Layer | CurrentMemoMap | 419 | 440 | Context service for the current `MemoMap` used in layer construction. |
| Layer | buildWithMemoMap | 441 | 609 | Builds a layer into an `Effect` value, using the specified `MemoMap` to memoize the layer construction. |
| Layer | build | 610 | 644 | Builds a layer into a scoped value. |
| Layer | buildWithScope | 645 | 807 | Builds a layer using an explicit scope. |
| Layer | succeed | 808 | 904 | Constructs a layer that provides a single service from an already available value. |
| Layer | succeedContext | 905 | 953 | Constructs a layer that provides all services in an already available `Context`. |
| Layer | empty | 954 | 978 | An empty layer that provides no services, cannot fail, has no requirements, and performs no construction or finalization work. |
| Layer | sync | 979 | 1087 | Constructs a layer lazily that provides a single service. |
| Layer | syncContext | 1088 | 1126 | Constructs a layer lazily that provides all services in a `Context`. |
| Layer | effect | 1127 | 1247 | Constructs a layer from an effect that produces a single service. |
| Layer | effectContext | 1248 | 1287 | Constructs a layer from an effect that produces all services in a `Context`. |
| Layer | effectDiscard | 1288 | 1318 | Constructs a layer from an effect, discarding its value and providing no services. |
| Layer | suspend | 1319 | 1348 | Constructs a layer lazily using the specified factory. |
| Layer | unwrap | 1349 | 1384 | Unwraps a `Layer` from an `Effect`, flattening the nested structure. |
| Layer | mergeAll | 1385 | 1434 | Combines all the provided layers concurrently, creating a new layer with merged input, error, and output types. |
| Layer | merge | 1435 | 1670 | Merges this layer with another layer concurrently, producing a new layer with combined input, error, and output types. |
| Layer | provide | 1671 | 2081 | Feeds the output services of the dependency layer into the requirements of this layer, returning a layer that only provides the services ... |
| Layer | provideMerge | 2082 | 2522 | Feeds the output services of the dependency layer into the requirements of this layer, returning a layer that provides both sets of servi... |
| Layer | flatMap | 2523 | 2754 | Constructs a layer dynamically based on the output of this layer. |
| Layer | tap | 2755 | 2821 | Performs the specified effect if this layer succeeds. |
| Layer | tapError | 2822 | 2910 | Performs the specified effect if this layer fails. |
| Layer | tapCause | 2911 | 3003 | Performs the specified effect when this layer fails with any cause. |
| Layer | orDie | 3004 | 3051 | Converts layer construction failures into defects, removing them from the layer's error type. |
| Layer | catch | 3052 | 3072 | Recovers from all typed errors by switching to another layer. |
| Layer | catchTag | 3073 | 3181 | Recovers from specific tagged errors. |
| Layer | catchCause | 3182 | 3353 | Recovers from any failure cause by switching to another layer. |
| Layer | updateService | 3354 | 3414 | Updates a service in the context with a new implementation. |
| Layer | fresh | 3415 | 3494 | Creates a fresh version of this layer that will not be shared. |
| Layer | launch | 3495 | 3540 | Builds this layer and keeps it alive until the returned effect is interrupted. |
| Layer | PartialEffectful | 3541 | 3567 | A utility type for creating partial mocks of services in testing. |
| Layer | mock | 3568 | 3745 | Creates a mock layer for testing purposes. |
| Layer | satisfiesSuccessType | 3746 | 3773 | Ensures that a layer's success type extends a given type `ROut`. |
| Layer | satisfiesErrorType | 3774 | 3800 | Ensures that a layer's error type extends a given type `E`. |
| Layer | satisfiesServicesType | 3801 | 3828 | Ensures that a layer's requirements type extends a given type `R`. |
| Layer | SpanOptions | 3829 | 3857 | Represents options that can be used to control the behavior of spans created for layers. |
| Layer | span | 3858 | 3909 | Constructs a new `Layer` which creates a span and registers it as the current parent span. |
| Layer | parentSpan | 3910 | 3953 | Constructs a layer that provides an existing span as the current parent span. |
| Layer | withSpan | 3954 | 4140 | Wraps a `Layer` with a new tracing span, making all operations in the layer constructor part of the named trace span. |
| Layer | withParentSpan | 4141 | 4346 | Wraps a layer so spans created during its construction use the supplied span as their parent. |
| LayerMap | LayerMap | 23 | 104 | A scoped, keyed map of layer-built service contexts. |
| LayerMap | make | 105 | 155 | Creates a `LayerMap` that dynamically provides resources based on a key. |
| LayerMap | fromRecord | 156 | 216 | Creates a `LayerMap` from a record of predefined layers. |
| LayerMap | TagClass | 217 | 269 | Service class shape produced by `LayerMap.Service`. |
| LayerMap | Service | 270 | 346 | Create a `LayerMap` service that provides a dynamic set of resources based on a key. |
| LayerMap | Service | 347 | 401 | Type helpers for values created with `LayerMap.Service`. |
| LayerRef | LayerRef | 19 | 63 | A refreshable reference to a single layer-built service context. |
| LayerRef | make | 64 | 139 | Creates a `LayerRef` from a `Layer`. |
| LayerRef | TagClass | 140 | 185 | Service class shape produced by `LayerRef.Service`. |
| LayerRef | Service | 186 | 259 | Creates a service class for a `LayerRef`. |
| LogLevel | LogLevel | 13 | 65 | Represents every level used by Effect logging, including concrete message severities and the `All` and `None` sentinel levels. |
| LogLevel | Severity | 66 | 85 | Log levels that represent actual message severities, excluding the `All` and `None` sentinel levels. |
| LogLevel | values | 86 | 112 | Returns all `LogLevel` values in order from `All` through the concrete severities to `None`. |
| LogLevel | Order | 113 | 139 | Order instance for `LogLevel` that defines the severity ordering. |
| LogLevel | Equivalence | 140 | 168 | Equivalence instance for log levels using strict equality (`===`). |
| LogLevel | getOrdinal | 169 | 196 | Returns the ordinal value of the log level. |
| LogLevel | isGreaterThan | 197 | 311 | Determines if the first log level is more severe than the second. |
| LogLevel | isGreaterThanOrEqualTo | 312 | 402 | Determines if the first log level is more severe than or equal to the second. |
| LogLevel | isLessThan | 403 | 517 | Determines if the first log level is less severe than the second. |
| LogLevel | isLessThanOrEqualTo | 518 | 608 | Determines if the first log level is less severe than or equal to the second. |
| LogLevel | isEnabled | 609 | 646 | Checks whether a given log level is enabled for the current fiber. |
| Logger | Logger | 13 | 47 | A logger that transforms a runtime log event into an output value. |
| Logger | Options | 48 | 87 | Information supplied to a `Logger` for a single log event. |
| Logger | isLogger | 88 | 107 | Returns `true` if the specified value is a `Logger`, otherwise returns `false`. |
| Logger | CurrentLoggers | 108 | 142 | Context reference containing the active loggers for the current fiber. |
| Logger | LogToStderr | 143 | 165 | Context reference that routes the built-in default logger and TTY pretty console logger to stderr. |
| Logger | map | 166 | 200 | Transforms the output of a `Logger` using the provided function. |
| Logger | withConsoleLog | 201 | 235 | Returns a new `Logger` that writes all output of the specified `Logger` to the console using `console.log`. |
| Logger | withConsoleError | 236 | 270 | Returns a new `Logger` that writes all output of the specified `Logger` to the console using `console.error`. |
| Logger | withLeveledConsole | 271 | 319 | Returns a new `Logger` that writes all output of the specified `Logger` to the console. |
| Logger | make | 320 | 350 | Creates a new `Logger` from a log function. |
| Logger | defaultLogger | 351 | 366 | The default logging implementation used by the Effect runtime. |
| Logger | formatSimple | 367 | 401 | A `Logger` which outputs logs as a string. |
| Logger | formatLogFmt | 402 | 436 | A `Logger` which outputs logs using the [logfmt](https://brandur.org/logfmt) style. |
| Logger | formatStructured | 437 | 479 | A `Logger` which outputs logs using a structured format. |
| Logger | formatJson | 480 | 514 | A `Logger` which outputs logs using a structured format serialized as JSON on a single line. |
| Logger | batched | 515 | 558 | Creates a scoped logger that batches the output of another logger. |
| Logger | consolePretty | 559 | 612 | A `Logger` which outputs logs in a "pretty" format and writes them to the console. |
| Logger | consolePrettyBrowser | 613 | 646 | A `Logger` which outputs logs in a "pretty" format and writes them to the console. |
| Logger | consolePrettyTty | 647 | 696 | A `Logger` which outputs logs in a "pretty" format and writes them to the console. |
| Logger | consoleLogFmt | 697 | 718 | A `Logger` which outputs logs using the [logfmt](https://brandur.org/logfmt) style and writes them to the console. |
| Logger | consoleStructured | 719 | 743 | A `Logger` which outputs logs using a structured format and writes them to the console. |
| Logger | consoleJson | 744 | 766 | A `Logger` which outputs logs using a structured format serialized as JSON on a single line and writes them to the console. |
| Logger | tracerLogger | 767 | 796 | A `Logger` which includes log messages as tracer span events. |
| Logger | layer | 797 | 830 | Creates a `Layer` which will overwrite the current set of loggers with the specified array of `loggers`. |
| Logger | toFile | 831 | 906 | Creates a scoped logger that writes string logger output to a file. |
| ManagedRuntime | isManagedRuntime | 21 | 44 | Checks whether the provided argument is a `ManagedRuntime`. |
| ManagedRuntime | ManagedRuntime | 45 | 81 | Type helpers associated with `ManagedRuntime`. |
| ManagedRuntime | ManagedRuntime | 82 | 214 | A runtime built from a layer that can execute effects requiring that layer's services. |
| ManagedRuntime | make | 215 | 280 | Creates a `ManagedRuntime` from a layer. |
| Match | ValueFlavor | 30 | 37 | Marker used by `Matcher` to distinguish matchers created with `Match.value`. |
| Match | Matcher | 38 | 75 | Union type for matchers created by `Match.type` and `Match.value`. |
| Match | TypeMatcher | 76 | 119 | Represents a pattern matcher that operates on types rather than specific values. |
| Match | ValueMatcher | 120 | 163 | Represents a pattern matcher that operates on a specific provided value. |
| Match | Case | 164 | 185 | Represents a single pattern matching case. |
| Match | When | 186 | 219 | Represents a positive pattern matching case. |
| Match | Not | 220 | 253 | Represents a negative pattern matching case. |
| Match | type | 254 | 297 | Creates a matcher for a specific type. |
| Match | fn | 298 | 324 | Creates a reusable matcher from a function that selects the value to match. |
| Match | value | 325 | 369 | Creates a matcher from a specific value. |
| Match | valueTags | 370 | 467 | Creates a match function for a specific value with discriminated union handling. |
| Match | typeTags | 468 | 615 | Creates a type-safe match function for discriminated unions based on `_tag` field. |
| Match | withReturnType | 616 | 658 | Ensures that all branches of a matcher return a specific type. |
| Match | when | 659 | 708 | Defines a condition for matching values. |
| Match | whenOr | 709 | 751 | Matches one of multiple patterns in a single condition. |
| Match | whenAnd | 752 | 791 | Matches a value that satisfies all provided patterns. |
| Match | discriminator | 792 | 834 | Matches values based on a specified discriminant field. |
| Match | discriminatorStartsWith | 835 | 872 | Matches values where a specified field starts with a given prefix. |
| Match | discriminators | 873 | 923 | Matches values based on a field that serves as a discriminator, mapping each possible value to a corresponding handler. |
| Match | discriminatorsExhaustive | 924 | 969 | Matches values by a discriminator field and requires every possible case to be handled. |
| Match | tag | 970 | 1013 | Matches discriminated union members by their `_tag` field. |
| Match | tagStartsWith | 1014 | 1045 | Matches values where the `_tag` field starts with a given prefix. |
| Match | tags | 1046 | 1085 | Matches values based on their `_tag` field, mapping each tag to a corresponding handler. |
| Match | tagsExhaustive | 1086 | 1125 | Matches values based on their `_tag` field and requires handling of all possible cases. |
| Match | literals | 1126 | 1163 | Matches string and number literal values, mapping each literal to a corresponding handler. |
| Match | literalsExhaustive | 1164 | 1201 | Matches string and number literal values and requires handling of all remaining cases. |
| Match | not | 1202 | 1239 | Creates a pattern that excludes a specific value while allowing all others. |
| Match | nonEmptyString | 1240 | 1276 | Matches non-empty strings. |
| Match | is | 1277 | 1317 | Matches a specific set of literal values (e.g., `Match.is("a", 42, true)`). |
| Match | string | 1318 | 1347 | Matches values of type `string`. |
| Match | number | 1348 | 1388 | Matches values of type `number`. |
| Match | any | 1389 | 1437 | Matches any value without restrictions. |
| Match | defined | 1438 | 1480 | Matches any defined (non-null and non-undefined) value. |
| Match | boolean | 1481 | 1521 | Matches values of type `boolean`. |
| Match | undefined | 1522 | 1543 | Matches the value `undefined`. |
| Match | null | 1544 | 1565 | Matches the value `null`. |
| Match | bigint | 1566 | 1606 | Matches values of type `bigint`. |
| Match | symbol | 1607 | 1644 | Matches values of type `symbol`. |
| Match | date | 1645 | 1686 | Matches values that are instances of `Date`. |
| Match | record | 1687 | 1733 | Matches non-null objects other than arrays. |
| Match | instanceOf | 1734 | 1792 | Matches instances of a given class. |
| Match | instanceOfUnsafe | 1793 | 1835 | Checks whether a value is an instance of a constructor without type-safe narrowing. |
| Match | orElse | 1836 | 1876 | Provides a fallback value when no patterns match. |
| Match | orElseAbsurd | 1877 | 1921 | Returns a matcher that throws an error if no pattern matches. |
| Match | result | 1922 | 1960 | Wraps the match result in a `Result`, distinguishing matched and unmatched cases. |
| Match | option | 1961 | 2005 | Wraps the match result in an `Option`, representing an optional match. |
| Match | exhaustive | 2006 | 2040 | Completes a matcher that handles every remaining input case. |
| Match | SafeRefinement | 2041 | 2077 | A safe refinement that narrows types without runtime errors. |
| Match | Types | 2078 | 2545 | A namespace containing utility types for Match operations. |
| Metric | Metric | 21 | 113 | A `Metric<Input, State>` represents a concurrent metric which accepts update values of type `Input` and are aggregated to a value of type... |
| Metric | Counter | 114 | 181 | A Counter metric that tracks cumulative values that typically only increase. |
| Metric | CounterState | 182 | 244 | State interface for Counter metrics containing the current count and increment mode. |
| Metric | Frequency | 245 | 316 | A Frequency metric interface that counts occurrences of discrete string values. |
| Metric | FrequencyState | 317 | 402 | State interface for Frequency metrics containing occurrence counts for discrete string values. |
| Metric | Gauge | 403 | 462 | A Gauge metric that tracks instantaneous values that can go up or down. |
| Metric | GaugeState | 463 | 532 | State interface for Gauge metrics containing the current instantaneous value. |
| Metric | Histogram | 533 | 619 | A Histogram metric that records observations in configurable buckets to analyze value distributions. |
| Metric | HistogramState | 620 | 712 | State interface for Histogram metrics containing bucket distributions and aggregate statistics. |
| Metric | Summary | 713 | 812 | A Summary metric that calculates quantiles over a sliding time window of observations. |
| Metric | SummaryState | 813 | 900 | State interface for Summary metrics containing quantile calculations and aggregate statistics. |
| Metric | Metric | 901 | 1492 | The `Metric` namespace provides a comprehensive system for collecting, aggregating, and observing application metrics in Effect applicati... |
| Metric | CurrentMetricAttributesKey | 1493 | 1542 | Service key for the current metric attributes context. |
| Metric | CurrentMetricAttributes | 1543 | 1589 | Context reference for metric attributes applied from the current Effect context. |
| Metric | MetricRegistry | 1590 | 1597 | The registry used to store metric metadata and hooks. |
| Metric | MetricRegistry | 1598 | 1626 | Context reference for the metric registry in the current context. |
| Metric | isMetric | 1627 | 1648 | Returns `true` if the specified value is a `Metric`, otherwise returns `false`. |
| Metric | counter | 1649 | 1836 | Represents a Counter metric that tracks cumulative numerical values over time. |
| Metric | gauge | 1837 | 2046 | Represents a `Gauge` metric that tracks and reports a single numerical value at a specific moment. |
| Metric | frequency | 2047 | 2133 | Creates a `Frequency` metric which can be used to count the number of occurrences of a string. |
| Metric | histogram | 2134 | 2212 | Represents a `Histogram` metric that records observations into buckets. |
| Metric | summary | 2213 | 2290 | Creates a `Summary` metric that records observations and calculates quantiles which takes a value as input and uses the current time. |
| Metric | summaryWithTimestamp | 2291 | 2337 | Creates a `Summary` metric that records observations with explicit timestamps and calculates quantiles. |
| Metric | timer | 2338 | 2388 | Creates a timer metric, based on a `Histogram`, which keeps track of durations in milliseconds. |
| Metric | value | 2389 | 2437 | Retrieves the current state of the specified `Metric`. |
| Metric | modify | 2438 | 2570 | Modifies the metric with the specified input. |
| Metric | update | 2571 | 2727 | Updates the metric with the specified input. |
| Metric | Registration | 2728 | 2743 | Handle for a series registered with `Metric.registerUnsafe`. |
| Metric | remove | 2744 | 2790 | Removes the series of a metric for the current attributes from the metric registry. |
| Metric | removeUnsafe | 2791 | 2806 | Removes the series of a metric for the attributes in the provided `Context` from the metric registry in that `Context`. |
| Metric | registerUnsafe | 2807 | 2859 | Registers a series backed by caller-supplied hooks, for gauges whose value is read when metrics are snapshotted rather than pushed with u... |
| Metric | mapInput | 2860 | 2965 | Returns a new metric that is powered by this one, but which accepts updates of the specified new type, which must be transformable to the... |
| Metric | withConstantInput | 2966 | 3077 | Returns a new metric that is powered by this one, but which accepts updates of any type, and translates them to updates with the specifie... |
| Metric | withAttributes | 3078 | 3255 | Returns a new metric that applies the specified attributes to all operations. |
| Metric | snapshot | 3256 | 3301 | Captures a snapshot of all registered metrics in the current context. |
| Metric | dump | 3302 | 3357 | Returns a human-readable string representation of all currently registered metrics in a tabular format. |
| Metric | snapshotUnsafe | 3358 | 3392 | Captures a snapshot of all registered metrics synchronously using the provided service context. |
| Metric | boundariesFromIterable | 3393 | 3414 | Creates histogram bucket boundaries from an iterable set of values. |
| Metric | linearBoundaries | 3415 | 3442 | Creates histogram bucket boundaries from a linear sequence and appends positive infinity. |
| Metric | exponentialBoundaries | 3443 | 3467 | Creates histogram bucket boundaries with exponentially increasing values. |
| Metric | FiberRuntimeMetricsKey | 3468 | 3483 | Service key for the fiber runtime metrics service. |
| Metric | FiberRuntimeMetricsService | 3484 | 3514 | Interface for the fiber runtime metrics service that tracks fiber lifecycle events. |
| Metric | FiberRuntimeMetrics | 3515 | 3550 | Context reference for the optional service that records fiber runtime metrics. |
| Metric | FiberRuntimeMetricsImpl | 3551 | 3569 | Default implementation of the fiber runtime metrics service. |
| Metric | enableRuntimeMetricsLayer | 3570 | 3596 | Layer that enables automatic collection of fiber runtime metrics across an entire Effect application. |
| Metric | disableRuntimeMetricsLayer | 3597 | 3635 | Layer that disables automatic collection of fiber runtime metrics. |
| Metric | enableRuntimeMetrics | 3636 | 3662 | Enables automatic collection of fiber runtime metrics for the provided Effect. |
| Metric | disableRuntimeMetrics | 3663 | 3690 | Disables automatic collection of fiber runtime metrics for the provided Effect. |
| MutableHashMap | MutableHashMap | 18 | 61 | A mutable hash map that stores key-value pairs and supports both referential and Effect structural equality. |
| MutableHashMap | isMutableHashMap | 62 | 83 | Checks whether the specified value is a `MutableHashMap`, `false` otherwise. |
| MutableHashMap | empty | 84 | 116 | Creates an empty MutableHashMap. |
| MutableHashMap | make | 117 | 146 | Creates a MutableHashMap from a variable number of key-value pairs. |
| MutableHashMap | fromIterable | 147 | 182 | Creates a MutableHashMap from an iterable collection of key-value pairs. |
| MutableHashMap | get | 183 | 285 | Looks up a key in the `MutableHashMap` safely. |
| MutableHashMap | keys | 286 | 314 | Returns an iterable over the keys in the `MutableHashMap`. |
| MutableHashMap | values | 315 | 348 | Returns an iterable over the values in the `MutableHashMap`. |
| MutableHashMap | has | 349 | 436 | Checks whether the MutableHashMap contains the specified key. |
| MutableHashMap | set | 437 | 560 | Sets a key-value pair in the MutableHashMap, mutating the map in place. |
| MutableHashMap | modify | 561 | 684 | Updates the value of the specified key within the MutableHashMap if it exists. |
| MutableHashMap | modifyAt | 685 | 847 | Updates or removes the specified key using a function from the current optional value to the next optional value. |
| MutableHashMap | remove | 848 | 977 | Removes the specified key from the MutableHashMap, mutating the map in place. |
| MutableHashMap | clear | 978 | 1017 | Removes all key-value pairs from the MutableHashMap, mutating the map in place. |
| MutableHashMap | size | 1018 | 1050 | Returns the number of key-value pairs in the MutableHashMap. |
| MutableHashMap | isEmpty | 1051 | 1064 | Returns `true` when the `MutableHashMap` contains no key-value pairs. |
| MutableHashMap | forEach | 1065 | 1130 | Runs a callback for each key-value pair in the `MutableHashMap`. |
| MutableHashSet | MutableHashSet | 5 | 52 | A mutable hash set for storing unique values with Effect structural equality support. |
| MutableHashSet | isMutableHashSet | 53 | 74 | Checks whether the specified value is a `MutableHashSet`, `false` otherwise. |
| MutableHashSet | empty | 75 | 110 | Creates an empty MutableHashSet. |
| MutableHashSet | fromIterable | 111 | 141 | Creates a MutableHashSet from an iterable collection of values. |
| MutableHashSet | make | 142 | 173 | Creates a MutableHashSet from a variable number of values. |
| MutableHashSet | add | 174 | 285 | Adds a value to the MutableHashSet, mutating the set in place. |
| MutableHashSet | has | 286 | 403 | Checks whether the MutableHashSet contains the specified value. |
| MutableHashSet | remove | 404 | 515 | Removes the specified value from the MutableHashSet, mutating the set in place. |
| MutableHashSet | size | 516 | 547 | Returns the number of unique values in the MutableHashSet. |
| MutableHashSet | clear | 548 | 583 | Removes all values from the MutableHashSet, mutating the set in place. |
| MutableList | MutableList | 1 | 28 | A mutable linked list data structure optimized for high-throughput operations. |
| MutableList | MutableList | 29 | 73 | The MutableList namespace contains type definitions and utilities for working with mutable linked lists. |
| MutableList | Empty | 74 | 97 | Defines the unique symbol used to represent an empty result when taking elements from a MutableList. |
| MutableList | Empty | 98 | 123 | The type of the Empty symbol, used for type checking when taking elements from a MutableList. |
| MutableList | make | 124 | 144 | Creates an empty MutableList. |
| MutableList | append | 145 | 167 | Appends an element to the end of the MutableList. |
| MutableList | prepend | 168 | 190 | Prepends an element to the beginning of the MutableList. |
| MutableList | prependAll | 191 | 214 | Prepends all elements from an iterable to the beginning of the MutableList. |
| MutableList | prependAllUnsafe | 215 | 246 | Prepends all elements from a ReadonlyArray to the beginning of the MutableList. |
| MutableList | appendAll | 247 | 271 | Appends all elements from an iterable to the end of the MutableList. |
| MutableList | appendAllUnsafe | 272 | 304 | Appends all elements from a ReadonlyArray to the end of the MutableList. |
| MutableList | clear | 305 | 328 | Removes all elements from the MutableList, resetting it to an empty state. |
| MutableList | takeN | 329 | 356 | Takes up to N elements from the beginning of the MutableList and returns them as an array. |
| MutableList | takeNVoid | 357 | 380 | Removes up to `n` elements from the beginning of the `MutableList` without returning them. |
| MutableList | takeAll | 381 | 401 | Takes all elements from the MutableList and returns them as an array. |
| MutableList | take | 402 | 424 | Takes a single element from the beginning of the MutableList. |
| MutableList | toArrayN | 425 | 445 | Copies up to `n` elements from the beginning of the `MutableList` into a new array without modifying the list. |
| MutableList | toArray | 446 | 461 | Copies all current elements of the `MutableList` into a new array without modifying the list. |
| MutableList | filter | 462 | 484 | Filters the MutableList in place, keeping only elements that satisfy the predicate. |
| MutableList | remove | 485 | 521 | Removes all occurrences of a value from the `MutableList` using JavaScript strict equality semantics. |
| MutableRef | MutableRef | 4 | 58 | A synchronous mutable reference that stores a current value. |
| MutableRef | make | 59 | 92 | Creates a new MutableRef with the specified initial value. |
| MutableRef | compareAndSet | 93 | 243 | Sets the value to newValue atomically if the current value equals oldValue. |
| MutableRef | decrement | 244 | 283 | Decrements a numeric MutableRef by 1 and returns the reference. |
| MutableRef | decrementAndGet | 284 | 326 | Decrements a numeric MutableRef by 1 and returns the new value. |
| MutableRef | get | 327 | 364 | Gets the current value of the MutableRef. |
| MutableRef | getAndDecrement | 365 | 409 | Decrements a numeric MutableRef by 1 and returns the previous value. |
| MutableRef | getAndIncrement | 410 | 461 | Increments a numeric MutableRef by 1 and returns the previous value. |
| MutableRef | getAndSet | 462 | 609 | Sets the MutableRef to a new value and returns the previous value. |
| MutableRef | getAndUpdate | 610 | 775 | Updates the MutableRef with the result of applying a function to its current value, and returns the previous value. |
| MutableRef | increment | 776 | 820 | Increments a numeric MutableRef by 1 and returns the reference. |
| MutableRef | incrementAndGet | 821 | 866 | Increments a numeric MutableRef by 1 and returns the new value. |
| MutableRef | set | 867 | 1023 | Sets the MutableRef to a new value and returns the reference. |
| MutableRef | setAndGet | 1024 | 1168 | Sets the MutableRef to a new value and returns the new value. |
| MutableRef | update | 1169 | 1340 | Updates the MutableRef with the result of applying a function to its current value, and returns the reference. |
| MutableRef | updateAndGet | 1341 | 1518 | Updates the MutableRef with the result of applying a function to its current value, and returns the new value. |
| MutableRef | toggle | 1519 | 1574 | Switches a boolean `MutableRef` between `true` and `false`, then returns the reference. |
| Newtype | Newtype | 20 | 64 | A tagged interface that wraps a carrier type under a unique key, preventing accidental interchange of structurally identical values. |
| Newtype | Newtype | 65 | 114 | Namespace containing type-level helpers for `Newtype` values, including constraints and utilities for extracting a newtype's key and carr... |
| Newtype | value | 115 | 147 | Unwraps a newtype value, returning the underlying carrier value. |
| Newtype | makeIso | 148 | 181 | Creates an `Optic.Iso` for a newtype, providing both wrapping (`set`) and unwrapping (`get`). |
| Newtype | makeEquivalence | 182 | 216 | Lifts an `Equivalence` for the carrier type into an `Equivalence` for the newtype. |
| Newtype | makeOrder | 217 | 248 | Lifts an `Order` for the carrier type into an `Order` for the newtype. |
| Newtype | makeCombiner | 249 | 282 | Lifts a `Combiner` for the carrier type into a `Combiner` for the newtype. |
| Newtype | makeReducer | 283 | 318 | Lifts a `Reducer` for the carrier type into a `Reducer` for the newtype. |
| NonEmptyIterable | nonEmpty | 10 | 30 | Defines the type-level symbol used to brand the `NonEmptyIterable` type. |
| NonEmptyIterable | NonEmptyIterable | 31 | 53 | Represents an iterable that is guaranteed to contain at least one element. |
| NonEmptyIterable | unprepend | 54 | 84 | Extracts the first element and remaining elements from a non-empty iterable safely. |
| Number | Number | 16 | 44 | Exposes the global number constructor. |
| Number | isNumber | 45 | 65 | Checks whether a value is a `number`. |
| Number | sum | 66 | 132 | Provides an addition operation on `number`s. |
| Number | multiply | 133 | 199 | Provides a multiplication operation on `number`s. |
| Number | subtract | 200 | 260 | Provides a subtraction operation on `number`s. |
| Number | divide | 261 | 333 | Divides `number`s safely, returning `Option.none()` if the divisor is `0`. |
| Number | divideUnsafe | 334 | 433 | Divides two `number` values without returning an `Option`. |
| Number | increment | 434 | 453 | Returns the result of adding `1` to a given number. |
| Number | decrement | 454 | 473 | Decrements a number by `1`. |
| Number | Order | 474 | 496 | Order instance for `number` values. |
| Number | Equivalence | 497 | 519 | Equivalence instance for numbers where `NaN` is considered equal to `NaN`. |
| Number | isLessThan | 520 | 586 | Returns `true` if the first argument is less than the second, otherwise `false`. |
| Number | isLessThanOrEqualTo | 587 | 653 | Returns a function that checks if a given `number` is less than or equal to the provided one. |
| Number | isGreaterThan | 654 | 720 | Returns `true` if the first argument is greater than the second, otherwise `false`. |
| Number | isGreaterThanOrEqualTo | 721 | 787 | Returns a function that checks if a given `number` is greater than or equal to the provided one. |
| Number | between | 788 | 872 | Checks whether a `number` is between a `minimum` and `maximum` value (inclusive). |
| Number | clamp | 873 | 981 | Restricts the given `number` to be within the range specified by the `minimum` and `maximum` values. |
| Number | min | 982 | 1048 | Returns the minimum between two `number`s. |
| Number | max | 1049 | 1115 | Returns the maximum between two `number`s. |
| Number | sign | 1116 | 1137 | Determines the sign of a given `number`. |
| Number | sumAll | 1138 | 1160 | Takes an `Iterable` of `number`s and returns their sum as a single `number`. |
| Number | multiplyAll | 1161 | 1183 | Takes an `Iterable` of `number`s and returns their multiplication as a single `number`. |
| Number | remainder | 1184 | 1259 | Returns the remainder left over when one operand is divided by a second operand, always taking the sign of the dividend. |
| Number | nextPow2 | 1260 | 1280 | Returns the next power of 2 from the given number. |
| Number | parse | 1281 | 1308 | Parses a `number` from a `string` safely using the `Number()` function. |
| Number | round | 1309 | 1372 | Returns the number rounded with the given precision. |
| Number | ReducerSum | 1373 | 1391 | Reducer for combining `number`s using addition. |
| Number | ReducerMultiply | 1392 | 1414 | Reducer for combining `number`s using multiplication. |
| Number | ReducerMax | 1415 | 1438 | Reducer for reducing `number`s by keeping the maximum value. |
| Number | ReducerMin | 1439 | 1463 | Reducer for reducing `number`s by keeping the minimum value. |
| Optic | Iso | 21 | 61 | A lossless, reversible conversion between types `S` and `A`. |
| Optic | makeIso | 62 | 97 | Creates an {@link Iso} from a pair of conversion functions. |
| Optic | Lens | 98 | 136 | Focuses on exactly one part `A` inside a whole `S`. |
| Optic | makeLens | 137 | 172 | Creates a {@link Lens} from a getter and a replacer. |
| Optic | Prism | 173 | 218 | Focuses on a part `A` of `S` that may not be present (e.g. |
| Optic | makePrism | 219 | 259 | Creates a {@link Prism} from a fallible getter and an infallible setter. |
| Optic | fromChecks | 260 | 298 | Creates a {@link Prism} from one or more `Schema` validation checks. |
| Optic | Optional | 299 | 714 | The most general optic — both reading and writing can fail. |
| Optic | makeOptional | 715 | 760 | Creates an {@link Optional} from a fallible getter and a fallible setter. |
| Optic | Traversal | 761 | 802 | An optic that focuses on **zero or more** elements of type `A` inside `S`. |
| Optic | get | 803 | 857 | Reads the focused value from a `Lens`. |
| Optic | getResult | 858 | 912 | Attempts to read the focused value from an `Optional`. |
| Optic | set | 913 | 967 | Builds a source value from a focused value using a `Prism`. |
| Optic | replace | 968 | 1022 | Replaces the focused value in a source. |
| Optic | replaceResult | 1023 | 1077 | Attempts to replace the focused value in a source. |
| Optic | modify | 1078 | 1135 | Transforms the focused value in a source. |
| Optic | getAll | 1136 | 1253 | Extracts all values focused by a `Traversal` as a plain mutable array. |
| Optic | modifyAll | 1254 | 1314 | Transforms every value focused by a `Traversal`. |
| Optic | id | 1315 | 1346 | Iso that focuses on the whole value unchanged. |
| Optic | entries | 1347 | 1382 | Iso that converts a `Record<string, A>` to an array of `[key, value]` entries and back. |
| Optic | some | 1383 | 1417 | Prism that focuses on the value inside `Option.Some`. |
| Optic | none | 1418 | 1450 | Prism that focuses on `Option.None`, exposing `undefined`. |
| Optic | success | 1451 | 1483 | Prism that focuses on the success value of a `Result`. |
| Optic | failure | 1484 | 1518 | Prism that focuses on the failure value of a `Result`. |
| Option | Option | 29 | 47 | The `Option` data type represents optional values. |
| Option | None | 48 | 78 | Represents the absence of a value within an {@link Option}. |
| Option | OptionIterator | 79 | 96 | Iterator protocol used to yield an `Option` inside {@link gen}, returning the contained value type back to the generator. |
| Option | Some | 97 | 130 | Represents the presence of a value within an {@link Option}. |
| Option | OptionUnify | 131 | 152 | Type-level unification support for `Option` values. |
| Option | Option | 153 | 186 | Namespace containing utility types for `Option`. |
| Option | OptionUnifyIgnore | 187 | 204 | Marker interface used by Effect's `Unify` machinery for `Option` values. |
| Option | OptionTypeLambda | 205 | 219 | Type lambda interface for higher-kinded type encodings with `Option`. |
| Option | none | 220 | 249 | Creates an `Option` representing the absence of a value. |
| Option | some | 250 | 279 | Wraps the given value into an `Option` to represent its presence. |
| Option | isOption | 280 | 310 | Determines whether the given value is an `Option`. |
| Option | isNone | 311 | 337 | Checks whether an `Option` is `None` (absent). |
| Option | isSome | 338 | 364 | Checks whether an `Option` contains a value (`Some`). |
| Option | match | 365 | 467 | Pattern-matches on an `Option`, handling both `None` and `Some` cases. |
| Option | toRefinement | 468 | 506 | Converts an `Option`-returning function into a type guard (refinement). |
| Option | fromIterable | 507 | 536 | Wraps the first element of an `Iterable` in a `Some`, or returns `None` if the iterable is empty. |
| Option | getSuccess | 537 | 565 | Converts a `Result` into an `Option`, keeping only the success value. |
| Option | getFailure | 566 | 594 | Converts a `Result` into an `Option`, keeping only the failure value. |
| Option | getOrElse | 595 | 691 | Extracts the value from a `Some`, or evaluates a fallback thunk on `None`. |
| Option | orElse | 692 | 785 | Returns the fallback `Option` if `self` is `None`; otherwise returns `self`. |
| Option | orElseSome | 786 | 873 | Returns `Some` of the fallback value if `self` is `None`; otherwise returns `self`. |
| Option | orElseResult | 874 | 970 | Returns the first available value and marks whether it came from the fallback. |
| Option | firstSomeOf | 971 | 1002 | Returns the first `Some` found in an iterable of `Option`s, or `None` if all are `None`. |
| Option | fromNullishOr | 1003 | 1034 | Converts a nullable value (`null` or `undefined`) into an `Option`. |
| Option | fromUndefinedOr | 1035 | 1066 | Converts a possibly `undefined` value into an `Option`, leaving `null` as a valid `Some`. |
| Option | fromNullOr | 1067 | 1098 | Converts a possibly `null` value into an `Option`, leaving `undefined` as a valid `Some`. |
| Option | liftNullishOr | 1099 | 1135 | Lifts a function that may return `null` or `undefined` into one that returns an `Option`. |
| Option | getOrNull | 1136 | 1164 | Extracts the value from a `Some`, or returns `null` for `None`. |
| Option | getOrUndefined | 1165 | 1194 | Extracts the value from a `Some`, or returns `undefined` for `None`. |
| Option | liftThrowable | 1195 | 1224 | Lifts a function that may throw into one that returns an `Option`. |
| Option | getOrThrowWith | 1225 | 1330 | Extracts the value from a `Some`, or throws a custom error for `None`. |
| Option | getOrThrow | 1331 | 1365 | Extracts the value from a `Some`, or throws a default `Error` for `None`. |
| Option | map | 1366 | 1459 | Transforms the value inside a `Some` using the provided function, leaving `None` unchanged. |
| Option | as | 1460 | 1535 | Replaces the value inside a `Some` with a constant, leaving `None` unchanged. |
| Option | asVoid | 1536 | 1560 | Replaces the value inside a `Some` with `void` (`undefined`), leaving `None` unchanged. |
| Option | void | 1561 | 1584 | Provides a pre-built `Some(undefined)` constant. |
| Option | flatMap | 1585 | 1717 | Applies a function that returns an `Option` to the value of a `Some`, flattening the result. |
| Option | andThen | 1718 | 2069 | Chains a second computation onto an `Option`. |
| Option | flatMapNullishOr | 2070 | 2190 | Combines {@link flatMap} with {@link fromNullishOr}: applies a function that may return `null`/`undefined` to the value of a `Some`. |
| Option | flatten | 2191 | 2219 | Flattens a nested `Option<Option<A>>` into `Option<A>`. |
| Option | zipRight | 2220 | 2310 | Sequences two `Option`s, keeping the value from the second if both are `Some`. |
| Option | zipLeft | 2311 | 2401 | Sequences two `Option`s, keeping the value from the first if both are `Some`. |
| Option | composeK | 2402 | 2516 | Composes two `Option`-returning functions into a single function that chains them together. |
| Option | tap | 2517 | 2622 | Runs a side-effecting `Option`-returning function on the value of a `Some`, returning the original `Option` if the function returns `Some... |
| Option | product | 2623 | 2716 | Combines two `Option`s into a `Some` containing a tuple `[A, B]` if both are `Some`. |
| Option | productMany | 2717 | 2819 | Combines a primary `Option` with an iterable of `Option`s into a tuple if all are `Some`. |
| Option | all | 2820 | 2864 | Combines a structure of `Option`s (tuple, struct, or iterable) into a single `Option` containing the unwrapped structure. |
| Option | zipWith | 2865 | 2964 | Combines two `Option`s using a provided function. |
| Option | reduceCompact | 2965 | 3052 | Reduces an iterable of `Option`s to a single value, skipping `None` entries. |
| Option | toArray | 3053 | 3081 | Converts an `Option` into an `Array`. |
| Option | partitionMap | 3082 | 3190 | Splits an `Option` into two `Option`s using a function that returns a `Result`. |
| Option | filterMap | 3191 | 3284 | Transforms and filters an `Option` using a `Filter` callback. |
| Option | filter | 3285 | 3470 | Filters an `Option` using a predicate. |
| Option | makeEquivalence | 3471 | 3501 | Creates an `Equivalence` for `Option<A>` from an `Equivalence` for `A`. |
| Option | makeOrder | 3502 | 3533 | Creates an `Order` for `Option<A>` from an `Order` for `A`. |
| Option | lift2 | 3534 | 3567 | Lifts a binary function to operate on two `Option` values. |
| Option | liftPredicate | 3568 | 3705 | Lifts a `Predicate` or `Refinement` into the `Option` context: returns `Some(value)` when the predicate holds, `None` otherwise. |
| Option | containsWith | 3706 | 3741 | Checks whether an `Option` contains a value equivalent to the given one, using a custom `Equivalence`. |
| Option | contains | 3742 | 3838 | Checks whether an `Option` contains a value equal to the given one, using default structural equality. |
| Option | exists | 3839 | 4009 | Checks whether the value in a `Some` satisfies a predicate or refinement. |
| Option | bindTo | 4010 | 4107 | Gives a name to the value of an `Option`, creating a single-key record inside `Some`. |
| Option | let | 4108 | 4146 | Adds a computed plain value to the do notation record. |
| Option | bind | 4147 | 4244 | Adds an `Option` value to the do notation record under a given name. |
| Option | Do | 4245 | 4276 | Provides an `Option` containing an empty record `{}`, used as the starting point for do notation chains. |
| Option | gen | 4277 | 4313 | Provides generator-based syntax for `Option`, similar to `async`/`await` but for optional values. |
| Option | makeReducer | 4314 | 4346 | Creates a `Reducer` for `Option<A>` that prioritizes the first non-`None` value and combines values when both are `Some`. |
| Option | makeCombinerFailFast | 4347 | 4378 | Creates a `Combiner` for `Option<A>` with fail-fast semantics: returns `None` if either operand is `None`. |
| Option | makeReducerFailFast | 4379 | 4412 | Creates a `Reducer` for `Option<A>` by lifting an existing `Reducer` with fail-fast semantics. |
| Order | Order | 4 | 42 | Represents a total ordering for values of type `A`. |
| Order | OrderTypeLambda | 43 | 61 | Type lambda for the `Order` type class, used internally for higher-kinded type operations. |
| Order | make | 62 | 98 | Creates a new `Order` instance from a comparison function. |
| Order | String | 99 | 127 | Order instance for strings that compares them lexicographically using JavaScript's `<` operator. |
| Order | Number | 128 | 160 | Order instance for numbers that compares them numerically. |
| Order | Boolean | 161 | 187 | Order instance for booleans where `false` is considered less than `true`. |
| Order | BigInt | 188 | 216 | Order instance for bigints that compares them numerically. |
| Order | flip | 217 | 247 | Creates a new `Order` that reverses the comparison order of the input `Order`. |
| Order | combine | 248 | 380 | Combines two `Order` instances to create a new `Order` that first compares using the first `Order`, and if the values are equal, then com... |
| Order | alwaysEqual | 381 | 410 | Creates an `Order` that considers all values as equal. |
| Order | combineAll | 411 | 453 | Combines all `Order` instances in the provided collection into a single `Order`. |
| Order | mapInput | 454 | 556 | Transforms an `Order` on type `A` into an `Order` on type `B` by providing a function that maps values of type `B` to values of type `A`. |
| Order | Date | 557 | 588 | Order instance for `Date` objects that compares them chronologically by their timestamp. |
| Order | Tuple | 589 | 624 | Creates an `Order` for a tuple type based on orders for each element. |
| Order | Array | 625 | 659 | Creates an `Order` for arrays by applying the given `Order` to each element, then comparing by length if all elements are equal. |
| Order | Struct | 660 | 702 | Creates an `Order` for structs by applying the given `Order`s to each property in sequence. |
| Order | isLessThan | 703 | 736 | Checks whether one value is strictly less than another according to the given order. |
| Order | isGreaterThan | 737 | 770 | Checks whether one value is strictly greater than another according to the given order. |
| Order | isLessThanOrEqualTo | 771 | 804 | Checks whether one value is less than or equal to another according to the given order. |
| Order | isGreaterThanOrEqualTo | 805 | 839 | Checks whether one value is greater than or equal to another according to the given order. |
| Order | min | 840 | 874 | Returns the minimum of two values according to the given order. |
| Order | max | 875 | 909 | Returns the maximum of two values according to the given order. |
| Order | clamp | 910 | 953 | Restricts a value between a minimum and a maximum according to the given order. |
| Order | isBetween | 954 | 999 | Checks whether a value is between a minimum and a maximum (inclusive) according to the given order. |
| Order | makeReducer | 1000 | 1034 | Creates a `Reducer` for combining `Order` instances, useful for aggregating orders in collections. |
| Ordering | Ordering | 13 | 53 | Represents the result of comparing two values. |
| Ordering | reverse | 54 | 95 | Reverses the ordering of the input Ordering. |
| Ordering | match | 96 | 188 | Matches an `Ordering` value and returns the branch selected by that ordering. |
| Ordering | Reducer | 189 | 212 | Reducer for combining `Ordering`s. |
| PartitionedSemaphore | PartitionedTypeId | 13 | 26 | Runtime type identifier used to mark values that implement `PartitionedSemaphore`. |
| PartitionedSemaphore | PartitionedTypeId | 27 | 43 | Literal type of the `PartitionedSemaphore` runtime type identifier. |
| PartitionedSemaphore | PartitionedSemaphore | 44 | 71 | A `PartitionedSemaphore` controls access to a shared permit pool while tracking waiters by partition key. |
| PartitionedSemaphore | Partitioned | 72 | 90 | Alias interface for a `PartitionedSemaphore` keyed by values of type `K`. |
| PartitionedSemaphore | makeUnsafe | 91 | 113 | Constructs a `PartitionedSemaphore` synchronously, outside of `Effect`. |
| PartitionedSemaphore | make | 114 | 140 | Creates a `PartitionedSemaphore` inside an `Effect`. |
| PartitionedSemaphore | available | 141 | 166 | Gets the current number of available permits. |
| PartitionedSemaphore | capacity | 167 | 185 | Gets the total capacity. |
| PartitionedSemaphore | take | 186 | 273 | Returns an effect that acquires the requested number of permits for the given partition key. |
| PartitionedSemaphore | release | 274 | 346 | Returns an effect that releases permits back to the shared pool and returns the current available permit count. |
| PartitionedSemaphore | withPermits | 347 | 440 | Runs an effect after acquiring permits for a partition, then releases those permits when the effect exits. |
| PartitionedSemaphore | withPermit | 441 | 516 | Runs an effect after acquiring one permit for a partition, then releases the permit when the effect exits. |
| PartitionedSemaphore | withPermitsIfAvailable | 517 | 590 | Runs an effect only when the requested permits can be acquired immediately, returning the result in `Some`. |
| Path | TypeId | 18 | 33 | Runtime type identifier used to mark implementations of the `Path` service. |
| Path | Path | 34 | 111 | Defines the service interface for platform-specific path manipulation. |
| Path | Path | 112 | 199 | Namespace containing types associated with the `Path` service. |
| Path | Path | 200 | 265 | Service tag for accessing the current `Path` implementation. |
| Path | make | 266 | 287 | Creates a `Path` service from platform path operations. |
| Path | layer | 288 | 308 | Layer that provides the built-in POSIX `Path` implementation. |
| Pipeable | Pipeable | 14 | 68 | Interface for values that support method-style `pipe` composition. |
| Pipeable | pipeArguments | 69 | 108 | Applies a `pipe` method's variadic arguments to an initial value from left to right. |
| Pipeable | Prototype | 109 | 121 | Reusable prototype that implements `Pipeable.pipe`. |
| Pipeable | Class | 122 | 135 | Provides a base constructor whose instances implement the standard `Pipeable.pipe` method. |
| Pipeable | PipeableConstructor | 136 | 154 | Constructor type for classes whose instances implement `Pipeable`. |
| Pipeable | Mixin | 155 | 176 | Returns a subclass of the provided class that adds the standard `pipe` method. |
| PlatformError | BadArgument | 18 | 55 | Error data for an invalid argument passed to a platform API. |
| PlatformError | SystemErrorTag | 56 | 76 | Normalized category for failures reported by platform or system operations. |
| PlatformError | SystemError | 77 | 121 | Error data for a platform or system operation failure. |
| PlatformError | PlatformError | 122 | 161 | Tagged error used by platform APIs to report either invalid arguments or system-level failures. |
| PlatformError | isPlatformError | 162 | 188 | Returns `true` if a value is a `PlatformError`. |
| PlatformError | systemError | 189 | 209 | Creates a `PlatformError` whose reason is a `SystemError`. |
| PlatformError | badArgument | 210 | 229 | Creates a `PlatformError` whose reason is a `BadArgument`. |
| Pool | Pool | 8 | 32 | A `Pool<A, E>` is a pool of items of type `A`, each of which may be associated with the acquisition and release of resources. |
| Pool | Config | 33 | 62 | Normalized configuration used by a `Pool`. |
| Pool | Stats | 63 | 84 | A point-in-time count of a pool's items and waiting borrowers. |
| Pool | State | 85 | 118 | Mutable runtime state maintained by a `Pool`. |
| Pool | PoolItem | 119 | 152 | Internal record for a value managed by a `Pool`. |
| Pool | Strategy | 153 | 178 | Strategy used by a `Pool` to manage background resizing and item reclamation. |
| Pool | isPool | 179 | 195 | Returns `true` if the specified value is a `Pool`, `false` otherwise. |
| Pool | make | 196 | 230 | Makes a new pool of the specified fixed size. |
| Pool | makeWithTTL | 231 | 301 | Creates a scoped pool with minimum and maximum sizes and a time-to-live policy for shrinking unused excess items. |
| Pool | makeWithStrategy | 302 | 330 | Creates a scoped pool using a custom resizing and reclamation strategy. |
| Pool | get | 331 | 354 | Retrieves an item from the pool in a scoped effect. |
| Pool | use | 355 | 445 | Borrows an item while an effect runs and returns it when the effect exits. |
| Pool | invalidate | 446 | 509 | Invalidates the specified item so the pool can remove it and reallocate the item, lazily if needed. |
| Pool | reserve | 510 | 549 | Reserves a leased item for exclusive use until the scope closes. |
| Pool | stats | 550 | 580 | Returns a snapshot of how many items are idle or in use and how many borrowers are waiting. |
| Predicate | Predicate | 3 | 36 | A function that decides whether a value of type `A` satisfies a condition. |
| Predicate | PredicateTypeLambda | 37 | 69 | Type-level lambda for higher-kinded usage of {@link Predicate}. |
| Predicate | Refinement | 70 | 106 | A predicate that also narrows the input type when it returns `true`. |
| Predicate | Predicate | 107 | 194 | Type-level utilities for working with {@link Predicate} types. |
| Predicate | Refinement | 195 | 311 | Type-level utilities for working with {@link Refinement} types. |
| Predicate | mapInput | 312 | 411 | Transforms the input of a predicate using a mapping function. |
| Predicate | isTupleOf | 412 | 502 | Checks whether a readonly array has exactly `n` elements. |
| Predicate | isTupleOfAtLeast | 503 | 593 | Checks whether a readonly array has at least `n` elements. |
| Predicate | isTruthy | 594 | 622 | Checks whether a value is truthy. |
| Predicate | isSet | 623 | 652 | Checks whether a value is a `Set`. |
| Predicate | isMap | 653 | 682 | Checks whether a value is a `Map`. |
| Predicate | isString | 683 | 714 | Checks whether a value is a `string`. |
| Predicate | isNumber | 715 | 745 | Checks whether a value is a `number`. |
| Predicate | isBoolean | 746 | 776 | Checks whether a value is a `boolean`. |
| Predicate | isBigInt | 777 | 806 | Checks whether a value is a `bigint`. |
| Predicate | isSymbol | 807 | 836 | Checks whether a value is a `symbol`. |
| Predicate | isPropertyKey | 837 | 869 | Checks whether a value is a valid `PropertyKey` (string, number, or symbol). |
| Predicate | isFunction | 870 | 899 | Checks whether a value is a `function`. |
| Predicate | isUndefined | 900 | 928 | Checks whether a value is `undefined`. |
| Predicate | isNotUndefined | 929 | 956 | Checks whether a value is not `undefined`. |
| Predicate | isNull | 957 | 984 | Checks whether a value is `null`. |
| Predicate | isNotNull | 985 | 1012 | Checks whether a value is not `null`. |
| Predicate | isNullish | 1013 | 1040 | Checks whether a value is `null` or `undefined`. |
| Predicate | isNotNullish | 1041 | 1069 | Checks whether a value is not `null` and not `undefined`. |
| Predicate | isNever | 1070 | 1090 | Type guard that always returns `false`. |
| Predicate | isUnknown | 1091 | 1111 | Type guard that always returns `true`. |
| Predicate | isObjectOrArray | 1112 | 1140 | Checks whether a value is an object or an array (non-null object). |
| Predicate | isObject | 1141 | 1172 | Checks whether a value is a non-null object value that is not an array. |
| Predicate | isReadonlyObject | 1173 | 1205 | Checks whether a value is a non-null, non-array object and narrows it to a readonly indexable object type. |
| Predicate | isObjectKeyword | 1206 | 1233 | Checks whether a value is an `object` in the JavaScript sense (objects, arrays, functions). |
| Predicate | hasProperty | 1234 | 1337 | Checks whether a value has a given property key. |
| Predicate | isTagged | 1338 | 1426 | Checks whether a value has a `_tag` property equal to the given tag. |
| Predicate | isError | 1427 | 1453 | Checks whether a value is an `Error`. |
| Predicate | isUint8Array | 1454 | 1481 | Checks whether a value is a `Uint8Array`. |
| Predicate | isDate | 1482 | 1508 | Checks whether a value is a `Date`. |
| Predicate | isIterable | 1509 | 1536 | Checks whether a value is iterable. |
| Predicate | isPromise | 1537 | 1563 | Checks whether a value is a `Promise`-like object with `then` and `catch`. |
| Predicate | isPromiseLike | 1564 | 1591 | Checks whether a value is `PromiseLike` (has a `then` method). |
| Predicate | isRegExp | 1592 | 1618 | Checks whether a value is a `RegExp`. |
| Predicate | compose | 1619 | 1784 | Composes two predicates or refinements into one. |
| Predicate | Tuple | 1785 | 1820 | Creates a predicate for tuples by applying predicates to each element. |
| Predicate | Struct | 1821 | 1859 | Creates a predicate for objects by applying predicates to named properties. |
| Predicate | not | 1860 | 1888 | Negates a predicate. |
| Predicate | or | 1889 | 2039 | Creates a predicate that returns `true` if either predicate is `true`. |
| Predicate | and | 2040 | 2245 | Creates a predicate that returns `true` only if both predicates are `true`. |
| Predicate | xor | 2246 | 2336 | Creates a predicate that returns `true` if exactly one predicate is `true`. |
| Predicate | eqv | 2337 | 2421 | Creates a predicate that returns `true` when both predicates agree. |
| Predicate | implies | 2422 | 2518 | Creates a predicate representing logical implication: if `antecedent`, then `consequent`. |
| Predicate | nor | 2519 | 2603 | Creates a predicate that returns `true` when neither predicate is `true`. |
| Predicate | nand | 2604 | 2688 | Creates a predicate that returns `true` unless both predicates are `true`. |
| Predicate | every | 2689 | 2717 | Creates a predicate that returns `true` if all predicates in the collection return `true`. |
| Predicate | some | 2718 | 2747 | Creates a predicate that returns `true` if any predicate in the collection returns `true`. |
| PrimaryKey | symbol | 10 | 26 | Defines the unique identifier used to identify objects that implement the `PrimaryKey` interface. |
| PrimaryKey | PrimaryKey | 27 | 63 | An interface for objects that can provide a string-based primary key. |
| PrimaryKey | isPrimaryKey | 64 | 86 | Checks whether a value implements the `PrimaryKey` protocol. |
| PrimaryKey | value | 87 | 123 | Extracts the string value from a `PrimaryKey`. |
| PubSub | PubSub | 26 | 71 | A `PubSub<A>` is an asynchronous message hub into which publishers can publish messages of type `A` and subscribers can subscribe to take... |
| PubSub | PubSub | 72 | 175 | Companion namespace containing the low-level building blocks used by `PubSub`, including atomic implementations, backing subscriptions, r... |
| PubSub | isPubSub | 176 | 202 | Returns `true` if a value is a `PubSub`. |
| PubSub | Subscription | 203 | 249 | A subscription represents a consumer's connection to a PubSub, allowing them to take messages. |
| PubSub | make | 250 | 282 | Creates a PubSub with a custom atomic implementation and strategy. |
| PubSub | bounded | 283 | 328 | Creates a bounded `PubSub` that applies backpressure when it reaches capacity. |
| PubSub | dropping | 329 | 371 | Creates a bounded `PubSub` with the dropping strategy. |
| PubSub | sliding | 372 | 413 | Creates a bounded `PubSub` with the sliding strategy. |
| PubSub | unbounded | 414 | 446 | Creates an unbounded `PubSub`. |
| PubSub | makeAtomicBounded | 447 | 480 | Creates a bounded atomic PubSub implementation with optional replay buffer. |
| PubSub | makeAtomicUnbounded | 481 | 504 | Creates an unbounded atomic PubSub implementation with optional replay buffer. |
| PubSub | capacity | 505 | 527 | Returns the number of elements the queue can hold. |
| PubSub | size | 528 | 567 | Returns the current number of messages retained by the `PubSub` for active subscribers. |
| PubSub | sizeUnsafe | 568 | 600 | Returns the current number of messages retained by the `PubSub` for active subscribers synchronously. |
| PubSub | isFull | 601 | 638 | Returns `true` when the `PubSub` has reached its configured capacity. |
| PubSub | isEmpty | 639 | 671 | Returns `true` if the `Pubsub` contains zero elements, `false` otherwise. |
| PubSub | shutdown | 672 | 708 | Shuts down the `PubSub`, interrupting suspended publishers and subscribers and finalizing active subscriptions. |
| PubSub | end | 709 | 895 | Ends the `PubSub` with a final message. |
| PubSub | endUnsafe | 896 | 932 | Ends the `PubSub` with a final message synchronously. |
| PubSub | isShutdown | 933 | 963 | Checks effectfully whether `shutdown` has been called, returning `true` after shutdown and `false` otherwise. |
| PubSub | isShutdownUnsafe | 964 | 993 | Checks synchronously whether `shutdown` has been called, returning `true` after shutdown and `false` otherwise. |
| PubSub | awaitShutdown | 994 | 1030 | Waits until the queue is shutdown. |
| PubSub | publish | 1031 | 1163 | Publishes a message to the `PubSub` as an `Effect`, returning whether the message was accepted. |
| PubSub | publishUnsafe | 1164 | 1272 | Attempts to publish a message synchronously without applying the PubSub strategy's effectful surplus handling. |
| PubSub | publishAll | 1273 | 1384 | Publishes all of the specified messages to the `PubSub`, returning whether they were published to the `PubSub`. |
| PubSub | subscribe | 1385 | 1437 | Subscribes to receive messages from the `PubSub`. |
| PubSub | take | 1438 | 1470 | Takes a single message from the subscription. |
| PubSub | takeAll | 1471 | 1500 | Takes all available messages from the subscription, suspending if no items are available. |
| PubSub | takeUpTo | 1501 | 1615 | Takes up to the specified number of messages from the subscription without suspending. |
| PubSub | takeBetween | 1616 | 1721 | Takes between the specified minimum and maximum number of messages from the subscription. |
| PubSub | remaining | 1722 | 1769 | Returns the number of messages currently available in the subscription as an `Effect`. |
| PubSub | remainingUnsafe | 1770 | 1800 | Synchronously returns the number of messages currently available in the subscription, or `Option.none()` when it is shut down. |
| PubSub | BackPressureStrategy | 1801 | 1836 | Represents the back-pressure strategy for bounded `PubSub` values. |
| PubSub | DroppingStrategy | 1837 | 1892 | Represents the dropping strategy for bounded `PubSub` values. |
| PubSub | SlidingStrategy | 1893 | 1951 | Represents the sliding strategy for bounded `PubSub` values. |
| Pull | Pull | 18 | 39 | An effectful pull step that either produces a value, fails with `E`, or signals completion with `Cause.Done<Done>`. |
| Pull | Success | 40 | 56 | Extracts the success type from a Pull type. |
| Pull | Error | 57 | 74 | Extracts the error type from a Pull type, excluding Done errors. |
| Pull | Leftover | 75 | 92 | Extracts the leftover type from a Pull type. |
| Pull | Services | 93 | 109 | Extracts the service requirements (context) type from a Pull type. |
| Pull | ExcludeDone | 110 | 125 | Excludes `Cause.Done` completion signals from an error type union. |
| Pull | catchDone | 126 | 195 | Handles `Cause.Done` failures in an effect while leaving ordinary failures in the error channel. |
| Pull | isDoneCause | 196 | 212 | Checks whether a Cause contains any done errors. |
| Pull | isDoneFailure | 213 | 229 | Checks whether a `Cause.Reason` is a `Fail` reason whose error is a `Cause.Done` signal. |
| Pull | filterDone | 230 | 251 | Finds a `Cause.Done` failure in a `Cause`. |
| Pull | filterDoneVoid | 252 | 273 | Finds a `Cause.Done` failure in a cause whose done value is not used. |
| Pull | filterNoDone | 274 | 294 | Keeps a `Cause` only when it contains no `Cause.Done` failures. |
| Pull | filterDoneLeftover | 295 | 307 | Filters a Cause to extract the leftover value from done errors. |
| Pull | doneExitFromCause | 308 | 331 | Converts a `Cause` into an `Exit`, treating `Cause.Done` as successful completion. |
| Pull | matchEffect | 332 | 425 | Pattern matches on a Pull, handling success, failure, and done cases. |
| Queue | isQueue | 25 | 40 | Type guard to check if a value is a Queue. |
| Queue | isEnqueue | 41 | 62 | Type guard to check if a value is an Enqueue. |
| Queue | isDequeue | 63 | 80 | Type guard to check if a value is a Dequeue. |
| Queue | asEnqueue | 81 | 101 | Converts a `Queue` to its write-only `Enqueue` interface. |
| Queue | asDequeue | 102 | 122 | Narrows a `Queue` to a `Dequeue`, exposing the consumer side of the queue. |
| Queue | Enqueue | 123 | 164 | An `Enqueue` is a queue that can be offered to. |
| Queue | Enqueue | 165 | 189 | Companion namespace containing type-level metadata for the `Enqueue` write-only queue interface. |
| Queue | Dequeue | 190 | 232 | A `Dequeue` is a queue that can be taken from. |
| Queue | Dequeue | 233 | 256 | Companion namespace containing type-level metadata for the `Dequeue` read-only queue interface. |
| Queue | Queue | 257 | 294 | A `Queue` is an asynchronous queue that can be offered to and taken from. |
| Queue | Queue | 295 | 385 | Companion namespace containing type-level metadata and low-level state types for `Queue`. |
| Queue | make | 386 | 432 | Creates a `Queue` with optional capacity and overflow strategy. |
| Queue | bounded | 433 | 464 | Creates a bounded queue with the specified capacity that uses backpressure strategy. |
| Queue | sliding | 465 | 501 | Creates a bounded queue with sliding strategy. |
| Queue | dropping | 502 | 537 | Creates a bounded queue with dropping strategy. |
| Queue | unbounded | 538 | 574 | Creates an unbounded queue that can grow to any size without blocking producers. |
| Queue | offer | 575 | 677 | Adds a message to the queue. |
| Queue | offerUnsafe | 678 | 719 | Adds a message to the queue synchronously. |
| Queue | offerAll | 720 | 828 | Adds multiple messages to the queue. |
| Queue | offerAllUnsafe | 829 | 866 | Adds multiple messages to the queue synchronously. |
| Queue | fail | 867 | 951 | Fails the queue with an error. |
| Queue | failCause | 952 | 1039 | Fails the queue with a cause. |
| Queue | failCauseUnsafe | 1040 | 1077 | Fails the queue with a cause synchronously. |
| Queue | end | 1078 | 1120 | Signals queue completion. |
| Queue | endUnsafe | 1121 | 1171 | Signals queue completion synchronously. |
| Queue | interrupt | 1172 | 1215 | Interrupts the queue gracefully, transitioning it to a closing state. |
| Queue | shutdown | 1216 | 1253 | Shuts down the queue immediately, discarding buffered messages and resuming pending operations. |
| Queue | shutdownUnsafe | 1254 | 1276 | Shuts down the queue synchronously, discarding buffered messages and resuming pending operations. |
| Queue | clear | 1277 | 1314 | Takes and returns all currently buffered messages without waiting for more. |
| Queue | takeAll | 1315 | 1352 | Takes all currently available messages, waiting until at least one message is available when the queue is empty. |
| Queue | collect | 1353 | 1379 | Takes all messages from the queue, until the queue has errored or is done. |
| Queue | takeN | 1380 | 1506 | Takes up to `n` messages from the queue. |
| Queue | takeBetween | 1507 | 1633 | Takes between `min` and `max` messages from the queue. |
| Queue | take | 1634 | 1674 | Takes a single message from the queue, or wait for a message to be available. |
| Queue | poll | 1675 | 1710 | Attempts to take one item from the queue without waiting. |
| Queue | peek | 1711 | 1739 | Peeks at the next item without removing it. |
| Queue | takeUnsafe | 1740 | 1784 | Attempts to take one message from the queue synchronously. |
| Queue | flushUnsafe | 1785 | 1822 | Manually releases current queue takers synchronously. |
| Queue | flush | 1823 | 1860 | Manually releases current queue takers. |
| Queue | await | 1861 | 1892 | Waits until a queue reaches the `Done` state. |
| Queue | size | 1893 | 1934 | Returns the current number of buffered messages in the queue. |
| Queue | isFull | 1935 | 1962 | Checks whether the queue is full. |
| Queue | sizeUnsafe | 1963 | 2012 | Returns the current number of buffered messages in the queue synchronously. |
| Queue | isFullUnsafe | 2013 | 2045 | Checks whether the queue is full synchronously. |
| Queue | into | 2046 | 2155 | Runs an `Effect` into a `Queue`, where success ends the queue and failure fails the queue. |
| Random | Random | 17 | 33 | The service used to generate pseudo-random numbers. |
| Random | Random | 34 | 67 | Represents a service for generating pseudo-random numbers. |
| Random | next | 68 | 88 | Generates a random number between 0 (inclusive) and 1 (exclusive). |
| Random | nextBoolean | 89 | 108 | Generates a random boolean value. |
| Random | nextInt | 109 | 130 | Generates a random integer between `Number.MIN_SAFE_INTEGER` (inclusive) and `Number.MAX_SAFE_INTEGER` (inclusive). |
| Random | nextBetween | 131 | 150 | Generates a random number between `min` (inclusive) and `max` (exclusive). |
| Random | nextIntBetween | 151 | 187 | Generates a random integer between `min` and `max`. |
| Random | shuffle | 188 | 207 | Uses the pseudo-random number generator to shuffle the specified iterable. |
| Random | choice | 208 | 233 | Gets a random element from an iterable. |
| Random | withSeed | 234 | 349 | Seeds the pseudo-random number generator with the specified value. |
| RcMap | RcMap | 28 | 79 | An `RcMap` is a reference-counted map data structure that manages the lifecycle of resources indexed by keys. |
| RcMap | State | 80 | 97 | Represents the internal state of an RcMap, which can be either Open (active) or Closed (shutdown and no longer accepting operations). |
| RcMap | State | 98 | 161 | Namespace containing the internal state types for RcMap. |
| RcMap | make | 162 | 332 | Creates an `RcMap` that can contain multiple reference counted resources that can be indexed by a key. |
| RcMap | get | 333 | 474 | Gets the resource for a key, acquiring it with the map's lookup function when the key is not already cached. |
| RcMap | getOption | 475 | 613 | Retains and returns an existing resource without invoking the map's lookup function when the key is missing. |
| RcMap | keys | 614 | 654 | Returns an iterable of all keys currently stored in the `RcMap`. |
| RcMap | invalidate | 655 | 796 | Invalidates and removes a specific key from the RcMap. |
| RcMap | has | 797 | 875 | Returns whether the `RcMap` currently contains an entry for the specified key. |
| RcMap | touch | 876 | 1022 | Extends the idle time for a resource in the RcMap. |
| RcRef | RcRef | 18 | 68 | A reference counted reference that manages resource lifecycle. |
| RcRef | RcRef | 69 | 108 | Namespace containing type-level members associated with `RcRef`. |
| RcRef | make | 109 | 171 | Creates an `RcRef` from an acquire effect. |
| RcRef | get | 172 | 217 | Gets the value from an `RcRef`, acquiring it first if needed. |
| RcRef | invalidate | 218 | 243 | Invalidates the currently cached resource, if one has been acquired. |
| Record | ReadonlyRecord | 20 | 45 | Represents a readonly record with keys of type `K` and values of type `A`. |
| Record | ReadonlyRecord | 46 | 132 | Namespace containing utility types for working with readonly records. |
| Record | ReadonlyRecordTypeLambda | 133 | 163 | Type lambda for readonly records, used in higher-kinded type operations. |
| Record | empty | 164 | 184 | Creates a new, empty record. |
| Record | isEmptyRecord | 185 | 201 | Determines if a mutable record is empty. |
| Record | isEmptyReadonlyRecord | 202 | 218 | Determines if a readonly record is empty. |
| Record | fromIterableWith | 219 | 270 | Takes an iterable and a projection function and returns a record. |
| Record | fromIterableBy | 271 | 343 | Creates a new record from an iterable, utilizing the provided function to determine the key for each element. |
| Record | fromEntries | 344 | 364 | Builds a record from an iterable of key-value pairs. |
| Record | collect | 365 | 416 | Transforms the values of a record into an `Array` with a custom mapping function. |
| Record | toEntries | 417 | 433 | Takes a record and returns an array of tuples containing its keys and values. |
| Record | size | 434 | 449 | Returns the number of key/value pairs in a record. |
| Record | has | 450 | 501 | Checks whether a given `key` exists in a record. |
| Record | get | 502 | 559 | Retrieves a value at a particular key from a record safely, returning it wrapped in an `Option`. |
| Record | modify | 560 | 626 | Applies a function to the element at the specified key safely, creating a new record, or return `Option.none()` if the key doesn't exist. |
| Record | replace | 627 | 696 | Replaces the value at an existing key safely and returns the updated record in `Option.some`. |
| Record | remove | 697 | 772 | Removes a key from a record. |
| Record | pop | 773 | 836 | Retrieves the value of the property with the given `key` from a record safely and returns an `Option` of a tuple with the value and the r... |
| Record | map | 837 | 903 | Maps a record into another record by applying a transformation function to each of its values. |
| Record | mapKeys | 904 | 952 | Maps the keys of a `ReadonlyRecord` while preserving the corresponding values. |
| Record | mapEntries | 953 | 1001 | Maps entries of a `ReadonlyRecord` using the provided function, allowing modification of both keys and corresponding values. |
| Record | filterMap | 1002 | 1059 | Transforms a record by applying the function `f` to each key and value in the original record. |
| Record | filter | 1060 | 1145 | Selects properties from a record whose values match the given predicate. |
| Record | getSomes | 1146 | 1162 | Returns a new record containing only the `Some` values from a record of `Option` values, preserving the original keys. |
| Record | getFailures | 1163 | 1183 | Returns a new record containing only the `Err` values from a record of `Result` values, preserving the original keys. |
| Record | getSuccesses | 1184 | 1204 | Returns a new record containing only the `Ok` values from a record of `Result` values, preserving the original keys. |
| Record | partition | 1205 | 1277 | Applies a function to each record entry and partitions the returned `Result` values into two records. |
| Record | separate | 1278 | 1294 | Partitions a record of `Result` values into two separate records, one with the success values and one with the failure values. |
| Record | keys | 1295 | 1310 | Retrieves the keys of a given record as an array. |
| Record | values | 1311 | 1326 | Retrieves the values of a given record as an array. |
| Record | set | 1327 | 1378 | Adds a new key-value pair or update an existing key's value in a record. |
| Record | assignProperty | 1379 | 1415 | Mutates a record by assigning a value to a property. |
| Record | isSubrecordBy | 1416 | 1447 | Checks whether all the keys and values in one record are also found in another record. |
| Record | isSubrecord | 1448 | 1514 | Checks whether the first record is a subrecord of the second record. |
| Record | reduce | 1515 | 1614 | Reduces a record to a single value by combining its entries with a specified function. |
| Record | every | 1615 | 1700 | Checks whether all entries in a record meet a specific condition. |
| Record | some | 1701 | 1752 | Checks whether any entry in a record meets a specific condition. |
| Record | union | 1753 | 1804 | Merges two records, preserving entries that exist in either of the records. |
| Record | intersection | 1805 | 1856 | Merges two records, retaining only the entries that exist in both records. |
| Record | difference | 1857 | 1908 | Merges two records, preserving only the entries that are unique to each record. |
| Record | makeEquivalence | 1909 | 1928 | Create an `Equivalence` for records using the provided `Equivalence` for values. |
| Record | singleton | 1929 | 1944 | Create a non-empty record from a single element. |
| Record | makeReducerUnion | 1945 | 1968 | Creates a `Reducer` for combining `Record`s using union, with values for keys that exist in both records combined using the provided `Com... |
| Record | makeReducerIntersection | 1969 | 1991 | Creates a `Reducer` whose `combine` operation intersects two records and combines values for keys present in both records. |
| Record | findFirst | 1992 | 2098 | Returns the first entry that satisfies the specified predicate, or `None` if no such entry exists. |
| Redactable | symbolRedactable | 13 | 50 | Defines the symbol used to identify objects that implement the {@link Redactable} protocol. |
| Redactable | Redactable | 51 | 89 | Interface for objects that provide context-aware redacted representations. |
| Redactable | isRedactable | 90 | 104 | Type guard that checks whether a value implements the {@link Redactable} interface. |
| Redactable | redact | 105 | 130 | Returns a redacted value if it implements {@link Redactable}, otherwise returns it unchanged. |
| Redactable | getRedacted | 131 | 156 | Returns the result of calling `[symbolRedactable]` on a value that is already known to be {@link Redactable}. |
| Redacted | Redacted | 19 | 54 | A wrapper for sensitive values whose string, JSON, and inspection output is redacted. |
| Redacted | Redacted | 55 | 125 | Namespace containing type-level members associated with `Redacted` values. |
| Redacted | isRedacted | 126 | 154 | Returns `true` if a value is a `Redacted` wrapper. |
| Redacted | make | 155 | 184 | Creates a `Redacted` wrapper for a sensitive value. |
| Redacted | value | 185 | 207 | Retrieves the original value from a `Redacted` instance. |
| Redacted | wipeUnsafe | 208 | 245 | Deletes the stored value for a `Redacted` wrapper, making future `Redacted.value` calls on that wrapper fail. |
| Redacted | makeEquivalence | 246 | 277 | Generates an equivalence relation for `Redacted<A>` values based on an equivalence relation for the underlying values `A`. |
| Reducer | Reducer | 12 | 71 | Represents a strategy for reducing a collection of values of type `A` into a single result. |
| Reducer | make | 72 | 116 | Creates a `Reducer` from a `combine` function and an `initialValue`. |
| Reducer | flip | 117 | 152 | Reverses the argument order of a reducer's `combine` method. |
| Ref | Ref | 20 | 59 | A mutable reference that provides atomic read, write, and update operations. |
| Ref | Ref | 60 | 101 | The Ref namespace containing type definitions and utilities. |
| Ref | makeUnsafe | 102 | 127 | Creates a new Ref with the specified initial value (unsafe version). |
| Ref | make | 128 | 154 | Creates a new Ref with the specified initial value. |
| Ref | get | 155 | 181 | Gets the current value of the Ref. |
| Ref | set | 182 | 217 | Sets the value of the Ref to the specified value. |
| Ref | getAndSet | 218 | 248 | Gets the current value of the Ref, sets it to the specified value, and returns the previous value atomically. |
| Ref | getAndUpdate | 249 | 279 | Gets the current value of the Ref, updates it with the given function, and returns the previous value atomically. |
| Ref | getAndUpdateSome | 280 | 324 | Gets the current value of the Ref and updates it atomically with the given partial function. |
| Ref | setAndGet | 325 | 359 | Sets the value of the Ref atomically to the specified value and returns the new value. |
| Ref | modify | 360 | 409 | Modifies the value of the Ref atomically using the given function. |
| Ref | modifySome | 410 | 566 | Computes a result atomically and optionally updates the value of the `Ref`. |
| Ref | update | 567 | 603 | Updates the value of the Ref atomically using the given function. |
| Ref | updateAndGet | 604 | 634 | Updates the value of the Ref atomically using the given function and returns the new value. |
| Ref | updateSome | 635 | 679 | Updates the value of the Ref atomically using the given partial function. |
| Ref | updateSomeAndGet | 680 | 723 | Updates the value of the Ref atomically using the given partial function and returns the current value. |
| Ref | getUnsafe | 724 | 751 | Gets the current value of the Ref synchronously (unsafe version). |
| References | CurrentLogAnnotations | 129 | 188 | Context reference for managing log annotations that are automatically added to all log entries. |
| References | CurrentLogLevel | 189 | 227 | Context reference for the current log severity used by `Effect.log` when no explicit level is provided. |
| References | CurrentLogSpans | 228 | 292 | Context reference for managing log spans that track the duration and hierarchy of operations. |
| References | CurrentStackFrame | 293 | 314 | Context reference for the current captured stack-frame chain for the running fiber. |
| References | MinimumLogLevel | 315 | 350 | Context reference for setting the minimum log level threshold. |
| References | TracerEnabled | 351 | 392 | Context reference for controlling whether tracing is enabled globally. |
| References | TracerSpanAnnotations | 393 | 446 | Context reference for managing span annotations that are automatically added to all new spans. |
| References | TracerSpanLinks | 447 | 504 | Context reference for managing span links that are automatically added to all new spans. |
| References | TracerTimingEnabled | 505 | 547 | Context reference for controlling whether trace timing is enabled globally. |
| References | UnhandledLogLevel | 548 | 574 | Context reference for the log severity used to report errors that have no caller to receive them, such as pool finalizer failures or defe... |
| References | StackFrame | 575 | 598 | A captured stack-frame node used to describe the traced execution path. |
| References | CurrentLoggers | 599 | 618 | Context reference for the set of loggers currently used by Effect logging operations. |
| References | LogToStderr | 619 | 675 | Context reference for controlling whether built-in console loggers write to stderr. |
| RegExp | RegExp | 1 | 24 | Exposes the JavaScript regular expression constructor from `globalThis`. |
| RegExp | isRegExp | 25 | 45 | Checks whether a value is a `RegExp`. |
| RegExp | escape | 46 | 66 | Escapes special characters in a regular expression pattern. |
| Request | Request | 19 | 46 | A `Request<A, E, R>` is a request from a data source for a value of type `A` that may fail with an `E` and have requirements of type `R`. |
| Request | Any | 47 | 66 | Alias for any `Request`, regardless of its success, error, or service requirements. |
| Request | Variance | 67 | 85 | Variance marker carried by every `Request`. |
| Request | Constructor | 86 | 119 | The constructor type returned by `Request.of` and `Request.tagged`. |
| Request | Error | 120 | 141 | A utility type to extract the error type from a `Request`. |
| Request | Success | 142 | 164 | A utility type to extract the value type from a `Request`. |
| Request | Services | 165 | 172 | A utility type to extract the requirements type from a `Request`. |
| Request | Result | 173 | 195 | A utility type to extract the result type from a `Request`. |
| Request | RequestPrototype | 196 | 210 | Prototype used by Effect's request constructors. |
| Request | isRequest | 211 | 239 | Checks whether a value is a `Request`. |
| Request | of | 240 | 273 | Creates a constructor function for a specific Request type. |
| Request | tagged | 274 | 318 | Creates a constructor function for a tagged Request type. |
| Request | Class | 319 | 348 | Defines request types with TypeScript classes. |
| Request | TaggedClass | 349 | 378 | Creates a class constructor for requests with a fixed `_tag` field. |
| Request | complete | 379 | 433 | Completes a request entry with the provided result. |
| Request | completeEffect | 434 | 515 | Completes a request entry with the result of an effect. |
| Request | fail | 516 | 570 | Completes a request entry with a typed failure. |
| Request | failCause | 571 | 625 | Completes a request entry with a failure `Cause`. |
| Request | succeed | 626 | 680 | Completes a request entry successfully with the supplied value. |
| Request | Entry | 681 | 705 | A pending request handed to a `RequestResolver`. |
| Request | makeEntry | 706 | 726 | Creates a `Request.Entry` from its component fields. |
| RequestResolver | RequestResolver | 26 | 91 | A resolver that executes and completes batched `Request` entries. |
| RequestResolver | RequestResolver | 92 | 115 | Namespace containing type-level helpers associated with `RequestResolver`. |
| RequestResolver | isRequestResolver | 116 | 130 | Returns `true` if the specified value is a `RequestResolver`, `false` otherwise. |
| RequestResolver | makeWith | 131 | 168 | Creates a request resolver with fine-grained control over its behavior. |
| RequestResolver | make | 169 | 214 | Constructs a request resolver with the specified method to run requests. |
| RequestResolver | makeGrouped | 215 | 275 | Constructs a request resolver with the requests grouped by a calculated key. |
| RequestResolver | fromFunction | 276 | 307 | Constructs a request resolver from a pure function. |
| RequestResolver | fromFunctionBatched | 308 | 341 | Constructs a request resolver from a pure function that takes a list of requests and returns a list of results of the same size. |
| RequestResolver | fromEffect | 342 | 384 | Constructs a request resolver from an effectual function. |
| RequestResolver | fromEffectTagged | 385 | 433 | Constructs a request resolver from a list of tags paired to functions, that takes a list of requests and returns a list of results of the... |
| RequestResolver | setDelayEffect | 434 | 554 | Sets the batch delay effect for this request resolver. |
| RequestResolver | setDelay | 555 | 654 | Sets the batch delay window for this request resolver to the specified duration. |
| RequestResolver | around | 655 | 802 | Wraps request resolver execution between `before` and `after` effects. |
| RequestResolver | never | 803 | 822 | Creates a request resolver that never executes requests. |
| RequestResolver | batchN | 823 | 988 | Returns a request resolver that collects at most `n` requests into each batch. |
| RequestResolver | grouped | 989 | 1175 | Transforms a request resolver by grouping requests using the specified key function. |
| RequestResolver | race | 1176 | 1329 | Returns a request resolver that sends each batch to both resolvers and completes with the first resolver to finish. |
| RequestResolver | withSpan | 1330 | 1465 | Adds a tracing span to the request resolver, which will also add any span links from the request's. |
| RequestResolver | asCache | 1466 | 1561 | Wraps a request resolver in a cache, allowing it to cache results up to a specified capacity and optional time-to-live. |
| RequestResolver | withCache | 1562 | 1655 | Adds a bounded in-memory cache to a request resolver. |
| RequestResolver | persisted | 1656 | 1741 | Wraps a request resolver with persistent storage for persistable requests. |
| Resource | Resource | 8 | 30 | A `Resource` is a value loaded into memory that can be refreshed manually or automatically according to a schedule. |
| Resource | isResource | 31 | 47 | Returns `true` if the specified value is a `Resource`. |
| Resource | manual | 48 | 62 | Creates a `Resource` that must be refreshed manually. |
| Resource | auto | 63 | 79 | Creates a `Resource` that refreshes automatically according to the supplied schedule. |
| Resource | get | 80 | 98 | Retrieves the current value stored in this resource. |
| Resource | refresh | 99 | 128 | Re-runs this resource's acquisition effect and updates the current value. |
| Result | Result | 24 | 59 | A value that is either `Success<A, E>` or `Failure<A, E>`. |
| Result | Failure | 60 | 101 | The failure variant of {@link Result}. |
| Result | ResultIterator | 102 | 119 | Iterator protocol used to yield a `Result` inside {@link gen}, returning the success value type back to the generator. |
| Result | Success | 120 | 161 | The success variant of {@link Result}. |
| Result | ResultUnify | 162 | 178 | Type-level utility for unifying `Result` types in generic contexts. |
| Result | ResultUnifyIgnore | 179 | 192 | Marker interface for ignoring unification in `Result` types. |
| Result | ResultTypeLambda | 193 | 208 | Higher-kinded type representation for `Result`. |
| Result | Result | 209 | 248 | Namespace containing type-level utilities for extracting the inner types of a `Result`. |
| Result | succeed | 249 | 272 | Creates a `Result` holding a `Success` value. |
| Result | fail | 273 | 299 | Creates a `Result` holding a `Failure` value. |
| Result | void | 300 | 329 | Provides a pre-built successful `Result` that carries `undefined`. |
| Result | failVoid | 330 | 358 | Provides a pre-built failed `Result` whose failure value is `undefined`. |
| Result | fromNullishOr | 359 | 458 | Converts a possibly `null` or `undefined` value into a `Result`. |
| Result | fromOption | 459 | 558 | Converts an `Option<A>` into a `Result<A, E>`. |
| Result | try | 559 | 598 | Wraps a synchronous computation that may throw into a `Result` safely. |
| Result | isResult | 599 | 627 | Checks whether a value is a `Result` (either `Success` or `Failure`). |
| Result | isFailure | 628 | 659 | Checks whether a `Result` is a `Failure`. |
| Result | isSuccess | 660 | 691 | Checks whether a `Result` is a `Success`. |
| Result | getSuccess | 692 | 722 | Extracts the success value as an `Option`, discarding the failure. |
| Result | getFailure | 723 | 753 | Extracts the failure value as an `Option`, discarding the success. |
| Result | makeEquivalence | 754 | 782 | Creates an `Equivalence` for comparing two `Result` values. |
| Result | mapBoth | 783 | 897 | Transforms both the success and failure channels of a `Result`. |
| Result | mapError | 898 | 991 | Transforms the failure channel of a `Result`, leaving the success channel unchanged. |
| Result | map | 992 | 1094 | Transforms the success channel of a `Result`, leaving the failure channel unchanged. |
| Result | match | 1095 | 1212 | Folds a `Result` into a single value by applying one of two functions. |
| Result | liftPredicate | 1213 | 1398 | Lifts a value into a `Result` based on a predicate or refinement. |
| Result | filterOrFail | 1399 | 1594 | Validates the success value of a `Result` using a predicate, failing with a custom error if the predicate returns `false`. |
| Result | merge | 1595 | 1622 | Unwraps a `Result` into `A \| E` by returning the inner value regardless of whether it is a success or failure. |
| Result | getOrElse | 1623 | 1725 | Extracts the success value, or computes a fallback from the error. |
| Result | getOrNull | 1726 | 1756 | Extracts the success value, or returns `null` on failure. |
| Result | getOrUndefined | 1757 | 1787 | Extracts the success value, or returns `undefined` on failure. |
| Result | getOrThrowWith | 1788 | 1902 | Extracts the success value or throws a custom error derived from the failure. |
| Result | getOrThrow | 1903 | 1934 | Extracts the success value or throws the raw failure value `E`. |
| Result | orElse | 1935 | 2034 | Returns the original `Result` if it is a `Success`, otherwise applies `that` to the error and returns the resulting `Result`. |
| Result | flatMap | 2035 | 2143 | Chains a function that returns a `Result` onto a successful value. |
| Result | andThen | 2144 | 2567 | Provides a flexible variant of {@link flatMap} that accepts multiple input shapes. |
| Result | all | 2568 | 2608 | Collects a structure of `Result`s into a single `Result` of collected values. |
| Result | flip | 2609 | 2640 | Swaps the success and failure channels of a `Result`. |
| Result | gen | 2641 | 2675 | Provides generator-based syntax for composing `Result` values sequentially. |
| Result | Do | 2676 | 2713 | Provides the starting point for the "do notation" simulation with `Result`. |
| Result | bind | 2714 | 2829 | Adds a named field to the do-notation accumulator by running a `Result`-producing function that receives the current accumulated object. |
| Result | bindTo | 2830 | 2929 | Wraps the success value of a `Result` into a named field, producing a `Result<Record<N, A>>`. |
| Result | let | 2930 | 2973 | Adds a named field to the do-notation accumulator by computing a pure (non-Result) value from the current accumulated object. |
| Result | transposeOption | 2974 | 3004 | Transforms `Option<Result<A, E>>` into `Result<Option<A>, E>`. |
| Result | transposeMapOption | 3005 | 3041 | Maps an `Option` value with a `Result`-producing function, then transposes the structure from `Option<Result<B, E>>` to `Result<Option<B>... |
| Result | succeedNone | 3042 | 3071 | Provides a pre-built `Result<Option<never>>` that succeeds with `None`. |
| Result | succeedSome | 3072 | 3094 | Creates a `Result<Option<A>>` that succeeds with `Some(a)`. |
| Result | tap | 3095 | 3192 | Runs a side-effect on the success value without altering the `Result`. |
| Runtime | Teardown | 4 | 49 | Represents a teardown function that handles program completion and determines the exit code. |
| Runtime | defaultTeardown | 50 | 95 | The default teardown function that determines exit codes from an Effect exit. |
| Runtime | makeRunMain | 96 | 179 | Creates a platform-specific main program runner that handles Effect execution lifecycle. |
| Runtime | errorExitCode | 180 | 192 | Type-level key for the `Runtime.errorExitCode` marker. |
| Runtime | errorExitCode | 193 | 233 | Allows associating an exit code with an error for determining the process exit code on failure. |
| Runtime | getErrorExitCode | 234 | 259 | Reads the runtime exit-code marker from an unknown error value. |
| Runtime | errorReported | 260 | 272 | Type-level key for the `Runtime.errorReported` marker. |
| Runtime | errorReported | 273 | 314 | Defines the runtime marker that controls default `runMain` error logging for an error. |
| Runtime | getErrorReported | 315 | 340 | Reads the runtime error-reporting marker from an unknown error value. |
| Schedule | Schedule | 23 | 46 | A Schedule defines a strategy for repeating or retrying effects based on some policy. |
| Schedule | InputMetadata | 47 | 61 | Metadata provided to schedule functions containing timing and input information. |
| Schedule | Metadata | 62 | 72 | Extended metadata that includes both input metadata and the output value from the schedule. |
| Schedule | CurrentMetadata | 73 | 87 | Context reference containing metadata for the currently running schedule step. |
| Schedule | Schedule | 88 | 131 | The Schedule namespace contains types and utilities for working with schedules. |
| Schedule | Output | 132 | 139 | Extracts the output type from a `Schedule`. |
| Schedule | Input | 140 | 147 | Extracts the input type from a `Schedule`. |
| Schedule | Error | 148 | 155 | Extracts the error type from a `Schedule`. |
| Schedule | Env | 156 | 163 | Extracts the service requirements from a `Schedule`. |
| Schedule | isSchedule | 164 | 185 | Type guard that checks if a value is a Schedule. |
| Schedule | fromStep | 186 | 218 | Creates a Schedule from a step function that returns a Pull. |
| Schedule | fromStepWithMetadata | 219 | 251 | Creates a Schedule from a step function that receives metadata about the schedule's execution. |
| Schedule | toStep | 252 | 279 | Extracts the step function from a Schedule. |
| Schedule | toStepWithMetadata | 280 | 302 | Extracts a step function from a `Schedule` that sleeps for each computed delay and returns metadata for the completed step. |
| Schedule | toStepWithSleep | 303 | 327 | Extracts a step function from a Schedule that automatically handles sleep delays. |
| Schedule | addDelay | 328 | 406 | Returns a new `Schedule` that adds the delay computed by the specified effectful function to the next recurrence of the schedule. |
| Schedule | concat | 407 | 461 | Returns a schedule that runs `self` to completion, then runs `other`, and merges their outputs. |
| Schedule | concatResult | 462 | 534 | Returns a schedule that runs `self` to completion, then runs `other`, and preserves which schedule produced each output. |
| Schedule | max | 535 | 557 | Combines schedules by recurring while all schedules want to recur, using the maximum delay between recurrences and outputting that maximu... |
| Schedule | cron | 558 | 629 | Returns a new `Schedule` that recurs on the specified `Cron` schedule and outputs the duration between recurrences. |
| Schedule | duration | 630 | 656 | Returns a schedule that recurs once after the specified duration. |
| Schedule | during | 657 | 679 | Returns a new `Schedule` that will always recur, but only during the specified `duration` of time. |
| Schedule | min | 680 | 702 | Combines schedules by recurring while at least one schedule wants to recur, using the minimum delay between recurrences and outputting th... |
| Schedule | exponential | 703 | 725 | Schedule that always recurs, but will wait a certain amount between repetitions, given by `base * factor.pow(n)`, where `n` is the number... |
| Schedule | fibonacci | 726 | 748 | Schedule that always recurs, increasing delays by summing the preceding two delays (similar to the Fibonacci sequence). |
| Schedule | fixed | 749 | 786 | Returns a `Schedule` that recurs on the specified fixed `interval` and outputs the number of repetitions of the schedule so far. |
| Schedule | map | 787 | 883 | Returns a new `Schedule` that maps each schedule decision to a new output using the full schedule metadata. |
| Schedule | modifyDelay | 884 | 962 | Returns a new `Schedule` that modifies the delay of the next recurrence of the schedule using the specified effectful function. |
| Schedule | jittered | 963 | 981 | Returns a new `Schedule` that randomly adjusts each recurrence delay. |
| Schedule | passthrough | 982 | 1006 | Returns a new `Schedule` that outputs the inputs of the specified schedule. |
| Schedule | recurs | 1007 | 1042 | Returns a `Schedule` which can only be stepped the specified number of `times` before it terminates. |
| Schedule | spaced | 1043 | 1070 | Returns a schedule that recurs continuously, each repetition spaced the specified duration from the last run. |
| Schedule | tap | 1071 | 1170 | Returns a new `Schedule` that allows execution of an effectful function for every decision of the schedule, but does not alter the inputs... |
| Schedule | upTo | 1171 | 1303 | Returns a new `Schedule` that limits an existing schedule by elapsed duration, number of outputs, or both. |
| Schedule | while | 1304 | 1331 | Returns a new schedule that continues while the predicate returns `true`. |
| Schedule | windowed | 1332 | 1364 | Schedule that divides the timeline to `interval`-long windows, and sleeps until the nearest window boundary every time it recurs. |
| Schedule | forever | 1365 | 1393 | Returns a new `Schedule` that will recur forever. |
| Schedule | once | 1394 | 1407 | Returns a schedule that recurs immediately once, then completes. |
| Schedule | identity | 1408 | 1429 | Creates a schedule that always recurs, passing inputs directly as outputs. |
| Schedule | setInputType | 1430 | 1458 | Sets the input type of the provided schedule without altering its behavior. |
| Scheduler | Scheduler | 15 | 37 | A scheduler manages the execution of Effect fibers by controlling when queued tasks run. |
| Scheduler | SchedulerDispatcher | 38 | 61 | A dispatcher created by a `Scheduler` for enqueuing tasks and forcing queued tasks to run. |
| Scheduler | Scheduler | 62 | 79 | Context reference for the scheduler used by the Effect runtime. |
| Scheduler | MixedScheduler | 80 | 157 | Provides a scheduler implementation that batches queued tasks and dispatches them by priority. |
| Scheduler | MaxOpsBeforeYield | 158 | 179 | Context reference that controls the maximum number of operations a fiber can perform before yielding control back to the scheduler. |
| Scheduler | PreventSchedulerYield | 180 | 204 | Context reference that controls whether the runtime should bypass scheduler yield checks. |
| Schema | Optionality | 69 | 79 | Whether a schema field is required or optional within a struct. |
| Schema | Mutability | 80 | 89 | Whether a schema field is readonly or mutable within a struct. |
| Schema | ConstructorDefault | 90 | 100 | Whether a schema field has a constructor default value. |
| Schema | MakeOptions | 101 | 126 | Options for `makeEffect`, `make`, and Class constructors. |
| Schema | BottomWithoutNew | 127 | 240 | The fully-parameterized schema interface without a construct signature. |
| Schema | Bottom | 241 | 264 | Fully-parameterized base interface for schemas that can be extended directly by TypeScript classes. |
| Schema | BottomLazyWithoutNew | 265 | 291 | Lazy `BottomWithoutNew` variant for schema implementations that compute their public views on demand. |
| Schema | BottomLazy | 292 | 315 | Lazy `Bottom` variant for schemas that can be extended directly by TypeScript classes. |
| Schema | declareConstructor | 316 | 324 | Type-level representation returned by {@link declareConstructor}. |
| Schema | declareConstructor | 325 | 381 | Creates a schema for a **parametric** type (a generic container such as `Array<A>`, `Option<A>`, etc.) by accepting a list of type-parame... |
| Schema | declare | 382 | 391 | Type-level representation returned by {@link declare}. |
| Schema | declare | 392 | 425 | Creates a schema for a **non-parametric** opaque type using a type-guard function. |
| Schema | revealBottom | 426 | 456 | Returns a schema widened to the fully-parameterized {@link Bottom} interface, making all 14 type parameters visible to TypeScript. |
| Schema | annotate | 457 | 487 | Adds metadata annotations to a schema without changing its runtime behavior. |
| Schema | annotateEncoded | 488 | 518 | Adds metadata annotations to the **encoded** side of a schema without changing its runtime behavior. |
| Schema | annotateKey | 519 | 551 | Adds key-level annotations to a schema field. |
| Schema | Top | 552 | 573 | The existential "any schema" type — all type parameters are erased to `unknown`. |
| Schema | Constraint | 574 | 613 | Lightweight structural constraint for APIs that accept schema values but only read their data and type-level views. |
| Schema | ConstraintCodec | 614 | 636 | Lightweight structural constraint for APIs that need codec type views but do not need the full schema protocol. |
| Schema | ConstraintDecoder | 637 | 656 | Lightweight structural constraint for APIs that need decoder type views but do not need the full schema protocol. |
| Schema | ConstraintEncoder | 657 | 676 | Lightweight structural constraint for APIs that need encoder type views but do not need the full schema protocol. |
| Schema | ConstraintRebuildable | 677 | 693 | Lightweight structural constraint for APIs that need schema views and the rebuilt schema type, but do not call the full schema protocol. |
| Schema | Schema | 694 | 720 | Namespace of type-level helpers for {@link Schema}. |
| Schema | Schema | 721 | 755 | A typed view of a schema that tracks only the decoded (output) type `T`. |
| Schema | Codec | 756 | 820 | Namespace of type-level helpers for {@link Codec}. |
| Schema | Codec | 821 | 861 | A schema that tracks the decoded type `T`, the encoded type `E`, and the Effect services required during decoding (`RD`) and encoding (`R... |
| Schema | Decoder | 862 | 884 | A schema that tracks the decoded type `T` and the Effect services required during decoding (`RD`). |
| Schema | Encoder | 885 | 907 | A schema that tracks the encoded type `E` and the Effect services required during encoding (`RE`). |
| Schema | revealCodec | 908 | 934 | Returns a codec widened to the full {@link Codec} interface, prompting TypeScript to infer all four type parameters (`T`, `E`, `RD`, `RE`). |
| Schema | Optic | 935 | 962 | A schema that additionally supports optic (lens/prism) operations. |
| Schema | SchemaError | 963 | 1009 | Error thrown or returned when schema decoding or encoding fails. |
| Schema | isSchemaError | 1010 | 1031 | Returns `true` if `u` is a {@link SchemaError}. |
| Schema | toStandardSchemaV1 | 1032 | 1105 | Returns a "Standard Schema" object conforming to the [Standard Schema v1](https://standardschema.dev/) specification. |
| Schema | toStandardJSONSchemaV1 | 1106 | 1117 | Converts a schema to an experimental Standard JSON Schema V1 representation. |
| Schema | is | 1118 | 1156 | Creates a type guard function that checks if a value conforms to a given schema. |
| Schema | asserts | 1157 | 1206 | Creates an assertion function that throws an error if the input does not match the schema. |
| Schema | decodeUnknownEffect | 1207 | 1229 | Decodes an `unknown` input against a schema, returning an `Effect` that succeeds with the decoded value or fails with a {@link SchemaError}. |
| Schema | decodeEffect | 1230 | 1252 | Decodes a typed input (the schema's `Encoded` type) against a schema, returning an `Effect` that succeeds with the decoded value or fails... |
| Schema | decodeUnknownExit | 1253 | 1284 | Decodes an `unknown` input against a schema synchronously, returning an `Exit` that is either a `Success` with the decoded value or a `Fa... |
| Schema | decodeExit | 1285 | 1316 | Decodes a typed input (the schema's `Encoded` type) against a schema synchronously, returning an `Exit` that is either a `Success` with t... |
| Schema | decodeUnknownOption | 1317 | 1344 | Decodes an `unknown` input against a schema, returning an `Option` that is `Some` with the decoded value on success or `None` for schema ... |
| Schema | decodeOption | 1345 | 1371 | Decodes a typed input (the schema's `Encoded` type) against a schema, returning an `Option` that is `Some` with the decoded value on succ... |
| Schema | decodeUnknownResult | 1372 | 1402 | Decodes an `unknown` input against a schema, returning a `Result` that succeeds with the decoded value or fails with a {@link SchemaError... |
| Schema | decodeResult | 1403 | 1432 | Decodes a typed input (the schema's `Encoded` type) against a schema, returning a `Result` that succeeds with the decoded value or fails ... |
| Schema | decodeUnknownPromise | 1433 | 1461 | Decodes an `unknown` input against a schema, returning a `Promise` that resolves with the decoded value or rejects with a {@link SchemaEr... |
| Schema | decodePromise | 1462 | 1490 | Decodes a typed input (the schema's `Encoded` type) against a schema, returning a `Promise` that resolves with the decoded value or rejec... |
| Schema | decodeUnknownSync | 1491 | 1529 | Decodes an `unknown` input against a schema synchronously, returning the decoded value or throwing a {@link SchemaError} for schema misma... |
| Schema | decodeSync | 1530 | 1557 | Decodes a typed input (the schema's `Encoded` type) against a schema synchronously, returning the decoded value or throwing a {@link Sche... |
| Schema | encodeUnknownEffect | 1558 | 1590 | Encodes an `unknown` input against a schema, returning an `Effect` that succeeds with the encoded value or fails with a {@link SchemaError}. |
| Schema | encodeEffect | 1591 | 1613 | Encodes a typed input (the schema's `Type`) against a schema, returning an `Effect` that succeeds with the encoded value or fails with a ... |
| Schema | encodeUnknownExit | 1614 | 1644 | Encodes an `unknown` input against a schema synchronously, returning an `Exit` that is either a `Success` with the encoded value or a `Fa... |
| Schema | encodeExit | 1645 | 1676 | Encodes a typed input (the schema's `Type`) against a schema synchronously, returning an `Exit` that is either a `Success` with the encod... |
| Schema | encodeUnknownOption | 1677 | 1704 | Encodes an `unknown` input against a schema, returning an `Option` that is `Some` with the encoded value on success or `None` for schema ... |
| Schema | encodeOption | 1705 | 1731 | Encodes a typed input (the schema's `Type`) against a schema, returning an `Option` that is `Some` with the encoded value on success or `... |
| Schema | encodeUnknownResult | 1732 | 1761 | Encodes an `unknown` input against a schema, returning a `Result` that succeeds with the encoded value or fails with a {@link SchemaError... |
| Schema | encodeResult | 1762 | 1791 | Encodes a typed input (the schema's `Type`) against a schema, returning a `Result` that succeeds with the encoded value or fails with a {... |
| Schema | encodeUnknownPromise | 1792 | 1819 | Encodes an `unknown` input against a schema, returning a `Promise` that resolves with the encoded value or rejects with a {@link SchemaEr... |
| Schema | encodePromise | 1820 | 1848 | Encodes a typed input (the schema's `Type`) against a schema, returning a `Promise` that resolves with the encoded value or rejects with ... |
| Schema | encodeUnknownSync | 1849 | 1876 | Encodes an `unknown` input against a schema synchronously, throwing a {@link SchemaError} for schema mismatches. |
| Schema | encodeSync | 1877 | 1902 | Encodes a typed input (the schema's `Type`) against a schema synchronously, throwing a {@link SchemaError} for schema mismatches. |
| Schema | make | 1903 | 1921 | Creates a schema from an AST (Abstract Syntax Tree) node. |
| Schema | isSchema | 1922 | 1929 | Checks whether a value is a `Schema`. |
| Schema | optionalKey | 1930 | 1950 | Type-level representation returned by {@link optionalKey}. |
| Schema | optionalKey | 1951 | 1978 | Creates an exact optional key schema for struct fields. |
| Schema | requiredKey | 1979 | 1991 | Reverses `optionalKey` and returns the inner required schema. |
| Schema | optional | 1992 | 2005 | Type-level representation returned by {@link optional}. |
| Schema | optional | 2006 | 2040 | Marks a struct field as optional, allowing the key to be absent or `undefined`. |
| Schema | required | 2041 | 2057 | Reverses `optional` and returns the inner schema. |
| Schema | mutableKey | 2058 | 2078 | Type-level representation returned by {@link mutableKey}. |
| Schema | mutableKey | 2079 | 2091 | Makes a struct field mutable (removes the `readonly` modifier on the property). |
| Schema | readonlyKey | 2092 | 2104 | Reverses `mutableKey` and returns the inner readonly schema. |
| Schema | toType | 2105 | 2125 | Type-level representation returned by {@link toType}. |
| Schema | toType | 2126 | 2134 | Extracts the type-side schema: sets `Encoded` to equal the decoded `Type`, discarding the encoding transformation path. |
| Schema | toEncoded | 2135 | 2155 | Type-level representation returned by {@link toEncoded}. |
| Schema | toEncoded | 2156 | 2165 | Extracts the encoded-side schema: sets `Type` to equal the `Encoded`, discarding the decoding transformation path. |
| Schema | flip | 2166 | 2183 | Type-level representation returned by {@link flip}. |
| Schema | flip | 2184 | 2209 | Swaps the decoded and encoded sides of a schema. |
| Schema | Literal | 2210 | 2220 | Type-level representation returned by {@link Literal}. |
| Schema | Literal | 2221 | 2241 | Creates a schema for a single literal value (string, number, bigint, boolean, or null). |
| Schema | TemplateLiteral | 2242 | 2298 | Namespace for {@link TemplateLiteral} helper types. |
| Schema | TemplateLiteral | 2299 | 2308 | Type-level representation returned by {@link TemplateLiteral}. |
| Schema | TemplateLiteral | 2309 | 2345 | Creates a schema that validates strings by matching ordered template literal parts. |
| Schema | TemplateLiteralParser | 2346 | 2369 | Namespace for {@link TemplateLiteralParser} helper types. |
| Schema | TemplateLiteralParser | 2370 | 2386 | Type-level representation returned by {@link TemplateLiteralParser}. |
| Schema | TemplateLiteralParser | 2387 | 2423 | Schema for parsing matched template literal strings into typed tuple parts. |
| Schema | Enum | 2424 | 2435 | Type-level representation returned by {@link Enum}. |
| Schema | Enum | 2436 | 2464 | Creates a schema from a TypeScript enum or an object mapping names to string or number values. |
| Schema | Never | 2465 | 2473 | Type-level representation of {@link Never}. |
| Schema | Never | 2474 | 2481 | Schema for the `never` type. |
| Schema | Any | 2482 | 2490 | Type-level representation of {@link Any}. |
| Schema | Any | 2491 | 2499 | Schema for the `any` type. |
| Schema | Unknown | 2500 | 2508 | Type-level representation of {@link Unknown}. |
| Schema | Unknown | 2509 | 2522 | Schema for the `unknown` type. |
| Schema | Null | 2523 | 2531 | Type-level representation of {@link Null}. |
| Schema | Null | 2532 | 2540 | Schema for the `null` literal. |
| Schema | Undefined | 2541 | 2549 | Type-level representation of {@link Undefined}. |
| Schema | Undefined | 2550 | 2558 | Schema for the `undefined` literal. |
| Schema | String | 2559 | 2567 | Type-level representation of {@link String}. |
| Schema | String | 2568 | 2575 | Schema for `string` values. |
| Schema | StringForLiteralAutocomplete | 2576 | 2584 | Type-level representation of {@link StringForLiteralAutocomplete}. |
| Schema | StringForLiteralAutocomplete | 2585 | 2620 | Schema for `string & {}`. |
| Schema | Number | 2621 | 2629 | Type-level representation of {@link Number}. |
| Schema | Number | 2630 | 2645 | Schema for `number` values, including `NaN`, `Infinity`, and `-Infinity`. |
| Schema | Boolean | 2646 | 2654 | Type-level representation of {@link Boolean}. |
| Schema | Boolean | 2655 | 2668 | Schema for `boolean` values. |
| Schema | Symbol | 2669 | 2677 | Type-level representation of {@link Symbol}. |
| Schema | Symbol | 2678 | 2686 | Schema for `symbol` values. |
| Schema | BigInt | 2687 | 2695 | Type-level representation of {@link BigInt}. |
| Schema | BigInt | 2696 | 2710 | Schema for `bigint` values. |
| Schema | Void | 2711 | 2719 | Type-level representation of {@link Void}. |
| Schema | Void | 2720 | 2740 | Schema for a TypeScript `void` return value. |
| Schema | ObjectKeyword | 2741 | 2749 | Type-level representation of {@link ObjectKeyword}. |
| Schema | ObjectKeyword | 2750 | 2758 | Schema for the `object` type. |
| Schema | UniqueSymbol | 2759 | 2767 | Type-level representation returned by {@link UniqueSymbol}. |
| Schema | UniqueSymbol | 2768 | 2792 | Creates a schema for a specific symbol. |
| Schema | Struct | 2793 | 2932 | Namespace for struct field type utilities. |
| Schema | Struct | 2933 | 2990 | Type-level representation returned by {@link Struct}. |
| Schema | Struct | 2991 | 3030 | Defines a struct schema from a map of field schemas. |
| Schema | fieldsAssign | 3031 | 3060 | Adds fields to a struct schema through a struct-mapping lambda. |
| Schema | encodeKeys | 3061 | 3075 | Type-level representation returned by {@link encodeKeys}. |
| Schema | encodeKeys | 3076 | 3107 | Renames struct keys in the encoded form without changing the decoded type. |
| Schema | extendTo | 3108 | 3141 | Adds derived fields to a struct schema during decoding. |
| Schema | Record | 3142 | 3290 | Namespace for `Record` type utilities. |
| Schema | $Record | 3291 | 3308 | Type-level representation returned by {@link Record}. |
| Schema | Record | 3309 | 3355 | Defines a record schema whose dynamic properties are selected by a key schema and decoded with a value schema. |
| Schema | StructWithRest | 3356 | 3489 | Namespace for `StructWithRest` type utilities. |
| Schema | StructWithRest | 3490 | 3507 | Type-level representation returned by {@link StructWithRest}. |
| Schema | StructWithRest | 3508 | 3544 | Extends a struct schema with one or more record (index-signature) schemas, producing a schema whose decoded type intersects the struct an... |
| Schema | Tuple | 3545 | 3649 | Namespace for `Tuple` type utilities. |
| Schema | Tuple | 3650 | 3685 | Type-level representation returned by {@link Tuple}. |
| Schema | Tuple | 3686 | 3703 | Defines a fixed-length tuple schema from an array of element schemas. |
| Schema | TupleWithRest | 3704 | 3820 | Namespace for `TupleWithRest` type utilities. |
| Schema | TupleWithRest | 3821 | 3838 | Type-level representation returned by {@link TupleWithRest}. |
| Schema | TupleWithRest | 3839 | 3868 | Extends a fixed-length tuple schema with a variadic rest segment. |
| Schema | $Array | 3869 | 3893 | Type-level representation returned by {@link Array}. |
| Schema | Array | 3894 | 3913 | Defines a `ReadonlyArray` schema for a given element schema. |
| Schema | NonEmptyArray | 3914 | 3934 | Type-level representation returned by {@link NonEmptyArray}. |
| Schema | NonEmptyArray | 3935 | 3953 | Defines a non-empty `ReadonlyArray` schema — at least one element required. |
| Schema | ArrayEnsure | 3954 | 3963 | Type-level representation returned by {@link ArrayEnsure}. |
| Schema | ArrayEnsure | 3964 | 3991 | Creates a schema that accepts either a value decoded by `schema` or an array decoded by `Schema.Array(schema)`, then returns an array. |
| Schema | UniqueArray | 3992 | 4001 | Type-level representation returned by {@link UniqueArray}. |
| Schema | UniqueArray | 4002 | 4014 | Returns a new array schema that ensures all elements are unique. |
| Schema | mutable | 4015 | 4041 | Type-level representation returned by {@link mutable}. |
| Schema | mutable | 4042 | 4069 | Makes an array or tuple schema mutable, removing the `readonly` modifier. |
| Schema | Union | 4070 | 4121 | Type-level representation returned by {@link Union}. |
| Schema | Union | 4122 | 4147 | Creates a union schema from an array of member schemas. |
| Schema | Literals | 4148 | 4170 | Type-level representation returned by {@link Literals}. |
| Schema | Literals | 4171 | 4188 | Creates a union schema from an array of literal values. |
| Schema | NullOr | 4189 | 4202 | Type-level representation returned by {@link NullOr}. |
| Schema | NullOr | 4203 | 4210 | Creates a union schema of `S \| null`. |
| Schema | UndefinedOr | 4211 | 4224 | Type-level representation returned by {@link UndefinedOr}. |
| Schema | UndefinedOr | 4225 | 4232 | Creates a union schema of `S \| undefined`. |
| Schema | NullishOr | 4233 | 4246 | Type-level representation returned by {@link NullishOr}. |
| Schema | NullishOr | 4247 | 4254 | Creates a union schema of `S \| null \| undefined`. |
| Schema | suspend | 4255 | 4270 | Type-level representation returned by {@link suspend}. |
| Schema | suspend | 4271 | 4297 | Creates a suspended schema that defers evaluation until needed. |
| Schema | check | 4298 | 4318 | Attaches one or more filter checks to a schema without changing the TypeScript type. |
| Schema | refine | 4319 | 4335 | Type-level representation returned by {@link refine}. |
| Schema | refine | 4336 | 4354 | Narrows the TypeScript type of a schema's output via a type guard predicate, attaching the guard as a runtime filter check. |
| Schema | brand | 4355 | 4372 | Type-level representation returned by {@link brand}. |
| Schema | brand | 4373 | 4398 | Intersects a schema's output type with `Brand.Brand<B>` to prevent accidental mixing of structurally identical types. |
| Schema | fromBrand | 4399 | 4421 | Creates a branded schema from a {@link Brand.Constructor}, applying the constructor's checks and branded type to the underlying schema. |
| Schema | middlewareDecoding | 4422 | 4438 | Type-level representation returned by {@link middlewareDecoding}. |
| Schema | middlewareDecoding | 4439 | 4468 | Intercepts the decoding pipeline of a schema. |
| Schema | middlewareEncoding | 4469 | 4485 | Type-level representation returned by {@link middlewareEncoding}. |
| Schema | middlewareEncoding | 4486 | 4515 | Intercepts the encoding pipeline of a schema. |
| Schema | catchDecoding | 4516 | 4540 | Recovers from a decoding error by providing a fallback value. |
| Schema | catchDecodingWithContext | 4541 | 4562 | Recovers from a decoding error with a handler that may require Effect services. |
| Schema | catchEncoding | 4563 | 4576 | Recovers from an encoding error by providing a fallback value. |
| Schema | catchEncodingWithContext | 4577 | 4598 | Recovers from an encoding error with a handler that may require Effect services. |
| Schema | decodeTo | 4599 | 4616 | Type-level representation returned by {@link decodeTo}. |
| Schema | compose | 4617 | 4625 | Type-level representation returned by {@link decodeTo} without a custom transformation. |
| Schema | decodeTo | 4626 | 4674 | Creates a schema that transforms from a source schema to a target schema. |
| Schema | decodeTo | 4675 | 4678 |  |
| Schema | decode | 4679 | 4725 | Applies a transformation to a schema, creating a new schema with the same type but transformed encoding/decoding. |
| Schema | encodeTo | 4726 | 4757 | Reverses a schema transformation so the encoded schema is supplied first. |
| Schema | encodeTo | 4758 | 4761 |  |
| Schema | encode | 4762 | 4792 | Applies a transformation to a schema's encoded type, creating a new schema where encoding/decoding operate on `S["Encoded"]` rather than ... |
| Schema | WithoutConstructorDefault | 4793 | 4806 | Constraint used to ensure a schema field does not already have a constructor default. |
| Schema | withConstructorDefault | 4807 | 4823 | Type-level representation returned by {@link withConstructorDefault}. |
| Schema | withConstructorDefault | 4824 | 4851 | Attaches a constructor default value to a schema field. |
| Schema | withDecodingDefaultKey | 4852 | 4861 | Type-level representation returned by {@link withDecodingDefaultKey}. |
| Schema | DecodingDefaultOptions | 4862 | 4877 | Options for {@link withDecodingDefaultKey} and {@link withDecodingDefault}. |
| Schema | withDecodingDefaultKey | 4878 | 4912 | Makes a struct key optional on the `Encoded` side and provides a default `Encoded` value when the key is missing during decoding. |
| Schema | withDecodingDefaultTypeKey | 4913 | 4922 | Type-level representation returned by {@link withDecodingDefaultTypeKey}. |
| Schema | withDecodingDefaultTypeKey | 4923 | 4946 | Makes a struct key optional on the `Encoded` side (`optionalKey`, so the key may be absent but **not** `undefined`) and provides a defaul... |
| Schema | withDecodingDefault | 4947 | 4956 | Type-level representation returned by {@link withDecodingDefault}. |
| Schema | withDecodingDefault | 4957 | 4996 | Wraps the `Encoded` side with `optional` (key absent **or** `undefined`) and provides a default `Encoded` value when the field is missing... |
| Schema | withDecodingDefaultType | 4997 | 5006 | Type-level representation returned by {@link withDecodingDefaultType}. |
| Schema | withDecodingDefaultType | 5007 | 5035 | Wraps the `Encoded` side with `optional` (key absent **or** `undefined`) and provides a default `Type` value when the field is missing or... |
| Schema | tag | 5036 | 5044 | Type-level representation returned by {@link tag}. |
| Schema | tag | 5045 | 5068 | Combines a {@link Literal} schema with {@link withConstructorDefault}, making it ideal for discriminator fields in tagged unions. |
| Schema | tagDefaultOmit | 5069 | 5101 | Creates a literal `_tag` schema that is omitted from encoded output. |
| Schema | TaggedStruct | 5102 | 5111 | Type-level representation returned by {@link TaggedStruct}. |
| Schema | TaggedStruct | 5112 | 5223 | Creates a struct schema with an automatically populated `_tag` field. |
| Schema | toTaggedUnion | 5224 | 5235 | Type-level representation returned by {@link toTaggedUnion}. |
| Schema | toTaggedUnion | 5236 | 5271 | Augments an existing {@link Union} of tagged structs with utility methods and an ordered tuple of discriminant values. |
| Schema | TaggedUnion | 5272 | 5311 | Type-level representation returned by {@link TaggedUnion}. |
| Schema | TaggedUnion | 5312 | 5342 | Builds a discriminated union from a record of field sets, one per variant. |
| Schema | Opaque | 5343 | 5359 | Type-level representation returned by {@link Opaque}. |
| Schema | Opaque | 5360 | 5385 | Wraps a struct schema so that its decoded `Type` becomes a nominally distinct type `Self`. |
| Schema | instanceOf | 5386 | 5395 | Type-level representation returned by {@link instanceOf}. |
| Schema | instanceOf | 5396 | 5415 | Creates a schema that validates values using `instanceof`. |
| Schema | link | 5416 | 5427 | Constructs an `SchemaAST.Link` that describes how a value of type `T` encodes to and decodes from a `To` schema. |
| Schema | makeFilter | 5428 | 5485 | Creates a custom validation filter from a predicate function. |
| Schema | FilterIssue | 5486 | 5509 | A single failure reported by a filter predicate. |
| Schema | FilterOutput | 5510 | 5534 | The value a filter predicate (see {@link makeFilter}) may return. |
| Schema | makeFilterGroup | 5535 | 5543 | Groups multiple checks into a single {@link SchemaAST.FilterGroup}, applying optional shared annotations to the group as a whole. |
| Schema | isTrimmed | 5544 | 5563 | Validates that a string has no leading or trailing whitespace. |
| Schema | isPattern | 5564 | 5584 | Validates that a string matches the specified regular expression pattern. |
| Schema | isStringFinite | 5585 | 5604 | Validates that a string represents a finite number. |
| Schema | isStringBigInt | 5605 | 5623 | Validates that a string is a signed base-10 integer literal for Effect's BigInt string encoding. |
| Schema | isStringSymbol | 5624 | 5637 | Validates that a string has the `Symbol(description)` format used by Effect's symbol string encoding. |
| Schema | isUUID | 5638 | 5669 | Validates that a string is a strict Universally Unique Identifier (UUID). |
| Schema | isGUID | 5670 | 5695 | Validates that a string has the GUID / UUID textual shape. |
| Schema | isULID | 5696 | 5719 | Validates that a string is a valid ULID (Universally Unique Lexicographically Sortable Identifier). |
| Schema | isAscii | 5720 | 5748 | Validates that a string contains only ASCII characters. |
| Schema | isBase64 | 5749 | 5768 | Validates that a string is valid Base64 encoded data. |
| Schema | isBase64Url | 5769 | 5789 | Validates that a string is valid Base64URL encoded data (Base64 with URL-safe characters). |
| Schema | isStartingWith | 5790 | 5803 | Validates at runtime that a string starts with the specified literal prefix. |
| Schema | isEndingWith | 5804 | 5817 | Validates at runtime that a string ends with the specified literal suffix. |
| Schema | isIncluding | 5818 | 5832 | Validates at runtime that a string contains the specified literal substring. |
| Schema | isUppercased | 5833 | 5846 | Validates that a string is unchanged by JavaScript's `toUpperCase()`. |
| Schema | isLowercased | 5847 | 5860 | Validates that a string is unchanged by JavaScript's `toLowerCase()`. |
| Schema | isCapitalized | 5861 | 5874 | Validates that the first character of a string is unchanged by `toUpperCase()`. |
| Schema | isUncapitalized | 5875 | 5888 | Validates that the first character of a string is unchanged by `toLowerCase()`. |
| Schema | Finite | 5889 | 5898 | Type-level representation of {@link Finite}. |
| Schema | Finite | 5899 | 5906 | Schema for finite numbers, rejecting `NaN`, `Infinity`, and `-Infinity`. |
| Schema | isFinite | 5907 | 5925 | Validates that a number is finite (not `Infinity`, `-Infinity`, or `NaN`). |
| Schema | makeIsGreaterThan | 5926 | 5938 | Creates a greater-than (`>`) check for any ordered type from an `Order.Order` instance. |
| Schema | makeIsGreaterThanOrEqualTo | 5939 | 5951 | Creates a greater-than-or-equal-to (`>=`) check for any ordered type from an `Order.Order` instance. |
| Schema | makeIsLessThan | 5952 | 5964 | Creates a less-than (`<`) check for any ordered type from an `Order.Order` instance. |
| Schema | makeIsLessThanOrEqualTo | 5965 | 5977 | Creates a less-than-or-equal-to (`<=`) check for any ordered type from an `Order.Order` instance. |
| Schema | makeIsBetween | 5978 | 6000 | Creates an inclusive or exclusive range check for any ordered type from an `Order.Order` instance. |
| Schema | makeIsMultipleOf | 6001 | 6014 | Creates a divisibility check for any numeric type from a remainder function and a zero value. |
| Schema | isGreaterThan | 6015 | 6034 | Validates that a number is greater than the specified value (exclusive). |
| Schema | isGreaterThanOrEqualTo | 6035 | 6054 | Validates that a number is greater than or equal to the specified value (inclusive). |
| Schema | isLessThan | 6055 | 6074 | Validates that a number is less than the specified value (exclusive). |
| Schema | isLessThanOrEqualTo | 6075 | 6094 | Validates that a number is less than or equal to the specified value (inclusive). |
| Schema | isBetween | 6095 | 6122 | Validates that a number is within a specified range. |
| Schema | isMultipleOf | 6123 | 6142 | Validates that a number is a multiple of the specified divisor. |
| Schema | isInt | 6143 | 6162 | Validates that a number is a safe integer (within the safe integer range that can be exactly represented in JavaScript). |
| Schema | Int | 6163 | 6172 | Type-level representation of {@link Int}. |
| Schema | Int | 6173 | 6180 | Schema for integers, rejecting `NaN`, `Infinity`, and `-Infinity`. |
| Schema | Natural | 6181 | 6190 | Type-level representation of {@link Natural}. |
| Schema | Natural | 6191 | 6204 | Schema for non-negative safe integers, including zero. |
| Schema | isInt32 | 6205 | 6225 | Validates that a number is a 32-bit signed integer (range: -2,147,483,648 to 2,147,483,647). |
| Schema | isUint32 | 6226 | 6246 | Validates that a number is a 32-bit unsigned integer (range: 0 to 4,294,967,295). |
| Schema | isGreaterThanDate | 6247 | 6260 | Validates that a Date is greater than the specified value (exclusive). |
| Schema | isGreaterThanOrEqualToDate | 6261 | 6280 | Validates that a Date is greater than or equal to the specified date (inclusive). |
| Schema | isLessThanDate | 6281 | 6294 | Validates that a Date is less than the specified value (exclusive). |
| Schema | isLessThanOrEqualToDate | 6295 | 6314 | Validates that a Date is less than or equal to the specified date (inclusive). |
| Schema | isBetweenDate | 6315 | 6339 | Validates that a Date is within a specified range. |
| Schema | isGreaterThanBigInt | 6340 | 6353 | Validates that a BigInt is greater than the specified value (exclusive). |
| Schema | isGreaterThanOrEqualToBigInt | 6354 | 6368 | Validates that a BigInt is greater than or equal to the specified value (inclusive). |
| Schema | isLessThanBigInt | 6369 | 6382 | Validates that a BigInt is less than the specified value (exclusive). |
| Schema | isLessThanOrEqualToBigInt | 6383 | 6397 | Validates that a BigInt is less than or equal to the specified value (inclusive). |
| Schema | isBetweenBigInt | 6398 | 6417 | Validates that a BigInt is within a specified range. |
| Schema | isMinLength | 6418 | 6455 | Validates that a value has at least the specified length. |
| Schema | isNonEmpty | 6456 | 6478 | Validates that a value has at least one element. |
| Schema | isMaxLength | 6479 | 6504 | Validates that a value has at most the specified length. |
| Schema | isBetweenLength | 6505 | 6531 | Validates that a value's length is within the specified range. |
| Schema | isMinCodePoints | 6532 | 6554 | Validates that a string contains at least the specified number of Unicode code points. |
| Schema | isMaxCodePoints | 6555 | 6577 | Validates that a string contains at most the specified number of Unicode code points. |
| Schema | isBetweenCodePoints | 6578 | 6600 | Validates that a string's Unicode code point count is within the specified inclusive range. |
| Schema | isMinSize | 6601 | 6624 | Validates that a value has at least the specified size. |
| Schema | isMaxSize | 6625 | 6648 | Validates that a value has at most the specified size. |
| Schema | isBetweenSize | 6649 | 6672 | Validates that a value's size is within the specified range. |
| Schema | isMinProperties | 6673 | 6697 | Validates that an object contains at least the specified number of properties. |
| Schema | isMaxProperties | 6698 | 6721 | Validates that an object contains at most the specified number of properties. |
| Schema | isBetweenProperties | 6722 | 6745 | Validates that an object contains between `minimum` and `maximum` properties (inclusive). |
| Schema | isPropertyNames | 6746 | 6765 | Validates that every own property key of an object satisfies the encoded side of the provided key schema. |
| Schema | isUnique | 6766 | 6782 | Validates that all items in an array are unique according to Effect equality. |
| Schema | isUniqueKey | 6783 | 6799 | Validates that all first elements in an array of key-value tuples are unique according to Effect equality. |
| Schema | NonEmptyString | 6800 | 6809 | Type-level representation of {@link NonEmptyString}. |
| Schema | NonEmptyString | 6810 | 6818 | Schema for non-empty strings. |
| Schema | Char | 6819 | 6828 | Type-level representation of {@link Char}. |
| Schema | Char | 6829 | 6849 | Schema for strings whose JavaScript `length` is exactly `1`. |
| Schema | ErrorInstance | 6850 | 6859 | Type-level representation of {@link ErrorInstance}. |
| Schema | ErrorOptions | 6860 | 6881 | Options for {@link ErrorInstance} and {@link Defect}. |
| Schema | ErrorInstance | 6882 | 6898 | Schema for JavaScript `Error` objects. |
| Schema | Defect | 6899 | 6908 | Type-level representation of {@link Defect}. |
| Schema | Defect | 6909 | 6951 | Schema for unexpected defect values represented as `unknown` with a JSON encoded form. |
| Schema | $ReadonlyMap | 6952 | 6963 | Type-level representation returned by {@link ReadonlyMap}. |
| Schema | ReadonlyMapIso | 6964 | 6972 | Iso representation used for `ReadonlyMap` schemas: an array of readonly `[key, value]` tuples using each entry schema's `Iso` type. |
| Schema | ReadonlyMap | 6973 | 6981 | Schema for readonly maps whose keys and values conform to the provided schemas. |
| Schema | $ReadonlySet | 6982 | 6992 | Type-level representation returned by {@link ReadonlySet}. |
| Schema | ReadonlySetIso | 6993 | 7001 | Iso representation used for `ReadonlySet` schemas: an array of element values using the element schema's `Iso` type. |
| Schema | ReadonlySet | 7002 | 7009 | Schema for readonly sets whose values conform to the provided element schema. |
| Schema | RegExp | 7010 | 7019 | Type-level representation of {@link RegExp}. |
| Schema | RegExp | 7020 | 7031 | Schema for JavaScript `RegExp` objects. |
| Schema | URL | 7032 | 7041 | Type-level representation of {@link URL}. |
| Schema | URL | 7042 | 7055 | Schema for JavaScript `URL` objects. |
| Schema | URLFromString | 7056 | 7065 | Type-level representation of {@link URLFromString}. |
| Schema | URLFromString | 7066 | 7081 | Schema that decodes a `string` into a `URL`. |
| Schema | Date | 7082 | 7091 | Type-level representation of {@link Date}. |
| Schema | Date | 7092 | 7121 | Schema for valid JavaScript `Date` objects. |
| Schema | DateFromString | 7122 | 7131 | Type-level representation of {@link DateFromString}. |
| Schema | DateFromString | 7132 | 7158 | Schema that decodes a string into a JavaScript `Date`. |
| Schema | DateFromMillis | 7159 | 7168 | Type-level representation of {@link DateFromMillis}. |
| Schema | DateFromMillis | 7169 | 7198 | Schema that decodes epoch milliseconds into a JavaScript `Date`. |
| Schema | fromJsonString | 7199 | 7208 | Type-level representation returned by {@link fromJsonString}. |
| Schema | fromJsonString | 7209 | 7243 | Returns a schema that decodes a JSON string and then decodes the parsed value using the given schema. |
| Schema | File | 7244 | 7253 | Type-level representation of {@link File}. |
| Schema | File | 7254 | 7266 | Schema for JavaScript `File` objects. |
| Schema | FormData | 7267 | 7276 | Type-level representation of {@link FormData}. |
| Schema | FormData | 7277 | 7289 | Schema for JavaScript `FormData` objects. |
| Schema | fromFormData | 7290 | 7299 | Type-level representation returned by {@link fromFormData}. |
| Schema | fromFormData | 7300 | 7383 | Schema for decoding `FormData` through a bracket-notation tree. |
| Schema | URLSearchParams | 7384 | 7393 | Type-level representation of {@link URLSearchParams}. |
| Schema | URLSearchParams | 7394 | 7405 | Schema for JavaScript `URLSearchParams` objects. |
| Schema | fromURLSearchParams | 7406 | 7415 | Type-level representation returned by {@link fromURLSearchParams}. |
| Schema | fromURLSearchParams | 7416 | 7494 | Schema for decoding `URLSearchParams` through a bracket-notation tree. |
| Schema | NumberFromString | 7495 | 7504 | Type-level representation of {@link NumberFromString}. |
| Schema | NumberFromString | 7505 | 7523 | Schema that parses a string into a `number` using JavaScript number coercion. |
| Schema | FiniteFromString | 7524 | 7533 | Type-level representation of {@link FiniteFromString}. |
| Schema | FiniteFromString | 7534 | 7550 | Schema that parses a string into a finite number. |
| Schema | BigIntFromString | 7551 | 7560 | Type-level representation of {@link BigIntFromString}. |
| Schema | BigIntFromString | 7561 | 7590 | Schema that parses a string into a `bigint`. |
| Schema | Trimmed | 7591 | 7600 | Type-level representation of {@link Trimmed}. |
| Schema | Trimmed | 7601 | 7608 | Schema for strings that contains no leading or trailing whitespaces. |
| Schema | Trim | 7609 | 7618 | Type-level representation of {@link Trim}. |
| Schema | Trim | 7619 | 7634 | Schema that trims whitespace from a string. |
| Schema | StringFromBase64 | 7635 | 7644 | Type-level representation of {@link StringFromBase64}. |
| Schema | StringFromBase64 | 7645 | 7660 | Decodes a base64 (RFC4648) encoded string into a UTF-8 string. |
| Schema | StringFromBase64Url | 7661 | 7670 | Type-level representation of {@link StringFromBase64Url}. |
| Schema | StringFromBase64Url | 7671 | 7686 | Decodes a base64 (URL) encoded string into a UTF-8 string. |
| Schema | StringFromHex | 7687 | 7696 | Type-level representation of {@link StringFromHex}. |
| Schema | StringFromHex | 7697 | 7712 | Decodes a hex encoded string into a UTF-8 string. |
| Schema | StringFromUriComponent | 7713 | 7722 | Type-level representation of {@link StringFromUriComponent}. |
| Schema | StringFromUriComponent | 7723 | 7756 | Decodes a URI component encoded string into a UTF-8 string. |
| Schema | PropertyKey | 7757 | 7765 | Schema for property keys accepted by Effect schemas: finite `number`, `symbol`, or `string`. |
| Schema | StandardSchemaV1FailureResult | 7766 | 7788 | Schema for a Standard Schema v1 failure result. |
| Schema | BooleanFromBit | 7789 | 7798 | Type-level representation of {@link BooleanFromBit}. |
| Schema | BooleanFromBit | 7799 | 7819 | Schema for a boolean parsed from 0 or 1. |
| Schema | Uint8Array | 7820 | 7829 | Type-level representation of {@link Uint8Array}. |
| Schema | Uint8Array | 7830 | 7843 | Schema for JavaScript `Uint8Array` objects. |
| Schema | Uint8ArrayFromBase64 | 7844 | 7853 | Type-level representation of {@link Uint8ArrayFromBase64}. |
| Schema | Uint8ArrayFromBase64 | 7854 | 7870 | Schema that decodes a base64 encoded string into a `Uint8Array`. |
| Schema | Uint8ArrayFromBase64Url | 7871 | 7880 | Type-level representation of {@link Uint8ArrayFromBase64Url}. |
| Schema | Uint8ArrayFromBase64Url | 7881 | 7897 | Schema that decodes a base64 (URL) encoded string into a `Uint8Array`. |
| Schema | Uint8ArrayFromHex | 7898 | 7907 | Type-level representation of {@link Uint8ArrayFromHex}. |
| Schema | Uint8ArrayFromHex | 7908 | 7924 | Schema that decodes a hex encoded string into a `Uint8Array`. |
| Schema | isGreaterThanBigDecimal | 7925 | 7932 | Validates that a BigDecimal is greater than the specified value (exclusive). |
| Schema | isGreaterThanOrEqualToBigDecimal | 7933 | 7941 | Validates that a BigDecimal is greater than or equal to the specified value (inclusive). |
| Schema | isLessThanBigDecimal | 7942 | 7949 | Validates that a BigDecimal is less than the specified value (exclusive). |
| Schema | isLessThanOrEqualToBigDecimal | 7950 | 7958 | Validates that a BigDecimal is less than or equal to the specified value (inclusive). |
| Schema | isBetweenBigDecimal | 7959 | 7976 | Validates that a `BigDecimal` is within a specified range. |
| Schema | BigDecimal | 7977 | 7986 | Type-level representation of {@link BigDecimal}. |
| Schema | BigDecimal | 7987 | 8007 | Schema for `BigDecimal` values. |
| Schema | BigDecimalFromString | 8008 | 8017 | Type-level representation of {@link BigDecimalFromString}. |
| Schema | BigDecimalFromString | 8018 | 8047 | Schema that parses a string into a `BigDecimal`. |
| Schema | ByteSize | 8048 | 8057 | Type-level representation of {@link ByteSize}. |
| Schema | ByteSize | 8058 | 8071 | Schema for exact, non-negative `ByteSize` values. |
| Schema | ByteSizeFromString | 8072 | 8081 | Type-level representation of {@link ByteSizeFromString}. |
| Schema | ByteSizeFromString | 8082 | 8112 | Schema that decodes byte-size strings into exact, non-negative `ByteSize` values. |
| Schema | ByteSizeFromBigInt | 8113 | 8122 | Type-level representation of {@link ByteSizeFromBigInt}. |
| Schema | ByteSizeFromBigInt | 8123 | 8130 | Schema that decodes non-negative bigint byte counts. |
| Schema | ByteSizeFromNumber | 8131 | 8140 | Type-level representation of {@link ByteSizeFromNumber}. |
| Schema | ByteSizeFromNumber | 8141 | 8152 | Schema that decodes non-negative safe-integer byte counts. |
| Schema | CauseReason | 8153 | 8164 | Type-level representation returned by {@link CauseReason}. |
| Schema | CauseReasonIso | 8165 | 8186 | Iso representation used for `CauseReason` schemas. |
| Schema | CauseReason | 8187 | 8208 | Creates a schema for `Cause.Reason` values using separate schemas for typed failures and unexpected defects. |
| Schema | Cause | 8209 | 8220 | Type-level representation returned by {@link Cause}. |
| Schema | CauseIso | 8221 | 8237 | Iso representation used for `Cause` schemas: an ordered array of `CauseReasonIso` values. |
| Schema | Cause | 8238 | 8260 | Creates a schema for `Cause` values using separate schemas for typed failures and unexpected defects. |
| Schema | Chunk | 8261 | 8271 | Type-level representation returned by {@link Chunk}. |
| Schema | ChunkIso | 8272 | 8287 | Iso representation used for `Chunk` schemas: an array of element values using the element schema's `Iso` type. |
| Schema | Chunk | 8288 | 8295 | Schema for chunks whose values conform to the provided element schema. |
| Schema | DateTimeUtc | 8296 | 8305 | Type-level representation of {@link DateTimeUtc}. |
| Schema | DateTimeUtc | 8306 | 8328 | Schema for `DateTime.Utc` values. |
| Schema | DateTimeUtcFromDate | 8329 | 8338 | Type-level representation of {@link DateTimeUtcFromDate}. |
| Schema | DateTimeUtcFromDate | 8339 | 8364 | Schema that decodes a `Date` into a `DateTime.Utc`. |
| Schema | DateTimeUtcFromString | 8365 | 8374 | Type-level representation of {@link DateTimeUtcFromString}. |
| Schema | DateTimeUtcFromString | 8375 | 8397 | Schema that decodes a date-time string into a `DateTime.Utc`. |
| Schema | DateTimeUtcFromHttpDate | 8398 | 8407 | Type-level representation of {@link DateTimeUtcFromHttpDate}. |
| Schema | DateTimeUtcFromHttpDate | 8408 | 8433 | Schema for HTTP date header values, such as `Date`, `Last-Modified` and `Expires`, decoded as `DateTime.Utc`. |
| Schema | DateTimeUtcFromMillis | 8434 | 8443 | Type-level representation of {@link DateTimeUtcFromMillis}. |
| Schema | DateTimeUtcFromMillis | 8444 | 8463 | Schema that decodes a number into a `DateTime.Utc`. |
| Schema | TimeZoneOffset | 8464 | 8473 | Type-level representation of {@link TimeZoneOffset}. |
| Schema | TimeZoneOffset | 8474 | 8487 | Schema for `DateTime.TimeZone.Offset` values. |
| Schema | TimeZoneNamed | 8488 | 8497 | Type-level representation of {@link TimeZoneNamed}. |
| Schema | TimeZoneNamed | 8498 | 8511 | Schema for `DateTime.TimeZone.Named` values. |
| Schema | TimeZoneNamedFromString | 8512 | 8521 | Type-level representation of {@link TimeZoneNamedFromString}. |
| Schema | TimeZoneNamedFromString | 8522 | 8537 | Schema that parses an IANA time zone identifier string into a `DateTime.TimeZone.Named`. |
| Schema | TimeZone | 8538 | 8547 | Type-level representation of {@link TimeZone}. |
| Schema | TimeZone | 8548 | 8562 | Schema for `DateTime.TimeZone` values. |
| Schema | TimeZoneFromString | 8563 | 8572 | Type-level representation of {@link TimeZoneFromString}. |
| Schema | TimeZoneFromString | 8573 | 8588 | Schema that parses a time zone string into a `DateTime.TimeZone`. |
| Schema | DateTimeZoned | 8589 | 8598 | Type-level representation of {@link DateTimeZoned}. |
| Schema | DateTimeZoned | 8599 | 8615 | Schema for `DateTime.Zoned` values. |
| Schema | DateTimeZonedFromString | 8616 | 8625 | Type-level representation of {@link DateTimeZonedFromString}. |
| Schema | DateTimeZonedFromString | 8626 | 8641 | Schema that parses a zoned DateTime string into a `DateTime.Zoned`. |
| Schema | MacAddress | 8642 | 8651 | Type-level representation of {@link MacAddress}. |
| Schema | MacAddress | 8652 | 8659 | Schema for already-constructed MAC address values. |
| Schema | MacAddressFromString | 8660 | 8669 | Type-level representation of {@link MacAddressFromString}. |
| Schema | MacAddressFromString | 8670 | 8677 | Schema for MAC addresses encoded as canonical colon-separated hexadecimal strings. |
| Schema | Ipv4Address | 8678 | 8687 | Type-level representation of {@link Ipv4Address}. |
| Schema | Ipv4Address | 8688 | 8695 | Schema for already-constructed IPv4 address values. |
| Schema | Ipv4AddressFromString | 8696 | 8705 | Type-level representation of {@link Ipv4AddressFromString}. |
| Schema | Ipv4AddressFromString | 8706 | 8713 | Schema for IPv4 addresses encoded as canonical dotted-decimal strings. |
| Schema | Ipv6Address | 8714 | 8723 | Type-level representation of {@link Ipv6Address}. |
| Schema | Ipv6Address | 8724 | 8731 | Schema for already-constructed IPv6 address values. |
| Schema | Ipv6AddressFromString | 8732 | 8741 | Type-level representation of {@link Ipv6AddressFromString}. |
| Schema | Ipv6AddressFromString | 8742 | 8749 | Schema for IPv6 addresses encoded as canonical strings. |
| Schema | IpAddress | 8750 | 8759 | Type-level representation of {@link IpAddress}. |
| Schema | IpAddress | 8760 | 8767 | Schema for already-constructed IPv4 or IPv6 address values. |
| Schema | IpAddressFromString | 8768 | 8777 | Type-level representation of {@link IpAddressFromString}. |
| Schema | IpAddressFromString | 8778 | 8785 | Schema for IP addresses encoded as canonical numeric strings. |
| Schema | IpMulticastAddress | 8786 | 8795 | Type-level representation of {@link IpMulticastAddress}. |
| Schema | IpMulticastAddress | 8796 | 8803 | Schema for already-constructed multicast IP addresses. |
| Schema | IpMulticastAddressFromString | 8804 | 8813 | Type-level representation of {@link IpMulticastAddressFromString}. |
| Schema | IpMulticastAddressFromString | 8814 | 8832 | Schema for multicast IP addresses encoded as numeric strings. |
| Schema | MacMulticastAddress | 8833 | 8842 | Type-level representation of {@link MacMulticastAddress}. |
| Schema | MacMulticastAddress | 8843 | 8850 | Schema for already-constructed multicast MAC addresses. |
| Schema | MacMulticastAddressFromString | 8851 | 8860 | Type-level representation of {@link MacMulticastAddressFromString}. |
| Schema | MacMulticastAddressFromString | 8861 | 8868 | Schema for multicast MAC addresses encoded as canonical strings. |
| Schema | IpUnicastAddress | 8869 | 8878 | Type-level representation of {@link IpUnicastAddress}. |
| Schema | IpUnicastAddress | 8879 | 8886 | Schema for already-constructed syntactic unicast IP addresses. |
| Schema | IpUnicastAddressFromString | 8887 | 8896 | Type-level representation of {@link IpUnicastAddressFromString}. |
| Schema | IpUnicastAddressFromString | 8897 | 8904 | Schema for syntactic unicast IP addresses encoded as numeric strings. |
| Schema | MacUnicastAddress | 8905 | 8914 | Type-level representation of {@link MacUnicastAddress}. |
| Schema | MacUnicastAddress | 8915 | 8922 | Schema for already-constructed unicast MAC addresses. |
| Schema | MacUnicastAddressFromString | 8923 | 8932 | Type-level representation of {@link MacUnicastAddressFromString}. |
| Schema | MacUnicastAddressFromString | 8933 | 8940 | Schema for unicast MAC addresses encoded as canonical strings. |
| Schema | Ipv4BroadcastAddress | 8941 | 8950 | Type-level representation of {@link Ipv4BroadcastAddress}. |
| Schema | Ipv4BroadcastAddress | 8951 | 8958 | Schema for the already-constructed IPv4 limited broadcast address. |
| Schema | Ipv4BroadcastAddressFromString | 8959 | 8968 | Type-level representation of {@link Ipv4BroadcastAddressFromString}. |
| Schema | Ipv4BroadcastAddressFromString | 8969 | 8976 | Schema for the IPv4 limited broadcast address encoded as a string. |
| Schema | MacBroadcastAddress | 8977 | 8986 | Type-level representation of {@link MacBroadcastAddress}. |
| Schema | MacBroadcastAddress | 8987 | 8994 | Schema for the already-constructed MAC all-ones broadcast address. |
| Schema | MacBroadcastAddressFromString | 8995 | 9004 | Type-level representation of {@link MacBroadcastAddressFromString}. |
| Schema | MacBroadcastAddressFromString | 9005 | 9012 | Schema for the MAC all-ones broadcast address encoded as a string. |
| Schema | IpLoopbackAddress | 9013 | 9022 | Type-level representation of {@link IpLoopbackAddress}. |
| Schema | IpLoopbackAddress | 9023 | 9030 | Schema for already-constructed loopback IP addresses. |
| Schema | IpLoopbackAddressFromString | 9031 | 9040 | Type-level representation of {@link IpLoopbackAddressFromString}. |
| Schema | IpLoopbackAddressFromString | 9041 | 9048 | Schema for loopback IP addresses encoded as numeric strings. |
| Schema | IpLinkLocalAddress | 9049 | 9058 | Type-level representation of {@link IpLinkLocalAddress}. |
| Schema | IpLinkLocalAddress | 9059 | 9066 | Schema for already-constructed link-local IP addresses. |
| Schema | IpLinkLocalAddressFromString | 9067 | 9076 | Type-level representation of {@link IpLinkLocalAddressFromString}. |
| Schema | IpLinkLocalAddressFromString | 9077 | 9084 | Schema for link-local IP addresses encoded as numeric strings. |
| Schema | IpUnspecifiedAddress | 9085 | 9094 | Type-level representation of {@link IpUnspecifiedAddress}. |
| Schema | IpUnspecifiedAddress | 9095 | 9102 | Schema for already-constructed unspecified IP addresses. |
| Schema | IpUnspecifiedAddressFromString | 9103 | 9112 | Type-level representation of {@link IpUnspecifiedAddressFromString}. |
| Schema | IpUnspecifiedAddressFromString | 9113 | 9120 | Schema for unspecified IP addresses encoded as numeric strings. |
| Schema | Ipv4PrivateAddress | 9121 | 9130 | Type-level representation of {@link Ipv4PrivateAddress}. |
| Schema | Ipv4PrivateAddress | 9131 | 9138 | Schema for already-constructed RFC 1918 private-use addresses. |
| Schema | Ipv4PrivateAddressFromString | 9139 | 9148 | Type-level representation of {@link Ipv4PrivateAddressFromString}. |
| Schema | Ipv4PrivateAddressFromString | 9149 | 9156 | Schema for RFC 1918 private-use addresses encoded as strings. |
| Schema | Ipv6UniqueLocalAddress | 9157 | 9166 | Type-level representation of {@link Ipv6UniqueLocalAddress}. |
| Schema | Ipv6UniqueLocalAddress | 9167 | 9174 | Schema for already-constructed IPv6 unique-local addresses. |
| Schema | Ipv6UniqueLocalAddressFromString | 9175 | 9184 | Type-level representation of {@link Ipv6UniqueLocalAddressFromString}. |
| Schema | Ipv6UniqueLocalAddressFromString | 9185 | 9192 | Schema for IPv6 unique-local addresses encoded as strings. |
| Schema | MacLocallyAdministeredAddress | 9193 | 9202 | Type-level representation of {@link MacLocallyAdministeredAddress}. |
| Schema | MacLocallyAdministeredAddress | 9203 | 9210 | Schema for already-constructed locally administered MAC addresses. |
| Schema | MacLocallyAdministeredAddressFromString | 9211 | 9220 | Type-level representation of {@link MacLocallyAdministeredAddressFromString}. |
| Schema | MacLocallyAdministeredAddressFromString | 9221 | 9228 | Schema for locally administered MAC addresses encoded as strings. |
| Schema | MacUniversallyAdministeredAddress | 9229 | 9238 | Type-level representation of {@link MacUniversallyAdministeredAddress}. |
| Schema | MacUniversallyAdministeredAddress | 9239 | 9246 | Schema for already-constructed universally administered MAC addresses. |
| Schema | MacUniversallyAdministeredAddressFromString | 9247 | 9256 | Type-level representation of {@link MacUniversallyAdministeredAddressFromString}. |
| Schema | MacUniversallyAdministeredAddressFromString | 9257 | 9264 | Schema for universally administered MAC addresses encoded as strings. |
| Schema | Ipv4Interface | 9265 | 9274 | Type-level representation of {@link Ipv4Interface}. |
| Schema | Ipv4Interface | 9275 | 9282 | Schema for already-constructed IPv4 interface address values. |
| Schema | Ipv4InterfaceFromString | 9283 | 9292 | Type-level representation of {@link Ipv4InterfaceFromString}. |
| Schema | Ipv4InterfaceFromString | 9293 | 9300 | Schema for IPv4 interface addresses encoded as an address and prefix length. |
| Schema | Ipv6Interface | 9301 | 9310 | Type-level representation of {@link Ipv6Interface}. |
| Schema | Ipv6Interface | 9311 | 9318 | Schema for already-constructed IPv6 interface address values. |
| Schema | Ipv6InterfaceFromString | 9319 | 9328 | Type-level representation of {@link Ipv6InterfaceFromString}. |
| Schema | Ipv6InterfaceFromString | 9329 | 9336 | Schema for IPv6 interface addresses encoded as an address and prefix length. |
| Schema | IpInterface | 9337 | 9346 | Type-level representation of {@link IpInterface}. |
| Schema | IpInterface | 9347 | 9354 | Schema for already-constructed IPv4 or IPv6 interface address values. |
| Schema | IpInterfaceFromString | 9355 | 9364 | Type-level representation of {@link IpInterfaceFromString}. |
| Schema | IpInterfaceFromString | 9365 | 9372 | Schema for IPv4 or IPv6 interface addresses encoded as an address and prefix length. |
| Schema | Ipv4Network | 9373 | 9382 | Type-level representation of {@link Ipv4Network}. |
| Schema | Ipv4Network | 9383 | 9390 | Schema for already-constructed canonical IPv4 network prefixes. |
| Schema | Ipv4NetworkFromString | 9391 | 9400 | Type-level representation of {@link Ipv4NetworkFromString}. |
| Schema | Ipv4NetworkFromString | 9401 | 9408 | Schema for canonical IPv4 network prefixes encoded in CIDR notation. |
| Schema | Ipv6Network | 9409 | 9418 | Type-level representation of {@link Ipv6Network}. |
| Schema | Ipv6Network | 9419 | 9426 | Schema for already-constructed canonical IPv6 network prefixes. |
| Schema | Ipv6NetworkFromString | 9427 | 9436 | Type-level representation of {@link Ipv6NetworkFromString}. |
| Schema | Ipv6NetworkFromString | 9437 | 9444 | Schema for canonical IPv6 network prefixes encoded in CIDR notation. |
| Schema | IpNetwork | 9445 | 9454 | Type-level representation of {@link IpNetwork}. |
| Schema | IpNetwork | 9455 | 9462 | Schema for already-constructed canonical IPv4 or IPv6 network prefixes. |
| Schema | IpNetworkFromString | 9463 | 9472 | Type-level representation of {@link IpNetworkFromString}. |
| Schema | IpNetworkFromString | 9473 | 9480 | Schema for canonical IPv4 or IPv6 network prefixes encoded in CIDR notation. |
| Schema | InetAddressV4 | 9481 | 9490 | Type-level representation of {@link InetAddressV4}. |
| Schema | InetAddressV4 | 9491 | 9498 | Schema for already-constructed resolved IPv4 internet addresses. |
| Schema | InetAddressV6 | 9499 | 9508 | Type-level representation of {@link InetAddressV6}. |
| Schema | InetAddressV6 | 9509 | 9516 | Schema for already-constructed resolved IPv6 internet addresses. |
| Schema | InetAddress | 9517 | 9526 | Type-level representation of {@link InetAddress}. |
| Schema | InetAddress | 9527 | 9534 | Schema for already-constructed resolved internet addresses. |
| Schema | InetAddressFromString | 9535 | 9544 | Type-level representation of {@link InetAddressFromString}. |
| Schema | InetAddressFromString | 9545 | 9552 | Schema for resolved internet addresses encoded as numeric socket strings. |
| Schema | UnixPathAddress | 9553 | 9562 | Type-level representation of {@link UnixPathAddress}. |
| Schema | UnixPathAddress | 9563 | 9570 | Schema for already-constructed Unix-domain filesystem addresses. |
| Schema | UnixPathAddressFromString | 9571 | 9580 | Type-level representation of {@link UnixPathAddressFromString}. |
| Schema | UnixPathAddressFromString | 9581 | 9588 | Schema for Unix-domain filesystem addresses encoded as opaque path strings. |
| Schema | SocketAddress | 9589 | 9598 | Type-level representation of {@link SocketAddress}. |
| Schema | SocketAddress | 9599 | 9606 | Schema for already-constructed portable concrete socket addresses. |
| Schema | DomainName | 9607 | 9616 | Type-level representation of {@link DomainName}. |
| Schema | DomainName | 9617 | 9630 | Schema for normalized DNS domain names. |
| Schema | DomainNameFromString | 9631 | 9640 | Type-level representation of {@link DomainNameFromString}. |
| Schema | DomainNameFromString | 9641 | 9649 | Schema for DNS domain names decoded from strings, normalizing case and converting internationalized names to their ASCII form. |
| Schema | ScopedIpv6Literal | 9650 | 9659 | Type-level representation of {@link ScopedIpv6Literal}. |
| Schema | ScopedIpv6Literal | 9660 | 9667 | Schema for canonical scoped IPv6 literals such as `fe80::1%eth0`. |
| Schema | ScopedIpv6LiteralFromString | 9668 | 9677 | Type-level representation of {@link ScopedIpv6LiteralFromString}. |
| Schema | ScopedIpv6LiteralFromString | 9678 | 9686 | Schema for scoped IPv6 literals decoded from strings, normalizing the address and numeric zones. |
| Schema | Host | 9687 | 9696 | Type-level representation of {@link Host}. |
| Schema | Host | 9697 | 9704 | Schema for hosts: numeric IP addresses, scoped IPv6 literals, or domain names. |
| Schema | HostFromString | 9705 | 9714 | Type-level representation of {@link HostFromString}. |
| Schema | HostFromString | 9715 | 9723 | Schema for hosts decoded from strings. |
| Schema | HostPort | 9724 | 9733 | Type-level representation of {@link HostPort}. |
| Schema | HostPort | 9734 | 9741 | Schema for already-constructed unresolved host and port values. |
| Schema | HostPortFromString | 9742 | 9751 | Type-level representation of {@link HostPortFromString}. |
| Schema | HostPortFromString | 9752 | 9760 | Schema for unresolved endpoints encoded as `host:port` or `[IPv6]:port` strings. |
| Schema | Port | 9761 | 9770 | Type-level representation of {@link Port}. |
| Schema | Port | 9771 | 9784 | Schema for TCP and UDP port numbers from 0 through 65535. |
| Schema | Duration | 9785 | 9794 | Type-level representation of {@link Duration}. |
| Schema | Duration | 9795 | 9816 | Schema for `Duration` values. |
| Schema | DurationFromString | 9817 | 9826 | Type-level representation of {@link DurationFromString}. |
| Schema | DurationFromString | 9827 | 9843 | Schema that parses a string into a `Duration`. |
| Schema | DurationFromNanos | 9844 | 9853 | Type-level representation of {@link DurationFromNanos}. |
| Schema | DurationFromNanos | 9854 | 9872 | Schema that decodes a `bigint` into a `Duration`, treating the bigint as nanoseconds. |
| Schema | DurationFromMillis | 9873 | 9882 | Type-level representation of {@link DurationFromMillis}. |
| Schema | DurationFromMillis | 9883 | 9903 | Schema that decodes a number into a `Duration`, treating the number as milliseconds. |
| Schema | DurationFromIsoString | 9904 | 9913 | Type-level representation of {@link DurationFromIsoString}. |
| Schema | DurationFromIsoString | 9914 | 9935 | Schema that decodes an ISO 8601 duration string into a `Duration`. |
| Schema | DnsRecordType | 9936 | 9944 | Type-level representation of {@link DnsRecordType}. |
| Schema | DnsRecordType | 9945 | 9952 | Schema for supported DNS record types such as `"A"` or `"SRV"`. |
| Schema | DnsARecord | 9953 | 9962 | Type-level representation of {@link DnsARecord}. |
| Schema | DnsARecord | 9963 | 9970 | Schema for already-constructed IPv4 address (`A`) DNS records. |
| Schema | DnsAaaaRecord | 9971 | 9980 | Type-level representation of {@link DnsAaaaRecord}. |
| Schema | DnsAaaaRecord | 9981 | 9988 | Schema for already-constructed IPv6 address (`AAAA`) DNS records. |
| Schema | DnsCaaRecord | 9989 | 9998 | Type-level representation of {@link DnsCaaRecord}. |
| Schema | DnsCaaRecord | 9999 | 10006 | Schema for already-constructed certification authority authorization (`CAA`) DNS records. |
| Schema | DnsCnameRecord | 10007 | 10016 | Type-level representation of {@link DnsCnameRecord}. |
| Schema | DnsCnameRecord | 10017 | 10024 | Schema for already-constructed canonical name (`CNAME`) DNS records. |
| Schema | DnsMxRecord | 10025 | 10034 | Type-level representation of {@link DnsMxRecord}. |
| Schema | DnsMxRecord | 10035 | 10042 | Schema for already-constructed mail exchange (`MX`) DNS records. |
| Schema | DnsNaptrRecord | 10043 | 10052 | Type-level representation of {@link DnsNaptrRecord}. |
| Schema | DnsNaptrRecord | 10053 | 10060 | Schema for already-constructed naming authority pointer (`NAPTR`) DNS records. |
| Schema | DnsNsRecord | 10061 | 10070 | Type-level representation of {@link DnsNsRecord}. |
| Schema | DnsNsRecord | 10071 | 10078 | Schema for already-constructed name server (`NS`) DNS records. |
| Schema | DnsPtrRecord | 10079 | 10088 | Type-level representation of {@link DnsPtrRecord}. |
| Schema | DnsPtrRecord | 10089 | 10096 | Schema for already-constructed pointer (`PTR`) DNS records. |
| Schema | DnsSoaRecord | 10097 | 10106 | Type-level representation of {@link DnsSoaRecord}. |
| Schema | DnsSoaRecord | 10107 | 10114 | Schema for already-constructed start of authority (`SOA`) DNS records. |
| Schema | DnsSrvRecord | 10115 | 10124 | Type-level representation of {@link DnsSrvRecord}. |
| Schema | DnsSrvRecord | 10125 | 10132 | Schema for already-constructed service locator (`SRV`) DNS records. |
| Schema | DnsTlsaRecord | 10133 | 10142 | Type-level representation of {@link DnsTlsaRecord}. |
| Schema | DnsTlsaRecord | 10143 | 10155 | Schema for already-constructed TLS authentication (`TLSA`) DNS records. |
| Schema | DnsTxtRecord | 10156 | 10165 | Type-level representation of {@link DnsTxtRecord}. |
| Schema | DnsTxtRecord | 10166 | 10173 | Schema for already-constructed text (`TXT`) DNS records. |
| Schema | DnsRecord | 10174 | 10196 | Type-level representation of {@link DnsRecord}. |
| Schema | DnsRecord | 10197 | 10216 | Schema for already-constructed DNS records of any supported record type. |
| Schema | MacKey | 10217 | 10226 | Type-level representation of {@link MacKey}. |
| Schema | MacKey | 10227 | 10241 | Schema for live `Mac.Key` values of an algorithm. |
| Schema | MacKeyFromBytes | 10242 | 10268 | Schema that decodes raw key bytes into a `Mac.Key`. |
| Schema | MacKeyFromFormat | 10269 | 10283 | Schema that decodes a `Mac.Key` from a JWK with `KeyFormat.decodeSecret`. |
| Schema | AeadKey | 10284 | 10293 | Type-level representation of {@link AeadKey}. |
| Schema | AeadKey | 10294 | 10308 | Schema for live `Aead.Key` values of an algorithm. |
| Schema | AeadKeyFromBytes | 10309 | 10323 | Schema that decodes raw key bytes into an `Aead.Key`. |
| Schema | AeadKeyFromFormat | 10324 | 10338 | Schema that decodes an `Aead.Key` from a JWK with `KeyFormat.decodeSecret`. |
| Schema | CipherKey | 10339 | 10348 | Type-level representation of {@link CipherKey}. |
| Schema | CipherKey | 10349 | 10364 | Schema for live `Cipher.Key` values of an algorithm. |
| Schema | CipherKeyFromBytes | 10365 | 10379 | Schema that decodes raw key bytes into a `Cipher.Key`. |
| Schema | CipherKeyFromFormat | 10380 | 10395 | Schema that decodes a `Cipher.Key` from a JWK with `KeyFormat.decodeSecret`. |
| Schema | SignaturePublicKey | 10396 | 10405 | Type-level representation of {@link SignaturePublicKey}. |
| Schema | SignaturePublicKey | 10406 | 10420 | Schema for live `Signature.PublicKey` values of an algorithm. |
| Schema | SignaturePublicKeyFromBytes | 10421 | 10437 | Schema that decodes a raw public key into a `Signature.PublicKey`: 32 bytes for Ed25519, or an uncompressed SEC1 point for ECDSA. |
| Schema | SignaturePublicKeyFromFormat | 10438 | 10454 | Schema that decodes a `Signature.PublicKey` with `KeyFormat.decodePublic` and encodes it with `KeyFormat.encode`. |
| Schema | SignaturePrivateKey | 10455 | 10464 | Type-level representation of {@link SignaturePrivateKey}. |
| Schema | SignaturePrivateKey | 10465 | 10480 | Schema for live `Signature.PrivateKey` values of an algorithm. |
| Schema | SignaturePrivateKeyFromBytes | 10481 | 10497 | Schema that decodes an Ed25519 seed into a `Signature.PrivateKey`. |
| Schema | SignaturePrivateKeyFromFormat | 10498 | 10516 | Schema that decodes a `Signature.PrivateKey` with `KeyFormat.decodePrivate`. |
| Schema | KeyAgreementPublicKey | 10517 | 10526 | Type-level representation of {@link KeyAgreementPublicKey}. |
| Schema | KeyAgreementPublicKey | 10527 | 10542 | Schema for live `KeyAgreement.PublicKey` values of an algorithm. |
| Schema | KeyAgreementPublicKeyFromBytes | 10543 | 10558 | Schema that decodes a raw public key into a `KeyAgreement.PublicKey`: 32 bytes for X25519, or an uncompressed SEC1 point for ECDH. |
| Schema | KeyAgreementPublicKeyFromFormat | 10559 | 10575 | Schema that decodes a `KeyAgreement.PublicKey` with `KeyFormat.decodePublic` and encodes it with `KeyFormat.encode`. |
| Schema | KeyAgreementPrivateKey | 10576 | 10585 | Type-level representation of {@link KeyAgreementPrivateKey}. |
| Schema | KeyAgreementPrivateKey | 10586 | 10601 | Schema for live `KeyAgreement.PrivateKey` values of an algorithm. |
| Schema | KeyAgreementPrivateKeyFromBytes | 10602 | 10619 | Schema that decodes an X25519 private key into a `KeyAgreement.PrivateKey`. |
| Schema | KeyAgreementPrivateKeyFromFormat | 10620 | 10638 | Schema that decodes a `KeyAgreement.PrivateKey` with `KeyFormat.decodePrivate`. |
| Schema | KeyWrapKey | 10639 | 10648 | Type-level representation of {@link KeyWrapKey}. |
| Schema | KeyWrapKey | 10649 | 10664 | Schema for live AES-KW `KeyWrap.Key` values of an algorithm. |
| Schema | KeyWrapKeyFromBytes | 10665 | 10679 | Schema that decodes raw key bytes into an AES-KW `KeyWrap.Key`. |
| Schema | KeyWrapKeyFromFormat | 10680 | 10695 | Schema that decodes an AES-KW `KeyWrap.Key` from a JWK with `KeyFormat.decodeSecret`. |
| Schema | KeyWrapPublicKey | 10696 | 10705 | Type-level representation of {@link KeyWrapPublicKey}. |
| Schema | KeyWrapPublicKey | 10706 | 10720 | Schema for live RSA-OAEP `KeyWrap.PublicKey` values of an algorithm. |
| Schema | KeyWrapPublicKeyFromFormat | 10721 | 10737 | Schema that decodes an RSA-OAEP `KeyWrap.PublicKey` with `KeyFormat.decodePublic` and encodes it with `KeyFormat.encode`. |
| Schema | KeyWrapPrivateKey | 10738 | 10747 | Type-level representation of {@link KeyWrapPrivateKey}. |
| Schema | KeyWrapPrivateKey | 10748 | 10763 | Schema for live RSA-OAEP `KeyWrap.PrivateKey` values of an algorithm. |
| Schema | KeyWrapPrivateKeyFromFormat | 10764 | 10782 | Schema that decodes an RSA-OAEP `KeyWrap.PrivateKey` with `KeyFormat.decodePrivate`. |
| Schema | Exit | 10783 | 10795 | Type-level representation returned by {@link Exit}. |
| Schema | ExitIso | 10796 | 10814 | Iso representation used for `Exit` schemas. |
| Schema | Exit | 10815 | 10828 | Creates a schema for `Exit` values using schemas for the success value, typed failure, and unexpected defect channels. |
| Schema | EncodedGraph | 10829 | 10836 | Encoded representation of an immutable Effect graph. |
| Schema | GraphIso | 10837 | 10844 | Iso representation used for {@link Graph} schemas. |
| Schema | Graph | 10845 | 10857 | Type-level representation returned by {@link Graph}. |
| Schema | Graph | 10858 | 10892 | Creates a schema for immutable directed or undirected Effect graphs. |
| Schema | Graph | 10893 | 10893 |  |
| Schema | Graph | 10894 | 10894 |  |
| Schema | HashMap | 10895 | 10906 | Type-level representation returned by {@link HashMap}. |
| Schema | HashMapIso | 10907 | 10915 | Iso representation used for `HashMap` schemas: an array of readonly `[key, value]` tuples using each entry schema's `Iso` type. |
| Schema | HashMap | 10916 | 10923 | Schema for hash maps whose keys and values conform to the provided schemas. |
| Schema | HashSet | 10924 | 10934 | Type-level representation returned by {@link HashSet}. |
| Schema | HashSetIso | 10935 | 10943 | Iso representation used for `HashSet` schemas: an array of element values using the element schema's `Iso` type. |
| Schema | HashSet | 10944 | 10951 | Schema for hash sets whose values conform to the provided element schema. |
| Schema | Option | 10952 | 10962 | Type-level representation returned by {@link Option}. |
| Schema | OptionIso | 10963 | 10980 | Iso representation used for `Option` schemas. |
| Schema | Option | 10981 | 10988 | Schema for `Option<A>` values. |
| Schema | OptionFromNullOr | 10989 | 10998 | Type-level representation returned by {@link OptionFromNullOr}. |
| Schema | OptionFromNullOr | 10999 | 11011 | Decodes a nullable, required value `T` to a required `Option<T>` value. |
| Schema | OptionFromUndefinedOr | 11012 | 11021 | Type-level representation returned by {@link OptionFromUndefinedOr}. |
| Schema | OptionFromUndefinedOr | 11022 | 11035 | Decodes a required value that may be `undefined` to a required `Option<T>` value. |
| Schema | OptionFromNullishOr | 11036 | 11045 | Type-level representation returned by {@link OptionFromNullishOr}. |
| Schema | OptionFromNullishOr | 11046 | 11062 | Decodes a nullish value `T` to a required `Option<T>` value. |
| Schema | Cookie | 11063 | 11072 | Type-level representation of {@link Cookie}. |
| Schema | Cookie | 11073 | 11080 | Schema for HTTP cookie values. |
| Schema | Cookies | 11081 | 11090 | Type-level representation of {@link Cookies}. |
| Schema | Cookies | 11091 | 11103 | Schema for HTTP cookie collections. |
| Schema | RecordFromCookies | 11104 | 11113 | Type-level representation of {@link RecordFromCookies}. |
| Schema | RecordFromCookies | 11114 | 11122 | Schema that decodes HTTP cookies into a record of decoded string values keyed by cookie name. |
| Schema | Headers | 11123 | 11134 | Type-level representation of {@link Headers}. |
| Schema | Headers | 11135 | 11146 | Schema for HTTP headers encoded as records of string values. |
| Schema | RetryAfter | 11147 | 11165 | Type-level representation of {@link RetryAfter}. |
| Schema | RetryAfter | 11166 | 11179 | Schema for parsed `Retry-After` header values. |
| Schema | RetryAfterFromString | 11180 | 11189 | Type-level representation of {@link RetryAfterFromString}. |
| Schema | RetryAfterFromString | 11190 | 11214 | Schema for `Retry-After` header values, decoded with `Headers.parseRetryAfter`. |
| Schema | UrlParams | 11215 | 11224 | Type-level representation of {@link UrlParams}. |
| Schema | UrlParams | 11225 | 11236 | Schema for HTTP URL parameters. |
| Schema | JsonFromUrlParamsField | 11237 | 11246 | Type-level representation of {@link JsonFromUrlParamsField}. |
| Schema | JsonFromUrlParamsField | 11247 | 11277 | Extracts a JSON value from the first occurrence of the given `field` in URL parameters. |
| Schema | RecordFromUrlParams | 11278 | 11287 | Type-level representation of {@link RecordFromUrlParams}. |
| Schema | RecordFromUrlParams | 11288 | 11320 | Schema that decodes URL parameters into a record of string values. |
| Schema | OptionFromOptionalKey | 11321 | 11330 | Type-level representation returned by {@link OptionFromOptionalKey}. |
| Schema | OptionFromOptionalKey | 11331 | 11343 | Decodes an optional value `A` to a required `Option<A>` value. |
| Schema | OptionFromOptional | 11344 | 11353 | Type-level representation returned by {@link OptionFromOptional}. |
| Schema | OptionFromOptional | 11354 | 11368 | Decodes an optional or `undefined` value `A` to a required `Option<A>` value. |
| Schema | OptionFromOptionalNullOr | 11369 | 11378 | Type-level representation returned by {@link OptionFromOptionalNullOr}. |
| Schema | OptionFromOptionalNullOr | 11379 | 11396 | Decodes an optional or `null` or `undefined` value `A` to a required `Option<A>` value. |
| Schema | Redacted | 11397 | 11407 | Type-level representation returned by {@link Redacted}. |
| Schema | Redacted | 11408 | 11432 | Schema for `Redacted` values, which hide their contents from inspection. |
| Schema | RedactedFromValue | 11433 | 11442 | Type-level representation returned by {@link RedactedFromValue}. |
| Schema | RedactedFromValue | 11443 | 11456 | Decodes a value and wraps it in `Redacted<A>`. |
| Schema | Result | 11457 | 11468 | Type-level representation returned by {@link Result}. |
| Schema | ResultIso | 11469 | 11487 | Iso representation used for `Result` schemas. |
| Schema | Result | 11488 | 11495 | Schema for `Result<A, E>` values. |
| Schema | SemVer | 11496 | 11505 | Type-level representation of {@link SemVer}. |
| Schema | SemVer | 11506 | 11519 | Schema for `SemVer` values. |
| Schema | SemVerFromString | 11520 | 11529 | Type-level representation of {@link SemVerFromString}. |
| Schema | SemVerFromString | 11530 | 11544 | Schema that parses a Semantic Versioning 2.0.0 string into a `SemVer`. |
| Schema | SemVerRange | 11545 | 11554 | Type-level representation of {@link SemVerRange}. |
| Schema | SemVerRange | 11555 | 11567 | Schema for `SemVerRange` values. |
| Schema | SemVerRangeFromString | 11568 | 11577 | Type-level representation of {@link SemVerRangeFromString}. |
| Schema | SemVerRangeFromString | 11578 | 11591 | Schema that parses an npm-style version range string into a `SemVerRange`. |
| Schema | Class | 11592 | 11666 | Type-level representation returned by {@link Class}. |
| Schema | Class | 11667 | 11824 | Creates a schema-backed class whose constructor validates input against a {@link Struct} schema. |
| Schema | TaggedClass | 11825 | 11896 | Defines a schema-backed class with an automatically populated `_tag` field. |
| Schema | Error | 11897 | 11954 | Creates a schema-backed error class that can be used as a typed, yieldable error in Effect programs. |
| Schema | TaggedError | 11955 | 12024 | Defines a schema-backed yieldable error class with an automatically populated `_tag` field. |
| Schema | overrideToFormatter | 12025 | 12038 | Attaches a custom formatter used by `toFormatter`. |
| Schema | toFormatter | 12039 | 12055 | Derives a string formatter function from a schema. |
| Schema | overrideToEquivalence | 12056 | 12069 | Overrides the equivalence derivation for a schema by supplying a custom `Equivalence`. |
| Schema | toEquivalence | 12070 | 12090 | Derives an `Equivalence` from a schema. |
| Schema | toRepresentation | 12091 | 12113 | Derives an intermediate `SchemaRepresentation.Document` from the encoded side of a schema. |
| Schema | ToJsonSchemaOptions | 12114 | 12199 | Options for reference allocation and JSON Schema generation in {@link toJsonSchemaDocument}. |
| Schema | toJsonSchemaDocument | 12200 | 12272 | Returns a JSON Schema document using draft 2020-12. |
| Schema | toCodecJson | 12273 | 12289 | Type-level representation returned by {@link toCodecJson}. |
| Schema | toCodecJson | 12290 | 12342 | Derives a canonical JSON codec from a schema. |
| Schema | toCodecIso | 12343 | 12381 | Derives an isomorphism codec from a schema. |
| Schema | StringTree | 12382 | 12390 | A {@link Tree} of `string \| undefined` nodes. |
| Schema | toCodecStringTree | 12391 | 12407 | Type-level representation returned by {@link toCodecStringTree}. |
| Schema | toCodecStringTree | 12408 | 12452 | Converts a schema to the StringTree canonical codec, where every leaf value becomes a string while preserving the original structure. |
| Schema | toCodecArrayFromSingle | 12453 | 12468 | Type-level representation returned by {@link toCodecArrayFromSingle}. |
| Schema | toCodecArrayFromSingle | 12469 | 12509 | Allows array schemas to decode from either an array input or a single value input. |
| Schema | toCodecGoJson | 12510 | 12526 | Type-level representation returned by {@link toCodecGoJson}. |
| Schema | toCodecGoJson | 12527 | 12683 | Derives a JSON codec, like {@link toCodecJson}, that also accepts the `null` values Go's `encoding/json` writes for nil pointers, slices,... |
| Schema | toEncoderXml | 12684 | 12697 | Derives an XML encoder from a codec. |
| Schema | toIso | 12698 | 12719 | Derives an `Iso` optic from a schema that isomorphically converts between the schema's `Type` and its `Iso` (intermediate / serialized fo... |
| Schema | toIsoSource | 12720 | 12727 | Returns an identity `Iso` over the schema's source (`Type`) side. |
| Schema | toIsoFocus | 12728 | 12735 | Returns an identity `Iso` over the schema's focus (`Iso`) side. |
| Schema | overrideToCodecIso | 12736 | 12752 | Type-level representation returned by {@link overrideToCodecIso}. |
| Schema | overrideToCodecIso | 12753 | 12774 | Overrides a schema's derived ISO codec with an explicit target codec. |
| Schema | toDifferJsonPatch | 12775 | 12797 | Derives a JSON Patch differ from a codec. |
| Schema | Tree | 12798 | 12806 | Recursive tree type whose leaves are `Node` values and whose branches are readonly arrays or string-keyed records of child trees. |
| Schema | TreeRecord | 12807 | 12817 | A record node in a {@link Tree}: an object mapping string keys to child `Tree` nodes. |
| Schema | Tree | 12818 | 12827 | Creates a recursive schema for a {@link Tree} of values described by `node`. |
| Schema | Json | 12828 | 12838 | Recursive TypeScript type for any valid immutable JSON value: `null`, `number`, `boolean`, `string`, a readonly array of `Json` values, o... |
| Schema | JsonArray | 12839 | 12847 | A readonly array of {@link Json} values. |
| Schema | JsonObject | 12848 | 12857 | A readonly record whose values are {@link Json} values. |
| Schema | Json | 12858 | 12873 | Schema that accepts and validates any immutable JSON-compatible value. |
| Schema | JsonObject | 12874 | 12895 | Schema for readonly string-keyed records whose values are JSON-compatible. |
| Schema | MutableJson | 12896 | 12904 | Recursive TypeScript type for mutable JSON values: `null`, `number`, `boolean`, `string`, mutable arrays, or mutable string-keyed records. |
| Schema | MutableJsonArray | 12905 | 12913 | A mutable array of {@link MutableJson} values. |
| Schema | MutableJsonObject | 12914 | 12923 | A mutable record whose values are {@link MutableJson} values. |
| Schema | MutableJson | 12924 | 12932 | Schema that accepts any mutable JSON-compatible value. |
| Schema | resolveAnnotations | 12933 | 12943 | Resolves the typed annotations from a schema. |
| Schema | resolveAnnotationsKey | 12944 | 12953 | Resolves the context (key-level) annotations from a schema. |
| Schema | Annotations | 12954 | 13428 | The `Annotations` namespace groups all annotation interfaces used to attach metadata to schemas. |
| SchemaAST | AST | 20 | 38 | Discriminated union of all AST node types. |
| SchemaAST | isAST | 39 | 52 | Returns `true` if the value is an {@link AST} node (any variant). |
| SchemaAST | isDeclaration | 53 | 67 | Narrows an {@link AST} to {@link Declaration}. |
| SchemaAST | isNull | 68 | 84 | Narrows an {@link AST} to {@link Null}. |
| SchemaAST | isUndefined | 85 | 99 | Narrows an {@link AST} to {@link Undefined}. |
| SchemaAST | isVoid | 100 | 114 | Narrows an {@link AST} to {@link Void}. |
| SchemaAST | isNever | 115 | 130 | Narrows an {@link AST} to {@link Never}. |
| SchemaAST | isUnknown | 131 | 145 | Narrows an {@link AST} to {@link Unknown}. |
| SchemaAST | isAny | 146 | 160 | Narrows an {@link AST} to {@link Any}. |
| SchemaAST | isString | 161 | 177 | Narrows an {@link AST} to {@link String}. |
| SchemaAST | isNumber | 178 | 190 | Narrows an {@link AST} to {@link Number}. |
| SchemaAST | isBoolean | 191 | 206 | Narrows an {@link AST} to {@link Boolean}. |
| SchemaAST | isBigInt | 207 | 221 | Narrows an {@link AST} to {@link BigInt}. |
| SchemaAST | isSymbol | 222 | 236 | Narrows an {@link AST} to {@link Symbol}. |
| SchemaAST | isLiteral | 237 | 251 | Narrows an {@link AST} to {@link Literal}. |
| SchemaAST | isUniqueSymbol | 252 | 259 | Narrows an {@link AST} to {@link UniqueSymbol}. |
| SchemaAST | isObjectKeyword | 260 | 276 | Narrows an {@link AST} to {@link ObjectKeyword}. |
| SchemaAST | isEnum | 277 | 291 | Narrows an {@link AST} to {@link Enum}. |
| SchemaAST | isTemplateLiteral | 292 | 299 | Narrows an {@link AST} to {@link TemplateLiteral}. |
| SchemaAST | isArrays | 300 | 314 | Narrows an {@link AST} to {@link Arrays}. |
| SchemaAST | isObjects | 315 | 322 | Narrows an {@link AST} to {@link Objects}. |
| SchemaAST | isUnion | 323 | 330 | Narrows an {@link AST} to {@link Union}. |
| SchemaAST | isSuspend | 331 | 338 | Narrows an {@link AST} to {@link Suspend}. |
| SchemaAST | Link | 339 | 362 | Represents a single step in an {@link Encoding} chain. |
| SchemaAST | Link | 363 | 370 | Constructs a {@link Link}. |
| SchemaAST | Encoding | 371 | 386 | A non-empty chain of {@link Link} values representing the transformation steps between a schema's decoded (type) form and its encoded (wi... |
| SchemaAST | ParseOptions | 387 | 504 | Options that control schema parsing, validation, transformation, and output behavior. |
| SchemaAST | Context | 505 | 533 | Represents per-property metadata attached to an AST node's `context` field. |
| SchemaAST | Context | 534 | 541 | Constructs a {@link Context}. |
| SchemaAST | Checks | 542 | 569 | Non-empty array of validation {@link Check} values attached to an AST node's `checks` field. |
| SchemaAST | Declaration | 570 | 601 | AST node for user-defined opaque types with custom parsing logic. |
| SchemaAST | Declaration | 602 | 609 | Constructs a {@link Declaration}. |
| SchemaAST | Null | 610 | 625 | AST node matching the `null` literal value. |
| SchemaAST | Null | 626 | 633 | Constructs a {@link Null}. |
| SchemaAST | null | 634 | 648 | Provides the singleton {@link Null} AST instance. |
| SchemaAST | Undefined | 649 | 664 | AST node matching the `undefined` value. |
| SchemaAST | Undefined | 665 | 672 | Constructs a {@link Undefined}. |
| SchemaAST | undefined | 673 | 687 | Provides the singleton {@link Undefined} AST instance. |
| SchemaAST | Void | 688 | 711 | AST node matching TypeScript `void` return-value semantics. |
| SchemaAST | Void | 712 | 719 | Constructs a {@link Void}. |
| SchemaAST | void | 720 | 743 | Provides the singleton {@link Void} AST instance. |
| SchemaAST | Never | 744 | 760 | AST node representing the `never` type — no value matches. |
| SchemaAST | Never | 761 | 768 | Constructs a {@link Never}. |
| SchemaAST | never | 769 | 784 | Provides the singleton {@link Never} AST instance. |
| SchemaAST | Any | 785 | 797 | AST node representing the `any` type — every value matches. |
| SchemaAST | Any | 798 | 805 | Constructs a {@link Any}. |
| SchemaAST | any | 806 | 820 | Provides the singleton {@link Any} AST instance. |
| SchemaAST | Unknown | 821 | 837 | AST node representing the `unknown` type — every value matches. |
| SchemaAST | Unknown | 838 | 845 | Constructs a {@link Unknown}. |
| SchemaAST | unknown | 846 | 860 | Provides the singleton {@link Unknown} AST instance. |
| SchemaAST | ObjectKeyword | 861 | 874 | AST node matching the TypeScript `object` type — accepts objects, arrays, and functions (anything non-primitive and non-null). |
| SchemaAST | ObjectKeyword | 875 | 882 | Constructs a {@link ObjectKeyword}. |
| SchemaAST | objectKeyword | 883 | 898 | Provides the singleton {@link ObjectKeyword} AST instance. |
| SchemaAST | Enum | 899 | 918 | AST node representing a TypeScript `enum`. |
| SchemaAST | Enum | 919 | 929 | Constructs a {@link Enum}. |
| SchemaAST | TemplateLiteral | 930 | 947 | AST node representing a TypeScript template literal type (e.g. |
| SchemaAST | TemplateLiteral | 948 | 960 | Constructs a {@link TemplateLiteral}. |
| SchemaAST | UniqueSymbol | 961 | 977 | AST node matching a specific `unique symbol` value. |
| SchemaAST | UniqueSymbol | 978 | 985 | Constructs a {@link UniqueSymbol}. |
| SchemaAST | LiteralValue | 986 | 995 | The set of primitive types that can appear as a {@link Literal} value. |
| SchemaAST | Literal | 996 | 1026 | AST node matching an exact primitive value (string, number, boolean, or bigint). |
| SchemaAST | Literal | 1027 | 1034 | Constructs a {@link Literal}. |
| SchemaAST | String | 1035 | 1047 | AST node matching any `string` value. |
| SchemaAST | String | 1048 | 1055 | Constructs a {@link String}. |
| SchemaAST | string | 1056 | 1070 | Provides the singleton {@link String} AST instance. |
| SchemaAST | Number | 1071 | 1093 | AST node matching any `number` value (including `NaN`, `Infinity`, `-Infinity`). |
| SchemaAST | Number | 1094 | 1101 | Constructs a {@link Number}. |
| SchemaAST | number | 1102 | 1117 | Provides the singleton {@link Number} AST instance. |
| SchemaAST | Boolean | 1118 | 1130 | AST node matching any `boolean` value (`true` or `false`). |
| SchemaAST | Boolean | 1131 | 1138 | Constructs a {@link Boolean}. |
| SchemaAST | boolean | 1139 | 1154 | Provides the singleton {@link Boolean} AST instance. |
| SchemaAST | Symbol | 1155 | 1176 | AST node matching any `symbol` value. |
| SchemaAST | Symbol | 1177 | 1184 | Constructs a {@link Symbol}. |
| SchemaAST | symbol | 1185 | 1204 | Provides the singleton {@link Symbol} AST instance. |
| SchemaAST | BigInt | 1205 | 1221 | AST node matching any `bigint` value. |
| SchemaAST | BigInt | 1222 | 1229 | Constructs a {@link BigInt}. |
| SchemaAST | bigInt | 1230 | 1245 | Provides the singleton {@link BigInt} AST instance. |
| SchemaAST | Arrays | 1246 | 1295 | AST node for array-like types — both tuples and arrays. |
| SchemaAST | Arrays | 1296 | 1303 | Constructs a {@link Arrays}. |
| SchemaAST | PropertySignature | 1304 | 1321 | Represents a named property within an {@link Objects} node. |
| SchemaAST | PropertySignature | 1322 | 1330 | Constructs a {@link PropertySignature}. |
| SchemaAST | IndexSignature | 1331 | 1361 | Represents an index signature entry within an {@link Objects} node. |
| SchemaAST | IndexSignature | 1362 | 1369 | Constructs a {@link IndexSignature}. |
| SchemaAST | Objects | 1370 | 1418 | AST node for object-like schemas, including structs and records. |
| SchemaAST | Objects | 1419 | 1426 | Constructs a {@link Objects}. |
| SchemaAST | Union | 1427 | 1463 | AST node representing a union of schemas. |
| SchemaAST | UnionOptions | 1464 | 1474 | Local matching options stored on {@link Union} nodes. |
| SchemaAST | Union | 1475 | 1482 | Constructs a {@link Union}. |
| SchemaAST | Suspend | 1483 | 1518 | AST node for lazy/recursive schemas. |
| SchemaAST | Suspend | 1519 | 1526 | Constructs a {@link Suspend}. |
| SchemaAST | Filter | 1527 | 1560 | Represents a single validation check attached to an AST node. |
| SchemaAST | Filter | 1561 | 1570 | Constructs a {@link Filter}. |
| SchemaAST | FilterGroup | 1571 | 1595 | Represents a composite validation check grouping multiple {@link Check} values. |
| SchemaAST | FilterGroup | 1596 | 1606 | Constructs a {@link FilterGroup}. |
| SchemaAST | Check | 1607 | 1621 | A validation check — either a single {@link Filter} or a composite {@link FilterGroup}. |
| SchemaAST | isPattern | 1622 | 1663 | Creates a {@link Filter} that validates strings by running `RegExp.test`. |
| SchemaAST | mapOrSame | 1664 | 1664 |  |
| SchemaAST | decodeTo | 1665 | 1683 | Attaches a `Transformation` to the `to` AST, making it decode from the `from` AST and encode back to it. |
| SchemaAST | isOptional | 1684 | 1698 | Returns `true` if the AST node represents an optional property. |
| SchemaAST | toType | 1699 | 1725 | Strips all encoding transformations from an AST, returning the decoded (type-level) representation. |
| SchemaAST | toEncoded | 1726 | 1753 | Returns the encoded (wire-format) AST by flipping and then stripping encodings. |
| SchemaAST | flip | 1754 | 1772 | Swaps the decode and encode directions of an AST's {@link Encoding} chain. |
| SchemaAST | resolve | 1773 | 1800 | Returns all annotations from the AST node. |
| SchemaAST | resolveAt | 1801 | 1814 | Returns a single annotation value by key from the AST node. |
| SchemaAST | resolveIdentifier | 1815 | 1829 | Returns the `identifier` annotation from the AST node, if set. |
| SchemaAST | resolveTitle | 1830 | 1841 | Returns the `title` annotation from the AST node, if set. |
| SchemaAST | resolveDescription | 1842 | 1854 | Returns the `description` annotation from the AST node, if set. |
| SchemaGetter | Passthrough | 8 | 17 | A transformation that returns its input unchanged. |
| SchemaGetter | Transform | 18 | 28 | A synchronous transformation of present values. |
| SchemaGetter | TransformOptional | 29 | 39 | A synchronous transformation of optional values. |
| SchemaGetter | TransformEffect | 40 | 50 | An effectful transformation of present values. |
| SchemaGetter | TransformOptionalEffect | 51 | 61 | An effectful transformation of optional values. |
| SchemaGetter | Getter | 62 | 100 | Represents a composable transformation from an encoded type `E` to a decoded type `T`. |
| SchemaGetter | run | 101 | 182 | Runs a getter directly. |
| SchemaGetter | compose | 183 | 279 | Composes two getters by passing the output of the first to the second. |
| SchemaGetter | map | 280 | 367 | Maps the output of a getter while preserving missing values. |
| SchemaGetter | succeed | 368 | 397 | Creates a getter that always produces the given constant value, ignoring the input. |
| SchemaGetter | fail | 398 | 433 | Creates a getter that always fails with the given issue. |
| SchemaGetter | forbidden | 434 | 468 | Creates a getter that always fails with a `Forbidden` issue. |
| SchemaGetter | forbiddenEncoding | 469 | 498 | Getter that always fails with a `Forbidden` issue indicating that encoding is unsupported. |
| SchemaGetter | passthrough | 499 | 539 | Returns the identity getter — passes the value through unchanged. |
| SchemaGetter | passthrough | 540 | 540 |  |
| SchemaGetter | passthroughSupertype | 541 | 570 | Returns the identity getter typed for the relationship `T extends E`. |
| SchemaGetter | passthroughSubtype | 571 | 600 | Returns the identity getter, typed for when the encoded type `E` is a subtype of `T`. |
| SchemaGetter | required | 601 | 633 | Creates a getter that fails with `MissingKey` if the input is absent (`Option.None`). |
| SchemaGetter | checkEffect | 634 | 672 | Creates a getter that validates a value using an effectful check function. |
| SchemaGetter | transform | 673 | 711 | Creates a getter that applies a pure function to present values. |
| SchemaGetter | transformEffect | 712 | 749 | Creates a getter that applies an effectful transformation to present values. |
| SchemaGetter | transformOptional | 750 | 781 | Creates a getter that transforms the full `Option` — both present and absent values. |
| SchemaGetter | transformOptionalEffect | 782 | 789 | Creates a getter that effectfully transforms the full `Option`. |
| SchemaGetter | omit | 790 | 819 | Creates a getter that always returns `None`, effectively omitting the value from output. |
| SchemaGetter | withDefault | 820 | 850 | Creates a getter that replaces `undefined` values with a default. |
| SchemaGetter | String | 851 | 878 | Coerces any value to a `string` using the global `String()` constructor. |
| SchemaGetter | Number | 879 | 907 | Coerces any value to a `number` using the global `Number()` constructor. |
| SchemaGetter | Boolean | 908 | 933 | Coerces any value to a `boolean` using the global `Boolean()` constructor. |
| SchemaGetter | BigInt | 934 | 961 | Coerces a value to `bigint` using the global `BigInt()` constructor. |
| SchemaGetter | Date | 962 | 991 | Coerces a value to a `Date` using `new Date(input)`. |
| SchemaGetter | trim | 992 | 1012 | Strips whitespace from both ends of a string. |
| SchemaGetter | capitalize | 1013 | 1033 | Capitalizes the first character of a string. |
| SchemaGetter | uncapitalize | 1034 | 1054 | Uncapitalizes the first character of a string. |
| SchemaGetter | snakeToCamel | 1055 | 1077 | Converts a `snake_case` string to `camelCase`. |
| SchemaGetter | camelToSnake | 1078 | 1100 | Converts a `camelCase` string to `snake_case`. |
| SchemaGetter | toLowerCase | 1101 | 1123 | Converts a string to lowercase. |
| SchemaGetter | toUpperCase | 1124 | 1149 | Converts a string to uppercase. |
| SchemaGetter | parseJson | 1150 | 1183 | Parses a JSON string into a value. |
| SchemaGetter | parseJson | 1184 | 1184 |  |
| SchemaGetter | JsonReplacer | 1185 | 1196 | Replacer function or property allowlist accepted by `JSON.stringify`. |
| SchemaGetter | stringifyJson | 1197 | 1229 | Stringifies a present value using `JSON.stringify`. |
| SchemaGetter | splitKeyValue | 1230 | 1270 | Parses a string into a record of key-value pairs. |
| SchemaGetter | joinKeyValue | 1271 | 1304 | Joins a record of key-value pairs into a delimited string. |
| SchemaGetter | split | 1305 | 1336 | Splits a string into an array of strings by a separator. |
| SchemaGetter | encodeBase64 | 1337 | 1362 | Encodes a `Uint8Array` or string to a Base64 string. |
| SchemaGetter | encodeBase64Url | 1363 | 1392 | Encodes a `Uint8Array` or string to a URL-safe Base64 string. |
| SchemaGetter | encodeHex | 1393 | 1417 | Encodes a `Uint8Array` or string to a hexadecimal string. |
| SchemaGetter | decodeBase64 | 1418 | 1442 | Decodes a Base64 string to a `Uint8Array`. |
| SchemaGetter | decodeBase64String | 1443 | 1467 | Decodes a Base64 string to a UTF-8 `string`. |
| SchemaGetter | decodeBase64Url | 1468 | 1492 | Decodes a URL-safe Base64 string to a `Uint8Array`. |
| SchemaGetter | decodeBase64UrlString | 1493 | 1517 | Decodes a URL-safe Base64 string to a UTF-8 `string`. |
| SchemaGetter | decodeHex | 1518 | 1542 | Decodes a hexadecimal string to a `Uint8Array`. |
| SchemaGetter | decodeHexString | 1543 | 1567 | Decodes a hexadecimal string to a UTF-8 `string`. |
| SchemaGetter | encodeUriComponent | 1568 | 1593 | Encodes a present string using `encodeURIComponent`. |
| SchemaGetter | decodeUriComponent | 1594 | 1617 | Decodes a URI component encoded string using `decodeURIComponent`. |
| SchemaGetter | dateTimeUtcFromInput | 1618 | 1653 | Parses a `DateTime.Input` value into a `DateTime.Utc`. |
| SchemaGetter | decodeFormData | 1654 | 1688 | Decodes a `FormData` object into a nested tree structure using bracket-path notation. |
| SchemaGetter | encodeFormData | 1689 | 1721 | Encodes a nested object into a `FormData` instance using bracket-path notation. |
| SchemaGetter | decodeURLSearchParams | 1722 | 1755 | Decodes a `URLSearchParams` object into a nested tree structure using bracket-path notation. |
| SchemaGetter | encodeURLSearchParams | 1756 | 1787 | Encodes a nested object into a `URLSearchParams` instance using bracket-path notation. |
| SchemaGetter | makeTreeRecord | 1788 | 1841 | Builds a nested tree object from a list of bracket-path entries. |
| SchemaGetter | collectBracketPathEntries | 1842 | 1884 | Flattens a nested object into bracket-path entries, filtering leaf values by a type guard. |
| SchemaIssue | isIssue | 6 | 35 | Returns `true` if the given value is an {@link Issue}. |
| SchemaIssue | hasInput | 36 | 68 | Returns `true` when an issue contains an input reported by the schema parser. |
| SchemaIssue | Leaf | 69 | 89 | Union of all terminal (leaf) issue types that have no inner `Issue` children. |
| SchemaIssue | Issue | 90 | 126 | The root discriminated union of all validation error nodes. |
| SchemaIssue | Filter | 127 | 178 | Represents a schema issue produced when a schema filter (refinement check) fails. |
| SchemaIssue | Filter | 179 | 203 | Constructs a schema issue for a failed refinement check. |
| SchemaIssue | Encoding | 204 | 234 | Represents a schema issue produced when a schema transformation (encode/decode step) fails. |
| SchemaIssue | Encoding | 235 | 242 | Constructs a schema issue for a failed transformation. |
| SchemaIssue | Pointer | 243 | 274 | Wraps an inner {@link Issue} with a property-key path, indicating *where* in a nested structure the error occurred. |
| SchemaIssue | Pointer | 275 | 282 | Constructs a schema issue that points to a nested location. |
| SchemaIssue | MissingKey | 283 | 307 | Represents a schema issue produced when a required key or tuple index is missing from the input. |
| SchemaIssue | MissingKey | 308 | 315 | Constructs a schema issue for a missing key or tuple index. |
| SchemaIssue | UnexpectedKey | 316 | 345 | Represents a schema issue produced when an input object or tuple contains a key/index not declared by the schema. |
| SchemaIssue | UnexpectedKey | 346 | 353 | Constructs a schema issue for an unexpected key or tuple index. |
| SchemaIssue | Composite | 354 | 384 | Represents a schema issue that groups multiple child issues under a single schema node. |
| SchemaIssue | Composite | 385 | 392 | Constructs a schema issue that groups multiple child issues. |
| SchemaIssue | InvalidType | 393 | 430 | Represents a schema issue produced when the runtime type of the input does not match the type expected by the schema. |
| SchemaIssue | InvalidType | 431 | 438 | Constructs a schema issue for an input with an invalid runtime type. |
| SchemaIssue | InvalidValue | 439 | 481 | Represents a schema issue produced when the input has the correct type but its value violates a constraint (e.g. |
| SchemaIssue | InvalidValue | 482 | 489 | Constructs a schema issue for a value that violates a constraint. |
| SchemaIssue | Forbidden | 490 | 528 | Represents a schema issue produced when a forbidden operation is encountered during parsing, such as an asynchronous Effect running insid... |
| SchemaIssue | Forbidden | 529 | 536 | Constructs a schema issue for a forbidden parsing operation. |
| SchemaIssue | AnyOf | 537 | 573 | Represents a schema issue produced when a value does not match *any* member of a union schema. |
| SchemaIssue | AnyOf | 574 | 581 | Constructs a schema issue for a value that matches no union member. |
| SchemaIssue | OneOf | 582 | 616 | Represents a schema issue produced when a value matches *multiple* members of a union that is configured to allow exactly one match (oneO... |
| SchemaIssue | OneOf | 617 | 624 | Constructs a schema issue for a value that matches multiple union members. |
| SchemaIssue | Formatter | 625 | 638 | A function type that converts an {@link Issue} into a formatted representation. |
| SchemaIssue | LeafHook | 639 | 654 | Callback type used to format {@link Leaf} issues into strings. |
| SchemaIssue | defaultLeafHook | 655 | 696 | Returns the built-in {@link LeafHook} used by default formatters. |
| SchemaIssue | CheckHook | 697 | 717 | Callback type used to format {@link Filter} issues into strings. |
| SchemaIssue | defaultCheckHook | 718 | 740 | Returns the built-in {@link CheckHook} used by default formatters. |
| SchemaIssue | makeFormatterStandardSchemaV1 | 741 | 787 | Creates a {@link Formatter} that produces a `StandardSchemaV1.FailureResult`. |
| SchemaIssue | makeFormatterDefault | 788 | 830 | Creates a {@link Formatter} that converts an {@link Issue} into a human-readable multi-line string. |
| SchemaParser | makeEffect | 8 | 26 | Creates an effectful maker for the schema's decoded type side. |
| SchemaParser | makeOption | 27 | 46 | Creates a synchronous maker that returns `Option.some` with the constructed value on success, or `Option.none` when construction fails wi... |
| SchemaParser | make | 47 | 73 | Creates a synchronous maker for the schema's decoded type side. |
| SchemaParser | is | 74 | 98 | Creates a type guard that checks whether an input satisfies the schema's decoded type side. |
| SchemaParser | asserts | 99 | 126 | Asserts that an input satisfies the schema's decoded type side. |
| SchemaParser | decodeUnknownEffect | 127 | 149 | Creates an effectful decoder for `unknown` input. |
| SchemaParser | decodeEffect | 150 | 173 | Creates an effectful decoder for input already typed as the schema's `Encoded` type. |
| SchemaParser | decodeUnknownPromise | 174 | 202 | Creates a Promise-based decoder for `unknown` input. |
| SchemaParser | decodePromise | 203 | 232 | Creates a Promise-based decoder for input already typed as the schema's `Encoded` type. |
| SchemaParser | decodeUnknownExit | 233 | 263 | Creates a synchronous decoder for `unknown` input that reports failure safely as an `Exit`. |
| SchemaParser | decodeExit | 264 | 291 | Creates a synchronous decoder for input already typed as the schema's `Encoded` type, reporting failure safely as an `Exit`. |
| SchemaParser | decodeUnknownResult | 292 | 319 | Creates a decoder for `unknown` input that reports failure safely as a `Result`. |
| SchemaParser | decodeResult | 320 | 347 | Creates a decoder for input already typed as the schema's `Encoded` type, reporting failure safely as a `Result`. |
| SchemaParser | decodeUnknownSync | 348 | 378 | Creates a synchronous decoder for `unknown` input. |
| SchemaParser | decodeSync | 379 | 410 | Creates a synchronous decoder for input already typed as the schema's `Encoded` type. |
| SchemaParser | encodeUnknownEffect | 411 | 433 | Creates an effectful encoder for `unknown` input. |
| SchemaParser | encodeEffect | 434 | 456 | Creates an effectful encoder for input already typed as the schema's decoded `Type`. |
| SchemaParser | encodeUnknownPromise | 457 | 485 | Creates a Promise-based encoder for `unknown` input. |
| SchemaParser | encodePromise | 486 | 515 | Creates a Promise-based encoder for input already typed as the schema's decoded `Type`. |
| SchemaParser | encodeUnknownExit | 516 | 543 | Creates a synchronous encoder for `unknown` input that reports failure safely as an `Exit`. |
| SchemaParser | encodeExit | 544 | 571 | Creates a synchronous encoder for input already typed as the schema's decoded `Type`, reporting failure safely as an `Exit`. |
| SchemaParser | encodeUnknownResult | 572 | 601 | Creates an encoder for `unknown` input that reports failure safely as a `Result`. |
| SchemaParser | encodeResult | 602 | 629 | Creates an encoder for input already typed as the schema's decoded `Type`, reporting failure safely as a `Result`. |
| SchemaParser | encodeUnknownSync | 630 | 659 | Creates a synchronous encoder for `unknown` input. |
| SchemaParser | encodeSync | 660 | 692 | Creates a synchronous encoder for input already typed as the schema's decoded `Type`. |
| SchemaRepresentation | RepresentationAnnotation | 4 | 14 | Open persistence identity carried by declarations and opaque checks. |
| SchemaRepresentation | CheckRepresentationAnnotation | 15 | 24 | Open persistence identity and schema dependencies carried by opaque checks. |
| SchemaRepresentation | ToJsonSchema | 25 | 106 | Input and output contracts for JSON Schema compiler annotations. |
| SchemaRepresentation | Generation | 107 | 167 | Input and output contracts for code generation annotations. |
| SchemaRepresentation | Declaration | 168 | 181 | A custom opaque declaration. |
| SchemaRepresentation | Suspend | 182 | 194 | A lazily resolved representation. |
| SchemaRepresentation | Reference | 195 | 210 | A named reference. |
| SchemaRepresentation | Null | 211 | 219 | The null keyword representation. |
| SchemaRepresentation | Undefined | 220 | 228 | The undefined keyword representation. |
| SchemaRepresentation | Void | 229 | 237 | The void keyword representation. |
| SchemaRepresentation | Never | 238 | 246 | The never keyword representation. |
| SchemaRepresentation | Unknown | 247 | 255 | The unknown keyword representation. |
| SchemaRepresentation | Any | 256 | 264 | The any keyword representation. |
| SchemaRepresentation | String | 265 | 278 | A string representation, optionally describing its content through a media type and a schema for the value encoded in the string. |
| SchemaRepresentation | Number | 279 | 287 | A number representation. |
| SchemaRepresentation | Boolean | 288 | 296 | A boolean representation. |
| SchemaRepresentation | BigInt | 297 | 305 | A bigint representation. |
| SchemaRepresentation | Symbol | 306 | 314 | A symbol representation. |
| SchemaRepresentation | Literal | 315 | 329 | A literal representation. |
| SchemaRepresentation | UniqueSymbol | 330 | 344 | A unique symbol representation. |
| SchemaRepresentation | ObjectKeyword | 345 | 353 | The object keyword representation. |
| SchemaRepresentation | Enum | 354 | 368 | An enum representation. |
| SchemaRepresentation | TemplateLiteral | 369 | 378 | A template literal representation. |
| SchemaRepresentation | Element | 379 | 390 | A tuple element. |
| SchemaRepresentation | Arrays | 391 | 401 | An array or tuple representation. |
| SchemaRepresentation | PropertySignature | 402 | 425 | A property signature. |
| SchemaRepresentation | IndexSignature | 426 | 436 | An index signature. |
| SchemaRepresentation | Objects | 437 | 447 | An object representation. |
| SchemaRepresentation | Union | 448 | 458 | A union representation. |
| SchemaRepresentation | Representation | 459 | 466 | The structural schema representation. |
| SchemaRepresentation | Check | 467 | 474 | A structural check. |
| SchemaRepresentation | Filter | 475 | 487 | An opaque leaf check. |
| SchemaRepresentation | FilterGroup | 488 | 500 | A non-empty group of checks. |
| SchemaRepresentation | References | 501 | 510 | Named representation definitions. |
| SchemaRepresentation | Document | 511 | 521 | A single representation and its definitions. |
| SchemaRepresentation | MultiDocument | 522 | 532 | Multiple representations sharing definitions. |
| SchemaRepresentation | DeclarationReviver | 533 | 548 | Reviver for a declaration. |
| SchemaRepresentation | FilterReviver | 549 | 564 | Reviver for a leaf check. |
| SchemaRepresentation | FilterGroupReviver | 565 | 580 | Reviver for a check group. |
| SchemaRepresentation | CheckReviver | 581 | 588 | A check reviver. |
| SchemaRepresentation | Reviver | 589 | 596 | A typed reviver. |
| SchemaRepresentation | AnyReviver | 597 | 604 | A reviver erased only at collection boundaries. |
| SchemaRepresentation | makeReviverDeclaration | 605 | 612 | Creates a declaration reviver while inferring its payload type from `payloadSchema`. |
| SchemaRepresentation | makeReviverFilter | 613 | 620 | Creates a filter reviver while inferring its payload type from `payloadSchema`. |
| SchemaRepresentation | makeReviverFilterGroup | 621 | 640 | Creates a filter group reviver while inferring its payload type from `payloadSchema`. |
| SchemaRepresentation | isTrimmedReviver | 641 | 654 | Reviver for persisted `isTrimmed` checks. |
| SchemaRepresentation | isPatternReviver | 655 | 671 | Reviver for persisted `isPattern` checks. |
| SchemaRepresentation | isStringFiniteReviver | 672 | 685 | Reviver for persisted `isStringFinite` checks. |
| SchemaRepresentation | isStringBigIntReviver | 686 | 699 | Reviver for persisted `isStringBigInt` checks. |
| SchemaRepresentation | isStringSymbolReviver | 700 | 713 | Reviver for persisted `isStringSymbol` checks. |
| SchemaRepresentation | isUUIDReviver | 714 | 729 | Reviver for persisted `isUUID` checks. |
| SchemaRepresentation | isGUIDReviver | 730 | 743 | Reviver for persisted `isGUID` checks. |
| SchemaRepresentation | isULIDReviver | 744 | 757 | Reviver for persisted `isULID` checks. |
| SchemaRepresentation | isAsciiReviver | 758 | 771 | Reviver for persisted `isAscii` checks. |
| SchemaRepresentation | isBase64Reviver | 772 | 785 | Reviver for persisted `isBase64` checks. |
| SchemaRepresentation | isBase64UrlReviver | 786 | 799 | Reviver for persisted `isBase64Url` checks. |
| SchemaRepresentation | isStartingWithReviver | 800 | 815 | Reviver for persisted `isStartingWith` checks. |
| SchemaRepresentation | isEndingWithReviver | 816 | 831 | Reviver for persisted `isEndingWith` checks. |
| SchemaRepresentation | isIncludingReviver | 832 | 847 | Reviver for persisted `isIncluding` checks. |
| SchemaRepresentation | isUppercasedReviver | 848 | 861 | Reviver for persisted `isUppercased` checks. |
| SchemaRepresentation | isLowercasedReviver | 862 | 875 | Reviver for persisted `isLowercased` checks. |
| SchemaRepresentation | isCapitalizedReviver | 876 | 889 | Reviver for persisted `isCapitalized` checks. |
| SchemaRepresentation | isUncapitalizedReviver | 890 | 903 | Reviver for persisted `isUncapitalized` checks. |
| SchemaRepresentation | isFiniteReviver | 904 | 917 | Reviver for persisted `isFinite` checks. |
| SchemaRepresentation | isGreaterThanReviver | 918 | 933 | Reviver for persisted `isGreaterThan` checks. |
| SchemaRepresentation | isGreaterThanOrEqualToReviver | 934 | 949 | Reviver for persisted `isGreaterThanOrEqualTo` checks. |
| SchemaRepresentation | isLessThanReviver | 950 | 965 | Reviver for persisted `isLessThan` checks. |
| SchemaRepresentation | isLessThanOrEqualToReviver | 966 | 981 | Reviver for persisted `isLessThanOrEqualTo` checks. |
| SchemaRepresentation | isBetweenReviver | 982 | 1000 | Reviver for persisted `isBetween` checks. |
| SchemaRepresentation | isMultipleOfReviver | 1001 | 1016 | Reviver for persisted `isMultipleOf` checks. |
| SchemaRepresentation | isIntReviver | 1017 | 1030 | Reviver for persisted `isInt` checks. |
| SchemaRepresentation | isMinLengthReviver | 1031 | 1046 | Reviver for persisted `isMinLength` checks. |
| SchemaRepresentation | isMaxLengthReviver | 1047 | 1062 | Reviver for persisted `isMaxLength` checks. |
| SchemaRepresentation | isBetweenLengthReviver | 1063 | 1079 | Reviver for persisted `isBetweenLength` checks. |
| SchemaRepresentation | isMinCodePointsReviver | 1080 | 1090 | Reviver for persisted `isMinCodePoints` checks. |
| SchemaRepresentation | isMaxCodePointsReviver | 1091 | 1101 | Reviver for persisted `isMaxCodePoints` checks. |
| SchemaRepresentation | isBetweenCodePointsReviver | 1102 | 1113 | Reviver for persisted `isBetweenCodePoints` checks. |
| SchemaRepresentation | isMinSizeReviver | 1114 | 1129 | Reviver for persisted `isMinSize` checks. |
| SchemaRepresentation | isMaxSizeReviver | 1130 | 1145 | Reviver for persisted `isMaxSize` checks. |
| SchemaRepresentation | isBetweenSizeReviver | 1146 | 1162 | Reviver for persisted `isBetweenSize` checks. |
| SchemaRepresentation | isMinPropertiesReviver | 1163 | 1178 | Reviver for persisted `isMinProperties` checks. |
| SchemaRepresentation | isMaxPropertiesReviver | 1179 | 1194 | Reviver for persisted `isMaxProperties` checks. |
| SchemaRepresentation | isBetweenPropertiesReviver | 1195 | 1211 | Reviver for persisted `isBetweenProperties` checks. |
| SchemaRepresentation | isPropertyNamesReviver | 1212 | 1225 | Reviver for persisted `isPropertyNames` checks. |
| SchemaRepresentation | isUniqueReviver | 1226 | 1239 | Reviver for persisted `isUnique` checks. |
| SchemaRepresentation | isUniqueKeyReviver | 1240 | 1252 | Reviver for persisted `isUniqueKey` checks. |
| SchemaRepresentation | OptionReviver | 1253 | 1266 | Reviver for persisted `Option` declarations. |
| SchemaRepresentation | ResultReviver | 1267 | 1280 | Reviver for persisted {@link Schema.Result} declarations. |
| SchemaRepresentation | RedactedReviver | 1281 | 1294 | Reviver for persisted {@link Schema.Redacted} declarations. |
| SchemaRepresentation | CauseReasonReviver | 1295 | 1308 | Reviver for persisted `CauseReason` declarations. |
| SchemaRepresentation | CauseReviver | 1309 | 1322 | Reviver for persisted `Cause` declarations. |
| SchemaRepresentation | ErrorInstanceReviver | 1323 | 1336 | Reviver for persisted {@link Schema.ErrorInstance} declarations. |
| SchemaRepresentation | ExitReviver | 1337 | 1350 | Reviver for persisted `Exit` declarations. |
| SchemaRepresentation | ReadonlyMapReviver | 1351 | 1364 | Reviver for persisted {@link Schema.ReadonlyMap} declarations. |
| SchemaRepresentation | GraphReviver | 1365 | 1372 | Reviver for persisted {@link Schema.Graph} declarations. |
| SchemaRepresentation | HashMapReviver | 1373 | 1386 | Reviver for persisted `HashMap` declarations. |
| SchemaRepresentation | ReadonlySetReviver | 1387 | 1400 | Reviver for persisted {@link Schema.ReadonlySet} declarations. |
| SchemaRepresentation | HashSetReviver | 1401 | 1414 | Reviver for persisted `HashSet` declarations. |
| SchemaRepresentation | ChunkReviver | 1415 | 1428 | Reviver for persisted {@link Schema.Chunk} declarations. |
| SchemaRepresentation | RegExpReviver | 1429 | 1442 | Reviver for persisted `RegExp` declarations. |
| SchemaRepresentation | URLReviver | 1443 | 1456 | Reviver for persisted `URL` declarations. |
| SchemaRepresentation | DateReviver | 1457 | 1470 | Reviver for persisted `Date` declarations. |
| SchemaRepresentation | DurationReviver | 1471 | 1484 | Reviver for persisted {@link Schema.Duration} declarations. |
| SchemaRepresentation | ByteSizeReviver | 1485 | 1492 | Reviver for persisted {@link Schema.ByteSize} declarations. |
| SchemaRepresentation | BigDecimalReviver | 1493 | 1506 | Reviver for persisted {@link Schema.BigDecimal} declarations. |
| SchemaRepresentation | SemVerReviver | 1507 | 1515 | Reviver for persisted {@link Schema.SemVer} declarations. |
| SchemaRepresentation | SemVerRangeReviver | 1516 | 1524 | Reviver for persisted {@link Schema.SemVerRange} declarations. |
| SchemaRepresentation | FileReviver | 1525 | 1538 | Reviver for persisted `File` declarations. |
| SchemaRepresentation | FormDataReviver | 1539 | 1552 | Reviver for persisted `FormData` declarations. |
| SchemaRepresentation | URLSearchParamsReviver | 1553 | 1566 | Reviver for persisted `URLSearchParams` declarations. |
| SchemaRepresentation | Uint8ArrayReviver | 1567 | 1580 | Reviver for persisted `Uint8Array` declarations. |
| SchemaRepresentation | DateTimeUtcReviver | 1581 | 1594 | Reviver for persisted {@link Schema.DateTimeUtc} declarations. |
| SchemaRepresentation | TimeZoneOffsetReviver | 1595 | 1608 | Reviver for persisted {@link Schema.TimeZoneOffset} declarations. |
| SchemaRepresentation | TimeZoneNamedReviver | 1609 | 1622 | Reviver for persisted {@link Schema.TimeZoneNamed} declarations. |
| SchemaRepresentation | TimeZoneReviver | 1623 | 1636 | Reviver for persisted {@link Schema.TimeZone} declarations. |
| SchemaRepresentation | DateTimeZonedReviver | 1637 | 1650 | Reviver for persisted {@link Schema.DateTimeZoned} declarations. |
| SchemaRepresentation | isGreaterThanDateReviver | 1651 | 1666 | Reviver for persisted `isGreaterThanDate` checks. |
| SchemaRepresentation | isGreaterThanOrEqualToDateReviver | 1667 | 1682 | Reviver for persisted `isGreaterThanOrEqualToDate` checks. |
| SchemaRepresentation | isLessThanDateReviver | 1683 | 1698 | Reviver for persisted `isLessThanDate` checks. |
| SchemaRepresentation | isLessThanOrEqualToDateReviver | 1699 | 1714 | Reviver for persisted `isLessThanOrEqualToDate` checks. |
| SchemaRepresentation | isBetweenDateReviver | 1715 | 1733 | Reviver for persisted `isBetweenDate` checks. |
| SchemaRepresentation | isGreaterThanBigIntReviver | 1734 | 1749 | Reviver for persisted `isGreaterThanBigInt` checks. |
| SchemaRepresentation | isGreaterThanOrEqualToBigIntReviver | 1750 | 1765 | Reviver for persisted `isGreaterThanOrEqualToBigInt` checks. |
| SchemaRepresentation | isLessThanBigIntReviver | 1766 | 1781 | Reviver for persisted `isLessThanBigInt` checks. |
| SchemaRepresentation | isLessThanOrEqualToBigIntReviver | 1782 | 1797 | Reviver for persisted `isLessThanOrEqualToBigInt` checks. |
| SchemaRepresentation | isBetweenBigIntReviver | 1798 | 1816 | Reviver for persisted `isBetweenBigInt` checks. |
| SchemaRepresentation | JsonReviver | 1817 | 1830 | Reviver for persisted `Json` declarations. |
| SchemaRepresentation | MutableJsonReviver | 1831 | 1844 | Reviver for persisted `MutableJson` declarations. |
| SchemaRepresentation | FromJsonSchemaOptions | 1845 | 1922 | Options for importing JSON Schema Draft 2020-12 documents. |
| SchemaRepresentation | Code | 1923 | 1933 | Runtime and TypeScript source generated for one schema. |
| SchemaRepresentation | makeCode | 1934 | 1941 | Creates generated runtime and TypeScript source strings for a schema. |
| SchemaRepresentation | Artifact | 1942 | 1960 | Auxiliary source artifact emitted while generating schema code. |
| SchemaRepresentation | CodeDocument | 1961 | 1978 | Generated schema code together with named references and auxiliary artifacts. |
| SchemaRepresentation | ReferencePolicyInput | 1979 | 1993 | Information supplied to a reference policy for one representation candidate. |
| SchemaRepresentation | ReferencePolicy | 1994 | 2020 | Function that chooses whether a representation candidate is emitted as a named reference. |
| SchemaRepresentation | ToRepresentationOptions | 2021 | 2044 | Options for generating schema representations. |
| SchemaRepresentation | toRepresentation | 2045 | 2065 | Lowers the encoded side of an AST to a live representation document. |
| SchemaRepresentation | toRepresentations | 2066 | 2084 | Lowers one or more AST encoded sides in a shared reference environment. |
| SchemaRepresentation | toMultiDocument | 2085 | 2096 | Wraps a single representation document as a multi-document with one root. |
| SchemaRepresentation | toJsonSchemaDocument | 2097 | 2141 | Compiles a live representation document to JSON Schema Draft 2020-12. |
| SchemaRepresentation | toJsonSchemaMultiDocument | 2142 | 2171 | Compiles multiple live representations to a shared JSON Schema Draft 2020-12 document. |
| SchemaRepresentation | toCodeDocument | 2172 | 2187 | Generates TypeScript source for live schema representations and their definitions. |
| SchemaRepresentation | toJson | 2188 | 2206 | Projects a live single-root representation document and encodes it as JSON. |
| SchemaRepresentation | toJsonMultiDocument | 2207 | 2225 | Projects a live multi-root representation document and encodes it as JSON. |
| SchemaRepresentation | fromJson | 2226 | 2245 | Decodes a persisted single-root representation document from JSON. |
| SchemaRepresentation | fromJsonMultiDocument | 2246 | 2265 | Decodes a persisted multi-root representation document from JSON. |
| SchemaRepresentation | fromRepresentation | 2266 | 2300 | Reconstructs a runtime schema from a representation document. |
| SchemaRepresentation | fromRepresentations | 2301 | 2321 | Reconstructs multiple runtime schemas from a representation multi-document. |
| SchemaRepresentation | fromJsonSchemaDocument | 2322 | 2380 | Imports a JSON Schema Draft 2020-12 document as a runtime schema. |
| SchemaRepresentation | fromJsonSchemaMultiDocument | 2381 | 2423 | Imports multiple JSON Schema Draft 2020-12 roots as runtime schemas with shared definitions. |
| SchemaTransformation | Middleware | 25 | 76 | Middleware that wraps the entire parsing `Effect` pipeline for both decode and encode directions. |
| SchemaTransformation | Middleware | 77 | 85 | Constructs schema middleware from its decode and encode functions. |
| SchemaTransformation | Transformation | 86 | 136 | Represents a bidirectional transformation between a decoded type `T` and an encoded type `E`, built from a pair of `Getter`s. |
| SchemaTransformation | Transformation | 137 | 144 | Constructs a bidirectional schema transformation from its decode and encode getters. |
| SchemaTransformation | composeTransformation | 145 | 244 | Composes two schema transformations into a single bidirectional conversion. |
| SchemaTransformation | isTransformation | 245 | 274 | Returns `true` if `u` is a `Transformation` instance. |
| SchemaTransformation | makeTransformation | 275 | 312 | Constructs a `Transformation` from an object with `decode` and `encode` `Getter`s. |
| SchemaTransformation | transformEffect | 313 | 360 | Creates a `Transformation` from effectful decode and encode functions. |
| SchemaTransformation | transform | 361 | 404 | Creates a `Transformation` from pure (sync, infallible) decode and encode functions. |
| SchemaTransformation | transformOptional | 405 | 452 | Creates a `Transformation` where decode and encode operate on `Option` values, giving full control over missing-key handling. |
| SchemaTransformation | trim | 453 | 487 | Transforms strings by trimming whitespace on decode. |
| SchemaTransformation | snakeToCamel | 488 | 524 | Transforms strings by converting snake_case to camelCase on decode and camelCase to snake_case on encode. |
| SchemaTransformation | toLowerCase | 525 | 557 | Transforms strings by lowercasing on decode. |
| SchemaTransformation | toUpperCase | 558 | 590 | Transforms strings by uppercasing on decode. |
| SchemaTransformation | capitalize | 591 | 623 | Transforms strings by capitalizing the first character on decode. |
| SchemaTransformation | uncapitalize | 624 | 656 | Transforms strings by lowercasing the first character on decode. |
| SchemaTransformation | splitKeyValue | 657 | 702 | Transforms a string into a record of key-value pairs and encodes a record of key-value pairs into a string. |
| SchemaTransformation | passthrough | 703 | 740 | Transforms values by returning the input unchanged in both directions. |
| SchemaTransformation | passthrough | 741 | 741 |  |
| SchemaTransformation | passthroughSupertype | 742 | 772 | Transforms values without changing them, typed so that `T extends E`, where the decoded type `T` is a subtype of the encoded type `E`. |
| SchemaTransformation | passthroughSubtype | 773 | 803 | Transforms values without changing them, typed so that `E extends T` — the encoded type is a subtype of the decoded type. |
| SchemaTransformation | numberFromString | 804 | 838 | Decodes a `string` into a `number` and encodes a `number` back to a `string`. |
| SchemaTransformation | bigintFromString | 839 | 872 | Decodes a `string` into a `bigint` and encodes a `bigint` back to a `string`. |
| SchemaTransformation | dateFromString | 873 | 905 | Decodes a `string` into a `Date` and encodes a `Date` back to a `string`. |
| SchemaTransformation | dateFromMillis | 906 | 943 | Decodes epoch milliseconds into a `Date` and encodes a `Date` back to epoch milliseconds. |
| SchemaTransformation | durationFromString | 944 | 978 | Decodes a `string` into a `Duration` and encodes a `Duration` back to a parseable `string`. |
| SchemaTransformation | durationFromNanos | 979 | 1011 | Decodes a `bigint` (nanoseconds) into a `Duration` and encodes a `Duration` back to `bigint` nanoseconds. |
| SchemaTransformation | durationFromMillis | 1012 | 1043 | Decodes a `number` of milliseconds into a `Duration` and encodes a `Duration` back to milliseconds. |
| SchemaTransformation | byteSizeFromString | 1044 | 1051 | Decodes a string into a `ByteSize` and encodes it as an exact string. |
| SchemaTransformation | byteSizeFromBigInt | 1052 | 1059 | Decodes a non-negative bigint byte count into a `ByteSize`. |
| SchemaTransformation | byteSizeFromNumber | 1060 | 1067 | Decodes a non-negative safe-integer byte count into a `ByteSize`. |
| SchemaTransformation | optionFromNullOr | 1068 | 1103 | Decodes `T \| null` into `Option<T>` and encodes `Option<T>` back to `T \| null`. |
| SchemaTransformation | optionFromUndefinedOr | 1104 | 1140 | Decodes `T \| undefined` into `Option<T>` and encodes `Option.none()` back to `undefined`. |
| SchemaTransformation | optionFromNullishOr | 1141 | 1181 | Decodes `T \| null \| undefined` into `Option<T>` and encodes `Option<T>` back to `T \| null` or `T \| undefined` depending on the provid... |
| SchemaTransformation | optionFromOptionalKey | 1182 | 1222 | Decodes an optional struct key into `Option<T>` and encodes `Option<T>` back to an optional key. |
| SchemaTransformation | optionFromOptional | 1223 | 1263 | Decodes optional values into `Option<T>` and encodes `Option.none()` back to an omitted optional value. |
| SchemaTransformation | urlFromString | 1264 | 1296 | Decodes a `string` into a `URL` and encodes a `URL` back to its `href` string. |
| SchemaTransformation | bigDecimalFromString | 1297 | 1316 | Decodes a `string` into a `BigDecimal` and encodes a `BigDecimal` back to its string representation. |
| SchemaTransformation | uint8ArrayFromBase64String | 1317 | 1349 | Decodes a Base64-encoded `string` into a `Uint8Array` and encodes a `Uint8Array` back to a Base64 string. |
| SchemaTransformation | stringFromBase64String | 1350 | 1382 | Decodes a Base64-encoded `string` into a UTF-8 `string` and encodes a UTF-8 `string` back to a Base64 string. |
| SchemaTransformation | stringFromBase64UrlString | 1383 | 1414 | Decodes a base64 (URL) encoded `string` into a UTF-8 `string` and encodes it back. |
| SchemaTransformation | stringFromHexString | 1415 | 1446 | Decodes a hex encoded `string` into a UTF-8 `string` and encodes it back. |
| SchemaTransformation | stringFromUriComponent | 1447 | 1480 | Decodes a URI component encoded string into a UTF-8 string and encodes a UTF-8 string into a URI component encoded string. |
| SchemaTransformation | fromJsonString | 1481 | 1520 | Decodes a JSON string with `JSON.parse` and encodes a value with `JSON.stringify`. |
| SchemaTransformation | fromFormData | 1521 | 1556 | Decodes a `FormData` instance into a nested record using bracket-path keys and encodes object-like values back into `FormData`. |
| SchemaTransformation | fromURLSearchParams | 1557 | 1590 | Decodes `URLSearchParams` into a nested record using bracket-path keys and encodes object-like values back into `URLSearchParams`. |
| SchemaTransformation | timeZoneOffsetFromNumber | 1591 | 1612 | Decodes a numeric time-zone offset in milliseconds into a `DateTime.TimeZone.Offset` and encodes it back to the offset number. |
| SchemaTransformation | timeZoneNamedFromString | 1613 | 1633 | Decodes an IANA time-zone identifier string into a `DateTime.TimeZone.Named` and encodes a named time zone back to its `id`. |
| SchemaTransformation | timeZoneFromString | 1634 | 1656 | Decodes a string into a `DateTime.TimeZone` and encodes a time zone back to its string representation. |
| SchemaTransformation | dateTimeUtcFromString | 1657 | 1679 | Decodes a date-time string into a `DateTime.Utc` and encodes it back to an ISO string. |
| SchemaTransformation | dateTimeZonedFromString | 1680 | 1703 | Decodes a zoned date-time string into a `DateTime.Zoned` and encodes it back to an ISO zoned string. |
| Scope | Scope | 18 | 48 | A `Scope` represents a context where resources can be acquired and automatically cleaned up when the scope is closed. |
| Scope | Closeable | 49 | 75 | A `Closeable` scope extends the base `Scope` interface with the ability to be closed, executing all registered finalizers. |
| Scope | State | 76 | 190 | Scope states: `Empty` has no finalizers, `Open` has at least one, and `Closed` holds the exit value. |
| Scope | Scope | 191 | 218 | Service tag for the active resource lifetime. |
| Scope | make | 219 | 243 | Creates a new `Scope` with the specified finalizer strategy. |
| Scope | makeUnsafe | 244 | 274 | Creates a new `Scope` synchronously without wrapping it in an `Effect`. |
| Scope | provide | 275 | 392 | Provides a concrete `Scope` to an effect. |
| Scope | addFinalizerExit | 393 | 427 | Registers an exit-aware finalizer on a scope. |
| Scope | addFinalizer | 428 | 460 | Registers a finalizer effect on a scope. |
| Scope | fork | 461 | 493 | Creates a closeable child scope registered with a parent scope. |
| Scope | forkUnsafe | 494 | 531 | Creates a closeable child scope synchronously and registers it with a parent scope. |
| Scope | close | 532 | 574 | Closes a scope and runs its registered finalizers. |
| Scope | closeUnsafe | 575 | 601 | Closes a scope unsafely with the provided exit value. |
| Scope | use | 602 | 673 | Runs an effect with the provided closeable scope in its context and closes that scope when the effect exits. |
| ScopedCache | ScopedCache | 12 | 42 | A scoped cache whose values are acquired by a lookup effect and stored in per-entry scopes. |
| ScopedCache | State | 43 | 65 | Represents whether a `ScopedCache` is open or closed. |
| ScopedCache | Entry | 66 | 92 | A single scoped cache entry. |
| ScopedCache | makeWith | 93 | 122 | Creates a `ScopedCache` from a lookup function, maximum capacity, and a time-to-live function computed from each lookup exit and key. |
| ScopedCache | make | 123 | 150 | Creates a `ScopedCache` with a fixed time-to-live for every lookup result. |
| ScopedCache | get | 151 | 226 | Gets the value for a key, running the cache lookup when no unexpired entry is present. |
| ScopedCache | getOption | 227 | 293 | Reads an existing unexpired cache entry without running the lookup function. |
| ScopedCache | getSuccess | 294 | 360 | Retrieves the value associated with the specified key from the cache, only if it contains a resolved successful value. |
| ScopedCache | set | 361 | 427 | Sets a successful value for a key without running the lookup function. |
| ScopedCache | has | 428 | 494 | Checks whether the cache contains an entry for the specified key. |
| ScopedCache | invalidate | 495 | 570 | Removes the entry associated with a key and closes its entry scope. |
| ScopedCache | invalidateWhen | 571 | 646 | Invalidates the entry associated with the specified key in the cache when the predicate returns true for the cached value. |
| ScopedCache | refresh | 647 | 710 | Forces a refresh of the value associated with the specified key in the cache. |
| ScopedCache | invalidateAll | 711 | 728 | Removes every entry from the cache and closes each entry scope. |
| ScopedCache | size | 729 | 746 | Retrieves the approximate number of entries in the cache. |
| ScopedCache | keys | 747 | 765 | Retrieves all active keys from the cache, automatically filtering out expired entries. |
| ScopedCache | values | 766 | 786 | Retrieves all successfully cached values from the cache, excluding failed lookups and expired entries. |
| ScopedCache | entries | 787 | 810 | Retrieves all key-value pairs from the cache as an array. |
| ScopedRef | ScopedRef | 19 | 39 | A `ScopedRef` is a reference whose value is associated with resources, which must be released properly. |
| ScopedRef | fromAcquire | 40 | 53 | Creates a new `ScopedRef` from an effect that acquires the initial value. |
| ScopedRef | getUnsafe | 54 | 68 | Retrieves the current value of the scoped reference synchronously. |
| ScopedRef | get | 69 | 83 | Retrieves the current value of the scoped reference effectfully. |
| ScopedRef | make | 84 | 110 | Creates a new `ScopedRef` from the specified value. |
| ScopedRef | set | 111 | 173 | Sets the value of this reference to a newly acquired scoped value, releasing any resources associated with the old value. |
| SemVer | SemVer | 10 | 47 | Represents a semantic version. |
| SemVer | SemVerError | 48 | 61 | Error raised for invalid version strings, ranges, or components. |
| SemVer | isSemVerError | 62 | 69 | Checks whether a value is a `SemVerError`. |
| SemVer | isSemVer | 70 | 77 | Checks whether a value is a `SemVer`. |
| SemVer | Components | 78 | 93 | The numeric components and identifiers of a version. |
| SemVer | VersionString | 94 | 109 | Version string literals accepted by `fromInput`. |
| SemVer | Input | 110 | 119 | Values accepted by `fromInput`: a version, a version string literal, or version components. |
| SemVer | make | 120 | 147 | Creates a version from its components and throws `SemVerError` for invalid components. |
| SemVer | parse | 148 | 177 | Parses a strict Semantic Versioning 2.0.0 string. |
| SemVer | parseUnsafe | 178 | 187 | Parses a strict Semantic Versioning 2.0.0 string and throws `SemVerError` for invalid input. |
| SemVer | fromInput | 188 | 212 | Converts a version, version string, or version components into a `SemVer`. |
| SemVer | fromInputUnsafe | 213 | 222 | Converts a version, version string, or version components into a `SemVer` and throws `SemVerError` for invalid input. |
| SemVer | format | 223 | 232 | Formats a version as its canonical string, including pre-release identifiers and build metadata. |
| SemVer | isPrerelease | 233 | 240 | Checks whether a version has pre-release identifiers. |
| SemVer | hasBuild | 241 | 253 | Checks whether a version has build metadata. |
| SemVer | isInitialDevelopment | 254 | 267 | Checks whether a version is in initial development, meaning its major version is `0`. |
| SemVer | Order | 268 | 299 | Orders versions by Semantic Versioning precedence. |
| SemVer | Equivalence | 300 | 308 | Provides structural equivalence for versions, including build metadata. |
| SemVer | equals | 309 | 336 | Checks whether two versions are structurally equal, including build metadata. |
| SemVer | isLessThan | 337 | 361 | Checks whether the first version has lower precedence than the second. |
| SemVer | isLessThanOrEqualTo | 362 | 389 | Checks whether the first version has lower or equal precedence than the second. |
| SemVer | isGreaterThan | 390 | 414 | Checks whether the first version has higher precedence than the second. |
| SemVer | isGreaterThanOrEqualTo | 415 | 442 | Checks whether the first version has higher or equal precedence than the second. |
| SemVer | between | 443 | 473 | Checks whether a version's precedence is within an inclusive range. |
| SemVer | min | 474 | 498 | Returns the version with lower precedence, preferring the first on ties. |
| SemVer | max | 499 | 523 | Returns the version with higher precedence, preferring the first on ties. |
| SemVer | clamp | 524 | 554 | Constrains a version's precedence to an inclusive range. |
| SemVer | withPrerelease | 555 | 597 | Replaces the pre-release identifiers of a version and throws `SemVerError` for invalid identifiers. |
| SemVer | withBuild | 598 | 640 | Replaces the build metadata of a version and throws `SemVerError` for invalid identifiers. |
| SemVer | release | 641 | 656 | Removes pre-release identifiers and build metadata from a version. |
| SemVer | bumpMajor | 657 | 680 | Returns the next major release. |
| SemVer | bumpMinor | 681 | 694 | Returns the next minor release. |
| SemVer | bumpPatch | 695 | 708 | Returns the next patch release. |
| SemVer | bumpPremajor | 709 | 748 | Returns the first pre-release of the next major version. |
| SemVer | bumpPreminor | 749 | 788 | Returns the first pre-release of the next minor version. |
| SemVer | bumpPrepatch | 789 | 828 | Returns the first pre-release of the next patch version. |
| SemVer | bumpPrerelease | 829 | 931 | Returns the next pre-release. |
| SemVer | ReleaseType | 932 | 940 | Names of version changes, matching npm's release types. |
| SemVer | bump | 941 | 1091 | Bumps a version by release type. |
| SemVer | difference | 1092 | 1196 | Classifies the change between two versions by release type. |
| SemVerRange | SemVerRange | 18 | 34 | Represents an npm-style version range. |
| SemVerRange | MatchOptions | 35 | 50 | Options controlling how pre-release versions match a range. |
| SemVerRange | isSemVerRange | 51 | 58 | Checks whether a value is a `SemVerRange`. |
| SemVerRange | parse | 59 | 99 | Parses an npm-style version range. |
| SemVerRange | parseUnsafe | 100 | 109 | Parses an npm-style version range and throws `SemVer.SemVerError` for invalid input. |
| SemVerRange | Input | 110 | 118 | Values accepted by `fromInput`: a range or a range string. |
| SemVerRange | fromInput | 119 | 132 | Converts a range or range string into a `SemVerRange`. |
| SemVerRange | fromInputUnsafe | 133 | 142 | Converts a range or range string into a `SemVerRange` and throws `SemVer.SemVerError` for invalid input. |
| SemVerRange | any | 143 | 154 | The range matching every release, written `*`. |
| SemVerRange | exact | 155 | 180 | Creates a range matching exactly one version, written `1.2.3`. |
| SemVerRange | greaterThan | 181 | 192 | Creates a range matching versions with higher precedence, written `>1.2.3`. |
| SemVerRange | greaterThanOrEqualTo | 193 | 204 | Creates a range matching versions with at least the given precedence, written `>=1.2.3`. |
| SemVerRange | lessThan | 205 | 216 | Creates a range matching versions with lower precedence, written `<1.2.3`. |
| SemVerRange | lessThanOrEqualTo | 217 | 228 | Creates a range matching versions with at most the given precedence, written `<=1.2.3`. |
| SemVerRange | caret | 229 | 242 | Creates a range matching versions compatible with a version, written `^1.2.3`. |
| SemVerRange | tilde | 243 | 255 | Creates a range matching patch-level changes of a version, written `~1.2.3`. |
| SemVerRange | between | 256 | 272 | Creates a range matching versions within inclusive bounds, written `>=1.2.3 <=2.0.0`. |
| SemVerRange | format | 273 | 287 | Formats a range in canonical form. |
| SemVerRange | matches | 288 | 435 | Checks whether a range matches a version. |
| SemVerRange | maxSatisfying | 436 | 511 | Returns the version with the highest precedence that a range matches. |
| SemVerRange | minSatisfying | 512 | 559 | Returns the version with the lowest precedence that a range matches. |
| Semaphore | Semaphore | 17 | 176 | A counting semaphore that coordinates concurrent access with permits. |
| Semaphore | makeUnsafe | 177 | 217 | Creates a `Semaphore` synchronously with the specified total number of permits. |
| Semaphore | make | 218 | 253 | Creates a `Semaphore` initialized with the specified total number of permits. |
| Semaphore | resize | 254 | 320 | Sets the total number of permits managed by the semaphore. |
| Semaphore | withPermits | 321 | 393 | Runs an effect with the given number of permits and releases the permits when the effect completes. |
| Semaphore | withPermit | 394 | 451 | Runs an effect with a single permit and releases the permit when the effect completes. |
| Semaphore | withPermitsIfAvailable | 452 | 521 | Runs an effect only if the specified number of permits are immediately available. |
| Semaphore | take | 522 | 591 | Acquires the specified number of permits and returns the acquired permit count. |
| Semaphore | takeScoped | 592 | 703 | Acquires the specified number of permits until the current scope closes. |
| Semaphore | takeIfAvailable | 704 | 776 | Acquires the specified number of permits only if they are immediately available. |
| Semaphore | release | 777 | 867 | Releases the specified number of permits and returns the resulting available permits. |
| Semaphore | releaseAll | 868 | 892 | Releases all permits held by this semaphore and returns the resulting available permits. |
| Sink | Sink | 34 | 63 | A `Sink<A, In, L, E, R>` is used to consume elements produced by a `Stream`. |
| Sink | End | 64 | 76 | Tuple returned when a `Sink` finishes. |
| Sink | SinkUnify | 77 | 95 | Type-level unification support for `Sink` values. |
| Sink | SinkUnifyIgnore | 96 | 111 | Marker used by Effect's `Unify` machinery for `Sink` values. |
| Sink | Sink | 112 | 153 | Namespace containing types and interfaces for Sink variance and type relationships. |
| Sink | isSink | 154 | 173 | Checks whether a value is a Sink. |
| Sink | fromChannel | 174 | 201 | Creates a sink from a `Channel`. |
| Sink | fromWritableStream | 202 | 232 | Creates a sink that writes its input to a Web `WritableStream`. |
| Sink | fromTransform | 233 | 246 | Creates a `Sink` from a low-level transform function. |
| Sink | toChannel | 247 | 266 | Creates a `Channel` from a Sink. |
| Sink | make | 267 | 280 | Creates a pipe-style constructor for sinks over input type `In`. |
| Sink | make | 281 | 313 | Companion namespace containing overload types for the pipe-style sink constructor returned by `Sink.make`. |
| Sink | fromEffectEnd | 314 | 327 | Creates a sink that ignores upstream input and completes from an effect that already returns an `End`. |
| Sink | fromEffect | 328 | 340 | Creates a sink that ignores upstream input and completes with the success value of the provided effect. |
| Sink | fromQueue | 341 | 353 | Creates a sink that offers every consumed input element to a queue. |
| Sink | fromPubSub | 354 | 365 | Creates a sink that publishes every consumed input element to a `PubSub`. |
| Sink | succeed | 366 | 386 | A sink that immediately ends with the specified value. |
| Sink | sync | 387 | 394 | A sink that immediately ends with the specified lazily evaluated value. |
| Sink | suspend | 395 | 402 | A sink that is created from a lazily evaluated sink. |
| Sink | fail | 403 | 423 | A sink that always fails with the specified error. |
| Sink | failSync | 424 | 444 | A sink that always fails with the specified lazily evaluated error. |
| Sink | failCause | 445 | 465 | Creates a sink halting with a specified `Cause`. |
| Sink | failCauseSync | 466 | 486 | Creates a sink halting with a specified lazily evaluated `Cause`. |
| Sink | die | 487 | 507 | Creates a sink halting with a specified defect. |
| Sink | never | 508 | 515 | A sink that never completes. |
| Sink | ignoreLeftover | 516 | 529 | Drops leftovers produced by a sink. |
| Sink | drain | 530 | 545 | Consumes and ignores all stream inputs. |
| Sink | fold | 546 | 569 | A sink that folds its inputs with the provided function, termination predicate and initial state. |
| Sink | foldArray | 570 | 591 | Folds non-empty input arrays into state with an effectful function. |
| Sink | foldUntil | 592 | 609 | Folds input elements into state until the specified maximum number of elements has been consumed or the upstream stream ends. |
| Sink | every | 610 | 624 | A sink that returns whether all elements satisfy the specified predicate. |
| Sink | some | 625 | 639 | A sink that returns whether an element satisfies the specified predicate. |
| Sink | map | 640 | 706 | Transforms this sink's result. |
| Sink | as | 707 | 752 | Sets the sink's result to a constant value. |
| Sink | mapInput | 753 | 777 | Transforms this sink's input elements. |
| Sink | mapInputEffect | 778 | 802 | Transforms this sink's input elements effectfully. |
| Sink | mapInputArray | 803 | 830 | Transforms each non-empty array of upstream input before it is fed to this sink. |
| Sink | mapInputArrayEffect | 831 | 858 | Transforms each non-empty array of upstream input effectfully before it is fed to this sink. |
| Sink | mapEnd | 859 | 895 | Transforms the full `End` produced by this sink. |
| Sink | mapEffectEnd | 896 | 935 | Transforms the full `End` produced by this sink effectfully. |
| Sink | mapEffect | 936 | 1002 | Transforms this sink's result effectfully. |
| Sink | mapError | 1003 | 1027 | Transforms the errors emitted by this sink using `f`. |
| Sink | mapLeftover | 1028 | 1052 | Transforms the leftovers emitted by this sink using `f`. |
| Sink | take | 1053 | 1067 | Collects up to `n` input elements into an array. |
| Sink | flatMap | 1068 | 1137 | Runs this sink until it yields a result, then uses that result to create another sink from the provided function which will continue to r... |
| Sink | reduceWhile | 1138 | 1146 | A sink that reduces input elements from the provided `initial` state with `f` while the specified `predicate` returns `true`. |
| Sink | reduceWhileEffect | 1147 | 1155 | A sink that effectfully reduces input elements from the provided `initial` state with `f` while the specified `predicate` returns `true`. |
| Sink | reduceWhileArray | 1156 | 1164 | A sink that reduces non-empty input arrays from the provided `initial` state with `f` while the specified `predicate` returns `true`. |
| Sink | reduceWhileArrayEffect | 1165 | 1173 | A sink that effectfully reduces non-empty input arrays from the provided `initial` state with `f` while the specified `predicate` returns... |
| Sink | reduce | 1174 | 1182 | A sink that reduces its inputs using the provided function `f` starting from the provided `initial` state. |
| Sink | reduceArray | 1183 | 1191 | A sink that reduces its inputs using the provided function `f` starting from the specified `initial` state. |
| Sink | reduceEffect | 1192 | 1200 | A sink that reduces its inputs using the provided effectful function `f` starting from the specified `initial` state. |
| Sink | head | 1201 | 1214 | Creates a sink containing the first value. |
| Sink | last | 1215 | 1239 | Creates a sink containing the last value. |
| Sink | find | 1240 | 1306 | Creates a sink containing the first value matched by a synchronous predicate. |
| Sink | findEffect | 1307 | 1327 | Creates a sink containing the first value matched by an effectful predicate. |
| Sink | sum | 1328 | 1335 | Creates a sink which sums up its inputs. |
| Sink | count | 1336 | 1347 | A sink that counts the number of elements fed to it. |
| Sink | collect | 1348 | 1361 | Accumulates incoming elements into an array. |
| Sink | takeWhile | 1362 | 1404 | Collects the longest input prefix whose elements satisfy the predicate or refinement. |
| Sink | takeWhileFilter | 1405 | 1419 | Applies a `Filter` to input elements while it succeeds, collecting each successful output. |
| Sink | takeWhileEffect | 1420 | 1448 | Collects input elements effectfully while the predicate succeeds. |
| Sink | takeWhileFilterEffect | 1449 | 1463 | Applies a `FilterEffect` to input elements effectfully while it succeeds, collecting each successful output. |
| Sink | takeUntil | 1464 | 1472 | Collects input elements until the predicate returns `true`, including the matching element in the result. |
| Sink | takeUntilEffect | 1473 | 1485 | Collects input elements effectfully until the predicate returns `true`, including the matching element in the result. |
| Sink | forEach | 1486 | 1508 | A sink that executes the provided effectful function for every item fed to it. |
| Sink | forEachArray | 1509 | 1531 | A sink that executes the provided effectful function for every Chunk fed to it. |
| Sink | forEachWhile | 1532 | 1544 | Runs an effectful function for each input element while it returns `true`. |
| Sink | forEachWhileArray | 1545 | 1558 | Runs an effectful function for each non-empty input array while it returns `true`. |
| Sink | unwrap | 1559 | 1584 | Creates a sink produced from a scoped effect. |
| Sink | summarized | 1585 | 1609 | Runs a summary effect when the sink starts and again when it completes. |
| Sink | withDuration | 1610 | 1617 | Returns the sink that executes this one and times its execution. |
| Sink | timed | 1618 | 1625 | A sink that drains all input and returns the elapsed duration. |
| Sink | provideContext | 1626 | 1665 | Provides a `Context` to this sink. |
| Sink | provideService | 1666 | 1705 | Provides a single service implementation to this sink. |
| Sink | orElse | 1706 | 1748 | Runs a fallback sink if this sink fails with a typed error. |
| Sink | catchCause | 1749 | 1815 | Handles failures from this sink by inspecting the full `Cause`. |
| Sink | catch | 1816 | 1836 | Handles typed errors from this sink with an effectful fallback value. |
| Sink | onExit | 1837 | 1876 | Runs an effect after this sink completes, fails, or is interrupted. |
| Sink | ensuring | 1877 | 1917 | Runs a finalizer effect after this sink completes, fails, or is interrupted. |
| StandardSchema | StandardTypedV1 | 10 | 13 |  |
| StandardSchema | StandardTypedV1 | 14 | 36 |  |
| StandardSchema | StandardSchemaV1 | 37 | 40 |  |
| StandardSchema | StandardSchemaV1 | 41 | 85 |  |
| StandardSchema | StandardJSONSchemaV1 | 86 | 89 |  |
| StandardSchema | StandardJSONSchemaV1 | 90 | 126 |  |
| Stdio | TypeId | 21 | 32 | String literal type used as the unique brand for the `Stdio` service. |
| Stdio | TypeId | 33 | 45 | Runtime identifier stored on `Stdio` service implementations. |
| Stdio | Stdio | 46 | 92 | Defines the service interface for process standard I/O. |
| Stdio | Stdio | 93 | 108 | Service tag for process standard I/O. |
| Stdio | make | 109 | 130 | Creates a `Stdio` service implementation from the provided fields and attaches the `Stdio` type identifier. |
| Stdio | layerTest | 131 | 152 | Creates a test layer for `Stdio`. |
| Stream | TypeId | 42 | 49 | String literal type used as the unique brand for `Stream` values. |
| Stream | TypeId | 50 | 65 | Runtime identifier stored on `Stream` values and used by `isStream` to recognize them. |
| Stream | Stream | 66 | 99 | A `Stream<A, E, R>` describes a program that can emit many `A` values, fail with `E`, and require `R`. |
| Stream | StreamUnify | 100 | 111 | Type-level unification hook for Stream within the Effect type system. |
| Stream | StreamUnifyIgnore | 112 | 121 | Type-level marker that excludes Stream from unification. |
| Stream | StreamTypeLambda | 122 | 143 | Type lambda for Stream used in higher-kinded type operations. |
| Stream | Variance | 144 | 158 | Type-level variance marker for `Stream`. |
| Stream | VarianceStruct | 159 | 175 | Structural encoding used by `Variance` to record each `Stream` type parameter's variance. |
| Stream | Success | 176 | 193 | Extract the success type from a Stream type. |
| Stream | Error | 194 | 211 | Extract the error type from a Stream type. |
| Stream | Services | 212 | 233 | Extract the services type from a Stream type. |
| Stream | isStream | 234 | 250 | Checks whether a value is a Stream. |
| Stream | DefaultChunkSize | 251 | 266 | The default chunk size used by Stream constructors and combinators. |
| Stream | HaltStrategy | 267 | 274 | Describes how merged streams decide when to halt. |
| Stream | fromChannel | 275 | 292 | Creates a stream from a array-emitting `Channel`. |
| Stream | fromEffect | 293 | 309 | Creates a stream from an effect. |
| Stream | service | 310 | 340 | Accesses a service from the context and emits it as a single element. |
| Stream | serviceOption | 341 | 382 | Optionally accesses a service from the context and emits the result as a single element. |
| Stream | fromEffectDrain | 383 | 404 | Creates a stream that runs the effect and emits no elements. |
| Stream | fromEffectRepeat | 405 | 422 | Creates a stream from an effect producing a value of type `A` which repeats forever. |
| Stream | fromEffectSchedule | 423 | 440 | Creates a stream from an effect producing a value of type `A`, which is repeated using the specified schedule. |
| Stream | tick | 441 | 457 | Creates a stream that emits `void` immediately once, then emits another `void` after each specified interval. |
| Stream | fromPull | 458 | 487 | Creates a stream from a pull effect, such as one produced by `Stream.toPull`. |
| Stream | transformPull | 488 | 507 | Derives a stream by transforming its pull effect. |
| Stream | transformPullBracket | 508 | 541 | Transforms a stream by effectfully transforming its pull effect. |
| Stream | toChannel | 542 | 559 | Creates a channel from a stream. |
| Stream | callback | 560 | 598 | Creates a stream from a callback that can emit values into a queue. |
| Stream | empty | 599 | 614 | Creates an empty stream. |
| Stream | succeed | 615 | 630 | Creates a single-valued pure stream. |
| Stream | make | 631 | 648 | Creates a stream from a sequence of values. |
| Stream | sync | 649 | 668 | Creates a stream that synchronously evaluates a function and emits the result as a single value. |
| Stream | suspend | 669 | 688 | Creates a lazily constructed stream. |
| Stream | fail | 689 | 704 | Terminates with the specified error. |
| Stream | failSync | 705 | 722 | Terminates with the specified lazily evaluated error. |
| Stream | failCause | 723 | 742 | Creates a stream that fails with the specified `Cause`. |
| Stream | die | 743 | 761 | The stream that dies with the specified defect. |
| Stream | failCauseSync | 762 | 781 | The stream that always fails with the specified lazily evaluated `Cause`. |
| Stream | fromIteratorSucceed | 782 | 816 | Creates a stream that consumes values from an iterator. |
| Stream | fromIterable | 817 | 848 | Creates a new `Stream` from an iterable collection of values. |
| Stream | fromIterableEffect | 849 | 889 | Creates a stream from an effect producing an iterable of values. |
| Stream | fromIterableEffectRepeat | 890 | 913 | Creates a stream by repeatedly running an effect that yields an iterable of values. |
| Stream | fromArray | 914 | 935 | Creates a stream from an array of values. |
| Stream | fromArrayEffect | 936 | 962 | Creates a stream from an effect that produces an array of values. |
| Stream | fromArrays | 963 | 984 | Creates a stream from an arbitrary number of arrays. |
| Stream | fromQueue | 985 | 1017 | Creates a stream that pulls values from a `Queue.Dequeue`. |
| Stream | fromPubSub | 1018 | 1050 | Creates a stream from a subscription to a `PubSub`. |
| Stream | fromPubSubTake | 1051 | 1083 | Creates a stream from a PubSub of `Take` values. |
| Stream | fromReadableStream | 1084 | 1130 | Creates a stream from a lazily supplied Web `ReadableStream`. |
| Stream | fromAsyncIterable | 1131 | 1159 | Creates a stream from an AsyncIterable. |
| Stream | fromSchedule | 1160 | 1183 | Creates a stream that emits each output of a schedule that does not require input, for as long as the schedule continues. |
| Stream | fromSubscription | 1184 | 1217 | Creates a stream from a PubSub subscription. |
| Stream | EventListener | 1218 | 1235 | Interface representing an event listener target. |
| Stream | fromEventListener | 1236 | 1279 | Creates a stream from an event listener. |
| Stream | unfold | 1280 | 1307 | Creates a stream by repeatedly applying an effectful step function to a state. |
| Stream | paginate | 1308 | 1341 | Creates a stream by repeatedly evaluating an effectful page function. |
| Stream | iterate | 1342 | 1364 | Creates an infinite stream by repeatedly applying a function to a seed value. |
| Stream | range | 1365 | 1391 | Constructs a stream from a range of integers, including both endpoints. |
| Stream | never | 1392 | 1412 | The stream that never produces any value or fails with any error. |
| Stream | unwrap | 1413 | 1436 | Creates a stream produced from an `Effect`. |
| Stream | scoped | 1437 | 1467 | Runs a stream that requires `Scope` in a managed scope, ensuring its finalizers are run when the stream completes. |
| Stream | map | 1468 | 1519 | Transforms the elements of this stream using the supplied function. |
| Stream | as | 1520 | 1598 | Replaces every element of the stream with the provided constant value. |
| Stream | mapBoth | 1599 | 1728 | Maps both the failure and success channels of a stream. |
| Stream | mapArray | 1729 | 1804 | Transforms each emitted chunk using the provided function, which receives the chunk and its index. |
| Stream | mapEffect | 1805 | 1928 | Maps over elements of the stream with the specified effectful function. |
| Stream | flattenEffect | 1929 | 1965 | Flattens a stream of `Effect` values into a stream of their results. |
| Stream | mapArrayEffect | 1966 | 2062 | Maps over non-empty array chunks emitted by the stream effectfully. |
| Stream | result | 2063 | 2095 | Lifts failures and successes into a `Result`, yielding a stream that cannot fail. |
| Stream | tap | 2096 | 2187 | Runs the provided effect for each element while preserving the elements. |
| Stream | tapBoth | 2188 | 2289 | Returns a stream that effectfully "peeks" at elements and failures. |
| Stream | tapSink | 2290 | 2380 | Runs a sink for all stream elements while still emitting them downstream. |
| Stream | flatMap | 2381 | 2480 | Maps each element to a stream and flattens the resulting streams. |
| Stream | switchMap | 2481 | 2562 | Switches to the latest stream produced by the mapping function, interrupting the previous stream when a new element arrives. |
| Stream | flatten | 2563 | 2605 | Flattens a stream of streams into a single stream. |
| Stream | flattenArray | 2606 | 2628 | Flattens a stream of non-empty arrays into a stream of elements. |
| Stream | drain | 2629 | 2649 | Converts this stream to one that runs its effects but emits no elements. |
| Stream | drainFork | 2650 | 2740 | Runs the provided stream in the background while this stream runs, interrupting it when this stream completes and failing if the backgrou... |
| Stream | repeat | 2741 | 2816 | Repeats the entire stream according to the provided schedule. |
| Stream | schedule | 2817 | 2892 | Schedules the stream's elements according to the provided schedule. |
| Stream | timeout | 2893 | 2968 | Ends the stream if it does not produce a value within the specified duration. |
| Stream | timeoutOrElse | 2969 | 3053 | Switches to a fallback stream if this stream does not emit a value within the specified duration. |
| Stream | repeatElements | 3054 | 3129 | Repeats each element of the stream according to the provided schedule, including the original emission. |
| Stream | forever | 3130 | 3155 | Repeats this stream forever. |
| Stream | flattenIterable | 3156 | 3177 | Flattens the iterables emitted by this stream into the stream's structure. |
| Stream | flattenTake | 3178 | 3205 | Unwraps `Take` values, emitting elements from non-empty arrays and ending or failing when the `Exit` signals completion. |
| Stream | concat | 3206 | 3272 | Concatenates two streams, emitting all elements from the first stream followed by all elements from the second stream. |
| Stream | prepend | 3273 | 3348 | Prepends the values from the provided iterable before the stream's elements. |
| Stream | merge | 3349 | 3440 | Merges two streams, emitting elements from both as they arrive. |
| Stream | mergeEffect | 3441 | 3552 | Merges this stream with a background effect, keeping the stream's elements. |
| Stream | mergeResult | 3553 | 3676 | Merges this stream and the specified stream together, tagging values from the left stream as `Result.succeed` and values from the right s... |
| Stream | mergeLeft | 3677 | 3779 | Merges two streams while emitting only the values from the left stream. |
| Stream | mergeRight | 3780 | 3897 | Merges this stream and the specified stream together, emitting only the values from the right stream while the left stream runs for its e... |
| Stream | mergeAll | 3898 | 4030 | Merges a collection of streams, running up to the specified number concurrently. |
| Stream | cross | 4031 | 4115 | Creates the cartesian product of two streams, running the `right` stream for each element in the `left` stream. |
| Stream | crossWith | 4116 | 4206 | Creates a cartesian product of elements from two streams using a function. |
| Stream | zipWith | 4207 | 4285 | Zips two streams point-wise with a combining function, ending when either stream ends. |
| Stream | zipWithArray | 4286 | 4399 | Zips two streams by applying a function to non-empty arrays of elements. |
| Stream | zip | 4400 | 4481 | Zips this stream with another point-wise and emits tuples of elements from both streams. |
| Stream | zipLeft | 4482 | 4569 | Zips this stream with another point-wise and keeps only the values from the left stream. |
| Stream | zipRight | 4570 | 4642 | Zips this stream with another point-wise, keeping only right values and ending when either stream ends. |
| Stream | zipFlatten | 4643 | 4742 | Zips this stream with another point-wise and emits tuples of elements from both streams, flattening the left tuple. |
| Stream | zipWithIndex | 4743 | 4766 | Zips this stream together with the index of elements. |
| Stream | zipWithNext | 4767 | 4788 | Zips each element with the next element, pairing the final element with `Option.none()`. |
| Stream | zipWithPrevious | 4789 | 4811 | Zips each element with its previous element, starting with `None`. |
| Stream | zipWithPreviousAndNext | 4812 | 4835 | Zips each element with its previous and next values. |
| Stream | zipLatestAll | 4836 | 4874 | Zips multiple streams so that when a value is emitted by any stream, it is combined with the latest values from the other streams to prod... |
| Stream | zipLatest | 4875 | 4980 | Combines two streams by emitting each new element with the latest value from the other stream. |
| Stream | zipLatestWith | 4981 | 5098 | Combines the latest values from both streams whenever either emits, using the provided function. |
| Stream | raceAll | 5099 | 5129 | Runs all streams concurrently until one stream emits its first value, then mirrors that winning stream and interrupts the rest. |
| Stream | race | 5130 | 5229 | Runs both streams concurrently until one stream emits its first value, then mirrors that winning stream and interrupts the other. |
| Stream | filter | 5230 | 5350 | Filters a stream to the elements that satisfy a predicate. |
| Stream | filterMap | 5351 | 5414 | Filters and maps stream elements in one pass using a `Filter`. |
| Stream | filterEffect | 5415 | 5484 | Filters elements in a single pass effectfully. |
| Stream | filterMapEffect | 5485 | 5551 | Filters and maps elements in one pass effectfully using a `FilterEffect`. |
| Stream | partitionQueue | 5552 | 5667 | Partitions a stream using a `Filter` and exposes passing and failing values as scoped queues. |
| Stream | partitionEffect | 5668 | 5752 | Splits a stream with an effectful `Filter`, returning scoped streams for filter successes and failures. |
| Stream | partition | 5753 | 5868 | Splits a stream into scoped passing and failing substreams using a `Filter`. |
| Stream | when | 5869 | 5941 | Returns the specified stream if the given condition is satisfied, otherwise returns an empty stream. |
| Stream | peel | 5942 | 6038 | Runs a sink to peel off enough elements to produce a value and returns that value with the remaining stream in a scope. |
| Stream | buffer | 6039 | 6145 | Buffers up to `capacity` elements so a faster producer can progress independently of a slower consumer. |
| Stream | bufferArray | 6146 | 6252 | Allows a faster producer to progress independently of a slower consumer by buffering up to `capacity` chunks in a queue. |
| Stream | catchCause | 6253 | 6349 | Switches over to the stream produced by the provided function in case this one fails. |
| Stream | catchDefect | 6350 | 6443 | Recovers from defects using the provided function. |
| Stream | tapCause | 6444 | 6534 | Runs an effect when the stream fails without changing its values or error, unless the tap effect itself fails. |
| Stream | catch | 6535 | 6572 | Switches over to the stream produced by the provided function if this one fails. |
| Stream | tapError | 6573 | 6660 | Peeks at errors effectfully without changing the stream unless the tap fails. |
| Stream | tapErrorTag | 6661 | 6781 | Peeks at errors with a matching `_tag` effectfully without changing the stream unless the tap fails. |
| Stream | tapDefect | 6782 | 6881 | Peeks at defects effectfully without changing the stream unless the tap fails. |
| Stream | catchIf | 6882 | 7087 | Recovers from errors that match a predicate by switching to a recovery stream. |
| Stream | catchFilter | 7088 | 7178 | Recovers from errors that match a `Filter` by switching to a recovery stream. |
| Stream | catchTag | 7179 | 7302 | Recovers from failures whose `_tag` matches the provided value by switching to the stream returned by `f`. |
| Stream | catchTags | 7303 | 7478 | Switches to a recovery stream based on matching `_tag` handlers. |
| Stream | catchReason | 7479 | 7650 | Catches a specific reason within a tagged error. |
| Stream | catchReasons | 7651 | 7814 | Catches multiple reasons within a tagged error using an object of handlers. |
| Stream | unwrapReason | 7815 | 7950 | Promotes nested reason errors into the stream error channel, replacing the parent error. |
| Stream | mapError | 7951 | 8041 | Transforms the errors emitted by this stream using `f`. |
| Stream | catchCauseIf | 8042 | 8129 | Recovers from stream failures by filtering the `Cause` and switching to a recovery stream. |
| Stream | catchCauseFilter | 8130 | 8205 | Recovers from stream failures by filtering the `Cause` and switching to a recovery stream. |
| Stream | orElseIfEmpty | 8206 | 8278 | Switches to a fallback stream if this stream is empty. |
| Stream | orElseSucceed | 8279 | 8372 | Returns a stream that emits a fallback value when this stream fails. |
| Stream | orDie | 8373 | 8397 | Turns typed failures into defects, making the stream infallible. |
| Stream | ignore | 8398 | 8463 | Ignores failures and ends the stream on error. |
| Stream | ignoreCause | 8464 | 8504 | Ignores the stream's failure cause, including defects, and ends the stream. |
| Stream | retry | 8505 | 8628 | Retries the stream according to the given schedule when it fails. |
| Stream | withExecutionPlan | 8629 | 8798 | Applies an `ExecutionPlan` to a stream, retrying with step-provided resources until it succeeds or the plan is exhausted. |
| Stream | take | 8799 | 8886 | Takes the first `n` elements from this stream. |
| Stream | limitBytes | 8887 | 8965 | Emits byte chunks until the configured limit would be exceeded, then drops the crossing chunk and switches to a fallback stream. |
| Stream | takeRight | 8966 | 9053 | Keeps the last `n` elements from this stream. |
| Stream | takeUntil | 9054 | 9163 | Takes elements until the predicate matches. |
| Stream | takeUntilEffect | 9164 | 9255 | Takes stream elements until an effectful predicate returns `true`. |
| Stream | takeWhile | 9256 | 9381 | Takes the longest initial prefix of elements that satisfy the predicate. |
| Stream | takeWhileFilter | 9382 | 9448 | Takes the longest initial prefix accepted by a `Filter` and emits the filter's success values. |
| Stream | takeWhileEffect | 9449 | 9536 | Takes elements from the stream while the effectful predicate is `true`. |
| Stream | drop | 9537 | 9624 | Drops the first `n` elements from this stream. |
| Stream | dropUntil | 9625 | 9694 | Drops elements until the specified predicate evaluates to `true`, then drops that matching element. |
| Stream | dropUntilEffect | 9695 | 9785 | Drops all elements of the stream until the specified effectful predicate evaluates to `true`. |
| Stream | dropWhile | 9786 | 9858 | Drops elements from the stream while the specified predicate evaluates to `true`. |
| Stream | dropWhileFilter | 9859 | 9928 | Drops elements while the filter succeeds. |
| Stream | dropWhileEffect | 9929 | 10001 | Drops elements while the specified effectful predicate evaluates to `true`. |
| Stream | dropRight | 10002 | 10092 | Drops the last specified number of elements from this stream. |
| Stream | chunks | 10093 | 10117 | Exposes the underlying chunks as a stream of non-empty arrays. |
| Stream | rechunk | 10118 | 10208 | Groups the stream into arrays of the specified size, preserving element order. |
| Stream | sliding | 10209 | 10293 | Emits a sliding window of `n` elements. |
| Stream | slidingSize | 10294 | 10381 | Emits sliding windows of `chunkSize` elements, advancing by `stepSize`. |
| Stream | split | 10382 | 10522 | Splits the stream into non-empty groups whenever the predicate matches. |
| Stream | combine | 10523 | 10634 | Combines elements from this stream and the specified stream by repeatedly applying a stateful function that can pull from either side. |
| Stream | combineArray | 10635 | 10767 | Combines two streams chunk-by-chunk with a stateful pull function. |
| Stream | mapAccum | 10768 | 10856 | Maps elements statefully, emitting zero or more outputs per input. |
| Stream | mapAccumArray | 10857 | 10957 | Maps over non-empty chunk arrays statefully, emitting zero or more values per chunk. |
| Stream | mapAccumEffect | 10958 | 11079 | Maps each element statefully and effectfully, emitting zero or more output values per input. |
| Stream | mapAccumArrayEffect | 11080 | 11207 | Maps each non-empty input chunk statefully and effectfully, emitting zero or more output values per chunk. |
| Stream | scan | 11208 | 11280 | Accumulates state across the stream, emitting the initial state and each updated state. |
| Stream | scanEffect | 11281 | 11350 | Accumulates state effectfully and emits the initial state plus each accumulated state. |
| Stream | debounce | 11351 | 11417 | Drops earlier elements within the debounce window and emits only the latest element after the pause. |
| Stream | throttleEffect | 11418 | 11562 | Rate-limits stream chunks with an effectful cost function. |
| Stream | throttle | 11563 | 11710 | Rate-limits stream chunks with a synchronous cost function. |
| Stream | grouped | 11711 | 11801 | Partitions the stream into non-empty arrays of the specified size. |
| Stream | groupedWithin | 11802 | 11895 | Partitions the stream into arrays, emitting when the chunk size is reached or the duration passes. |
| Stream | groupBy | 11896 | 12001 | Groups elements into keyed substreams using an effectful classifier. |
| Stream | groupByKey | 12002 | 12101 | Groups elements by a key and emits a stream per key. |
| Stream | groupAdjacentBy | 12102 | 12171 | Groups consecutive elements that have equal keys into non-empty arrays. |
| Stream | transduce | 12172 | 12244 | Applies a sink transducer to the stream and emits each sink result. |
| Stream | aggregate | 12245 | 12335 | Aggregates elements using the provided sink and emits each sink result as a stream element. |
| Stream | aggregateWithin | 12336 | 12462 | Aggregates elements with a sink, emitting each result when the sink completes or the schedule triggers. |
| Stream | broadcastN | 12463 | 12604 | Creates a fixed-size tuple of streams that each emit the same elements as the source stream. |
| Stream | broadcast | 12605 | 12727 | Creates a PubSub-backed stream that multicasts the source to all subscribers. |
| Stream | share | 12728 | 12893 | Returns a new Stream that multicasts the original stream, subscribing when the first consumer starts. |
| Stream | pipeThroughChannel | 12894 | 13002 | Pipes this stream through a channel that consumes and emits chunked elements. |
| Stream | pipeThroughChannelOrFail | 13003 | 13111 | Pipes values through the provided channel while preserving this stream's failures alongside any channel failures. |
| Stream | pipeThrough | 13112 | 13199 | Pipes the stream through `Sink.toChannel`, emitting only the sink leftovers. |
| Stream | collect | 13200 | 13222 | Collects all elements into an array and emits it as a single element. |
| Stream | accumulate | 13223 | 13248 | Accumulates elements into a growing array, emitting the cumulative array for each input chunk. |
| Stream | changes | 13249 | 13273 | Emits only elements that differ from the previous one. |
| Stream | changesWith | 13274 | 13349 | Returns a stream that only emits elements that are not equal to the previously emitted element, as determined by the specified predicate. |
| Stream | changesWithEffect | 13350 | 13434 | Emits only elements that differ from the previous element, using an effectful equality check. |
| Stream | decodeText | 13435 | 13470 | Decodes Uint8Array chunks into strings using TextDecoder with an optional encoding. |
| Stream | encodeText | 13471 | 13494 | Encodes a stream of strings into UTF-8 `Uint8Array` chunks. |
| Stream | splitLines | 13495 | 13515 | Splits a stream of strings into lines, handling `\n`, `\r`, and `\r\n` delimiters across chunks. |
| Stream | intersperse | 13516 | 13582 | Inserts the provided element between emitted elements. |
| Stream | intersperseAffixes | 13583 | 13678 | Adds a start value, middle value, and end value around stream elements. |
| Stream | interleave | 13679 | 13763 | Interleaves this stream with the specified stream by alternating pulls from each stream; when one ends, the remaining values from the oth... |
| Stream | interleaveWith | 13764 | 13863 | Interleaves two streams deterministically by following a boolean decider stream. |
| Stream | interruptWhen | 13864 | 13981 | Interrupts the evaluation of this stream when the provided effect completes. |
| Stream | haltWhen | 13982 | 14108 | Stops a stream after the current pull when an effect completes. |
| Stream | onExit | 14109 | 14193 | Runs the provided finalizer when the stream exits, passing the exit value. |
| Stream | onError | 14194 | 14290 | Runs the provided effect when the stream fails, passing the failure cause. |
| Stream | onStart | 14291 | 14372 | Runs the provided effect before this stream starts. |
| Stream | onFirst | 14373 | 14442 | Runs the provided effect with the first element emitted by the stream. |
| Stream | onEnd | 14443 | 14521 | Runs the provided effect when the stream ends successfully. |
| Stream | ensuring | 14522 | 14603 | Executes the provided finalizer after this stream's finalizers run. |
| Stream | provide | 14604 | 14704 | Provides a layer or context to the stream, removing the corresponding service requirements. |
| Stream | provideContext | 14705 | 14813 | Provides multiple services to the stream using a context. |
| Stream | provideService | 14814 | 14928 | Provides the stream with a single required service, eliminating that requirement from its environment. |
| Stream | provideServiceEffect | 14929 | 15037 | Provides a service to the stream using an effect, removing the requirement and adding the effect's error and environment. |
| Stream | updateContext | 15038 | 15161 | Transforms the stream's required services by mapping the current context to a new one. |
| Stream | updateService | 15162 | 15243 | Updates a single service in the stream environment by applying a function. |
| Stream | withSpan | 15244 | 15313 | Wraps the stream with a new span for tracing. |
| Stream | Do | 15314 | 15340 | Provides the entry point for do-notation style stream composition. |
| Stream | let | 15341 | 15371 | Adds a computed field to the current Do-notation record. |
| Stream | bind | 15372 | 15447 | Binds the result of a stream to a field in the do-notation record. |
| Stream | bindEffect | 15448 | 15534 | Binds an Effect-produced value into the do-notation record for each stream element. |
| Stream | bindTo | 15535 | 15593 | Maps each element into a record keyed by the provided name. |
| Stream | run | 15594 | 15648 | Runs a stream with a sink and returns the sink result. |
| Stream | runCollect | 15649 | 15671 | Runs the stream and collects all elements into an array. |
| Stream | runCount | 15672 | 15694 | Runs the stream and returns the number of elements emitted. |
| Stream | runSum | 15695 | 15715 | Runs the stream and returns the numeric sum of its elements. |
| Stream | runFold | 15716 | 15791 | Runs the stream and folds elements using a pure reducer. |
| Stream | runFoldEffect | 15792 | 15882 | Runs the stream and folds elements using an effectful reducer. |
| Stream | runHead | 15883 | 15903 | Runs the stream and returns the first element as an `Option`. |
| Stream | runLast | 15904 | 15929 | Runs the stream and returns the last element as an `Option`. |
| Stream | runForEach | 15930 | 16002 | Runs the provided effectful callback for each element of the stream. |
| Stream | runForEachWhile | 16003 | 16093 | Runs the stream, applying the effectful predicate to each element and stopping when it returns `false`. |
| Stream | runForEachArray | 16094 | 16172 | Consumes the stream in chunks, passing each non-empty array to the callback. |
| Stream | runDrain | 16173 | 16198 | Runs the stream for its effects, discarding emitted elements. |
| Stream | toPull | 16199 | 16229 | Returns a scoped pull for manually consuming the stream's output chunks. |
| Stream | mkString | 16230 | 16251 | Concatenates all emitted strings into a single string. |
| Stream | mkArrayBuffer | 16252 | 16280 | Concatenates the stream's `Uint8Array` chunks into a single `ArrayBuffer`. |
| Stream | mkUint8Array | 16281 | 16307 | Concatenates the stream's `Uint8Array` chunks into a single `Uint8Array`. |
| Stream | toReadableStreamWith | 16308 | 16407 | Converts the stream to a `ReadableStream` using the provided services. |
| Stream | toReadableStream | 16408 | 16478 | Converts a stream to a `ReadableStream`. |
| Stream | toReadableStreamEffect | 16479 | 16579 | Creates an Effect that builds a ReadableStream from the stream. |
| Stream | toAsyncIterableWith | 16580 | 16652 | Converts the stream to an `AsyncIterable` using the provided services. |
| Stream | toAsyncIterableEffect | 16653 | 16680 | Creates an effect that yields an `AsyncIterable` using the current services. |
| Stream | toAsyncIterable | 16681 | 16698 | Converts a stream to an `AsyncIterable` for `for await...of` consumption. |
| Stream | runIntoPubSub | 16699 | 16805 | Runs the stream, publishing elements into the provided PubSub. |
| Stream | toPubSub | 16806 | 16914 | Converts a stream to a PubSub of emitted values for concurrent consumption. |
| Stream | toPubSubTake | 16915 | 17028 | Converts a stream to a PubSub of `Take` values for concurrent consumption. |
| Stream | toQueue | 17029 | 17123 | Creates a scoped dequeue that is fed by the stream for concurrent consumption. |
| Stream | runIntoQueue | 17124 | 17227 | Runs the stream, offering each element to the provided queue and ending it with `Cause.Done` when the stream completes. |
| String | String | 19 | 38 | Exposes the global string constructor. |
| String | isString | 39 | 55 | Checks whether a value is a `string`. |
| String | Order | 56 | 74 | Provides an `Order` instance for comparing strings using lexicographic ordering. |
| String | Equivalence | 75 | 91 | Provides an `Equivalence` instance for strings using strict equality (`===`). |
| String | empty | 92 | 112 | Provides the empty string `""`. |
| String | Concat | 113 | 131 | Concatenates two strings at the type level. |
| String | concat | 132 | 183 | Concatenates two strings at runtime. |
| String | toUpperCase | 184 | 200 | Converts a string to uppercase. |
| String | toLowerCase | 201 | 217 | Converts a string to lowercase. |
| String | capitalize | 218 | 235 | Capitalizes the first character (Unicode code point) of a string. |
| String | uncapitalize | 236 | 253 | Uncapitalizes the first character (Unicode code point) of a string. |
| String | replace | 254 | 275 | Replaces matches in a string using `String.prototype.replace`. |
| String | Trim | 276 | 293 | Type-level representation of trimming whitespace from both ends of a string. |
| String | trim | 294 | 310 | Removes whitespace from both ends of a string. |
| String | TrimStart | 311 | 328 | Type-level representation of trimming whitespace from the start of a string. |
| String | trimStart | 329 | 345 | Removes whitespace from the start of a string. |
| String | TrimEnd | 346 | 363 | Type-level representation of trimming whitespace from the end of a string. |
| String | trimEnd | 364 | 380 | Removes whitespace from the end of a string. |
| String | slice | 381 | 397 | Extracts a section of a string and returns it as a new string. |
| String | isEmpty | 398 | 414 | Checks whether a `string` is empty. |
| String | isNonEmpty | 415 | 431 | Checks whether a `string` is non-empty. |
| String | length | 432 | 447 | Returns the JavaScript string length, measured in UTF-16 code units. |
| String | split | 448 | 502 | Splits a string into an array of substrings using a separator. |
| String | includes | 503 | 520 | Returns `true` if `searchString` appears as a substring of `self`, at one or more positions that are greater than or equal to `position`;... |
| String | startsWith | 521 | 537 | Returns `true` if the string starts with the specified search string. |
| String | endsWith | 538 | 554 | Returns `true` if the string ends with the specified search string. |
| String | charCodeAt | 555 | 606 | Returns the character code at the specified index safely, or `None` if the index is out of bounds. |
| String | substring | 607 | 623 | Extracts characters from a string between two specified indices. |
| String | at | 624 | 675 | Returns the character at the specified relative index safely, or `None` if the index is out of bounds. |
| String | charAt | 676 | 727 | Returns the character at the specified non-negative index safely, or `None` if the index is out of bounds. |
| String | codePointAt | 728 | 779 | Returns the Unicode code point at the specified index safely, or `None` if the index is out of bounds. |
| String | indexOf | 780 | 796 | Returns the index of the first occurrence of a substring safely, or `None` if not found. |
| String | lastIndexOf | 797 | 813 | Returns the index of the last occurrence of a substring safely, or `None` if not found. |
| String | localeCompare | 814 | 833 | Computes locale-aware ordering for two strings, with optional locales and collator options, and returns the result as an `Ordering` (`-1`... |
| String | match | 834 | 855 | Matches a string against a pattern safely and returns `Option.some` with the match array, or `Option.none` when the pattern does not match. |
| String | matchAll | 856 | 874 | Returns an iterator over all regular expression matches in the string using native `String.prototype.matchAll` semantics. |
| String | normalize | 875 | 901 | Normalizes a string according to the specified Unicode normalization form. |
| String | padEnd | 902 | 918 | Pads the string from the end with a given fill string to a specified length. |
| String | padStart | 919 | 935 | Pads the string from the start with a given fill string to a specified length. |
| String | repeat | 936 | 956 | Repeats the string the specified number of times. |
| String | replaceAll | 957 | 973 | Replaces all occurrences of a substring or pattern in a string. |
| String | search | 974 | 1031 | Returns the index of the first match for a string or regular expression safely, or `Option.none` when no match is found. |
| String | toLocaleLowerCase | 1032 | 1048 | Converts the string to lowercase according to the specified locale. |
| String | toLocaleUpperCase | 1049 | 1065 | Converts the string to uppercase according to the specified locale. |
| String | takeLeft | 1066 | 1144 | Keeps the specified number of characters from the start of a string. |
| String | takeRight | 1145 | 1223 | Keeps the specified number of characters from the end of a string. |
| String | linesIterator | 1224 | 1240 | Returns an `IterableIterator` which yields each line contained within the string, trimming off the trailing newline character. |
| String | linesWithSeparators | 1241 | 1257 | Returns an `IterableIterator` which yields each line contained within the string as well as the trailing newline character. |
| String | stripMarginWith | 1258 | 1309 | Strips a leading margin prefix from every line using the supplied margin character. |
| String | stripMargin | 1310 | 1325 | Strips a leading `\|` margin prefix from every line. |
| String | snakeToCamel | 1326 | 1348 | Converts a snake_case string to camelCase. |
| String | snakeToPascal | 1349 | 1371 | Converts a snake_case string to PascalCase. |
| String | snakeToKebab | 1372 | 1388 | Converts a snake_case string to kebab-case. |
| String | camelToSnake | 1389 | 1405 | Converts a camelCase string to snake_case. |
| String | pascalToSnake | 1406 | 1422 | Converts a PascalCase string to snake_case. |
| String | kebabToSnake | 1423 | 1449 | Converts a kebab-case string to snake_case. |
| String | noCase | 1450 | 1520 | Normalizes a string by splitting it into word parts, transforming each part, and joining the parts with a configurable delimiter. |
| String | pascalCase | 1521 | 1537 | Converts a string to PascalCase. |
| String | camelCase | 1538 | 1556 | Converts a string to camelCase. |
| String | constantCase | 1557 | 1576 | Converts a string to CONSTANT_CASE (uppercase with underscores). |
| String | configCase | 1577 | 1599 | Converts a string to CONFIG_CASE (uppercase with underscores) for configuration keys. |
| String | kebabCase | 1600 | 1618 | Converts a string to kebab-case (lowercase with hyphens). |
| String | snakeCase | 1619 | 1635 | Converts a string to snake_case (lowercase with underscores). |
| String | ReducerConcat | 1636 | 1655 | Reducer for concatenating `string`s. |
| Struct | Simplify | 18 | 52 | Flattens intersection types into a single object type for readability. |
| Struct | Mutable | 53 | 86 | Removes `readonly` modifiers from all properties of an object type. |
| Struct | Assign | 87 | 119 | Merges two object types with properties from `U` taking precedence over `T` on overlapping keys (like `Object.assign` at the type level). |
| Struct | get | 120 | 198 | Retrieves the value at `key` from a struct. |
| Struct | keys | 199 | 228 | Returns the string keys of a struct as a properly typed `Array<keyof S & string>`. |
| Struct | pick | 229 | 310 | Creates a new struct containing only the specified keys. |
| Struct | omit | 311 | 389 | Creates a new struct with the specified keys removed. |
| Struct | assign | 390 | 483 | Merges two structs into a new struct. |
| Struct | evolve | 484 | 598 | Transforms values of a struct selectively using per-key functions. |
| Struct | evolveKeys | 599 | 710 | Transforms keys of a struct selectively using per-key functions. |
| Struct | evolveEntries | 711 | 816 | Transforms both keys and values of a struct selectively. |
| Struct | renameKeys | 817 | 918 | Renames keys in a struct using a static `{ oldKey: newKey }` mapping. |
| Struct | makeEquivalence | 919 | 954 | Creates an `Equivalence` for a struct by providing an `Equivalence` for each property. |
| Struct | makeOrder | 955 | 988 | Creates an `Order` for a struct by providing an `Order` for each property. |
| Struct | Lambda | 989 | 1026 | Interface for type-level functions used by {@link map}, {@link mapPick}, and {@link mapOmit}. |
| Struct | Apply | 1027 | 1063 | Applies a {@link Lambda} type-level function to a value type `V`, producing the output type. |
| Struct | lambda | 1064 | 1101 | Wraps a plain function as a {@link Lambda} value so it can be used with {@link map}, {@link mapPick}, and {@link mapOmit}. |
| Struct | map | 1102 | 1211 | Applies a {@link Lambda} transformation to every value in a struct. |
| Struct | mapPick | 1212 | 1315 | Applies a {@link Lambda} transformation only to the specified keys; all other keys are copied unchanged. |
| Struct | mapOmit | 1316 | 1419 | Applies a {@link Lambda} transformation to all keys except the specified ones; the excluded keys are copied unchanged. |
| Struct | makeCombiner | 1420 | 1457 | Creates a `Combiner` for a struct shape by providing a `Combiner` for each property. |
| Struct | makeReducer | 1458 | 1501 | Creates a `Reducer` for a struct shape by providing a `Reducer` for each property. |
| Struct | Record | 1502 | 1523 | Creates a record with the given keys and value. |
| SubscriptionRef | SubscriptionRef | 21 | 38 | A mutable reference whose updates are serialized and published to subscribers. |
| SubscriptionRef | isSubscriptionRef | 39 | 51 | Returns `true` if the provided value is a `SubscriptionRef`. |
| SubscriptionRef | SubscriptionRef | 52 | 72 | The `SubscriptionRef` namespace containing type definitions associated with subscription references. |
| SubscriptionRef | make | 73 | 93 | Constructs a new `SubscriptionRef` from an initial value. |
| SubscriptionRef | changes | 94 | 134 | Creates a stream that emits the current value and all subsequent changes to the `SubscriptionRef`. |
| SubscriptionRef | getUnsafe | 135 | 167 | Retrieves the current value of the `SubscriptionRef` unsafely. |
| SubscriptionRef | get | 168 | 189 | Retrieves the current value of the `SubscriptionRef`. |
| SubscriptionRef | getAndSet | 190 | 265 | Retrieves the current value and sets a new value atomically, notifying subscribers of the change. |
| SubscriptionRef | getAndUpdate | 266 | 341 | Retrieves the current value and updates it atomically with the result of applying a function, notifying subscribers of the change. |
| SubscriptionRef | getAndUpdateEffect | 342 | 426 | Retrieves the current value and updates it atomically with the result of applying an effectful function, notifying subscribers of the cha... |
| SubscriptionRef | getAndUpdateSome | 427 | 541 | Retrieves the current value and optionally updates the reference. |
| SubscriptionRef | getAndUpdateSomeEffect | 542 | 656 | Retrieves the current value and optionally updates the reference effectfully. |
| SubscriptionRef | modify | 657 | 741 | Modifies the `SubscriptionRef` atomically with a function that computes a return value and a new value, notifying subscribers of the change. |
| SubscriptionRef | modifyEffect | 742 | 829 | Modifies the `SubscriptionRef` atomically with an effectful function that computes a return value and a new value, notifying subscribers ... |
| SubscriptionRef | modifySome | 830 | 947 | Computes a return value and optionally updates the reference. |
| SubscriptionRef | modifySomeEffect | 948 | 1077 | Computes a return value and optionally updates the reference effectfully. |
| SubscriptionRef | set | 1078 | 1153 | Sets the value of the `SubscriptionRef`, notifying all subscribers of the change. |
| SubscriptionRef | setAndGet | 1154 | 1223 | Sets the value of the `SubscriptionRef` and returns the new value, notifying all subscribers of the change. |
| SubscriptionRef | update | 1224 | 1299 | Updates the value of the `SubscriptionRef` with the result of applying a function, notifying subscribers of the change. |
| SubscriptionRef | updateEffect | 1300 | 1375 | Updates the value of the `SubscriptionRef` with the result of applying an effectful function, notifying subscribers of the change. |
| SubscriptionRef | updateAndGet | 1376 | 1445 | Updates the value of the `SubscriptionRef` with the result of applying a function and returns the new value, notifying subscribers of the... |
| SubscriptionRef | updateAndGetEffect | 1446 | 1527 | Updates the value of the `SubscriptionRef` with the result of applying an effectful function and returns the new value, notifying subscri... |
| SubscriptionRef | updateSome | 1528 | 1615 | Applies an update function to the current value. |
| SubscriptionRef | updateSomeEffect | 1616 | 1730 | Applies an effectful update only when it produces a new value. |
| SubscriptionRef | updateSomeAndGet | 1731 | 1839 | Applies an optional update and returns the current value afterward. |
| SubscriptionRef | updateSomeAndGetEffect | 1840 | 1950 | Applies an effectful optional update and returns the current value afterward. |
| Symbol | isSymbol | 10 | 31 | Checks whether a value is a `symbol`. |
| SynchronizedRef | SynchronizedRef | 20 | 40 | A mutable reference whose update and modify operations are serialized with an internal semaphore, including effectful transformations. |
| SynchronizedRef | makeUnsafe | 41 | 53 | Creates a `SynchronizedRef` synchronously from an initial value. |
| SynchronizedRef | make | 54 | 74 | Creates a `SynchronizedRef` from an initial value, wrapped in an `Effect`. |
| SynchronizedRef | getUnsafe | 75 | 90 | Reads the current value synchronously, bypassing the `Effect` API and the ref's semaphore. |
| SynchronizedRef | get | 91 | 105 | Returns an `Effect` that reads the current value of the `SynchronizedRef`. |
| SynchronizedRef | getAndSet | 106 | 160 | Sets a new value atomically and returns the previous value, serialized by the ref's semaphore. |
| SynchronizedRef | getAndUpdate | 161 | 215 | Updates the current value atomically with a function and returns the previous value, serialized by the ref's semaphore. |
| SynchronizedRef | getAndUpdateEffect | 216 | 276 | Runs an effectful update atomically while holding the ref's semaphore, sets the new value if the effect succeeds, and returns the previou... |
| SynchronizedRef | getAndUpdateSome | 277 | 331 | Applies a partial update atomically and returns the previous value. |
| SynchronizedRef | getAndUpdateSomeEffect | 332 | 386 | Runs an effectful partial update atomically while holding the ref's semaphore and returns the previous value. |
| SynchronizedRef | modify | 387 | 441 | Computes a return value and a new ref value atomically, stores the new value, and returns the computed result. |
| SynchronizedRef | modifyEffect | 442 | 493 | Runs an effectful modification atomically while holding the ref's semaphore, stores the new value if the effect succeeds, and returns the... |
| SynchronizedRef | modifySome | 494 | 545 | Computes a return value and an optional new ref value atomically. |
| SynchronizedRef | modifySomeEffect | 546 | 600 | Runs an effectful modification atomically while holding the ref's semaphore. |
| SynchronizedRef | set | 601 | 652 | Sets the value of the `SynchronizedRef`, serialized by the ref's semaphore. |
| SynchronizedRef | setAndGet | 653 | 701 | Sets the value of the `SynchronizedRef` and returns the new value. |
| SynchronizedRef | update | 702 | 756 | Updates the value of the `SynchronizedRef` with a function, serialized by the ref's semaphore. |
| SynchronizedRef | updateEffect | 757 | 817 | Runs an effectful update while holding the ref's semaphore and stores the new value if the effect succeeds. |
| SynchronizedRef | updateAndGet | 818 | 869 | Updates the value of the `SynchronizedRef` with a function and returns the new value. |
| SynchronizedRef | updateAndGetEffect | 870 | 921 | Runs an effectful update while holding the ref's semaphore, stores the new value if the effect succeeds, and returns that new value. |
| SynchronizedRef | updateSome | 922 | 973 | Applies a partial update to the current value. |
| SynchronizedRef | updateSomeEffect | 974 | 1025 | Runs an effectful partial update while holding the ref's semaphore. |
| SynchronizedRef | updateSomeAndGet | 1026 | 1080 | Applies a partial update and returns the resulting current value. |
| SynchronizedRef | updateSomeAndGetEffect | 1081 | 1137 | Runs an effectful partial update while holding the ref's semaphore and returns the resulting current value. |
| Take | Take | 13 | 28 | Represents one pull result: either a non-empty batch of values, a failure `Exit`, or a successful `Exit` that signals completion with a `... |
| Take | toPull | 29 | 43 | Converts a `Take` into a `Pull`, succeeding with value batches, failing with failure exits, and translating successful exits into pull co... |
| Terminal | Terminal | 22 | 58 | A `Terminal` represents a command-line interface which can read input from a user and display messages to a user. |
| Terminal | Size | 59 | 69 | Terminal dimensions measured in character cells. |
| Terminal | Key | 70 | 95 | Keyboard key metadata for terminal input, including the key name and modifier state. |
| Terminal | UserInput | 96 | 124 | A terminal input event containing an optional raw character and the parsed key that was pressed. |
| Terminal | QuitError | 125 | 147 | Represents an error that occurs when a user attempts to quit out of a `Terminal` prompt for input (usually by entering `ctrl`+`c`). |
| Terminal | isQuitError | 148 | 167 | Returns `true` if the provided value is a `Terminal.QuitError`. |
| Terminal | Terminal | 168 | 180 | Service tag for command-line input and output services. |
| Terminal | make | 181 | 202 | Creates a `Terminal` service implementation. |
| TextDiff | Edit | 3 | 19 | One run of an edit script. |
| TextDiff | EditEqual | 20 | 30 | Run of items present in both sequences. |
| TextDiff | EditInsert | 31 | 41 | Run of items present only in the `after` sequence. |
| TextDiff | EditDelete | 42 | 55 | Run of items present only in the `before` sequence. |
| TextDiff | TextDiffError | 56 | 79 | Error returned when an edit script does not fit the input it is applied to. |
| TextDiff | isTextDiffError | 80 | 87 | Checks whether a value is a `TextDiffError`. |
| TextDiff | diffWith | 88 | 137 | Creates a function that computes a minimal edit script between two arrays using a custom equivalence. |
| TextDiff | diff | 138 | 180 | Computes a minimal edit script between two arrays, comparing items with `Equal.equals`. |
| TextDiff | lines | 181 | 222 | Computes a minimal line-level edit script between two strings. |
| TextDiff | codePoints | 223 | 265 | Computes a minimal code point edit script between two strings. |
| TextDiff | apply | 266 | 297 | Applies an edit script to an array. |
| TextDiff | applyText | 298 | 328 | Applies a text edit script to a string. |
| TextDiff | invert | 329 | 351 | Inverts an edit script, so it turns `after` back into `before`. |
| TextDiff | unified | 352 | 399 | Formats a line edit script as a unified diff. |
| Tracer | Tracer | 19 | 41 | A tracing backend used by Effect to create spans. |
| Tracer | EffectPrimitive | 42 | 52 | A low-level Effect primitive that can be evaluated by a tracer-specific context for the current fiber. |
| Tracer | SpanStatus | 53 | 95 | Lifecycle state of a span, where `Started` records the start time and `Ended` records the start time, end time, and exit value with which... |
| Tracer | AnySpan | 96 | 121 | A span value that can participate in tracing, either an Effect-managed `Span` or an `ExternalSpan` propagated from another tracing system. |
| Tracer | ParentSpanKey | 122 | 144 | Defines the string key for the parent-span context service. |
| Tracer | ParentSpan | 145 | 169 | Context service containing the `Span` or `ExternalSpan` to use as the parent of newly-created child spans. |
| Tracer | ExternalSpan | 170 | 203 | Represents a span created outside Effect's tracer, carrying trace and span identifiers, sampling state, and annotations so it can be used... |
| Tracer | SpanOptions | 204 | 245 | Options accepted by span-creating APIs, combining span metadata such as attributes, links, parent/root selection, kind, sampling, and tra... |
| Tracer | SpanOptionsNoTrace | 246 | 264 | Span creation options that do not control stack trace capture, including attributes, links, parent or root selection, annotations, span k... |
| Tracer | TraceOptions | 265 | 275 | Options that control stack trace capture for tracing wrappers. |
| Tracer | SpanKind | 276 | 309 | OpenTelemetry-style role describing the kind of operation represented by a span: internal work, server handling, client calls, producing,... |
| Tracer | Span | 310 | 396 | A span created by an Effect tracer. |
| Tracer | SpanLink | 397 | 442 | A relationship from one span to another span, with attributes describing the relationship. |
| Tracer | make | 443 | 463 | Creates a `Tracer` value from a tracer implementation object. |
| Tracer | externalSpan | 464 | 509 | Creates an `ExternalSpan` from trace and span identifiers, defaulting `sampled` to `true` and annotations to an empty context when they a... |
| Tracer | DisablePropagation | 510 | 540 | Context reference for disabling trace propagation. |
| Tracer | CurrentTraceLevel | 541 | 560 | Context reference for controlling the current trace level for dynamic filtering. |
| Tracer | MinimumTraceLevel | 561 | 586 | Context reference for setting the minimum trace level threshold. |
| Tracer | TracerKey | 587 | 599 | Defines the string key for the active tracer context reference. |
| Tracer | Tracer | 600 | 624 | Context reference for the active tracer service. |
| Tracer | nativeTracer | 625 | 639 | The default `Tracer` implementation backing the `Tracer` reference. |
| Tracer | NativeSpan | 640 | 693 | Default in-memory `Span` implementation used by the native tracer. |
| Trie | Trie | 20 | 63 | An immutable string-keyed map optimized for prefix lookup. |
| Trie | empty | 64 | 82 | Creates an empty `Trie`. |
| Trie | fromIterable | 83 | 106 | Creates a new `Trie` from an iterable collection of key/value pairs (e.g. |
| Trie | make | 107 | 125 | Constructs a new `Trie` from the specified entries (`[string, V]`). |
| Trie | insert | 126 | 204 | Inserts a new entry in the `Trie`. |
| Trie | keys | 205 | 230 | Returns an `IterableIterator` of the keys within the `Trie`. |
| Trie | values | 231 | 256 | Returns an `IterableIterator` of the values within the `Trie`. |
| Trie | entries | 257 | 281 | Returns an `IterableIterator` of the entries within the `Trie`. |
| Trie | toEntries | 282 | 305 | Returns an `Array<[string, V]>` of the entries within the `Trie`. |
| Trie | keysWithPrefix | 306 | 378 | Returns an `IterableIterator` of the keys within the `Trie` that have `prefix` as prefix (`prefix` included if it exists). |
| Trie | valuesWithPrefix | 379 | 451 | Returns an `IterableIterator` of the values within the `Trie` that have `prefix` as prefix (`prefix` included if it exists). |
| Trie | entriesWithPrefix | 452 | 524 | Returns an `IterableIterator` of the entries within the `Trie` that have `prefix` as prefix (`prefix` included if it exists). |
| Trie | toEntriesWithPrefix | 525 | 597 | Returns an `Array<[string, V]>` of the entries within the `Trie` whose keys start with `prefix`, including the entry for `prefix` itself ... |
| Trie | longestPrefixOf | 598 | 670 | Returns the longest key/value in the `Trie` that is a prefix of that `key` if it exists, `None` otherwise. |
| Trie | size | 671 | 691 | Returns the size of the `Trie` (number of entries in the `Trie`). |
| Trie | get | 692 | 782 | Looks up the value for the specified key in the `Trie` safely. |
| Trie | has | 783 | 873 | Checks whether the given key exists in the `Trie`. |
| Trie | isEmpty | 874 | 893 | Returns `true` when the `Trie` contains no entries. |
| Trie | getUnsafe | 894 | 996 | Looks up the value for the specified key in the `Trie` unsafely. |
| Trie | remove | 997 | 1081 | Removes the entry for the specified key in the `Trie`. |
| Trie | reduce | 1082 | 1154 | Reduces a state over the entries of the `Trie`. |
| Trie | map | 1155 | 1224 | Maps over the entries of the `Trie` using the specified function. |
| Trie | filter | 1225 | 1340 | Filters entries out of a `Trie` using the specified predicate. |
| Trie | filterMap | 1341 | 1422 | Maps over the entries of the `Trie` using the specified filter and keeps only successful results. |
| Trie | compact | 1423 | 1444 | Filters out `None` values from a `Trie` of `Options`s. |
| Trie | forEach | 1445 | 1526 | Applies the specified function to the entries of the `Trie`. |
| Trie | modify | 1527 | 1596 | Updates the value of the specified key within the `Trie` if it exists. |
| Trie | removeMany | 1597 | 1663 | Removes all entries in the `Trie` which have the specified keys. |
| Trie | insertMany | 1664 | 1732 | Inserts multiple entries in the `Trie` at once. |
| Tuple | make | 19 | 47 | Creates a tuple from the provided arguments. |
| Tuple | get | 48 | 133 | Retrieves the element at the specified index from a tuple. |
| Tuple | pick | 134 | 213 | Creates a new tuple containing only the elements at the specified indices. |
| Tuple | omit | 214 | 289 | Creates a new tuple with the elements at the specified indices removed. |
| Tuple | appendElement | 290 | 368 | Appends a single element to the end of a tuple. |
| Tuple | appendElements | 369 | 454 | Concatenates two tuples into a single tuple. |
| Tuple | evolve | 455 | 560 | Transforms elements of a tuple by providing an array of transform functions. |
| Tuple | renameIndices | 561 | 671 | Renames tuple indices by providing an array of stringified source indices. |
| Tuple | map | 672 | 790 | Applies a `Struct.Lambda` transformation to every element in a tuple. |
| Tuple | mapPick | 791 | 894 | Applies a `Struct.Lambda` transformation only to the elements at the specified indices; all other elements are copied unchanged. |
| Tuple | mapOmit | 895 | 998 | Applies a `Struct.Lambda` transformation to all elements except those at the specified indices; the excluded elements are copied unchanged. |
| Tuple | makeEquivalence | 999 | 1031 | Creates an `Equivalence` for tuples by comparing corresponding elements using the provided per-position `Equivalence`s. |
| Tuple | makeOrder | 1032 | 1133 | Creates an `Order` for tuples by comparing corresponding elements using the provided per-position `Order`s. |
| Tuple | makeCombiner | 1134 | 1164 | Creates a `Combiner` for a tuple shape by providing a `Combiner` for each position. |
| Tuple | makeReducer | 1165 | 1201 | Creates a `Reducer` for a tuple shape by providing a `Reducer` for each position. |
| TxChunk | TxChunk | 21 | 70 | TxChunk is a transactional chunk data structure that provides Software Transactional Memory (STM) semantics for chunk operations. |
| TxChunk | make | 71 | 101 | Creates a new `TxChunk` with the specified initial chunk. |
| TxChunk | empty | 102 | 136 | Creates a new empty `TxChunk`. |
| TxChunk | fromIterable | 137 | 176 | Creates a new `TxChunk` from an iterable. |
| TxChunk | makeUnsafe | 177 | 200 | Creates a new `TxChunk` with the specified TxRef. |
| TxChunk | isTxChunk | 201 | 219 | Checks whether `u` is a `TxChunk<unknown>`. |
| TxChunk | modify | 220 | 322 | Modifies the value of the `TxChunk` using the provided function. |
| TxChunk | update | 323 | 416 | Updates the value of the `TxChunk` using the provided function. |
| TxChunk | get | 417 | 440 | Reads the current chunk from the `TxChunk`. |
| TxChunk | set | 441 | 537 | Sets the value of the `TxChunk`. |
| TxChunk | append | 538 | 631 | Appends an element to the end of the `TxChunk`. |
| TxChunk | prepend | 632 | 725 | Prepends an element to the beginning of the `TxChunk`. |
| TxChunk | size | 726 | 753 | Gets the size of the `TxChunk`. |
| TxChunk | isEmpty | 754 | 780 | Checks whether the `TxChunk` is empty. |
| TxChunk | isNonEmpty | 781 | 807 | Checks whether the `TxChunk` is non-empty. |
| TxChunk | take | 808 | 901 | Takes the first `n` elements from the `TxChunk`. |
| TxChunk | drop | 902 | 995 | Drops the first `n` elements from the `TxChunk`. |
| TxChunk | slice | 996 | 1089 | Takes a slice of the `TxChunk` from `start` to `end` (exclusive). |
| TxChunk | map | 1090 | 1186 | Maps each element of the `TxChunk` using a function that returns the same element type. |
| TxChunk | filter | 1187 | 1342 | Filters the `TxChunk` keeping only elements that satisfy the predicate. |
| TxChunk | appendAll | 1343 | 1439 | Concatenates another chunk to the end of the `TxChunk`. |
| TxChunk | prependAll | 1440 | 1536 | Concatenates another chunk to the beginning of the `TxChunk`. |
| TxChunk | concat | 1537 | 1644 | Concatenates another `TxChunk` to the end of this `TxChunk`. |
| TxDeferred | TxDeferred | 20 | 59 | A transactional deferred is a write-once cell readable within transactions. |
| TxDeferred | make | 60 | 105 | Creates a new empty `TxDeferred`. |
| TxDeferred | await | 106 | 123 | Reads the deferred value. |
| TxDeferred | poll | 124 | 153 | Reads the current state of the deferred without retrying. |
| TxDeferred | done | 154 | 238 | Completes the deferred with a `Result`. |
| TxDeferred | succeed | 239 | 323 | Completes the deferred with a success value. |
| TxDeferred | fail | 324 | 411 | Completes the deferred with a failure. |
| TxDeferred | isTxDeferred | 412 | 437 | Determines if the provided value is a `TxDeferred`. |
| TxHashMap | TxHashMap | 21 | 63 | A TxHashMap is a transactional hash map data structure that provides atomic operations on key-value pairs within Effect transactions. |
| TxHashMap | TxHashMap | 64 | 202 | The TxHashMap namespace contains type-level utilities and helper types for working with TxHashMap instances. |
| TxHashMap | empty | 203 | 231 | Creates an empty TxHashMap. |
| TxHashMap | make | 232 | 263 | Creates a TxHashMap from the provided key-value pairs. |
| TxHashMap | fromIterable | 264 | 299 | Creates a TxHashMap from an iterable of key-value pairs. |
| TxHashMap | get | 300 | 390 | Looks up the value for the specified key in the TxHashMap. |
| TxHashMap | set | 391 | 511 | Sets the value for the specified key in the TxHashMap. |
| TxHashMap | has | 512 | 605 | Checks whether the specified key exists in the TxHashMap. |
| TxHashMap | remove | 606 | 723 | Removes the specified key from the TxHashMap. |
| TxHashMap | clear | 724 | 762 | Removes all entries from the TxHashMap. |
| TxHashMap | size | 763 | 796 | Returns the number of entries in the TxHashMap. |
| TxHashMap | isEmpty | 797 | 826 | Checks whether the TxHashMap is empty. |
| TxHashMap | isNonEmpty | 827 | 852 | Checks whether the TxHashMap is non-empty. |
| TxHashMap | modify | 853 | 1003 | Updates the value for the specified key if it exists, returning the previous value in `Some`; returns `None` and leaves the map unchanged... |
| TxHashMap | modifyAt | 1004 | 1142 | Updates the value for the specified key using an Option-based update function. |
| TxHashMap | keys | 1143 | 1179 | Returns an array of all keys in the TxHashMap. |
| TxHashMap | values | 1180 | 1214 | Returns an array of all values in the TxHashMap. |
| TxHashMap | entries | 1215 | 1240 | Returns an array of all key-value pairs in the TxHashMap. |
| TxHashMap | snapshot | 1241 | 1278 | Returns an immutable snapshot of the current TxHashMap state. |
| TxHashMap | union | 1279 | 1420 | Merges another HashMap into this TxHashMap. |
| TxHashMap | removeMany | 1421 | 1565 | Removes multiple keys from the TxHashMap. |
| TxHashMap | setMany | 1566 | 1758 | Sets multiple key-value pairs in the TxHashMap. |
| TxHashMap | isTxHashMap | 1759 | 1795 | Returns `true` if the specified value is a `TxHashMap`, `false` otherwise. |
| TxHashMap | getHash | 1796 | 1931 | Looks up the value for the specified key using a caller-supplied hash. |
| TxHashMap | hasHash | 1932 | 2094 | Checks whether the specified key has an entry using a caller-supplied hash. |
| TxHashMap | map | 2095 | 2242 | Transforms all values in the TxHashMap using the provided function, preserving keys. |
| TxHashMap | filter | 2243 | 2508 | Filters the TxHashMap to keep only entries that satisfy the provided predicate. |
| TxHashMap | reduce | 2509 | 2653 | Reduces the TxHashMap entries to a single value by applying a reducer function. |
| TxHashMap | filterMap | 2654 | 2837 | Combines filtering and mapping in a single operation. |
| TxHashMap | hasBy | 2838 | 2967 | Checks whether any entry in the TxHashMap matches the given predicate. |
| TxHashMap | findFirst | 2968 | 3085 | Finds the first entry in the TxHashMap that matches the given predicate. |
| TxHashMap | some | 3086 | 3212 | Checks whether at least one entry in the TxHashMap satisfies the given predicate. |
| TxHashMap | every | 3213 | 3339 | Checks whether all entries in the TxHashMap satisfy the given predicate. |
| TxHashMap | forEach | 3340 | 3445 | Executes a side-effect function for each entry in the TxHashMap. |
| TxHashMap | flatMap | 3446 | 3602 | Maps each entry effectfully to a `TxHashMap` and flattens the produced maps. |
| TxHashMap | compact | 3603 | 3649 | Removes all None values from a TxHashMap containing Option values. |
| TxHashMap | toEntries | 3650 | 3682 | Returns an array of all key-value pairs in the TxHashMap. |
| TxHashMap | toValues | 3683 | 3723 | Returns an array of all values in the TxHashMap. |
| TxHashSet | TxHashSet | 24 | 68 | A TxHashSet is a transactional hash set data structure that provides atomic operations on unique values within Effect transactions. |
| TxHashSet | TxHashSet | 69 | 123 | The TxHashSet namespace contains type-level utilities and helper types for working with TxHashSet instances. |
| TxHashSet | empty | 124 | 151 | Creates an empty TxHashSet. |
| TxHashSet | make | 152 | 178 | Creates a TxHashSet from a variable number of values. |
| TxHashSet | fromIterable | 179 | 205 | Creates a TxHashSet from an iterable collection of values. |
| TxHashSet | fromHashSet | 206 | 234 | Creates a TxHashSet from an existing HashSet. |
| TxHashSet | isTxHashSet | 235 | 261 | Checks whether a value is a TxHashSet. |
| TxHashSet | add | 262 | 358 | Adds a value to the TxHashSet. |
| TxHashSet | remove | 359 | 452 | Removes a value from the TxHashSet. |
| TxHashSet | has | 453 | 570 | Checks whether the TxHashSet contains the specified value. |
| TxHashSet | size | 571 | 597 | Returns the number of values in the TxHashSet. |
| TxHashSet | isEmpty | 598 | 621 | Checks whether the TxHashSet is empty. |
| TxHashSet | isNonEmpty | 622 | 646 | Checks whether the TxHashSet is non-empty. |
| TxHashSet | clear | 647 | 675 | Removes all values from the TxHashSet. |
| TxHashSet | union | 676 | 751 | Creates the union of two TxHashSets, returning a new TxHashSet. |
| TxHashSet | intersection | 752 | 827 | Creates the intersection of two TxHashSets, returning a new TxHashSet. |
| TxHashSet | difference | 828 | 903 | Creates the difference of two TxHashSets (elements in the first set that are not in the second), returning a new TxHashSet. |
| TxHashSet | isSubset | 904 | 985 | Checks whether a TxHashSet is a subset of another TxHashSet. |
| TxHashSet | some | 986 | 1064 | Checks whether at least one value in the TxHashSet satisfies the predicate. |
| TxHashSet | every | 1065 | 1143 | Checks whether all values in the TxHashSet satisfy the predicate. |
| TxHashSet | map | 1144 | 1231 | Maps each value in the TxHashSet using the provided function, returning a new TxHashSet. |
| TxHashSet | filter | 1232 | 1352 | Filters the TxHashSet keeping only values that satisfy the predicate, returning a new TxHashSet. |
| TxHashSet | reduce | 1353 | 1425 | Reduces the TxHashSet to a single value by iterating through the values and applying an accumulator function. |
| TxHashSet | toHashSet | 1426 | 1456 | Converts the TxHashSet to an immutable HashSet snapshot. |
| TxPriorityQueue | TxPriorityQueue | 24 | 57 | A transactional priority queue backed by a sorted `Chunk`. |
| TxPriorityQueue | empty | 58 | 78 | Creates an empty `TxPriorityQueue` with the given ordering. |
| TxPriorityQueue | fromIterable | 79 | 99 | Creates a `TxPriorityQueue` from an iterable of elements. |
| TxPriorityQueue | fromIterable | 100 | 100 |  |
| TxPriorityQueue | make | 101 | 121 | Creates a `TxPriorityQueue` from variadic elements. |
| TxPriorityQueue | size | 122 | 142 | Returns the number of elements in the queue. |
| TxPriorityQueue | isEmpty | 143 | 163 | Returns `true` if the queue is empty. |
| TxPriorityQueue | isNonEmpty | 164 | 184 | Returns `true` if the queue has at least one element. |
| TxPriorityQueue | peek | 185 | 210 | Observes the smallest element without removing it. |
| TxPriorityQueue | peekOption | 211 | 236 | Observes the smallest element without removing it, returning `None` when the queue is empty. |
| TxPriorityQueue | offer | 237 | 306 | Inserts an element into the queue in sorted position. |
| TxPriorityQueue | offerAll | 307 | 373 | Inserts all elements from an iterable into the queue. |
| TxPriorityQueue | take | 374 | 394 | Takes the smallest element from the queue. |
| TxPriorityQueue | takeAll | 395 | 415 | Takes all elements from the queue, returning them in priority order. |
| TxPriorityQueue | takeOption | 416 | 436 | Tries to take the smallest element. |
| TxPriorityQueue | takeUpTo | 437 | 500 | Takes up to `n` elements from the queue in priority order. |
| TxPriorityQueue | removeIf | 501 | 567 | Removes elements matching the predicate. |
| TxPriorityQueue | retainIf | 568 | 634 | Keeps only elements matching the predicate. |
| TxPriorityQueue | toArray | 635 | 655 | Returns all elements in priority order without removing them. |
| TxPriorityQueue | isTxPriorityQueue | 656 | 678 | Determines if the provided value is a `TxPriorityQueue`. |
| TxPubSub | TxPubSub | 7 | 39 | A TxPubSub represents a transactional publish/subscribe hub that broadcasts messages to all current subscribers using Software Transactio... |
| TxPubSub | bounded | 40 | 68 | Creates a bounded TxPubSub with the specified capacity. |
| TxPubSub | dropping | 69 | 101 | Creates a dropping TxPubSub with the specified capacity. |
| TxPubSub | sliding | 102 | 132 | Creates a sliding TxPubSub with the specified capacity. |
| TxPubSub | unbounded | 133 | 160 | Creates an unbounded TxPubSub with unlimited capacity. |
| TxPubSub | capacity | 161 | 181 | Returns the capacity of the TxPubSub. |
| TxPubSub | size | 182 | 210 | Returns the current number of messages across all subscriber queues (the max). |
| TxPubSub | isEmpty | 211 | 231 | Checks whether the TxPubSub has no pending messages (all subscriber queues are empty). |
| TxPubSub | isNonEmpty | 232 | 260 | Checks whether any subscriber queue has pending messages. |
| TxPubSub | isFull | 261 | 281 | Checks whether any subscriber queue is at capacity. |
| TxPubSub | isShutdown | 282 | 304 | Checks whether the TxPubSub has been shut down. |
| TxPubSub | publish | 305 | 413 | Publishes a message to all current subscribers. |
| TxPubSub | publishAll | 414 | 519 | Publishes all messages from an iterable to all current subscribers. |
| TxPubSub | subscribe | 520 | 556 | Subscribes to the TxPubSub, returning a scoped `TxQueue` for messages published after subscription. |
| TxPubSub | acquireSubscriber | 557 | 576 | Creates a subscriber queue and registers it with the pub/sub. |
| TxPubSub | releaseSubscriber | 577 | 655 | Removes a subscriber queue from the pub/sub and shuts it down. |
| TxPubSub | shutdown | 656 | 688 | Shuts down the TxPubSub and all subscriber queues registered at the time of shutdown. |
| TxPubSub | awaitShutdown | 689 | 713 | Waits for the TxPubSub to be shut down. |
| TxPubSub | isTxPubSub | 714 | 732 | Checks whether the given value is a TxPubSub. |
| TxQueue | State | 23 | 57 | Represents the state of a transactional queue with sophisticated lifecycle management. |
| TxQueue | TxEnqueue | 58 | 75 | Namespace containing type definitions for TxEnqueue variance annotations. |
| TxQueue | TxDequeue | 76 | 93 | Namespace containing type definitions for TxDequeue variance annotations. |
| TxQueue | TxQueue | 94 | 111 | Namespace containing type definitions for TxQueue variance annotations. |
| TxQueue | TxQueueState | 112 | 126 | Represents the shared state of a transactional queue that can be inspected. |
| TxQueue | TxEnqueue | 127 | 167 | A TxEnqueue represents the write-only interface of a transactional queue, providing operations for adding elements (enqueue operations) a... |
| TxQueue | TxDequeue | 168 | 202 | A TxDequeue represents the read-only interface of a transactional queue, providing operations for consuming elements (dequeue operations)... |
| TxQueue | TxQueue | 203 | 238 | A TxQueue represents a transactional queue data structure that provides both enqueue and dequeue operations with Software Transactional M... |
| TxQueue | isTxEnqueue | 239 | 255 | Checks whether the given value is a TxEnqueue. |
| TxQueue | isTxDequeue | 256 | 272 | Checks whether the given value is a TxDequeue. |
| TxQueue | isTxQueue | 273 | 289 | Checks whether the given value is a TxQueue. |
| TxQueue | bounded | 290 | 323 | Creates a new bounded `TxQueue` with the specified capacity. |
| TxQueue | unbounded | 324 | 357 | Creates a new unbounded `TxQueue` with unlimited capacity. |
| TxQueue | dropping | 358 | 389 | Creates a new dropping `TxQueue` with the specified capacity that drops new items when full. |
| TxQueue | sliding | 390 | 423 | Creates a new sliding `TxQueue` with the specified capacity that evicts old items when full. |
| TxQueue | offer | 424 | 505 | Offers an item to the queue and returns whether it was accepted. |
| TxQueue | offerAll | 506 | 590 | Offers multiple items to the queue, returning the items that were not accepted. |
| TxQueue | take | 591 | 624 | Takes the next item from the queue, retrying the transaction while the queue is empty. |
| TxQueue | poll | 625 | 651 | Tries to take an item from the queue without blocking. |
| TxQueue | takeAll | 652 | 690 | Takes all items from the queue. |
| TxQueue | takeN | 691 | 787 | Takes up to `n` items from the queue in a single transaction. |
| TxQueue | takeBetween | 788 | 896 | Takes between `min` and `max` currently available items, waiting for `min` on an open queue. |
| TxQueue | peek | 897 | 938 | Waits transactionally for the next item and returns it without removing it. |
| TxQueue | size | 939 | 961 | Gets the current size of the queue. |
| TxQueue | isEmpty | 962 | 987 | Checks whether the queue is empty. |
| TxQueue | isNonEmpty | 988 | 1013 | Checks whether the queue is non-empty. |
| TxQueue | isFull | 1014 | 1039 | Checks whether the queue is at capacity. |
| TxQueue | interrupt | 1040 | 1067 | Interrupts the queue gracefully with the current fiber's interruption cause. |
| TxQueue | fail | 1068 | 1149 | Fails the queue with the specified error, discarding any buffered items. |
| TxQueue | failCause | 1150 | 1237 | Completes the queue with the specified cause. |
| TxQueue | end | 1238 | 1270 | Ends a queue by signaling completion with a `Cause.Done` error. |
| TxQueue | clear | 1271 | 1302 | Removes and returns all currently buffered elements. |
| TxQueue | shutdown | 1303 | 1336 | Shuts down the queue immediately by clearing all items and interrupting it (legacy compatibility). |
| TxQueue | isOpen | 1337 | 1362 | Checks whether the queue is in the open state. |
| TxQueue | isClosing | 1363 | 1389 | Checks whether the queue is in the closing state. |
| TxQueue | isDone | 1390 | 1415 | Checks whether the queue is done (completed or failed). |
| TxQueue | isShutdown | 1416 | 1441 | Checks whether the queue is shutdown (legacy compatibility). |
| TxQueue | awaitCompletion | 1442 | 1469 | Waits for the queue to complete (either successfully or with failure). |
| TxReentrantLock | TxReentrantLock | 19 | 49 | A TxReentrantLock provides a transactional read/write lock with reentrant semantics. |
| TxReentrantLock | make | 50 | 70 | Creates a new TxReentrantLock. |
| TxReentrantLock | acquireRead | 71 | 95 | Acquires a read lock. |
| TxReentrantLock | acquireWrite | 96 | 131 | Acquires the write lock for the current fiber. |
| TxReentrantLock | releaseRead | 132 | 147 | Releases one read lock held by the current fiber. |
| TxReentrantLock | releaseWrite | 148 | 163 | Releases one write lock held by the current fiber. |
| TxReentrantLock | readLock | 164 | 194 | Acquires a read lock for the duration of the scope. |
| TxReentrantLock | writeLock | 195 | 225 | Acquires a write lock for the duration of the scope. |
| TxReentrantLock | withReadLock | 226 | 301 | Runs the provided effect while holding a read lock. |
| TxReentrantLock | withWriteLock | 302 | 377 | Runs the provided effect while holding a write lock. |
| TxReentrantLock | withLock | 378 | 465 | Runs an effect while holding a write lock. |
| TxReentrantLock | readLocks | 466 | 489 | Returns the total number of read locks held across all fibers. |
| TxReentrantLock | writeLocks | 490 | 510 | Returns the number of write locks held (0 or the reentrant count). |
| TxReentrantLock | locked | 511 | 531 | Checks whether the lock is held by any fiber (read or write). |
| TxReentrantLock | readLocked | 532 | 552 | Checks whether any fiber holds a read lock. |
| TxReentrantLock | writeLocked | 553 | 573 | Checks whether any fiber holds a write lock. |
| TxReentrantLock | isTxReentrantLock | 574 | 593 | Checks whether the given value is a TxReentrantLock. |
| TxRef | TxRef | 19 | 64 | TxRef is a transactional value, it can be read and modified within the body of a transaction. |
| TxRef | make | 65 | 98 | Creates a new `TxRef` with the specified initial value. |
| TxRef | makeUnsafe | 99 | 125 | Creates a new `TxRef` synchronously with the specified initial value. |
| TxRef | modify | 126 | 216 | Modifies the value of the `TxRef` using the provided function. |
| TxRef | update | 217 | 310 | Updates the value of the `TxRef` using the provided function. |
| TxRef | get | 311 | 341 | Reads the current value of the `TxRef`. |
| TxRef | set | 342 | 437 | Sets the value of the `TxRef`. |
| TxSemaphore | TxSemaphore | 19 | 66 | A transactional semaphore that manages permits using Software Transactional Memory (STM) semantics, providing atomic permit acquisition a... |
| TxSemaphore | make | 67 | 100 | Creates a new TxSemaphore with the specified number of permits. |
| TxSemaphore | available | 101 | 137 | Gets the current number of available permits in the semaphore. |
| TxSemaphore | capacity | 138 | 170 | Gets the maximum capacity (total permits) of the semaphore. |
| TxSemaphore | acquire | 171 | 206 | Acquires a single permit from the semaphore. |
| TxSemaphore | acquireN | 207 | 336 | Acquires the specified number of permits from the semaphore. |
| TxSemaphore | tryAcquire | 337 | 372 | Tries to acquire a single permit from the semaphore without blocking, returning `true` if successful or `false` if no permits are available. |
| TxSemaphore | tryAcquireN | 373 | 484 | Tries to acquire the specified number of permits from the semaphore without blocking, returning `true` if successful or `false` if not en... |
| TxSemaphore | release | 485 | 526 | Releases one permit back to the semaphore, making it available for acquisition. |
| TxSemaphore | releaseN | 527 | 659 | Releases the specified number of permits back to the semaphore. |
| TxSemaphore | withPermit | 660 | 816 | Executes an effect with a single permit from the semaphore. |
| TxSemaphore | withPermits | 817 | 982 | Runs an effect while holding the specified number of permits from the semaphore. |
| TxSemaphore | withPermitScoped | 983 | 1035 | Acquires a single permit from the semaphore in a scoped manner. |
| TxSemaphore | isTxSemaphore | 1036 | 1074 | Determines if the provided value is a TxSemaphore. |
| TxSubscriptionRef | TxSubscriptionRef | 20 | 63 | A TxSubscriptionRef is a transactional reference that allows subscribing to all committed changes. |
| TxSubscriptionRef | make | 64 | 91 | Creates a new TxSubscriptionRef with the specified initial value. |
| TxSubscriptionRef | get | 92 | 119 | Reads the current value of the TxSubscriptionRef. |
| TxSubscriptionRef | modify | 120 | 213 | Modifies the value of the TxSubscriptionRef using a function that returns both a result and the new value. |
| TxSubscriptionRef | set | 214 | 304 | Sets the value of the TxSubscriptionRef and publishes the new value to all subscribers. |
| TxSubscriptionRef | update | 305 | 398 | Updates the value of the TxSubscriptionRef using a function and publishes the new value to all subscribers. |
| TxSubscriptionRef | getAndSet | 399 | 492 | Gets the current value and sets a new value atomically. |
| TxSubscriptionRef | getAndUpdate | 493 | 586 | Gets the current value and updates it using a function atomically. |
| TxSubscriptionRef | updateAndGet | 587 | 677 | Updates the value using a function and returns the new value. |
| TxSubscriptionRef | changes | 678 | 716 | Subscribes to all changes of the TxSubscriptionRef. |
| TxSubscriptionRef | changesStream | 717 | 750 | Returns a Stream of all changes to the TxSubscriptionRef, starting with the current value followed by every subsequent update. |
| TxSubscriptionRef | isTxSubscriptionRef | 751 | 775 | Checks whether the given value is a TxSubscriptionRef. |
| Types | TupleOf | 17 | 53 | Constructs a tuple type with exactly `N` elements of type `T`. |
| Types | TupleOfAtLeast | 54 | 86 | Constructs a tuple type with at least `N` elements of type `T`. |
| Types | Tags | 87 | 123 | Extracts the `_tag` string literal types from a union. |
| Types | ExcludeTag | 124 | 161 | Excludes members of a tagged union by their `_tag` value. |
| Types | ExtractTag | 162 | 198 | Extracts a specific member of a tagged union by its `_tag` value. |
| Types | UnionToIntersection | 199 | 232 | Transforms a union type into an intersection type. |
| Types | Simplify | 233 | 266 | Flattens an intersection type into a single object type for readability. |
| Types | Equals | 267 | 296 | Determines if two types are exactly equal at the type level. |
| Types | EqualsWith | 297 | 323 | Determines if two types are equal, returning custom types for each case. |
| Types | Has | 324 | 350 | Checks whether an object type contains any of the specified keys. |
| Types | MergeLeft | 351 | 384 | Left-biased merge of two object types where keys from `Source` take precedence over `Target` on conflict. |
| Types | MergeRight | 385 | 420 | Right-biased merge of two object types where keys from `Source` take precedence over `Target` on conflict. |
| Types | Concurrency | 421 | 448 | Describes the concurrency level for Effect operations that run multiple effects. |
| Types | Mutable | 449 | 492 | Removes `readonly` from all properties of `T`. |
| Types | DeepMutable | 493 | 538 | Recursively removes `readonly` from plain objects, arrays, tuples, `Map`, and `Set` while preserving opaque objects. |
| Types | NoInfer | 539 | 569 | Prevents TypeScript from inferring a type parameter from a specific position. |
| Types | Invariant | 570 | 605 | Function-type alias encoding invariant variance for a phantom type parameter. |
| Types | Invariant | 606 | 641 | Namespace for {@link Invariant}-related utilities. |
| Types | Covariant | 642 | 677 | Function-type alias encoding covariant variance for a phantom type parameter. |
| Types | Covariant | 678 | 713 | Namespace for {@link Covariant}-related utilities. |
| Types | Contravariant | 714 | 752 | Function-type alias encoding contravariant variance for a phantom type parameter. |
| Types | Contravariant | 753 | 788 | Namespace for {@link Contravariant}-related utilities. |
| Types | VoidIfEmpty | 789 | 801 | Conditional type that returns `void` if `S` is an empty object type, otherwise returns `S`. |
| Types | NotFunction | 802 | 828 | Excludes function types from a union, keeping only non-function members. |
| Types | NoExcessProperties | 829 | 858 | Constrains a type to prevent excess properties not present in `T`. |
| Types | unassigned | 859 | 880 | Branded marker interface representing an unassigned type parameter. |
| Types | unhandled | 881 | 902 | Branded marker interface representing an unhandled error type. |
| Types | IsUnion | 903 | 932 | Checks whether a type `T` is a union type. |
| Types | ReasonOf | 933 | 970 | Extracts the `reason` type from an error that has a `reason` field. |
| Types | ReasonTags | 971 | 1010 | Extracts the `_tag` values from the `reason` type of an error. |
| Types | ExtractReason | 1011 | 1051 | Extracts a specific reason variant by its `_tag` from an error's `reason` field. |
| Types | NarrowReason | 1052 | 1097 | Narrows a specific reason variant by its `_tag` from an error's `reason` field. |
| Types | OmitReason | 1098 | 1144 | Narrows an error's `reason` field to exclude a specific reason variant by its `_tag`. |
| Types | ExcludeReason | 1145 | 1192 | Excludes a specific reason variant by its `_tag` from an error's `reason` field. |
| Types | RequiredKeys | 1193 | 1204 | Extracts the keys of required properties from a type. |
| UndefinedOr | map | 17 | 62 | Maps a defined value with `f`, or returns `undefined` unchanged. |
| UndefinedOr | match | 63 | 120 | Pattern matches on an `A \| undefined` value, running `onDefined` when the value is present or evaluating `onUndefined` when the value is... |
| UndefinedOr | getOrThrowWith | 121 | 187 | Returns the defined value, or throws the value produced by `onUndefined` when the input is `undefined`. |
| UndefinedOr | getOrThrow | 188 | 209 | Returns the defined value, or throws a default `Error` when the input is `undefined`. |
| UndefinedOr | liftThrowable | 210 | 228 | Converts a throwing function into one that returns successful results unchanged and returns `undefined` when the function throws. |
| UndefinedOr | makeReducer | 229 | 251 | Creates a `Reducer` for `UndefinedOr<A>` that prioritizes the first non-`undefined` value and combines values when both operands are pres... |
| UndefinedOr | makeCombinerFailFast | 252 | 274 | Creates a `Combiner` for `A \| undefined` that combines values only when both operands are defined. |
| UndefinedOr | makeReducerFailFast | 275 | 298 | Creates a `Reducer` for `A \| undefined` by wrapping an existing reducer with fail-fast semantics. |
| Unify | unifySymbol | 14 | 34 | Defines the unique symbol used to identify unification behavior in Effect types. |
| Unify | unifySymbol | 35 | 53 | The type of the unifySymbol. |
| Unify | typeSymbol | 54 | 73 | Defines the unique symbol used to identify the type information for unification. |
| Unify | typeSymbol | 74 | 92 | The type of the typeSymbol. |
| Unify | ignoreSymbol | 93 | 112 | Defines the unique symbol used to specify types that should be ignored during unification. |
| Unify | ignoreSymbol | 113 | 146 | The type of the ignoreSymbol. |
| Unify | Unify | 147 | 195 | Unifies types that implement the unification protocol. |
| Unify | unify | 196 | 499 | Applies `Unify` to a value or function return type at compile time. |
| Utils | SingleShotGen | 16 | 66 | Yields its wrapped value exactly once, then completes with the value sent back in. |
| Utils | Variance | 67 | 112 | Type-level marker encoding the variance of a `TypeLambda`'s type parameters. |
| Utils | Gen | 113 | 159 | Type-level signature for generator-based monadic composition over any `TypeLambda`. |
| Version | getCurrentVersion | 1 | 12 | Returns the current version of the `effect` package. |
| Version | setCurrentVersion | 13 | 26 | Overrides the version returned by `getCurrentVersion`. |
