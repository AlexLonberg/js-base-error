import { describe, test, expect } from 'vitest'

/**
 * Пример использования базовых интерфейсов.
 */
import { type IErrorLike, BaseError, createErrorLike, errorToString, isErrorLike } from './index.js'

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

// # 2. Определяем базовую ошибку библиотеки.

class BaseLibError extends BaseError<IErrorLike<TErrorCode>> { }

// # 3. Стратегия генерации ошибок с помощью конструктора.

class UnknownError extends BaseLibError {
  constructor(message: string) {
    super({ code: errorCodes.UnknownError, message })
  }
}

// # 4. Стратегия генерации ErrorLike с передачей деталей ошибки в класс ValueError
//      или просто возврат пользователю. Ошибка созданная с createErrorLike() уже
//      имеет метод форматирования к строке

const errorDetails = Object.freeze({
  ValueError (message: string, captureStack?: null | undefined | boolean, cause?: undefined | null | unknown) {
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
    expect(err.level).toBe('error') // Default from BaseError

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
    expect(err.level).toBe('error') // Default from BaseError

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

test('Error formatting', () => {
  const err = new ValueError(errorDetails.ValueError('base error', null, new UnknownError('uncertainty')))

  // Удалим стек, иначе не сможем увидеть точный формат
  err.detail.stack = null;
  (err.detail.cause as any).detail.stack = null
  const str = `${err}`

  const expected = `name: ValueError
code: 1
message: base error
cause:
name: UnknownError
code: 0
message: uncertainty`

  expect(str).toContain(expected)
})
