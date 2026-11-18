# effect/persistence API index

Generated from the type declarations of the installed `effect@4.1.2` by `scripts/refresh-effect-api.mjs`.

Line ranges refer to [persistence.txt](persistence.txt). Read [the source guide](../README.md) before applying examples.

| Module | Export | Start line | End line |
| --- | --- | ---: | ---: |
| CircuitBreaker | (module overview) | 1 | 170 |
| CircuitBreaker | TypeId | 171 | 178 |
| CircuitBreaker | TypeId | 179 | 186 |
| CircuitBreaker | CircuitBreaker | 187 | 390 |
| CircuitBreaker | CircuitBreaker | 391 | 431 |
| CircuitBreaker | make | 432 | 482 |
| CircuitBreaker | layer | 483 | 499 |
| CircuitBreaker | TripPolicy | 500 | 525 |
| CircuitBreaker | consecutive | 526 | 537 |
| CircuitBreaker | rate | 538 | 562 |
| CircuitBreaker | Classifier | 563 | 580 |
| CircuitBreaker | Outcome | 581 | 588 |
| CircuitBreaker | Outcome | 589 | 629 |
| CircuitBreaker | success | 630 | 637 |
| CircuitBreaker | ignored | 638 | 645 |
| CircuitBreaker | failure | 646 | 661 |
| CircuitBreaker | State | 662 | 691 |
| CircuitBreaker | Transition | 692 | 724 |
| CircuitBreaker | CircuitOpen | 725 | 744 |
| CircuitBreaker | CircuitHalfOpen | 745 | 765 |
| CircuitBreaker | CircuitBreakerStoreError | 766 | 774 |
| CircuitBreaker | CircuitBreakerErrorReason | 775 | 782 |
| CircuitBreaker | CircuitBreakerErrorReason | 783 | 794 |
| CircuitBreaker | ErrorTypeId | 795 | 802 |
| CircuitBreaker | ErrorTypeId | 803 | 814 |
| CircuitBreaker | CircuitBreakerError | 815 | 846 |
| CircuitBreaker | CircuitBreakerStore | 847 | 870 |
| CircuitBreaker | Admission | 871 | 891 |
| CircuitBreaker | layerStoreMemory | 892 | 908 |
| CircuitBreaker | layerStoreRedis | 909 | 940 |
| CircuitBreaker | layerStoreRedisConfig | 941 | 959 |
| KeyValueStore | (module overview) | 960 | 985 |
| KeyValueStore | KeyValueStore | 986 | 1043 |
| KeyValueStore | MakeOptions | 1044 | 1085 |
| KeyValueStore | MakeStringOptions | 1086 | 1123 |
| KeyValueStore | KeyValueStoreError | 1124 | 1145 |
| KeyValueStore | KeyValueStore | 1146 | 1158 |
| KeyValueStore | make | 1159 | 1175 |
| KeyValueStore | makeStringOnly | 1176 | 1188 |
| KeyValueStore | prefix | 1189 | 1237 |
| KeyValueStore | layerMemory | 1238 | 1245 |
| KeyValueStore | layerFileSystem | 1246 | 1262 |
| KeyValueStore | LayerSqlOptions | 1263 | 1277 |
| KeyValueStore | layerSql | 1278 | 1291 |
| KeyValueStore | SchemaStore | 1292 | 1337 |
| KeyValueStore | toSchemaStore | 1338 | 1345 |
| KeyValueStore | layerStorage | 1346 | 1361 |
| Persistable | (module overview) | 1362 | 1381 |
| Persistable | symbol | 1382 | 1395 |
| Persistable | Persistable | 1396 | 1409 |
| Persistable | Any | 1410 | 1417 |
| Persistable | SuccessSchema | 1418 | 1425 |
| Persistable | Success | 1426 | 1433 |
| Persistable | ErrorSchema | 1434 | 1441 |
| Persistable | Error | 1442 | 1449 |
| Persistable | DecodingServices | 1450 | 1458 |
| Persistable | EncodingServices | 1459 | 1466 |
| Persistable | Services | 1467 | 1475 |
| Persistable | TimeToLiveFn | 1476 | 1484 |
| Persistable | Class | 1485 | 1509 |
| Persistable | exitSchema | 1510 | 1518 |
| Persistable | serializeExit | 1519 | 1527 |
| Persistable | deserializeExit | 1528 | 1537 |
| PersistedCache | (module overview) | 1538 | 1557 |
| PersistedCache | PersistedCache | 1558 | 1570 |
| PersistedCache | make | 1571 | 1592 |
| PersistedQueue | (module overview) | 1593 | 1621 |
| PersistedQueue | TypeId | 1622 | 1629 |
| PersistedQueue | TypeId | 1630 | 1637 |
| PersistedQueue | PersistedQueue | 1638 | 1715 |
| PersistedQueue | PersistedQueueFactory | 1716 | 1724 |
| PersistedQueue | make | 1725 | 1755 |
| PersistedQueue | makeFactory | 1756 | 1776 |
| PersistedQueue | layer | 1777 | 1784 |
| PersistedQueue | layerCleanup | 1785 | 1807 |
| PersistedQueue | ErrorTypeId | 1808 | 1815 |
| PersistedQueue | ErrorTypeId | 1816 | 1828 |
| PersistedQueue | PersistedQueueError | 1829 | 1871 |
| PersistedQueue | PersistedQueueStore | 1872 | 1899 |
| PersistedQueue | layerStoreMemory | 1900 | 1916 |
| PersistedQueue | makeStoreRedis | 1917 | 1973 |
| PersistedQueue | layerStoreRedis | 1974 | 1986 |
| PersistedQueue | makeStoreSql | 1987 | 2012 |
| PersistedQueue | layerStoreSql | 2013 | 2027 |
| Persistence | (module overview) | 2028 | 2059 |
| Persistence | PersistenceError | 2060 | 2081 |
| Persistence | Persistence | 2082 | 2091 |
| Persistence | PersistenceStore | 2092 | 2109 |
| Persistence | BackingPersistence | 2110 | 2118 |
| Persistence | BackingPersistenceStore | 2119 | 2134 |
| Persistence | layer | 2135 | 2147 |
| Persistence | layerBackingMemory | 2148 | 2159 |
| Persistence | layerBackingSqlMultiTable | 2160 | 2190 |
| Persistence | layerBackingSql | 2191 | 2203 |
| Persistence | layerBackingRedis | 2204 | 2218 |
| Persistence | layerBackingKvs | 2219 | 2235 |
| Persistence | layerKvs | 2236 | 2243 |
| Persistence | layerMemory | 2244 | 2251 |
| Persistence | layerRedis | 2252 | 2259 |
| Persistence | layerSqlMultiTable | 2260 | 2277 |
| Persistence | layerSql | 2278 | 2285 |
| Persistence | unsafeTtlToExpires | 2286 | 2300 |
| RateLimiter | (module overview) | 2301 | 2322 |
| RateLimiter | TypeId | 2323 | 2330 |
| RateLimiter | TypeId | 2331 | 2338 |
| RateLimiter | RateLimiter | 2339 | 2359 |
| RateLimiter | RateLimiter | 2360 | 2372 |
| RateLimiter | make | 2373 | 2388 |
| RateLimiter | layer | 2389 | 2396 |
| RateLimiter | makeWithRateLimiter | 2397 | 2440 |
| RateLimiter | sleep | 2441 | 2483 |
| RateLimiter | sleep | 2484 | 2493 |
| RateLimiter | ErrorTypeId | 2494 | 2501 |
| RateLimiter | ErrorTypeId | 2502 | 2516 |
| RateLimiter | RateLimitExceeded | 2517 | 2541 |
| RateLimiter | RateLimitStoreError | 2542 | 2550 |
| RateLimiter | RateLimiterErrorReason | 2551 | 2558 |
| RateLimiter | RateLimiterErrorReason | 2559 | 2573 |
| RateLimiter | RateLimiterError | 2574 | 2594 |
| RateLimiter | ConsumeResult | 2595 | 2626 |
| RateLimiter | AdaptivePhase | 2627 | 2634 |
| RateLimiter | AdaptiveConsumeOptions | 2635 | 2659 |
| RateLimiter | AdaptiveConsumeResult | 2660 | 2680 |
| RateLimiter | AdaptiveFeedbackOptions | 2681 | 2759 |
| RateLimiter | RateLimiterStore | 2760 | 2773 |
| RateLimiter | layerStoreMemory | 2774 | 2786 |
| RateLimiter | makeStoreRedis | 2787 | 2853 |
| RateLimiter | layerStoreRedis | 2854 | 2863 |
| RateLimiter | layerStoreRedisConfig | 2864 | 2876 |
| Redis | (module overview) | 2877 | 2885 |
| Redis | RedisMessage | 2886 | 2924 |
| Redis | Redis | 2925 | 2934 |
| Redis | Connection | 2935 | 2950 |
| Redis | PoolOptions | 2951 | 2973 |
| Redis | make | 2974 | 3032 |
| Redis | RedisError | 3033 | 3050 |
| Redis | Script | 3051 | 3081 |
| Redis | script | 3082 | 3102 |
| UserDirectories | (module overview) | 3103 | 3108 |
| UserDirectories | TypeId | 3109 | 3116 |
| UserDirectories | TypeId | 3117 | 3124 |
| UserDirectories | UserDirectories | 3125 | 3177 |
| UserDirectories | UserDirectories | 3178 | 3185 |
| UserDirectories | make | 3186 | 3215 |
| UserDirectories | layer | 3216 | 3223 |
| UserDirectories | layerPlatform | 3224 | 3233 |
