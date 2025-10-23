import { bench } from 'vitest'
// Скомпилируем, чтобы получить более точный результат JS
import { captureStackTrace as cst_, ErrorLike, BaseError as BaseError_, LiteError as LiteError_ } from '../dist/index.js'
const captureStackTrace = cst_
const BaseError = BaseError_
const LiteError = LiteError_

// # Производительность вызова нативной ошибки и облегченной ErrorLike без стека

// Добавим ошибку с управляемым стеком
class WithStackError extends ErrorLike {
  _detail
  constructor(detail, modeDev) {
    super()
    this._detail = detail
    if (modeDev) {
      captureStackTrace(this, this.constructor)
    }
  }
}

const count = 50

bench('without stack', () => {
  for (let i = 0; i < count; ++i) {
    const ins = new WithStackError({ message: 'error message', cause: 0 }, false)
    if (ins) { /**/ }
  }
})

bench('with stack', () => {
  for (let i = 0; i < count; ++i) {
    const ins = new WithStackError({ message: 'error message', cause: 0 }, true)
    if (ins) { /**/ }
  }
})

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
 ✓  chromium  scripts/likeVsNative.bench.js 3442ms
     name                     hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · without stack  1,593,884.00  0.0000  2.8000  0.0006  0.0000  0.0000  0.1000  0.1000  ±3.20%   796942
   · with stack         4,373.38  0.1000  0.8000  0.2287  0.3000  0.5000  0.5000  0.7000  ±1.38%     2188
   · base               8,066.39  0.0000  2.5000  0.1240  0.2000  0.3000  0.3000  0.4000  ±1.97%     4034
   · native             9,192.16  0.0000  0.5000  0.1088  0.1000  0.3000  0.3000  0.4000  ±1.65%     4597
   · lite           1,556,272.75  0.0000  0.3000  0.0006  0.0000  0.0000  0.1000  0.1000  ±2.77%   778292

 BENCH  Summary

   chromium  without stack - scripts/likeVsNative.bench.js
    1.02x faster than lite
    173.40x faster than native
    197.60x faster than base
    364.45x faster than with stack
*/

/* NodeJS v24.5.0
 ✓ scripts/likeVsNative.bench.js 8202ms
     name                      hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · without stack  18,806,208.24  0.0000  0.1851  0.0001  0.0001  0.0001  0.0001  0.0003  ±0.23%  9403106
   · with stack            695.39  1.2127  7.9208  1.4380  1.4029  2.7393  6.4999  7.9208  ±3.75%      348
   · base                4,238.37  0.2120  1.0717  0.2359  0.2388  0.3946  0.5037  0.8370  ±0.81%     2120
   · native              4,110.65  0.2250  0.8679  0.2433  0.2364  0.4301  0.5428  0.6532  ±0.74%     2056
   · lite           19,595,700.00  0.0000  0.1832  0.0001  0.0001  0.0001  0.0001  0.0002  ±0.24%  9797850

 BENCH  Summary

  lite - scripts/likeVsNative.bench.js
    1.04x faster than without stack
    4623.40x faster than base
    4767.05x faster than native
    28179.25x faster than with stack
*/
