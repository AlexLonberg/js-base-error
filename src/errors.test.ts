import { describe, test, expect, expectTypeOf } from 'vitest'
import type { IErrorDetail, IErrorSerializable, IErrorLike } from './types.ts'
import type { TSerializationOptions } from './options.ts'
//
import {
  captureErrorProperties,
  defineErrorLike,
  ErrorLike,
  LiteError,
  BaseError,
  ErrorCollection
} from './errors.ts'

describe('errors', () => {
  test('defineErrorLike sets up ErrorLike properties on a plain object ', () => {
    const error = {
      _detail: { message: 'test message' }
    } as unknown as IErrorLike<IErrorDetail>
    defineErrorLike(error)

    expect(error).toHaveProperty('detail')
    expect(error.detail).toStrictEqual({ message: 'test message' })
    expect(error.name).toBe('Object') // name falls back to constructor.name if not set
    expect(error.message).toBe('test message')
    expect(error instanceof ErrorLike).toBe(true) // via Symbol.hasInstance
    expect(ErrorLike[Symbol.hasInstance](error)).toBe(true)
  })

  test('captureErrorProperties copies enumerable properties to detail, skipping reserved and existing', () => {
    class CustomError {
      name = 'CustomName'
      message = 'CustomMessage'
      code = 123
      own = 'should be copied'
      boom () { /* */ } // non-enumerable by default
    }
    defineErrorLike(CustomError.prototype)

    const error = new CustomError() as unknown as ErrorLike<any>
    const detail: IErrorDetail = { code: 456 } // existing code should not be overwritten

    const result = captureErrorProperties(error, detail)
    expect(result).toBe(detail) // returns the same detail object
    expect(detail).toStrictEqual({
      name: 'CustomName', // copied
      message: 'CustomMessage',
      code: 456, // not overwritten
      own: 'should be copied'
    })

    // Переустановить значения через поля данных после инициализации detail - невозможно
    error.name = 'NewErrorName'
    expect(error.detail.name).toBe('CustomName')
  })

  test('ErrorLike lazy initializes detail with captureErrorProperties', () => {
    class CustomError extends ErrorLike {
      code = 123
      protected readonly _detail: IErrorDetail
      constructor(detail: IErrorDetail) {
        super()
        this._detail = detail
      }
    }

    const error = new CustomError({ message: 'pre-set' })
    expect((error as any)._detail).toStrictEqual({ message: 'pre-set' }) // protected access for test

    // Trigger lazy init
    const detail = error.detail
    expect(detail).toStrictEqual({
      message: 'pre-set',
      code: 123,
      name: 'CustomError'
    })
    expect(error.name).toBe(CustomError.name) // fallback
    expect(error.message).toBe('pre-set')
  })

  test('ErrorLike handles circular dependencies in getters during init', () => {
    const actions: string[] = []
    const fakeDetails: any[] = []

    class CustomError extends ErrorLike<IErrorDetail> {
      // @ts-expect-error Временный перехватчик для теста
      get detail (): IErrorDetail {
        actions.push('before init')
        const detail = Reflect.get(ErrorLike.prototype, 'detail', this) // super.detail
        actions.push('after init')
        return detail
      }
    }
    Object.defineProperty(CustomError.prototype, 'message', {
      enumerable: true,
      get () {
        actions.push('get message')
        const detail = this.detail // Proxy
        fakeDetails.push(detail)
        detail.hidden = 'set hidden'
        return detail.message ?? 'default'
      },
      set (v: string) {
        actions.push('before set message')
        const detail = this.detail // circular dependencies
        detail.message = detail.message ? detail.message + ' + ' + v : v
        actions.push('after set message')
      }
    })

    const error = new CustomError()
    error.message = 'test'

    expect(error.detail).toStrictEqual({
      name: 'CustomError',
      message: 'default + test',
      hidden: 'set hidden'
    })
    expect(actions).toStrictEqual([
      'before set message',
      'before init',
      'get message',
      'after init',
      'after set message'
    ])

    // После инициализации, аксессор становится свойством инстанса и доступен напрямую
    const acc = Object.getOwnPropertyDescriptor(error, 'detail')!
    expect(acc.get).toBeInstanceOf(Function)

    const proxy = fakeDetails[0]!
    error.message // get message() обновим массив "подозреваемых"
    const real = fakeDetails[1]!
    const detail = error.detail
    expect(proxy).toStrictEqual(detail)
    expect(proxy.level).toBeUndefined()
    expect(detail.level).toBeUndefined()
    proxy.level = 'debug'
    expect(detail.level).toBe('debug')
    expect(proxy).not.toBe(detail)
    expect(real).toBe(detail)
  })

  test('LiteError initialization', () => {
    const detail = { message: 'lite error' }
    const error = new LiteError(detail)

    expect(error.detail).toStrictEqual({
      name: 'LiteError',
      message: 'lite error'
    })
    expect(error instanceof ErrorLike).toBe(true)
  })

  test('BaseError extends native Error and implements ErrorLike', () => {
    class CustomBaseError extends BaseError {
      code = 123
    }

    const error = new CustomBaseError({ message: 'base error' })
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ErrorLike)

    // Стек никогда не попадает в detail - `get detail()` не обращается к нативному ленивому инициализатору стека
    expect(error.detail).toStrictEqual({
      name: 'CustomBaseError',
      message: 'base error',
      code: 123
    })

    // Стек будет прочитан только при явном запросе.
    expect(new CustomBaseError({ message: '...' }).toJsonWith({ includeStack: true, keepStackHeader: true })).toStrictEqual({
      name: 'CustomBaseError',
      message: '...',
      code: 123,
      stack: expect.stringContaining('CustomBaseError') // native stack
    })

    // Стек формируется так же как и у нативной ошибки при первом запросе - то есть имя можно изменить в
    // любое время до первого обращения к стеку
    const err = new CustomBaseError()
    expect(err.name).toBe('CustomBaseError')
    expect(err.message).toBe('')
    err.name = 'RenamedError'
    // Смотри ниже на разницу тестирования в NodeJS и Chromium. Не используем эту строку.
    // err.message =
    expect(err.stack).contains('RenamedError')

    // В NodeJS тесты можно увидеть с измененным сообщением, но в playwright+chromium это не работает.
    // Подозрение что в браузере - нельзя изменить сообщение, которое не было передано сразу.
    // expect((new Error('msg')).stack).contains('Error: msg') // Только NodeJS
    expect((new Error('msg')).stack).contains('Error')
  })

  test('ErrorCollection ensures items are ErrorLike', () => {
    const collection = new ErrorCollection([
      new LiteError({ code: 1 }),
      { code: 2 }, // plain object -> wrapped
      'string error', // primitive -> cause/wrapped
      undefined // -> wrapped with default
    ])

    expect(collection.length).toBe(4)
    expect(collection.every(item => item instanceof ErrorLike)).toBe(true)
    expect(collection[0]?.detail).toMatchObject({ code: 1 })
    expect(collection[1]?.detail).toMatchObject({ code: 2 })
    expect(collection[2]?.detail).toMatchObject({ cause: 'string error' })
    expect(collection[3]?.detail).toStrictEqual({ name: 'LiteError' }) // or default empty
  })

  test('ErrorCollection methods like push/unshift/splice ensure ErrorLike', () => {
    const collection = new ErrorCollection()

    collection.push({ code: 1 }, 'primitive' as any)
    expect(collection.length).toBe(2)
    expect(collection[0] instanceof ErrorLike).toBe(true)
    expect(collection[1]?.detail.cause).toBe('primitive')

    collection.unshift(new LiteError({ code: 0 }))
    expect(collection.length).toBe(3)
    expect(collection[0]?.detail.code).toBe(0)

    const spliced = collection.splice(1, 1, { code: 99 })
    expect(spliced.length).toBe(1)
    expect(spliced[0] instanceof ErrorLike).toBe(true)
    expect(collection[1]?.detail.code).toBe(99)
  })

  test('type ErrorLike', () => {
    // type Ok = BaseError extends ErrorLike ? true : false
    // // true
    // type Failed = ErrorLike extends BaseError ? true : false
    // // false

    expectTypeOf<LiteError>().toExtend<ErrorLike>()
    expectTypeOf<BaseError>().toExtend<ErrorLike>()
    expectTypeOf<ErrorLike>().not.toExtend<BaseError>()

    expectTypeOf<typeof LiteError>().toExtend<typeof ErrorLike>()
    expectTypeOf<typeof BaseError>().toExtend<typeof ErrorLike>()
    expectTypeOf<typeof ErrorLike>().not.toExtend<typeof BaseError>()

    expectTypeOf<ErrorLike>().toExtend<IErrorLike<IErrorDetail>>()
    expectTypeOf<ErrorLike>().toExtend<IErrorSerializable>()
    expectTypeOf<LiteError>().toExtend<IErrorSerializable>()
    expectTypeOf<BaseError>().toExtend<IErrorSerializable>()
    expectTypeOf<ErrorCollection>().toExtend<IErrorSerializable>()
  })
})

describe('errors | to Json and String', () => {
  test('BaseError', () => {
    const detail = {
      code: 500,
      message: 'Internal error',
      cause: { detail: 'Database failure' },
      stack: 'Fake stack\n    at service (/app.js:30)\n    at controller (/app.js:20)'
    }
    const error = new BaseError(detail)

    const jsonDefault = error.toJson()
    expect(jsonDefault).toStrictEqual({
      name: 'BaseError',
      message: 'Internal error',
      code: 500,
      cause: { detail: 'Database failure' }
    }) // no stack by default

    const strDefault = error.toString()
    expect(strDefault).toBe(
      'name: BaseError\n' +
      'message: Internal error\n' +
      'code: 500\n' +
      'cause:\n' +
      '  detail: Database failure'
    )

    const options = { includeStack: true, maxDepth: 1 }
    const jsonWith = error.toJsonWith(options)
    expect(jsonWith).toStrictEqual({
      name: 'BaseError',
      message: 'Internal error',
      code: 500,
      stack: '    at service (/app.js:30)\n    at controller (/app.js:20)',
      cause: { __meta: { kind: 'object', length: 1 } }
    }) // with stack and limited depth

    const strWith = error.toStringWith(options)
    expect(strWith).toBe(
      'name: BaseError\n' +
      'message: Internal error\n' +
      'code: 500\n' +
      'stack:     at service (/app.js:30)\n' +
      '      at controller (/app.js:20)\n' +
      'cause:\n' +
      '  __meta:\n' +
      '    kind: object\n' +
      '    length: 1'
    )
  })

  test('ErrorCollection', () => {
    const err1 = new LiteError({ message: 'First warning', level: 'warn' })
    const err2 = new LiteError({ message: 'Second error', cause: { info: 'Details' } })
    const collection = new ErrorCollection([err1, err2])

    const jsonDefault = collection.toJsonWith({ maxDepth: 3 })
    expect(jsonDefault).toStrictEqual([
      { name: 'LiteError', message: 'First warning', level: 'warn' },
      { name: 'LiteError', message: 'Second error', cause: { info: 'Details' } }
    ]) // array of objects, no stack

    const strDefault = collection.toStringWith({ maxDepth: 3 })
    expect(strDefault).toBe(
      '[0]:\n' +
      '  name: LiteError\n' +
      '  message: First warning\n' +
      '  level: warn\n' +
      '[1]:\n' +
      '  name: LiteError\n' +
      '  message: Second error\n' +
      '  cause:\n' +
      '    info: Details'
    )

    const options: TSerializationOptions = { maxDepth: 2 }
    const jsonWith = collection.toJsonWith(options)
    expect(jsonWith).toStrictEqual([
      { name: 'LiteError', message: 'First warning', level: 'warn' },
      { name: 'LiteError', message: 'Second error', cause: { __meta: { kind: 'object', length: 1 } } }
    ]) // limited depth, stack not present since not in details

    const options2: TSerializationOptions = { maxDepth: 3, ignoreMeta: true }
    const strWith = collection.toStringWith(options2)
    expect(strWith).toBe(
      '[0]:\n' +
      '  name: LiteError\n' +
      '  message: First warning\n' +
      '  level: warn\n' +
      '[1]:\n' +
      '  name: LiteError\n' +
      '  message: Second error\n' +
      '  cause:\n' +
      '    info: Details'
    )
  })
})

describe('beautiful error', () => {
  const bombs: Error[] = []

  class CacheMissError extends BaseError {
    override name = 'CacheMissError'
    key = 'user:123:session'
  }

  class DatabaseTimeoutError extends ErrorLike {
    override name = 'DatabaseTimeoutError'
    query = 'SELECT * FROM users;'
    timeout = 3000 // ms
    protected readonly _detail: IErrorDetail
    constructor(detail: IErrorDetail) {
      super()
      this._detail = detail
    }
  }
  Object.defineProperty(DatabaseTimeoutError.prototype, 'bomb', {
    enumerable: true,
    get () {
      const e = new Error('bomb 1')
      bombs[0] = e
      throw e
    }
  })

  class CosmicRayFluxError extends BaseError {
    override name = 'CosmicRayFluxError'
    code = 'CRF-001'
    level = 'fatal'
    override message = 'A high-energy particle corrupted a critical memory address.'

    // Дата - чтобы проверить сериализатор Date
    timestamp = new Date('2025-12-25T13:37:00.000Z')

    // BigInt - чтобы проверить __meta: { bigint: ... }
    transactionId = 123456789012345678901234567890n

    // RegExp - еще один экзотический тип
    validator = /^[a-zA-Z0-9]+\n$/

    // Простой вложенный объект
    affectedSystem = {
      service: 'auth-service',
      cpuCore: 7,
      isCritical: true,
      [Symbol('internal_id')]: 'secret-internal-id',// Symbol (должен быть проигнорирован, т.к. не является enumerable)
      get bomb () {
        const e = new Error('bomb 2')
        bombs[1] = e
        throw e
      }
    }

    // Массив примитивов
    failedAttempts = [1, 'two', Symbol('three')]

    // Стек (мы его подменим для предсказуемости)
    override stack = 'CosmicRayFluxError: A high-energy particle...\n' +
      '    at processTransaction (/app/services/payment.js:123:45)\n' +
      '    at handleRequest (/app/server.js:80:10)'

    // Причина - вложенная ошибка
    override cause = new DatabaseTimeoutError({ message: 'Query timed out while fetching user data' })

    // ErrorCollection - массив сложных объектов
    subsystemFailures = new ErrorCollection([
      new CacheMissError({ message: 'Session data not found in Redis' }),
      { name: 'MetricsError', message: 'Failed to report to Prometheus', code: 503 } // Обычный объект, чтобы проверить _ensureError
    ])
  }

  test('beautiful error', () => {
    // Создаем экземпляр
    const beautifulError = new CosmicRayFluxError()
    expect(beautifulError.toStringWith({ includeStack: true, keepStackHeader: true })).toBe(`
name: CosmicRayFluxError
message: A high-energy particle corrupted a critical memory address.
code: CRF-001
stack: CosmicRayFluxError: A high-energy particle...
      at processTransaction (/app/services/payment.js:123:45)
      at handleRequest (/app/server.js:80:10)
cause:
  name: DatabaseTimeoutError
  message: Query timed out while fetching user data
  query: SELECT * FROM users;
  timeout: 3000
level: fatal
timestamp:
  __meta:
    type: date
    value: 2025-12-25T13:37:00.000Z
transactionId:
  __meta:
    type: bigint
    value: 123456789012345678901234567890
validator:
  __meta:
    type: regexp
    value: /^[a-zA-Z0-9]+\\n$/
affectedSystem:
  service: auth-service
  cpuCore: 7
  isCritical: true
failedAttempts:
  [0]: 1
  [1]: two
  [2]:
    __meta:
      type: symbol
      value: Symbol(three)
subsystemFailures:
  [0]:
    __meta:
      kind: error
      name: CacheMissError
      message: Session data not found in Redis
  [1]:
    __meta:
      kind: error
      name: MetricsError
      message: Failed to report to Prometheus
`.trim())

    expect(bombs).toMatchObject([new Error('bomb 1'), new Error('bomb 2')])
  })
})
