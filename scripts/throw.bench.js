import { bench } from 'vitest'

// # Проверка влияния try/catch на производительность(когда нет ошибки).

// Базовые объекты для тестирования
const testObj = {
  a: 1,
  b: 2,
  c: 3,
  nested: {
    x: 10,
    y: 20
  }
}

const safeObj = {
  prop1: 'value1',
  prop2: 'value2',
  prop3: 'value3'
}

// 1. Простое чтение свойств
bench('try/catch - простое чтение', () => {
  try {
    return testObj.a + testObj.b
  } catch {
    return 0
  }
})

bench('literal - простое чтение', () => {
  return testObj.a + testObj.b
})

// 2. Множественное чтение свойств
bench('try/catch - множественное чтение', () => {
  try {
    return testObj.a + testObj.b + testObj.c + testObj.nested.x
  } catch {
    return 0
  }
})

bench('literal - множественное чтение', () => {
  return testObj.a + testObj.b + testObj.c + testObj.nested.x
})

// 3. Вложенные блоки try/catch
bench('try/catch - вложенные блоки', () => {
  try {
    const first = testObj.a
    try {
      const second = testObj.nested.x
      return first + second
    } catch {
      return first
    }
  } catch {
    return 0
  }
})

bench('literal - вложенные блоки', () => {
  const first = testObj.a
  const second = testObj.nested.x
  return first + second
})

// 4. Чтение через опциональную цепочку
bench('try/catch - опциональные цепочки', () => {
  try {
    return testObj.nested?.x + testObj.nested?.y
  } catch {
    return 0
  }
})

bench('literal - опциональные цепочки', () => {
  return testObj.nested?.x + testObj.nested?.y
})

// 5. Комплексный тест с несколькими операциями
bench('try/catch - комплексный', () => {
  try {
    const sum = testObj.a + testObj.b
    const product = testObj.c * testObj.nested.x
    const safe = safeObj.prop1.length + safeObj.prop2.length
    return sum + product + safe
  } catch {
    return 0
  }
})

bench('literal - комплексный', () => {
  const sum = testObj.a + testObj.b
  const product = testObj.c * testObj.nested.x
  const safe = safeObj.prop1.length + safeObj.prop2.length
  return sum + product + safe
})

// 6. Тест с глубокой вложенностью
bench('try/catch - глубокая вложенность', () => {
  try {
    try {
      try {
        return testObj.nested.x
      } catch {
        return 0
      }
    } catch {
      return 0
    }
  } catch {
    return 0
  }
})

bench('literal - глубокая вложенность', () => {
  return testObj.nested.x
})

/*
 ✓  chromium  scripts/throw.bench.js 21423ms
     name                                        hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · try/catch - простое чтение        7,973,469.98  0.0000  3.7000  0.0001  0.0000  0.0000  0.0000  0.1000  ±3.12%  3986735
   · literal - простое чтение          8,432,181.59  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  4216934
   · try/catch - множественное чтение  8,016,784.66  0.0000  0.2000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  4009194
   · literal - множественное чтение    7,952,481.96  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  3976241   slowest
   · try/catch - вложенные блоки       8,620,130.00  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  4310927
   · literal - вложенные блоки         8,448,519.97  0.0000  0.4000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.78%  4224260
   · try/catch - опциональные цепочки  8,407,364.57  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  4204523
   · literal - опциональные цепочки    8,628,095.92  0.0000  0.4000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  4314048
   · try/catch - комплексный           8,534,581.13  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.77%  4268144
   · literal - комплексный             8,525,846.87  0.0000  0.4000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.78%  4263776
   · try/catch - глубокая вложенность  8,594,181.99  0.0000  0.3000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.78%  4297091
   · literal - глубокая вложенность    8,710,091.98  0.0000  0.4000  0.0001  0.0000  0.0000  0.0000  0.1000  ±2.78%  4355046   fastest

 BENCH  Summary

   chromium  literal - глубокая вложенность - scripts/throw.bench.js
    1.01x faster than literal - опциональные цепочки
    1.01x faster than try/catch - вложенные блоки
    1.01x faster than try/catch - глубокая вложенность
    1.02x faster than try/catch - комплексный
    1.02x faster than literal - комплексный
    1.03x faster than literal - вложенные блоки
    1.03x faster than literal - простое чтение
    1.04x faster than try/catch - опциональные цепочки
    1.09x faster than try/catch - множественное чтение
    1.09x faster than try/catch - простое чтение
    1.10x faster than literal - множественное чтение
*/
