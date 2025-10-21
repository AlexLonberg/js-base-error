import { bench } from 'vitest'
// Скомпилируем, чтобы получить более точный результат JS
import { BaseError, LiteError } from '../dist/index.js'

// # Производительность вызова нативной ошибки и облегченной ErrorLike без стека

const count = 50

bench('base', () => {
  for (let i = 0; i < count; ++i) {
    const ins = new BaseError({ message: 'error message', cause: 0 })
    if (ins) { /**/ }
  }
})

bench('native', () => {
  for (let i = 0; i < count; ++i) {
    const ins = new Error('error message', { cause: 0 })
    if (ins) { /**/ }
  }
})

bench('lite', () => {
  for (let i = 0; i < count; ++i) {
    const ins = new LiteError({ message: 'error message', cause: 0 })
    if (ins) { /**/ }
  }
})

/*
 ✓  chromium  scripts/likeVsNative.bench.js 2003ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · base        8,264.00  0.0000  0.5000  0.1210  0.2000  0.3000  0.3000  0.4000  ±1.60%     4132
   · native      8,220.00  0.0000  0.4000  0.1217  0.2000  0.3000  0.3000  0.3000  ±1.65%     4110
   · lite    1,501,566.00  0.0000  2.4000  0.0007  0.0000  0.0000  0.1000  0.1000  ±3.10%   750783

 BENCH  Summary

   chromium  lite - scripts/likeVsNative.bench.js
    181.70x faster than base
    182.67x faster than native
*/

/* NodeJS v24.5.0
 ✓ scripts/likeVsNative.bench.js 2045ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · base        4,372.56  0.1776  0.5193  0.2287  0.2270  0.4204  0.4469  0.4862  ±0.89%     2187
   · native      4,923.71  0.1716  0.7076  0.2031  0.2234  0.3847  0.4300  0.5306  ±0.85%     2463
   · lite    1,230,798.52  0.0006  0.1017  0.0008  0.0008  0.0013  0.0014  0.0019  ±0.16%   615400

 BENCH  Summary

  lite - scripts/likeVsNative.bench.js
    249.97x faster than native
    281.48x faster than base
*/
