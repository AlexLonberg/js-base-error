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
  errorToString
} from './index.js'

test('should create an IErrorLike object with default values', () => {
  const detail = { code: 1, message: 'Test message' }
  const errorLike: IErrorLike<number> = createErrorLike(detail)
  expect(errorLike.code).toBe(1)
  expect(errorLike.message).toBe('Test message')
  expect(errorLike.level).toBeUndefined() // По умолчанию не устанавливается
  expect(errorLike.name).toBeUndefined()
  expect(errorLike.stack).toBeUndefined()
  expect(isErrorLike(errorLike)).toBe(true)
  expect(typeof errorLike.toString).toBe('function')
})

test('should use ErrorLikeProto', () => {
  const errorLike = createErrorLike({ code: 1, message: 'Test' })
  expect(Object.getPrototypeOf(errorLike)).toBe(ErrorLikeProto)
})

test('should handle non-object detail by creating a default error', () => {
  const errorLike = createErrorLike('invalid detail' as any)
  expect(errorLike.code).toBe(0)
  expect(errorLike.message).toBe('IErrorLike was not created')
  expect(errorLike.level).toBe('error')
  expect(errorLike.cause).toBe('invalid detail')
  expect(isErrorLike(errorLike)).toBe(true)
})

test('should call captureStackTrace if captureStack is true', () => {
  const detail = { code: 2, message: 'Capture test' }
  const errorLike = createErrorLike(detail, true)
  expect(typeof errorLike.stack).toBe('string')
  const asString = errorLike.toString()
  const expected = 'code: 2\n' +
    'message: Capture test\n' +
    'stack:'
  expect(asString).toContain(expected)
})

test('should correctly assign all IErrorDetail properties', () => {
  const detail: IErrorDetail<string> = {
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
})

describe('BaseError', () => {
  class DefaultError extends BaseError<IErrorLike<number>> { }
  class TestError extends BaseError<IErrorLike<number>> {
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
    expect(err.code).toBe(101)
    expect(err.level).toBe('info')
  })

  test('should default level to "error" if not provided', () => {
    const err = new TestError(102, 'Default level')
    expect(err.level).toBe('error')
    expect(err.detail.level).toBeUndefined() // detail.level может быть undefined
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
    const errorLikeDetail = createErrorLike({ code: 104, message: 'From IErrorLike', name: 'MyErrorLike' })
    const err = new DefaultError(errorLikeDetail)
    expect(err.detail).toBe(errorLikeDetail) // Должен быть тот же объект
    expect(err.code).toBe(104)
    expect(err.message).toBe('From IErrorLike') // super(detail.message)
    expect(err.detail.name).toBe('MyErrorLike') // Имя из IErrorLike
  })

  test('constructor should prioritize detail.name and detail.stack if provided', () => {
    const detailWithNameAndStack: IErrorDetail<number> = {
      code: 105,
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
  const baseDetail: IErrorDetail<string> = {
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
    const detail: IErrorDetail<string> = { ...baseDetail, level: 'warning', name: 'MyDetailError' }
    const str = errorDetailToString(detail)
    expect(str).toContain('name: MyDetailError')
    expect(str).toContain('level: warning')
    const detailWithCustomName = { ...baseDetail, customProp: 'MyDetailError' }
    const strWithCustomName = errorDetailToString(detailWithCustomName)
    expect(strWithCustomName).toContain('customProp: MyDetailError')
  })

  test('should include stack and cause', () => {
    const causeError = new Error('Root cause')
    const detail: IErrorDetail<string> = {
      ...baseDetail,
      stack: 'Error: Detail message\n  at someFunc (file.js:10:5)',
      cause: causeError,
    }
    const str = errorDetailToString(detail)
    expect(str).toContain('stack:\nError: Detail message')
    expect(str).toContain('cause:\nError: Root cause') // nativeErrorToString для cause
  })

  test('should handle nested IErrorDetail in cause', () => {
    const nestedDetail: IErrorDetail<number> = { code: 99, message: 'Nested detail' }
    const detail: IErrorDetail<string> = { ...baseDetail, cause: nestedDetail }
    const str = errorDetailToString(detail)
    expect(str).toContain('cause:\ncode: 99\nmessage: Nested detail')
  })

  test('should handle circular dependencies in cause gracefully (WeakSet)', () => {
    const detailA: IErrorDetail<string> = { code: 'A', message: 'Detail A' }
    const detailB: IErrorDetail<string> = { code: 'B', message: 'Detail B' }
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
    const detail: IErrorDetail<string> & { customField: string, numField: number } = {
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
    expect(str).toContain('cause:\nError: Root cause error')
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

test('ErrorLikeCollection', () => {
  const errorLike = createErrorLike({ code: 0x1001, name: 'MyLib.CustomError', level: 'warning' })
  const collection = new ErrorLikeCollection('warnings', [undefined, errorLike])
  expect([...collection]).toMatchObject([
    {
      code: 0,
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
code: 0
message: IErrorLike was not created
level: error
warnings.1:
name: MyLib.CustomError
code: 4097
level: warning
`.trim()
  expect(asString).toBe(expected)
})
