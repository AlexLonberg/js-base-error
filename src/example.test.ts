import { describe, test, expect } from 'vitest'

/**
 * Пример использования базовых интерфейсов.
 */
import { type IErrorLike as IErrorLike_, BaseError, createErrorLike, errorToString, isErrorLike } from './index.js'

// # 1. Определяем коды ошибок.

/** Коды ошибок. */
const errorCodes = Object.freeze({
  UnknownError: 0,
  ValueError: 1
} as const)
/** Коды ошибок. */
type TErrorCodes = typeof errorCodes
/** Коды ошибок. */
type TErrorCode = TErrorCodes[keyof TErrorCodes]

interface IErrorLike extends IErrorLike_ {
  code: TErrorCode
}

// # 2. Определяем базовую ошибку библиотеки.

class BaseLibError extends BaseError<IErrorLike, IErrorLike_> { }

// # 3. Стратегия генерации ошибок с помощью конструктора.

class UnknownError extends BaseLibError {
  readonly code = errorCodes.UnknownError
  constructor(message: string) {
    super({ message })
  }
}

// # 4. Стратегия генерации ErrorLike с передачей деталей ошибки в класс ValueError
//      или просто возврат пользователю. Ошибка созданная с createErrorLike() уже
//      имеет метод форматирования к строке

const errorDetails = Object.freeze({
  ValueError (message: string, captureStack?: null | undefined | boolean, cause?: undefined | null | unknown): IErrorLike {
    return createErrorLike({
      name: 'ValueError',
      code: errorCodes.ValueError,
      message,
      cause
    }, captureStack)
  }
} as const)

class ValueError extends BaseLibError { }

// # test

describe('Example Usage Integration', () => {
  test('UnknownError should work as expected', () => {
    const err = new UnknownError('Something unknown happened')

    expect(err).toBeInstanceOf(BaseLibError)
    expect(err).toBeInstanceOf(UnknownError)
    expect(err.detail.code).toBe(errorCodes.UnknownError)
    expect(err.message).toBe('Something unknown happened')

    const str = err.toString()
    expect(str).toContain(`code: ${errorCodes.UnknownError}`)
    expect(str).toContain('message: Something unknown happened')
    expect(str).toMatch(/stack:/)
  })

  test('errorDetails.ValueError should create IErrorLike', () => {
    const valErrorLike = errorDetails.ValueError('Invalid input value', true)
    expect(isErrorLike(valErrorLike)).toBe(true)
    expect(valErrorLike.code).toBe(errorCodes.ValueError)
    expect(valErrorLike.message).toBe('Invalid input value')
    expect(valErrorLike.name).toBe('ValueError')

    const str = valErrorLike.toString()
    expect(str).toContain(`code: ${errorCodes.ValueError}`)
    expect(str).toContain('message: Invalid input value')
    expect(str).toContain('name: ValueError') // Имя из деталей
  })

  test('ValueError class should wrap IErrorLike correctly', () => {
    const errorDetail = errorDetails.ValueError('Input is not a number')
    const err = new ValueError(errorDetail)

    expect(err).toBeInstanceOf(BaseLibError)
    expect(err).toBeInstanceOf(ValueError)
    expect(err.detail.code).toBe(errorCodes.ValueError)
    expect(err.message).toBe('Input is not a number') // From super(detail.message)
    expect(err.detail.name).toBe('ValueError') // Name from errorDetail

    const str = err.toString()
    expect(str).toContain(`code: ${errorCodes.ValueError}`)
    expect(str).toContain('message: Input is not a number')
    expect(str).toContain('name: ValueError') // Имя из деталей, переданных в конструктор
    expect(str).toMatch(/stack:/)
    // Стек должен быть от ValueError инстанса
    expect(err.detail.stack).toContain(/*'ValueError'*/ 'Error')
  })

  test('BaseError should handle cause correctly (using example classes)', () => {
    const rootCause = new UnknownError('The very first problem')
    const midCauseDetail = errorDetails.ValueError('Intermediate issue', false)
    const midError = new ValueError(midCauseDetail);
    (midError.detail as any).cause = rootCause // Устанавливаем причину для ValueError

    class TopLevelError extends BaseLibError {
      constructor(message: string, cause: unknown) {
        super({ code: errorCodes.UnknownError, message, cause, name: 'TopLevelError' })
      }
    }
    const topError = new TopLevelError('A high-level problem occurred', midError)

    const str = errorToString(topError)

    // Check TopLevelError
    // expect(str).toContain('name: TopLevelError')
    expect(str).toContain('message: A high-level problem occurred')

    // Check MidError (ValueError) in cause
    expect(str).toContain('cause:')
    expect(str).toMatch(/name: TopLevelError[\s\S]*code: 1[\s\S]*message: Intermediate issue/)

    // Check RootCause (UnknownError) in cause of MidError
    // Ищем "cause:" внутри блока причины от ValueError
    const midErrorCauseSection = str.substring(str.indexOf('name: ValueError'))
    expect(midErrorCauseSection).toContain('cause:')

    // Более точная проверка:
    // message: Intermediate issue
    // stack: ...
    // cause:
    // name: Error (или UnknownError)
    // code: 0
    // message: The very first problem
    expect(midErrorCauseSection).toMatch(/code: 0[\s\S]*message: The very first problem/)
  })
})

test('Error default property', () => {
  // Варианты определения свойств по умолчанию.

  // Без свойства 'name' класса ошибка получит имя класса
  class FooError extends BaseError { }
  const foo = new FooError({})
  expect(foo.name).toBe('FooError')
  expect(foo.detail.name).toBe('FooError')
  // Прямое переопределение имени игнорируется - базовый класс использует заглушку set name(v)
  foo.name = 'X'
  expect(foo.name).toBe('FooError')
  expect(foo.detail.name).toBe('FooError')
  // ... только так
  foo.detail.name = 'X'
  expect(foo.name).toBe('X')
  expect(foo.detail.name).toBe('X')

  // С переопределением 'name' - getter базового класса перекрывается и ошибка получит пользователькое свойство
  class CustomNameError extends BaseError {
    override name = 'App.Error' // Полностью переопределим свойство класса: get/set to value
  }
  const name = new CustomNameError({})
  expect(name.name).toBe('App.Error')
  expect(name.detail.name).toBe('App.Error')
  // Повторное определение невозможно - setter был переопределен
  name.name = 'X'
  expect(name.name).toBe('X') // !!!
  expect(name.detail.name).toBe('App.Error')
  // ... но это не мешает установить имя прямо в деталях ошибки(не забываем что это не повлияет на Error.name)
  name.detail.name = 'X'
  expect(name.detail.name).toBe('X')

  // Стандартный вариант с передачей имени в деталях ошибки
  const err = new FooError({ name: 'Arr.FooError' })
  expect(err.name).toBe('Arr.FooError') // сработает get name()
  expect(err.detail.name).toBe('Arr.FooError')

  // Любое пользовательское свойство класса ошибки будет скопировано один раз
  class SomeError extends BaseError<IErrorLike_ & { custom: number }, {}> {
    custom = 1234
  }
  const some = new SomeError({})
  expect(some.detail.custom).toBe(1234)
  // Пользователькие свойства класса должны применяться только для упрощенного определения свойств по умолчанию,
  // попытки изменить значения на самом свойстве - игнорируются.
  some.custom = 5678
  expect(some.detail.custom).toBe(1234)
})

test('Error formatting', () => {
  const err = new ValueError(errorDetails.ValueError('base error', null, new UnknownError('uncertainty')))

  // Удалим стек, иначе не сможем увидеть точный формат
  err.detail.stack = null;
  (err.detail.cause as any).detail.stack = null
  const str = `${err}`

  const expected = `code: 1
name: ValueError
message: base error
cause:
code: 0
name: UnknownError
message: uncertainty`

  expect(str).toContain(expected)
})
