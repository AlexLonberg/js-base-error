/* eslint-disable @typescript-eslint/consistent-generic-constructors */
import { describe, test, expect } from 'vitest'
//
import {
  type TNullish,
  // type TJsonLike,
  // type TErrorLevel,
  type IErrorDetail,
  // type IErrorLike,
  // type IErrorCollection,
  // type TMetaValue,
  // type TMetaTruncated,
  // type TMetaPlaceholder,
  // type TSerializationOptions,
  SerializationParameters,
  ensureSerializationParameters,
  // captureStackTrace,
  // defineErrorLike,
  ErrorLike,
  LiteError,
  BaseError,
  ErrorCollection,
  // isErrorLike,
  errorToJsonLike,
  // errorToString
} from './index.ts'

describe('usage', () => {
  test('basic', () => {
    // Определите базовые ошибки вашего прилжения:
    class AppError extends BaseError {
      // Все перечислимые свойства класса на любой иерархии - будут скопированы.
      override name = 'AppError'
      code = 'E0058'
      constructor(detail: IErrorDetail) {
        super(detail)
      }
    }

    const error = new AppError({ message: 'Oh no 😮', cause: { reason: '🕷️' } })

    // Приведитете ошибку к форматированной строке:
    const str = error.toString() // without a stack
    expect(str).toBe(`
name: AppError
message: Oh no 😮
code: E0058
cause:
  reason: 🕷️
      `.trim())

    // Используйте функции [`errorToJsonLike(...)` и `errorToString(...)`](./src/serialization.ts)
    // или передайте параметры ограничений в расширенные методы `toJsonWith(...)` и `toStringWith(...)`:
    const json = error.toJsonWith({ includeStack: true, keepStackHeader: true })
    expect(json).toStrictEqual({
      name: 'AppError',
      message: 'Oh no 😮',
      code: 'E0058',
      cause: { reason: '🕷️' },
      stack: expect.stringContaining('AppError')
    })

    // `LiteError` обеспечивает тот же API, но не захватывает `stack`(низкая стоимость создания):
    expect(error instanceof ErrorLike).toBe(true)
    expect(new LiteError() instanceof ErrorLike).toBe(true)
  })

  test('configuration', () => {
    // Параметры ограничений [`SerializationParameters` и `TSerializationOptions`](./src/options.ts)
    // можно передать для каждого запроса или установить глобальную конфигурацию:
    SerializationParameters.configure({
      // includeStack?: TNullish | boolean
      // maxDepth?: TNullish | number
      maxItems: 2,
      maxTotalItems: 10,
      maxStringLength: 8,
      // ignoreEmpty: true,
      // include?: TNullish | string | string[]
      exclude: ['token'],
      // metaFieldName?: TNullish | string
      // ignoreMeta?: TNullish | boolean
    })

    // Теперь вызовы методов `toJson()/toJSON()/toJsonWith()/toString()/toStringWith()` и функции
    // `errorToJsonLike()/errorToString()` используют эти параметры по умолчанию без повторной инициализации.
    expect(ensureSerializationParameters()).toBe(ensureSerializationParameters())
  })

  test('collection', () => {
    type T = IErrorDetail & { token?: TNullish | string }

    // `ErrorCollection` позволяет объединять ошибки и выводить коллекцию как одно поле(внутри другой ошибки)
    // или как самостоятельный массив:
    const combined = new ErrorCollection<LiteError<T>, T>([
      new LiteError({ message: '123456789', level: 'debug' })
    ])
    combined.push({ name: 'TokenError', token: 'private' })

    // NOTE Для теста установим параметры повторно
    SerializationParameters.configure({ maxItems: 2, maxTotalItems: 10, maxStringLength: 8, exclude: 'token' })

    const list = combined.toStringWith(/* global */)

    expect(list).toBe(`
[0]:
  name: LiteError
  message: 12345678
  __meta:
    kind: object
    total: 3
    truncated: 1
[1]:
  name: TokenError
`.trim())
  })

  test('advanced', () => {
    // Расширим стандартные поля для TS и автоподсказок в IDE
    interface ILibErrorDetail extends IErrorDetail {
      features?: string
    }

    // Базовая ошибка библиотеки
    class LibError extends BaseError<ILibErrorDetail> {
      override readonly name: string = 'LibError'
      readonly lib = 'lib_v5.04.85.test'

      // Такое необходимо для defineProperty
      declare features: string
    }

    // Синхронизация features с объектом деталей ошибки
    Object.defineProperty(LibError.prototype, 'features', {
      enumerable: true,
      // Обращаться нужно именно к detail. Беспокоится о круговых
      // ссылках не стоит - об этом позаботится инициализатор.
      get () { return this.detail.features ?? 'default' },
      set (v) { this.detail.features = v }
    })

    // Конкретизированные ошибки
    class ConcreteError extends LibError {
      // Переопределяет базовое имя
      override readonly name = 'ConcreteError'
    }

    // Значения параметров IErrorDetail имеют приоритет и перезапишут
    // любое поле по умолчанию
    const error1 = new ConcreteError({ features: 'custom' })
    const error2 = new ConcreteError({ name: 'RenamedError' })

    // Поле `detail` инициализируется после первого вызова
    expect(Object.hasOwn(error1, 'detail')).toBe(false)

    expect(error1.detail).toStrictEqual({
      name: 'ConcreteError',
      lib: 'lib_v5.04.85.test',
      features: 'custom'
    })
    expect(error2.detail).toStrictEqual({
      name: 'RenamedError',
      lib: 'lib_v5.04.85.test',
      features: 'default'
    })

    expect(Object.hasOwn(error1, 'detail')).toBe(true)
  })

  test('meta', () => {
    SerializationParameters.configure(/* Сброс конфига к умолчанию */)

    // Безопасные методы ошибок и функции `errorToJsonLike()` или `errorToString()`,
    // позволяют привести любые данные к допустимому типу JSON или строке:
    const jsonLike = errorToJsonLike({
      he: 'Hello, Error Like!',
      get good () { return 'good' },
      get bad () { throw new Error('bad') }, // проигнорирует
      re: /^[0-9]+$/i,
      bg: 123n,
      sm: Symbol('hidden'),
      dt: new Date('2025-12-25T13:37:00.000Z'),
    })

    // Некорректные типы заворачиваются в мета-объекты:
    expect(jsonLike).toStrictEqual({
      he: 'Hello, Error Like!',
      good: 'good',
      re: { __meta: { type: 'regexp', value: '/^[0-9]+$/i' } },
      bg: { __meta: { type: 'bigint', value: '123' } },
      sm: { __meta: { type: 'symbol', value: 'Symbol(hidden)' } },
      dt: { __meta: { type: 'date', value: '2025-12-25T13:37:00.000Z' } }
    })

    // > Зарезервированное имя поля `__meta` изменяется опцией `metaFieldName`.
  })

  test('recommendations', () => {
    for (const item of ['development', 'production'] as const) {
      const mode: 'development' | 'production' = /* env.mode */ item

      // Определим две версии базовой ошибки с одним именем:
      //  + BaseError - Версия для разработки с трассировкой
      //  + LiteError - Версия для минифицированного приложения
      const Base = (mode === 'production' ? LiteError : BaseError) as typeof LiteError

      class AppError extends Base { }

      // Конкретизированные ошибки
      class PermissionError extends AppError {
        override readonly name = 'PermissionError'
        constructor(message: string) {
          super({ message })
        }
      }

      // В режиме 'development', такая ошибка получит дополнительное поле `stack`
      const error = new PermissionError('...')

      const expected: IErrorDetail = {
        name: 'PermissionError',
        message: '...'
      }
      if (mode === 'development') {
        expected.stack = expect.stringContaining('PermissionError')
      }

      expect(error).toBeInstanceOf(ErrorLike)
      expect(error.toJsonWith({ includeStack: true, keepStackHeader: true })).toStrictEqual(expected)
    }
  })
})
