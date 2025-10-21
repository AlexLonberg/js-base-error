
import { describe, test, expect } from 'vitest'
import type { TNullish, IErrorDetail } from './types.ts'
import { ErrorLike } from './errors.ts'
import { errorLikeToJsonLike } from './serialization.ts'
//
import { captureStackTrace } from './capture.ts'

describe('capture', () => {
  test('добавляет свойство `stack` в переданный объект', () => {
    const errorLike = captureStackTrace({})
    expect(errorLike).toStrictEqual({
      stack: expect.stringContaining('at captureStackTrace')
    })
  })

  test('при получении некорректного типа (!{}) создает новый объект и добавляет сообщение об ошибке', () => {
    // @ts-expect-error Argument of type 'null' is not assignable to parameter of type 'IErrorDetail'.ts(2345)
    const errorLike = captureStackTrace(null)
    expect(errorLike).toStrictEqual({
      message: 'IErrorDetail was not created',
      level: 'error',
      cause: null,
      stack: expect.stringContaining('at captureStackTrace')
    })
  })

  test('не падает, если установка свойства `stack` вызывает ошибку, и возвращает исходный объект', () => {
    const fake = {
      get stack () {
        return 'fake'
      },
      set stack (_) {
        throw new Error('Fake')
      }
    }

    const errorLike = captureStackTrace(fake)
    expect(errorLike).toStrictEqual({
      stack: 'fake'
    })
  })

  test('исключает указанную функцию из трассировки стека', () => {
    interface ICustomDetail extends IErrorDetail {
      code: number
      message: string
    }
    // Исключаем имя игнорируемой функции
    function FnError () {
      function nestFn () {
        return captureStackTrace<ICustomDetail>({ message: '...', code: 0x0001 }, nestFn)
      }
      return nestFn()
    }
    expect(FnError()).toStrictEqual({
      message: '...',
      code: 1,
      stack: expect.stringContaining('at FnError')
    })
  })

  test('ErrorLike with stack', () => {
    // Пользовательская ошибка с управляемым стеком
    const modeDev = true

    class WithStackError extends ErrorLike {
      protected readonly _detail: TNullish | IErrorDetail
      stack: undefined | string
      constructor(detail?: TNullish | IErrorDetail) {
        super()
        this._detail = detail
        if (modeDev) {
          captureStackTrace(this, this.constructor)
        }
      }
    }

    class AppError extends WithStackError { }

    function foo () {
      throw new AppError({ message: 'stack test' })
    }
    function bar () {
      return foo()
    }

    try {
      bar()
      throw new Error('Test Error')
    } catch (e) {
      const json = errorLikeToJsonLike(e as ErrorLike, { includeStack: true, keepStackHeader: false })
      expect(json).toStrictEqual({
        name: 'AppError',
        message: 'stack test',
        stack: expect.stringMatching(/^\s+at foo/)
      })
    }
  })
})
