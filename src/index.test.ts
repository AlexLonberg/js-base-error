import { describe, test, expect } from 'vitest'
import {
  type TErrorLevel,
  type IErrorDetail,
  type IErrorLike,
  // type IErrorLikeCollection,
  ErrorLikeProto,
  BaseError,
  ErrorLikeCollection,
  // captureStackTrace,
  createErrorLike,
  // ensureErrorLike,
  isErrorLike,
  safeAnyToString,
  safeGetStringOf,
  errorDetailToList,
  errorDetailToString,
  nativeErrorToString,
  errorToString,
  errorDetailToJsonLike,
  nativeErrorToJsonLike,
  errorToJsonLike
} from './index.js'

// NOTE: Этот код находился в index.js и подменял createErrorLike. Сейчас это работает без этого исправления. Оставлено для справки.
// /**
//  * В среде vitest + playwright не работает Error.captureStackTrace(...)
//  * Добавляем в vitest.config.ts -> env: { FIX_CAPTURE_STACK_TRACE: true } для эмуляции захвата стека через стандартные механизмы ошибки.
//  */
// void function () {
//   try {
//     const isTest = Reflect.get(globalThis, 'FIX_CAPTURE_STACK_TRACE')
//     if (typeof isTest === 'boolean' && isTest) {
//       (createErrorLike as any) = <T extends IErrorDetail<any>> (detail: T, captureStack?: null | undefined | boolean) => {
//         const props: IErrorDetail<any> = (typeof detail === 'object' && detail !== null)
//           ? detail
//           : {
//             message: 'IErrorLike was not created',
//             level: 'error',
//             cause: detail
//           }
//         if (captureStack) {
//           props.stack = (new Error()).stack ?? null
//         }
//         return Object.assign(Object.create(ErrorLikeProto), props)
//       }
//     }
//   } catch (_) { /**/ }
// }()

test('should create an IErrorLike object with default values', () => {
  const detail = { code: 1, message: 'Test message' }
  const errorLike: IErrorLike = createErrorLike(detail)
  expect(errorLike.code).toBe(1)
  expect(errorLike.message).toBe('Test message')
  expect(errorLike.level).toBeUndefined() // По умолчанию не устанавливается
  expect(errorLike.name).toBeUndefined()
  expect(errorLike.stack).toBeUndefined()
  expect(isErrorLike(errorLike)).toBe(true)
  expect(typeof errorLike.toString).toBe('function')
  expect(typeof errorLike.toJSON).toBe('function')
})

test('should use ErrorLikeProto', () => {
  const errorLike = createErrorLike({ code: 1, message: 'Test' })
  expect(Object.getPrototypeOf(errorLike)).toBe(ErrorLikeProto)
})

test('should ignore the property with an error', () => {
  const errorLike = createErrorLike({
    name: 'Test',
    get message (): string {
      throw 0
    }
  })
  expect(errorLike).toStrictEqual({ name: 'Test' })
})

test('should handle non-object detail by creating a default error', () => {
  const errorLike = createErrorLike('invalid detail' as any)
  expect(errorLike.message).toBe('IErrorLike was not created')
  expect(errorLike.level).toBe('error')
  expect(errorLike.cause).toBe('invalid detail')
  expect(isErrorLike(errorLike)).toBe(true)
  expect(errorLike.toJSON()).toStrictEqual({
    message: 'IErrorLike was not created',
    level: 'error',
    cause: 'invalid detail'
  })
})

test('should call captureStackTrace if captureStack is true', () => {
  const detail = { code: 2, message: 'Capture test' }
  const errorLike = createErrorLike<IErrorLike>(detail, true)
  expect(typeof errorLike.stack).toBe('string')
  const asString = errorLike.toString()
  const expected = 'code: 2\n' +
    'message: Capture test\n' +
    'stack:'
  expect(asString).toContain(expected)
})

test('should correctly assign all IErrorDetail properties', () => {
  const detail: IErrorDetail = {
    code: 'C100',
    message: 'Full detail',
    name: 'CustomError',
    level: 'warning',
    stack: 'custom stack',
    cause: new Error('root cause')
  }
  const errorLike = createErrorLike(detail)
  expect(errorLike.code).toBe('C100')
  expect(errorLike.message).toBe('Full detail')
  expect(errorLike.name).toBe('CustomError')
  expect(errorLike.level).toBe('warning')
  expect(errorLike.stack).toBe('custom stack')
  expect(errorLike.cause).toBeInstanceOf(Error)
  expect((errorLike.cause as Error).message).toBe('root cause')
  expect(errorLike.toJSON()).toStrictEqual({
    code: 'C100',
    message: 'Full detail',
    name: 'CustomError',
    level: 'warning',
    stack: 'custom stack',
    cause: {
      name: 'Error',
      message: 'root cause',
      stack: expect.any(String)
    }
  })
})

describe('BaseError', () => {
  interface IErrorLikeEx extends IErrorLike {
    code: number
  }
  class DefaultError extends BaseError<IErrorLike> { }
  class TestError extends BaseError<IErrorLikeEx> {
    constructor(code: number, message: string, level?: TErrorLevel) {
      super({ code, message, level })
    }
  }

  test('should be an instance of Error', () => {
    const err = new TestError(100, 'Base test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(BaseError)
    expect(err).toBeInstanceOf(TestError)
  })

  test('should store detail and provide access to code and level', () => {
    const err = new TestError(101, 'Detail access', 'info')
    expect(err.detail.code).toBe(101)
    expect(err.detail.message).toBe('Detail access')
    expect(err.detail.level).toBe('info')
  })

  test('should set name and stack in detail from the Error instance', () => {
    const err = new TestError(103, 'Name and stack')
    // Скорее всего имя ошибки по умолчанию будет именем класса 'TestError', но в тестовой среде и минифицированном
    // коде можно ожидать всего, поэтому не стоит ожидать точного имени
    expect(err.detail.name).toBe('TestError')
    // expect(err.detail.name).toMatch('Error')
    expect(err.detail.stack).toEqual(expect.any(String))
    expect(err.detail.stack).toContain('Error')
    expect(err.stack).toBe(err.detail.stack)
  })

  test('should use provided IErrorLike directly', () => {
    const errorLikeDetail = createErrorLike({ message: 'From IErrorLike', name: 'MyErrorLike' })
    const err = new DefaultError(errorLikeDetail)
    expect(err.detail).toBe(errorLikeDetail) // Должен быть тот же объект
    expect(err.message).toBe('From IErrorLike') // super(detail.message)
    expect(err.detail.name).toBe('MyErrorLike') // Имя из IErrorLike
  })

  test('constructor should prioritize detail.name and detail.stack if provided', () => {
    const detailWithNameAndStack: IErrorDetail = {
      message: 'Custom name and stack',
      name: 'ExplicitName',
      stack: 'ExplicitStack\n  at foo (bar.js:1:1)'
    }
    const err = new DefaultError(detailWithNameAndStack)
    expect(err.detail.name).toBe('ExplicitName')
    expect(err.detail.stack).toBe('ExplicitStack\n  at foo (bar.js:1:1)')
  })
})

describe('safeAnyToString', () => {
  test('should convert values to string', () => {
    expect(safeAnyToString('hello')).toBe('hello')
    expect(safeAnyToString(123)).toBe('123')
    expect(safeAnyToString(true)).toBe('true')
    expect(safeAnyToString({ toString: () => 'obj_str' })).toBe('obj_str')
  })
  test('should return null for null, undefined, or empty string result', () => {
    expect(safeAnyToString(null)).toBeNull()
    expect(safeAnyToString(undefined)).toBeNull()
    expect(safeAnyToString({ toString: () => '' })).toBeNull()
  })
  test('should return null if toString throws', () => {
    const badObj = { toString: () => { throw new Error('cant stringify') } }
    expect(safeAnyToString(badObj)).toBeNull()
  })
})

describe('safeGetStringOf', () => {
  const obj = { name: 'TestObj', count: 5, complex: { value: 'nested' }, badToString: { toString: () => { throw new Error('fail') } } }
  test('should get string property', () => {
    expect(safeGetStringOf(obj, 'name')).toBe('TestObj')
  })
  test('should convert non-string property using safeAnyToString', () => {
    expect(safeGetStringOf(obj, 'count')).toBe('5')
  })
  test('should return null for non-existent property', () => {
    expect(safeGetStringOf(obj, 'nonExistent')).toBeNull()
  })
  test('should return null if safeAnyToString returns null', () => {
    expect(safeGetStringOf(obj, 'badToString')).toBeNull()
  })
})

describe('errorDetailToString / errorDetailToList', () => {
  const baseDetail: IErrorDetail = {
    code: 'D100',
    message: 'Detail message',
  }

  test('should format basic detail', () => {
    const list = errorDetailToList(baseDetail)
    expect(list).toEqual(expect.arrayContaining([
      'code: D100',
      'message: Detail message'
    ]))
    const str = errorDetailToString(baseDetail)
    expect(str).toContain('code: D100')
    expect(str).toContain('message: Detail message')
  })

  test('should include level and name', () => {
    const detail: IErrorDetail = { ...baseDetail, level: 'warning', name: 'MyDetailError' }
    const str = errorDetailToString(detail)
    expect(str).toContain('name: MyDetailError')
    expect(str).toContain('level: warning')
    const detailWithCustomName = { ...baseDetail, customProp: 'MyDetailError' }
    const strWithCustomName = errorDetailToString(detailWithCustomName)
    expect(strWithCustomName).toContain('customProp: MyDetailError')
  })

  test('should include stack and cause', () => {
    const causeError = new Error('Root cause')
    const detail: IErrorDetail = {
      ...baseDetail,
      stack: 'Error: Detail message\n  at someFunc (file.js:10:5)',
      cause: causeError,
    }
    const str = errorDetailToString(detail)
    expect(str).toContain('stack:\nError: Detail message')
    expect(str).toContain('cause:\nstack:\nError: Root cause') // nativeErrorToString для cause
  })

  test('should handle nested IErrorDetail in cause', () => {
    const nestedDetail: IErrorDetail = { code: 99, message: 'Nested detail' }
    const detail: IErrorDetail = { ...baseDetail, cause: nestedDetail }
    const str = errorDetailToString(detail)
    expect(str).toContain('cause:\ncode: 99\nmessage: Nested detail')
  })

  test('should handle circular dependencies in cause gracefully (WeakSet)', () => {
    const detailA: IErrorDetail = { code: 'A', message: 'Detail A' }
    const detailB: IErrorDetail = { code: 'B', message: 'Detail B' }
    detailA.cause = detailB
    detailB.cause = detailA // Circular
    // В зависимости от того, как WeakSet обрабатывает, повторного вывода detailA не будет или будет пустота
    // Важно, что нет бесконечного цикла
    let resultA = ''
    expect(() => { resultA = errorDetailToString(detailA) }).not.toThrow()
    expect(resultA).toContain('code: A')
    expect(resultA).toContain('message: Detail A')
    expect(resultA).toContain('cause:\ncode: B\nmessage: Detail B')
  })

  test('should list other properties', () => {
    interface IErrorDetailEx extends IErrorDetail {
      customField: string
      numField: number
    }
    const detail: IErrorDetailEx = {
      ...baseDetail,
      customField: 'Custom Value',
      numField: 123
    }
    const str = errorDetailToString(detail)
    expect(str).toContain('customField: Custom Value')
    expect(str).toContain('numField: 123')
  })
})

describe('nativeErrorToString', () => {
  test('should format a simple Error', () => {
    const err = new Error('Native error message')
    err.stack = 'Error: Native error message\n  at func (file.js:1:1)'
    const str = nativeErrorToString(err)
    expect(str).toContain('Error: Native error message') // message or toString()
    expect(str).toContain('stack:\nError: Native error message\n  at func (file.js:1:1)')
  })

  test('should format an Error with a string cause', () => {
    const err = new Error('Native error') as Error & { cause: any }
    err.cause = 'String cause'
    err.stack = 'Error: Native error\n  at func (file.js:1:1)'
    const str = nativeErrorToString(err)
    expect(str).toContain('cause:\nString cause')
  })

  test('should format an Error with another Error as cause', () => {
    const rootCause = new Error('Root cause error')
    rootCause.stack = 'Error: Root cause error\n  at root (root.js:1:1)'
    const err = new Error('Native error') as Error & { cause: any }
    err.cause = rootCause
    err.stack = 'Error: Native error\n  at func (file.js:1:1)'

    const str = nativeErrorToString(err)
    expect(str).toContain('cause:\nstack:\nError: Root cause error')
    expect(str).toContain('stack:\nError: Root cause error\n  at root (root.js:1:1)')
  })
})

describe('errorToString (universal formatter)', () => {
  test('should format IErrorLike object', () => {
    const errorLike = createErrorLike({ code: 'EL1', message: 'Universal test for IErrorLike', name: 'MyErrorLike' })
    const str = errorToString(errorLike)
    expect(str).toContain('code: EL1')
    expect(str).toContain('message: Universal test for IErrorLike')
    expect(str).toContain('name: MyErrorLike')
  })

  test('should format plain object as IErrorDetail', () => {
    const plainObj = { code: 'PO1', message: 'Plain object test', custom: 'value' }
    const str = errorToString(plainObj)
    expect(str).toContain('code: PO1')
    expect(str).toContain('message: Plain object test')
    expect(str).toContain('custom: value')
  })

  test('should format native Error instance', () => {
    const nativeErr = new Error('Universal native Error')
    nativeErr.stack = 'Error: Universal native Error\n  at n (n.js:1:1)'
    const str = errorToString(nativeErr)
    expect(str).toContain('Error: Universal native Error')
    expect(str).toContain('stack:\nError: Universal native Error\n  at n (n.js:1:1)')
    const json = nativeErrorToJsonLike(nativeErr)
    expect(json).toStrictEqual({
      name: 'Error',
      message: 'Universal native Error',
      stack: expect.any(String)
    })
  })

  test('should format string, number, boolean', () => {
    expect(errorToString('Just a string')).toBe('Just a string')
    expect(errorToString(12345)).toBe('12345')
    expect(errorToString(true)).toBe('true')


  })

  test('should return empty string for null or undefined', () => {
    expect(errorToString(null)).toBe('')
    expect(errorToString(undefined)).toBe('')
  })
})

describe('errorToJsonLike (universal formatter)', () => {
  test('invalid type', () => {
    // Все примитивные значения на верхнем уровне - будут записаны в свойство __value
    expect(errorToJsonLike(123)).toStrictEqual({ __value: 123 })
    // Для конкретных функций работающих с объектами - нельзя передавать невалидный тип
    // @ts-expect-error
    expect(() => nativeErrorToJsonLike(true)).toThrow()
    // @ts-expect-error
    expect(() => errorDetailToJsonLike(false)).toThrow()
  })

  test('hacker attack', () => {
    const error = createErrorLike({
      name: 'HackerError',
      message: '...'
    })
    Object.defineProperty(error, 'message', {
      enumerable: true,
      get () {
        throw 0 // Упавшие свойства игнорируются
      }
    })
    // @ts-expect-error Рекурсивные ссылки игнорируются
    error.self = error
    // @ts-expect-error Пустые объекты игнорируются
    error.empty = { error }
    // @ts-expect-error
    error.obj = { some: 123, error }
    expect(errorToJsonLike(error)).toStrictEqual({ name: 'HackerError', obj: { some: 123 } })
    // Безопасное извлечение JSON
    expect(JSON.stringify(error)).toBe('{"name":"HackerError","obj":{"some":123}}')
  })

  test('non enumerable', () => {
    const privateValue = Symbol()
    class SomeError extends BaseError {

      constructor(message: string) {
        const detail = createErrorLike({ message })
        super(Object.defineProperty(detail, '_meta', { value: privateValue }))
      }
    }
    let error!: SomeError
    let isMeta = false
    try {
      throw new SomeError('...')
    } catch (e: any) {
      if (e.detail._meta === privateValue) {
        isMeta = true
      }
      error = e
    }
    // Неперечислимые поля ошибок игнорируются
    expect(isMeta).toBe(true)
    expect(error.toJSON()).toStrictEqual({ name: 'SomeError', message: '...', stack: expect.stringContaining('SomeError: ...') })
  })
})

describe('ErrorLikeCollection', () => {
  test('toString', () => {
    const errorLike = createErrorLike({ code: 0x1001, name: 'MyLib.CustomError', level: 'warning' })
    const collection = new ErrorLikeCollection('warnings', [undefined, errorLike])
    expect([...collection]).toMatchObject([
      {
        message: 'IErrorLike was not created',
        level: 'error',
        cause: undefined
      },
      {
        code: 0x1001,
        name: 'MyLib.CustomError',
        level: 'warning'
      }
    ])
    expect(collection[1]).toBe(errorLike)

    const asString = `${collection}`
    const expected = `
warnings.0:
message: IErrorLike was not created
level: error
warnings.1:
code: 4097
name: MyLib.CustomError
level: warning
`.trim()
    expect(asString).toBe(expected)
  })

  test('toJSON', () => {
    // Расширяем тип ошибок
    interface IErrorLike_ extends IErrorLike {
      collection: any
    }
    // ... и устанавливаем дженерик
    const errorLike = createErrorLike<IErrorLike_>({
      name: 'MyLib.CustomError',
      collection: new ErrorLikeCollection(null, [{ name: 'MyLib.Error1' }, { name: 'MyLib.Error2' }])
    })

    // Будет вызвана toJSON
    expect(JSON.stringify(errorLike)).toStrictEqual(JSON.stringify({
      name: 'MyLib.CustomError',
      collection: {
        errors: [
          {
            name: 'MyLib.Error1'
          },
          {
            name: 'MyLib.Error2'
          }
        ]
      }
    }))
  })
})
