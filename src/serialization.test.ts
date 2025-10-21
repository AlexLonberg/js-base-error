import { describe, test, expect } from 'vitest'
import { ErrorLike, LiteError, BaseError, defineErrorLike } from './errors.ts'
import { SerializationParameters } from './options.ts'
//
import {
  // type TValueTypes,
  VALUE_TYPES,
  // type TSerResultUndefined,
  // type TSerResultPrimitive,
  // type TSerResultObject,
  // type TSerResultArray,
  // type TSerResultMeta,
  // type TSerResult,
  isErrorLike,
  SerializationContext,
  jsonPropInto,
  jsonObjectInto,
  jsonArrayInto,
  ensureErrorMeta,
  safeArrayLength,
  safeReadCodeInto,
  safeReadStackInto,
  safeReadStringInto,
  safeReadPropsInto,
  inspectPrimitive,
  inspectDate,
  inspectRegExp,
  inspectObject,
  inspectArray,
  inspectDetail,
  inspectError,
  inspectAny,
  ensureSerResultAsObject,
  errorLikeToJsonLike,
  nativeErrorToJsonLike,
  errorToJsonLike,
  errorLikeToToString,
  nativeErrorToString,
  errorToString
} from './serialization.ts'
import type { IErrorDetail, TMetaValue } from './types.ts'

describe('serialization | json', () => {
  test('isErrorLike', () => {
    class Foo extends ErrorLike { }
    expect(isErrorLike(new Foo())).toBe(true)
    expect(isErrorLike(new LiteError())).toBe(true)
    expect(isErrorLike(new BaseError())).toBe(true)
    expect(isErrorLike(defineErrorLike({}))).toBe(true)
    expect(isErrorLike({})).toBe(false)
  })

  test('ensureErrorMeta', () => {
    expect(ensureErrorMeta({}, 10)).toStrictEqual({ kind: 'error', name: '' })
    expect(ensureErrorMeta({ name: 'TestError' }, 10)).toStrictEqual({ kind: 'error', name: 'TestError' })
    expect(ensureErrorMeta({ name: null }, 10)).toStrictEqual({ kind: 'error', name: '' })
    expect(ensureErrorMeta({ name: 123 as unknown as string }, 10)).toStrictEqual({ kind: 'error', name: '' })
    expect(ensureErrorMeta({ name: 'TestError', message: 'Short' }, 10)).toStrictEqual({ kind: 'error', name: 'TestError', message: 'Short' })
    expect(ensureErrorMeta({ name: 'TestError', message: 'This is a very long message' }, 10)).toStrictEqual({ kind: 'error', name: 'TestError', message: 'This is a ' })
    expect(ensureErrorMeta({ name: 'TestError', message: '' }, 10)).toStrictEqual({ kind: 'error', name: 'TestError' })
    expect(ensureErrorMeta({ name: 'TestError', message: null }, 10)).toStrictEqual({ kind: 'error', name: 'TestError' })
    expect(ensureErrorMeta({ name: 'TestError', message: 123 as unknown as string }, 10)).toStrictEqual({ kind: 'error', name: 'TestError' })
  })

  test('safeArrayLength', () => {
    expect(safeArrayLength([])).toBe(0)
    expect(safeArrayLength([1, 2, 3])).toBe(3)
    // @ts-expect-error
    expect(safeArrayLength({ length: 5 })).toBe(5) // not array
    // @ts-expect-error
    expect(safeArrayLength({ length: 'invalid' })).toBe(0)
    // @ts-expect-error
    expect(safeArrayLength(null)).toBe(0)
    // @ts-expect-error
    expect(safeArrayLength(undefined)).toBe(0)
    expect(safeArrayLength(new Array(100))).toBe(100)
    const proxyArray = new Proxy([], {
      get: (target, prop) => prop === 'length' ? 'not a number' : target[prop as 'length']
    })
    expect(safeArrayLength(proxyArray)).toBe(0)
  })

  test('safeReadCodeInto', () => {
    const receiver = {}
    expect(safeReadCodeInto({ code: 123 }, receiver)).toBe(true)
    expect(receiver).toStrictEqual({ code: 123 })
    expect(safeReadCodeInto({ code: 'E001' }, receiver)).toBe(true)
    expect(receiver).toStrictEqual({ code: 'E001' }) // overwrites
    expect(safeReadCodeInto({ code: null }, receiver)).toBe(false)
    expect(receiver).toStrictEqual({ code: 'E001' }) // unchanged
    expect(safeReadCodeInto({ code: undefined }, receiver)).toBe(false)
    expect(safeReadCodeInto({ code: true }, receiver)).toBe(false)
    expect(safeReadCodeInto({ code: {} }, receiver)).toBe(false)
    expect(safeReadCodeInto({}, receiver)).toBe(false)
    const brokenObj = new Proxy({}, { get: () => { throw new Error('broken') } })
    expect(safeReadCodeInto(brokenObj, receiver)).toBe(false)
  })

  test('safeReadStackInto', () => {
    expect(safeReadStackInto({ stack: null }, {}, 256, false)).toBe(false)
    expect(safeReadStackInto({ stack: '' }, {}, 256, false)).toBe(false)
    expect(safeReadStackInto({ stack: 'without first at' }, {}, 256, false)).toBe(false)

    const receiver = {} as { stack: any }
    expect(safeReadStackInto({ stack: '    at 1\n    at 2' }, receiver, 256, false)).toBe(true)
    expect(receiver.stack).toBe('    at 1\n    at 2')
    expect(safeReadStackInto({ stack: 'Error: message\n    at 3\n    at 4' }, receiver, 256, false)).toBe(true)
    expect(receiver.stack).toBe('    at 3\n    at 4')
    expect(safeReadStackInto({ stack: 'Error: message\n    at 5\n    at process' }, receiver, 20, false)).toBe(true)
    expect(receiver.stack).toBe('    at 5\n    at proc')
  })

  test('safeReadStringInto', () => {
    const receiver = {}
    expect(safeReadStringInto({ name: 'Test' }, receiver, 'name', 10, false)).toBe(true)
    expect(receiver).toStrictEqual({ name: 'Test' })
    expect(safeReadStringInto({ name: 'Very long name here' }, receiver, 'name', 10, false)).toBe(true)
    expect(receiver).toStrictEqual({ name: 'Very long ' })
    expect(safeReadStringInto({ name: '' }, receiver, 'name', 10, false)).toBe(false)
    expect(safeReadStringInto({ name: '' }, receiver, 'name', 10, true)).toBe(true)
    expect(safeReadStringInto({ name: null }, receiver, 'name', 10, false)).toBe(false)
    expect(safeReadStringInto({ name: undefined }, receiver, 'name', 10, false)).toBe(false)
    expect(safeReadStringInto({ name: 123 }, receiver, 'name', 10, false)).toBe(false)
    expect(safeReadStringInto({}, receiver, 'name', 10, false)).toBe(false)
    const brokenObj = new Proxy({}, { get: () => { throw new Error('broken') } })
    expect(safeReadStringInto(brokenObj, receiver, 'name', 10, false)).toBe(false)

    // Special case for 'stack'
    const stackReceiver = {}
    const longStack = 'Line1\nLine2 that is very long\nLine3'
    expect(safeReadStringInto({ stack: longStack }, stackReceiver, 'stack', 10, false)).toBe(true)
    expect(stackReceiver).toStrictEqual({ stack: 'Line1\nLine' }) // each line truncated
    const multiLineEmpty = '\n\n'
    expect(safeReadStringInto({ stack: multiLineEmpty }, stackReceiver, 'stack', 10, false)).toBe(true)
    expect(stackReceiver).toStrictEqual({ stack: '\n\n' }) // empty lines not truncated
  })

  test('inspectPrimitive', () => {
    const params = new SerializationParameters({ maxStringLength: 5 })
    expect(params.maxStringLength).toBe(8)

    expect(inspectPrimitive(null, params)).toStrictEqual([VALUE_TYPES.null, null])
    expect(inspectPrimitive(true, params)).toStrictEqual([VALUE_TYPES.boolean, true])
    expect(inspectPrimitive(42, params)).toStrictEqual([VALUE_TYPES.number, 42])
    expect(inspectPrimitive('short', params)).toStrictEqual([VALUE_TYPES.string, 'short'])
    expect(inspectPrimitive('long string', params)).toStrictEqual([VALUE_TYPES.string, 'long str'])
    expect(inspectPrimitive(undefined, params)).toStrictEqual([VALUE_TYPES.undefined, null])

    const bi: { __meta: TMetaValue } = { __meta: { type: 'bigint', value: '123' } }
    expect(inspectPrimitive(BigInt(123), params)).toStrictEqual([VALUE_TYPES.meta, bi])
    const sm: { __meta: TMetaValue } = { __meta: { type: 'symbol', value: 'Symbol(sym)' } }
    expect(inspectPrimitive(Symbol('sym'), params)).toStrictEqual([VALUE_TYPES.meta, sm])

    // Объекты не должны попадать в эту функцию и будут приведены к любой строке
    const meta: { __meta: TMetaValue } = {
      __meta: {
        // @ts-expect-error
        type: 'object',
        value: '[object Object]'
      }
    }
    // @ts-expect-error - not primitive
    expect(inspectPrimitive({}, params)).toStrictEqual([VALUE_TYPES.meta, meta])
  })

  test('inspectDate', () => {
    const params = new SerializationParameters()

    const date = new Date('2023-01-01T00:00:00Z')
    expect(inspectDate(date, params)).toStrictEqual([VALUE_TYPES.meta, { __meta: { type: 'date', value: '2023-01-01T00:00:00.000Z' } }])
    const invalidDate = new Date('invalid')
    expect(inspectDate(invalidDate, params)).toStrictEqual([VALUE_TYPES.undefined, null])
    const customDate = new Date()
    customDate.toJSON = () => 'custom-json'
    expect(inspectDate(customDate, params)).toStrictEqual([VALUE_TYPES.meta, { __meta: { type: 'date', value: 'custom-json' } }])
    const brokenDate = new Date()
    brokenDate.toJSON = () => { throw new Error('broken') }
    expect(inspectDate(brokenDate, params)).toStrictEqual([VALUE_TYPES.undefined, null])
    const emptyJsonDate = new Date()
    emptyJsonDate.toJSON = () => ''
    expect(inspectDate(emptyJsonDate, params)).toStrictEqual([VALUE_TYPES.undefined, null])
    const nonStringJson = new Date()
    nonStringJson.toJSON = () => 123 as unknown as string
    expect(inspectDate(nonStringJson, params)).toStrictEqual([VALUE_TYPES.undefined, null])
  })

  test('inspectRegExp', () => {
    const params = new SerializationParameters()
    const re = /foo\n[0-9]/ig
    expect(inspectRegExp(re, params)).toStrictEqual([VALUE_TYPES.meta, { __meta: { type: 'regexp', value: '/foo\\n[0-9]/gi' } }])
  })

  test('safeReadPropsInto', () => {
    const params = new SerializationParameters({ maxDepth: 1, ignoreEmpty: true })
    const ctx = new SerializationContext(params.maxTotalItems, params.maxItems)
    const receiver = {}
    const source = { a: 1, b: 'test', c: null, d: [], e: {}, f: '', g: undefined }
    const keys = Object.keys(source)

    safeReadPropsInto(source, params, ctx, 0, 0, new Set(keys), receiver)
    expect(receiver).toStrictEqual({ a: 1, b: 'test' }) // ignores empty

    const paramsNoIgnore = new SerializationParameters({ ignoreEmpty: false })
    const ctx2 = new SerializationContext(params.maxTotalItems, params.maxItems)
    const receiver2 = {}
    safeReadPropsInto(source, paramsNoIgnore, ctx2, 0, 0, new Set(keys), receiver2)
    expect(receiver2).toStrictEqual({ a: 1, b: 'test', c: null, d: [], e: {}, f: '' }) // ignore undefined

    const sourceWithInclude = { x: 10, y: 20 }
    const paramsInclude = new SerializationParameters({ include: ['x'] })
    const receiver3 = {}
    safeReadPropsInto(sourceWithInclude, paramsInclude, ctx, 0, 0, new Set(Object.keys(sourceWithInclude)), receiver3)
    expect(receiver3).toStrictEqual({ x: 10 }) // only includes 'x'

    const brokenSource = new Proxy({}, { ownKeys: () => { throw new Error('broken') } })
    expect(() => safeReadPropsInto(brokenSource, params, ctx, 0, 0, new Set(keys), receiver)).not.toThrow()
  })

  test('inspectObject', () => {
    const params = new SerializationParameters({ maxDepth: 1, maxItems: 2, maxTotalItems: 10, metaFieldName: '__info__' })
    const ctx = new SerializationContext(params.maxTotalItems, params.maxItems)

    expect(inspectObject({}, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, {}])
    expect(inspectObject({ a: 1 }, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, { a: 1 }])
    expect(inspectObject({ a: 1, b: 2, c: 3 }, params, ctx, 0)).toStrictEqual([
      VALUE_TYPES.object,
      { a: 1, b: 2, __info__: { kind: 'object', total: 3, truncated: 1 } }
    ]) // truncates

    const nested = { a: { b: 1 } }
    expect(inspectObject(nested, params, ctx, 0)).toStrictEqual([
      VALUE_TYPES.object, { a: { __info__: { kind: 'object', length: 1 } } }
    ]) // maxDepth 1, placeholder

    const cycle = {} as Record<string, any>
    cycle['self'] = cycle
    expect(inspectObject(cycle, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, {}]) // cycle detected, ignores

    const paramsIgnore = new SerializationParameters({ ignoreEmpty: true })
    expect(inspectObject({ empty: {} }, paramsIgnore, ctx, 0)).toStrictEqual([VALUE_TYPES.undefined, null]) // ignores empty object

    const undef = { a: undefined, b: undefined }
    expect(inspectObject(undef, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, {}])

    // Когда глубина превышена и возвращается мета-объект - невозможно точно подсчитать количество значимых полей.
    // Поле __meta.length будет содержать количество всех полей, независимо от их значимости.
    expect(inspectObject({ a: 1, b: undefined }, params, ctx, 1)).toStrictEqual([
      VALUE_TYPES.meta, { __info__: { kind: 'object', length: 2 } }
    ]) // level>0 if maxDepth=1

    // Игнорирование мета поля
    const paramsIgnoreMeta = new SerializationParameters({ maxDepth: 1, maxItems: 2, maxTotalItems: 10, ignoreMeta: true })
    expect(inspectObject({ a: 1, b: { c: 2 } }, paramsIgnoreMeta, ctx, 0)).toStrictEqual([VALUE_TYPES.object, { a: 1 }])
  })

  test('inspectArray', () => {
    const params = new SerializationParameters({ maxDepth: 1, maxItems: 2, maxTotalItems: 10 })
    const ctx = new SerializationContext(params.maxTotalItems, params.maxItems)

    expect(inspectArray([], params, ctx, 0)).toStrictEqual([VALUE_TYPES.array, []])
    expect(inspectArray([1, 2], params, ctx, 0)).toStrictEqual([VALUE_TYPES.array, [1, 2]])
    expect(inspectArray([1, 2, 3, 4], params, ctx, 0)).toStrictEqual([
      VALUE_TYPES.array,
      [1, 2, { [params.metaFieldName]: { kind: 'array', total: 4, truncated: 2 } }]
    ]) // truncates

    const nested = [[1]]
    expect(inspectArray(nested, params, ctx, 0)).toStrictEqual([
      VALUE_TYPES.array,
      [{ [params.metaFieldName]: { kind: 'array', length: 1 } }]
    ]) // placeholder

    const cycle: any[] = []
    cycle.push(cycle)
    expect(inspectArray(cycle, params, ctx, 0)).toStrictEqual([VALUE_TYPES.array, []]) // cycle

    const paramsIgnore = new SerializationParameters({ ignoreEmpty: true })
    expect(inspectArray([], paramsIgnore, ctx, 0)).toStrictEqual([VALUE_TYPES.undefined, null]) // ignores empty

    // totalItems limit
    const paramsTotalItems = new SerializationParameters({ maxTotalItems: 5 })
    const ctxTotalItems = new SerializationContext(paramsTotalItems.maxTotalItems, paramsTotalItems.maxItems)
    inspectArray([1, 2, 3, 4], paramsTotalItems, ctxTotalItems, 0)
    expect(inspectArray([5, 6], paramsTotalItems, ctxTotalItems, 0)).toStrictEqual([
      VALUE_TYPES.array,
      [5, { [params.metaFieldName]: { kind: 'array', total: 2, truncated: 1 } }]
    ]) // truncated due to total
  })

  test('inspectDetail', () => {
    const params = new SerializationParameters({ maxDepth: 2, maxStringLength: 9, includeStack: true, keepStackHeader: true })
    const ctx = new SerializationContext(params.maxTotalItems, params.maxItems)
    const detail: IErrorDetail = { code: 123, name: 'Test', message: 'Error msg', level: 'error', stack: 'stack trace\nline2', cause: { nested: 1 } }

    expect(inspectDetail({ detail }, params, ctx, 0)).toStrictEqual([
      VALUE_TYPES.object,
      { code: 123, name: 'Test', message: 'Error msg', level: 'error', stack: 'stack tra'/*ce\nline2*/, cause: { nested: 1 } }
    ])

    const shortDetail = { message: '' }
    expect(inspectDetail({ detail: shortDetail }, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, {}]) // empty message ignored? but since not ignoreEmpty, but message is string

    const paramsNoStack = new SerializationParameters({ includeStack: false })
    const detailNoStack = { stack: 'ignore' }
    expect(inspectDetail({ detail: detailNoStack }, paramsNoStack, ctx, 0)).toStrictEqual([VALUE_TYPES.object, {}])

    const brokenDetail = new Proxy({}, { get: () => { throw new Error() } })
    expect(inspectDetail({ detail: brokenDetail }, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, {}]) // safe
  })

  test('inspectError', () => {
    const params = new SerializationParameters({ maxDepth: 1, includeStack: true, keepStackHeader: true })
    const ctx = new SerializationContext(params.maxTotalItems, params.maxItems)
    const err = new Error('test')
    err.name = 'TestError'
    err.stack = 'stack'

    expect(inspectError(err, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, { name: 'TestError', message: 'test', stack: 'stack' }])

    const customErr = { name: 'Custom', message: 'msg', other: 1 }
    expect(inspectError(customErr, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, { name: 'Custom', message: 'msg', other: 1 }])

    const deepErr = new Error('deep')
    deepErr.cause = { nested: { deeper: 1 } }
    expect(inspectError(deepErr, params, ctx, 0)).toStrictEqual([
      VALUE_TYPES.object,
      { name: 'Error', message: 'deep', stack: expect.stringContaining('Error: deep'), cause: { [params.metaFieldName]: { kind: 'object', length: 1 } } }
    ]) // placeholder

    const err2 = new Error('test')
    err2.name = 'TestError'
    expect(inspectError(err2, params, ctx, 1)).toStrictEqual([
      VALUE_TYPES.meta, { [params.metaFieldName]: { kind: 'error', name: 'TestError', message: 'test' } }
    ]) // maxDepth
  })

  test('inspectAny', () => {
    const params = new SerializationParameters({ maxDepth: 2, maxItems: 3, maxTotalItems: 20 })
    const ctx = new SerializationContext(params.maxTotalItems, params.maxItems)

    // Primitives
    const p1 = inspectAny(undefined, params, ctx, 0)
    expect(p1).toStrictEqual([VALUE_TYPES.undefined, null])
    expect(typeof ensureSerResultAsObject(p1, params.metaFieldName)).toBe('object')

    const p2 = inspectAny(null, params, ctx, 0)
    expect(p2).toStrictEqual([VALUE_TYPES.null, null])
    expect(typeof ensureSerResultAsObject(p2, params.metaFieldName)).toBe('object')

    const p3 = inspectAny(true, params, ctx, 0)
    expect(p3).toStrictEqual([VALUE_TYPES.boolean, true])
    expect(typeof ensureSerResultAsObject(p3, params.metaFieldName)).toBe('object')

    const p4 = inspectAny(42, params, ctx, 0)
    expect(p4).toStrictEqual([VALUE_TYPES.number, 42])
    expect(typeof ensureSerResultAsObject(p4, params.metaFieldName)).toBe('object')

    const p5 = inspectAny('text', params, ctx, 0)
    expect(p5).toStrictEqual([VALUE_TYPES.string, 'text'])
    expect(typeof ensureSerResultAsObject(p5, params.metaFieldName)).toBe('object')

    const p6 = inspectAny(123n, params, ctx, 0)
    expect(p6).toStrictEqual([VALUE_TYPES.meta, { __meta: { type: 'bigint', value: '123' } }]) // BigInt
    expect(typeof ensureSerResultAsObject(p6, params.metaFieldName)).toBe('object')

    const p7 = inspectAny(Symbol('token'), params, ctx, 0)
    expect(p7).toStrictEqual([VALUE_TYPES.meta, { __meta: { type: 'symbol', value: 'Symbol(token)' } }])
    expect(typeof ensureSerResultAsObject(p7, params.metaFieldName)).toBe('object')

    // Object
    const obj = { a: 1, b: { c: 2 }, d: [3, 4] }
    const a = inspectAny(obj, params, ctx, 0)
    expect(a).toStrictEqual([VALUE_TYPES.object, { a: 1, b: { c: 2 }, d: [3, 4] }])
    expect(typeof ensureSerResultAsObject(a, params.metaFieldName)).toBe('object')

    // Deep object exceeding depth
    const deep = { level1: { level2: { level3: 1 } } }
    expect(inspectAny(deep, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, { level1: { level2: { [params.metaFieldName]: { kind: 'object', length: 1 } } } }])

    // Array with truncation
    const longArr = [1, 2, 3, 4, 5]
    const b = inspectAny(longArr, params, ctx, 0)
    expect(b).toStrictEqual([VALUE_TYPES.array, [1, 2, 3, { [params.metaFieldName]: { kind: 'array', total: 5, truncated: 2 } }]])
    expect(typeof ensureSerResultAsObject(b, params.metaFieldName)).toBe('object')

    // Cycle
    const cycleObj = { self: null as any }
    cycleObj.self = cycleObj
    expect(inspectAny(cycleObj, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, {}])

    // ErrorLike
    const liteErr = new LiteError({ code: 500, message: 'Server error' })
    expect(inspectAny(liteErr, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, { name: 'LiteError', message: 'Server error', code: 500 }])

    // Native Error
    const nativeErr = new Error('Boom')
    expect(inspectAny(nativeErr, params, ctx, 0)).toStrictEqual([VALUE_TYPES.object, { name: 'Error', message: 'Boom' }]) // assuming no stack by default

    // Total items limit !!!
    // Лимит maxTotalItems не подсчитывается точно. Вложенный объект увеличит счетчик только после завершения обхода.
    // Выходной объект
    const paramsTotal = new SerializationParameters({ maxItems: 6, maxTotalItems: 7 })
    const ctxTotal = new SerializationContext(paramsTotal.maxTotalItems, paramsTotal.maxItems)
    const largeObj = { a: 1, b: 2, c: 3, d: 4, e: { f: 6, g: 7, h: 8, i: 9, j: 10 } }
    expect(inspectAny(largeObj, paramsTotal, ctxTotal, 0)).toStrictEqual([
      VALUE_TYPES.object, { a: 1, b: 2, c: 3, d: 4, e: { f: 6, g: 7, h: 8, [params.metaFieldName]: { kind: 'object', total: 5, truncated: 2 } } }
    ]) // adjusts based on remaining

    // Ignore empty
    const paramsIgnore = new SerializationParameters({ ignoreEmpty: true, maxDepth: 2 })
    expect(inspectAny(
      { emptyArr: [], emptyObj: {}, nullVal: null },
      paramsIgnore,
      new SerializationContext(params.maxTotalItems, params.maxItems), 0
    )).toStrictEqual([VALUE_TYPES.undefined, null]) // all ignored
  })
})

describe('serialization | text', () => {
  test('jsonPropInto', () => {
    let receiver: string[] = []
    jsonPropInto('key', null, receiver, 0)
    expect(receiver).toStrictEqual(['key: null'])

    receiver = []
    jsonPropInto('bool', true, receiver, 1)
    expect(receiver).toStrictEqual(['  bool: true'])

    receiver = []
    jsonPropInto('num', 42, receiver, 2)
    expect(receiver).toStrictEqual(['    num: 42'])

    receiver = []
    jsonPropInto('str', 'simple', receiver, 0)
    expect(receiver).toStrictEqual(['str: simple'])

    receiver = []
    jsonPropInto('multi', 'line1\nline2\nline3', receiver, 1)
    expect(receiver).toStrictEqual([
      '  multi: line1',
      '    line2',
      '    line3'
    ])

    receiver = []
    jsonPropInto('empty', '', receiver, 0)
    expect(receiver).toStrictEqual(['empty: '])

    receiver = []
    jsonPropInto('[0]', { sub: 'value' }, receiver, 0)
    expect(receiver).toStrictEqual([
      '[0]:',
      '  sub: value'
    ]) // but actually calls jsonObjectInto internally

    receiver = []
    jsonPropInto('arr', [1, 'two'], receiver, 1)
    expect(receiver).toStrictEqual([
      '  arr:',
      '    [0]: 1',
      '    [1]: two'
    ]) // calls jsonArrayInto
  })

  test('jsonObjectInto', () => {
    let receiver: string[] = []
    jsonObjectInto({}, receiver, 0)
    expect(receiver).toStrictEqual([]) // empty object adds nothing

    receiver = []
    jsonObjectInto({ a: 1, b: 'test' }, receiver, 1)
    expect(receiver).toStrictEqual([
      '  a: 1',
      '  b: test'
    ])

    receiver = []
    jsonObjectInto({ multi: 'line1\nline2' }, receiver, 2)
    expect(receiver).toStrictEqual([
      '    multi: line1',
      '      line2'
    ])

    receiver = []
    jsonObjectInto({ nested: { sub: true } }, receiver, 0)
    expect(receiver).toStrictEqual([
      'nested:',
      '  sub: true'
    ])

    receiver = []
    jsonObjectInto({ emptyStr: '', nullVal: null }, receiver, 1)
    expect(receiver).toStrictEqual([
      '  emptyStr: ',
      '  nullVal: null'
    ])
  })

  test('jsonArrayInto', () => {
    let receiver: string[] = []
    jsonArrayInto([], receiver, 0)
    expect(receiver).toStrictEqual([]) // empty array adds nothing

    receiver = []
    jsonArrayInto([1, 'test'], receiver, 1)
    expect(receiver).toStrictEqual([
      '  [0]: 1',
      '  [1]: test'
    ])

    receiver = []
    jsonArrayInto(['line1\nline2', null], receiver, 2)
    expect(receiver).toStrictEqual([
      '    [0]: line1',
      '      line2',
      '    [1]: null'
    ])

    receiver = []
    jsonArrayInto([{ sub: 42 }], receiver, 0)
    expect(receiver).toStrictEqual([
      '[0]:',
      '  sub: 42'
    ])

    receiver = []
    jsonArrayInto([[true, false]], receiver, 1)
    expect(receiver).toStrictEqual([
      '  [0]:',
      '    [0]: true',
      '    [1]: false'
    ])

    receiver = []
    jsonArrayInto(['', null, 0], receiver, 0)
    expect(receiver).toStrictEqual([
      '[0]: ',
      '[1]: null',
      '[2]: 0'
    ])
  })
})

describe('serialization | to Json and String', () => {
  test('errorLikeToJsonLike + errorLikeToToString', () => {
    const detail: IErrorDetail = {
      code: 404,
      name: 'NotFoundError',
      message: 'Resource not found',
      level: 'warn',
      stack: 'Fake stack\nat handler (/app.ts:10)\nat main (/app.ts:5)',
      cause: { reason: 'Invalid ID' }
    }

    const json = errorLikeToJsonLike({ detail }, { includeStack: true })
    expect(json).toStrictEqual({
      code: 404,
      name: 'NotFoundError',
      message: 'Resource not found',
      level: 'warn',
      stack: 'at handler (/app.ts:10)\nat main (/app.ts:5)',
      cause: { reason: 'Invalid ID' }
    })

    const str = errorLikeToToString({ detail }, { includeStack: true })
    expect(str).toBe(
      'name: NotFoundError\n' +
      'message: Resource not found\n' +
      'code: 404\n' +
      'level: warn\n' +
      'stack: at handler (/app.ts:10)\n' +
      '  at main (/app.ts:5)\n' +
      'cause:\n' +
      '  reason: Invalid ID'
    )
  })

  test('nativeErrorToJsonLike + nativeErrorToString', () => {
    const err = new Error('Native error occurred')
    err.name = 'NativeError'
    err.stack = 'Fake stack\nat process (/native.js:20)\nat init (/native.js:15)'
    { (err as any).cause = { detail: 'Underlying issue' } }

    const json = nativeErrorToJsonLike(err, { includeStack: true })
    expect(json).toStrictEqual({
      name: 'NativeError',
      message: 'Native error occurred',
      stack: 'at process (/native.js:20)\nat init (/native.js:15)',
      cause: { detail: 'Underlying issue' }
    })

    const str = nativeErrorToString(err, { includeStack: true })
    expect(str).toBe(
      'name: NativeError\n' +
      'message: Native error occurred\n' +
      'stack: at process (/native.js:20)\n' +
      '  at init (/native.js:15)\n' +
      'cause:\n' +
      '  detail: Underlying issue'
    )
  })

  test('errorToJsonLike + errorToString', () => {
    // Primitive: number
    const primNum = 500
    const jsonNum = errorToJsonLike(primNum)
    expect(jsonNum).toStrictEqual({ __meta: { type: 'number', value: 500 } })
    const strNum = errorToString(primNum)
    expect(strNum).toBe('__meta:\n  type: number\n  value: 500')

    // Primitive: string
    const primStr = 'Simple error'
    const jsonStr = errorToJsonLike(primStr)
    expect(jsonStr).toStrictEqual({ __meta: { type: 'string', value: 'Simple error' } })
    const strStr = errorToString(primStr)
    expect(strStr).toBe('__meta:\n  type: string\n  value: Simple error')

    // Primitive: boolean
    const primBool = false
    const jsonBool = errorToJsonLike(primBool)
    expect(jsonBool).toStrictEqual({ __meta: { type: 'boolean', value: false } })
    const strBool = errorToString(primBool)
    expect(strBool).toBe('__meta:\n  type: boolean\n  value: false')

    // Null
    const primNull = null
    const jsonNull = errorToJsonLike(primNull)
    expect(jsonNull).toStrictEqual({ __meta: { type: 'null', value: null } })
    const strNull = errorToString(primNull)
    expect(strNull).toBe('__meta:\n  type: null\n  value: null')

    // Undefined
    const primUndef = undefined
    const jsonUndef = errorToJsonLike(primUndef)
    expect(jsonUndef).toStrictEqual({})
    const strUndef = errorToString(primUndef)
    expect(strUndef).toBe('')

    // Array as primitive-like
    const primArr = [1, 2]
    const jsonArr = errorToJsonLike(primArr)
    expect(jsonArr).toStrictEqual({ __meta: { type: 'array', value: [1, 2] } })
    const strArr = errorToString(primArr)
    expect(strArr).toBe('__meta:\n  type: array\n  value:\n    [0]: 1\n    [1]: 2')
  })
})
