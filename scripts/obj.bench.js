import { bench } from 'vitest'

// # Проверка производительности создания объекта:
//    + Классы с объявленными полями и без
//    + Использование прототипа или определения свойств defineProperties()
//    + Фабричные функции и литералы

class FooClassic {
  _foo // Преположим эти поля типизированы в TS
  _bar
  _box

  constructor(foo, bar, box) {
    this._foo = foo
    this._bar = bar
    this._box = box
  }

  get foo () { return this._foo }
  get bar () { return this._bar }
  get box () { return this._box }
}

class FooDeclare {
  // Преположим эти поля определены в TS как declare
  constructor(foo, bar, box) {
    this._foo = foo
    this._bar = bar
    this._box = box
  }

  get foo () { return this._foo }
  get bar () { return this._bar }
  get box () { return this._box }
}

const PROTO = Object.freeze({
  get foo () { return this._foo },
  get bar () { return this._bar },
  get box () { return this._box }
})
function createProto (foo, bar, box) {
  return Object.assign(Object.create(PROTO), { _foo: foo, _bar: bar, _box: box })
}

function createFreeze (foo, bar, box) {
  return Object.freeze({ foo, bar, box })
}

function createDefine (foo, bar, box) {
  return Object.defineProperties({}, { foo: { value: foo }, bar: { value: bar }, box: { value: box } })
}

function createLiteral (foo, bar, box) {
  return { foo, bar, box }
}

const count = 50

bench('classic', () => {
  for (let i = 0; i < count; ++i) {
    const ins = new FooClassic(true, 0, 'str')
    if (ins) { /**/ }
  }
})

bench('declare', () => {
  for (let i = 0; i < count; ++i) {
    const ins = new FooDeclare(true, 0, 'str')
    if (ins) { /**/ }
  }
})

bench('proto', () => {
  for (let i = 0; i < count; ++i) {
    const ins = createProto(true, 0, 'str')
    if (ins) { /**/ }
  }
})


bench('freeze', () => {
  for (let i = 0; i < count; ++i) {
    const ins = createFreeze(true, 0, 'str')
    if (ins) { /**/ }
  }
})

bench('define', () => {
  for (let i = 0; i < count; ++i) {
    const ins = createDefine(true, 0, 'str')
    if (ins) { /**/ }
  }
})

bench('factory', () => {
  for (let i = 0; i < count; ++i) {
    const ins = createLiteral(true, 0, 'str')
    if (ins) { /**/ }
  }
})

bench('literal', () => {
  for (let i = 0; i < count; ++i) {
    const ins = { foo: true, bar: 0, box: 'str' }
    if (ins) { /**/ }
  }
})

/* Chromium
 ✓  chromium  src/obj.bench.js 8785ms
     name               hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · classic  7,577,054.65  0.0000  3.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±3.05%  3789285
   · declare  7,646,818.65  0.0000  0.2000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  3824174
   · proto      678,878.00  0.0000  0.3000  0.0015  0.0000  0.1000  0.1000  0.1000  ±2.76%   339439
   · freeze     708,494.00  0.0000  0.3000  0.0014  0.0000  0.1000  0.1000  0.1000  ±2.76%   354247
   · define      51,039.79  0.0000  0.4000  0.0196  0.0000  0.1000  0.1000  0.2000  ±2.53%    25525   slowest
   · factory  7,937,459.98  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  3968730
   · literal  8,003,027.41  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  4002314   fastest

 BENCH  Summary

   chromium  literal - src/obj.bench.js
    1.01x faster than factory
    1.05x faster than declare
    1.06x faster than classic
    11.30x faster than freeze
    11.79x faster than proto
    156.80x faster than define
*/

/* NodeJS v24.5.0
 ✓ src/obj.bench.js 14505ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme   samples
   · classic  19,613,376.00  0.0000  0.3724  0.0001  0.0001  0.0001  0.0001  0.0002  ±0.25%   9806688
   · declare  19,381,564.12  0.0000  0.1439  0.0001  0.0001  0.0001  0.0002  0.0002  ±0.21%   9690784
   · proto       686,745.73  0.0012  0.5767  0.0015  0.0014  0.0027  0.0034  0.0142  ±0.69%    343373
   · freeze      805,680.23  0.0010  0.4316  0.0012  0.0012  0.0022  0.0025  0.0082  ±0.54%    402841
   · define       35,210.51  0.0251  0.5241  0.0284  0.0280  0.0583  0.0663  0.1181  ±0.55%     17606   slowest
   · factory  19,901,600.00  0.0000  0.4001  0.0001  0.0001  0.0001  0.0001  0.0002  ±0.29%   9950800
   · literal  20,067,063.99  0.0000  0.1446  0.0000  0.0001  0.0001  0.0001  0.0002  ±0.21%  10033534   fastest

 BENCH  Summary

  literal - src/obj.bench.js
    1.01x faster than factory
    1.02x faster than classic
    1.04x faster than declare
    24.91x faster than freeze
    29.22x faster than proto
    569.92x faster than define
*/
