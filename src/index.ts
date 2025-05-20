/**
 * Статический метод [Error.captureStackTrace(...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace)
 *
 * Безопасная альтернатива явного вызова `Error.captureStackTrace()`. В окружениях, где он отсутствует, функция становится no-op.
 */
const captureStackTrace = ((): ((target: object) => void) => {
  try {
    const fun = Reflect.get(Error, 'captureStackTrace')
    if (typeof fun === 'function') {
      return fun.bind(Error)
    }
  } catch (_) { /**/ }
  return ((..._: any) => { /**/ })
})()

/**
 * Уровень ошибок.
 */
type TErrorLevel = 'info' | 'warning' | 'error' | 'debug'

/**
 * Базовый интерфейс деталей ошибки.
 */
interface IErrorDetail<TCode extends number | string> {
  /**
   * Обязательное поле кода ошибки.
   */
  code: TCode
  /**
   * Обязательное поле описания ошибки.
   */
  message: string
  /**
   * Необязательное поле имя ошибки. Может быть установлено явно или будет извлечено из {@link Error}.
   */
  name?: undefined | null | string
  /**
   * Необязательное поле уровня ошибки. По умолчанию все ошибки считаются `'error'`.
   */
  level?: undefined | null | TErrorLevel
  /**
   * Может быть установлен явно, или взят из {@link Error} если поле извлекается из ошибки.
   */
  stack?: undefined | null | string
  /**
   * Необязательное поле причины.
   */
  cause?: undefined | null | unknown
}

/**
 * Расширяет {@link IErrorDetail} методом форматирования `toString()`.
 */
interface IErrorLike<TCode extends number | string> extends IErrorDetail<TCode> {
  toString (): string
}

/**
 * Прототип для реализации интерфейса {@link IErrorLike}.
 */
const ErrorLikeProto = Object.freeze({
  toString (): string {
    return errorDetailToString(this as IErrorDetail<any>)
  }
} as const)

/**
 * Базовый класс ошибок.
 *
 * Обеспечивает прямой доступ к {@link IErrorDetail}, коду ошибки {@link IErrorDetail.code} и форматированию к строке.
 */
abstract class BaseError<TCode extends number | string> extends Error {
  readonly detail: IErrorLike<TCode>

  constructor(detail: IErrorLike<TCode> | IErrorDetail<TCode>) {
    super(detail.message)
    this.detail = isErrorLike(detail) ? detail : createErrorLike(detail, false)
    _writeNameAndStackOf(this.detail, this)
  }

  get code (): TCode {
    return this.detail.code
  }

  get level (): TErrorLevel {
    return this.detail.level ?? 'error'
  }

  override toString (): string {
    return this.detail.toString()
  }
}

/**
 * Создает {@link IErrorLike} добавляя прототип {@link ErrorLikeProto} форматирования объекта к строке.
 *
 * @param detail Совместимый {@link IErrorDetail}.
 * @param captureStack Установка `true` вызывает `Error.captureStackTrace()` для объекта.
 */
function createErrorLike<T extends IErrorDetail<any>> (detail: T, captureStack?: undefined | null | boolean): IErrorLike<T['code']> {
  const props: IErrorDetail<any> = (typeof detail === 'object' && detail !== null)
    ? detail
    : {
      code: 0,
      message: 'IErrorLike was not created',
      level: 'error',
      cause: detail
    }
  if (captureStack) {
    captureStackTrace(props)
  }
  return Object.assign(Object.create(ErrorLikeProto), props)
}

function _writeNameAndStackOf<T extends IErrorDetail<any>> (detail: T, error: Error): void {
  if (typeof detail.name !== 'string') {
    detail.name = getStringOf(error, 'name')
  }
  if (typeof detail.stack !== 'string') {
    detail.stack = getStringOf(error, 'stack')
  }
}

/**
 * Имеет ли `maybeLikeError` в своем прототипе {@link ErrorLikeProto}.
 *
 * @param maybeLikeError Предполагаемый объект ошибки.
 */
function isErrorLike (maybeLikeError: any): maybeLikeError is IErrorLike<any> {
  return typeof maybeLikeError === 'object' && maybeLikeError !== null && (Object.getPrototypeOf(maybeLikeError) === ErrorLikeProto)
}

/**
 * Вызывает для любого значения `anyValue` метод `toString()` или, в случае неудачи, возвращает `null`.
 */
function safeAnyToString (anyValue: any): null | string {
  try {
    const str = anyValue.toString()
    if (typeof str === 'string' && str.length > 0) {
      return str
    }
  } catch (_) { /**/ }
  return null
}

/**
 * Извлекает строку из свойства объекта.
 *
 * @param obj Целевой объект.
 * @param property Имя свойства.
 */
function getStringOf (obj: object, property: string): null | string {
  try {
    const value = Reflect.get(obj, property)
    if (typeof value !== 'undefined' && value !== null && value !== '') {
      return safeAnyToString(value)
    }
  } catch (_) { /**/ }
  return null
}

function _errorDetailToList (detail: IErrorDetail<any>, temp: WeakSet<any>): string[] {
  const keys = new Set(Object.keys(detail))
  const fields: string[] = []
  let stack: null | string = null
  let cause: null | string = null

  // Обходим известные свойства
  for (const name of ['name', 'code', 'message', 'level']) {
    if (keys.has(name)) {
      keys.delete(name)
      const value = getStringOf(detail, name)
      if (value) {
        fields.push(`${name}: ${value}`)
      }
    }
  }

  // Эти свойства предпочтительней разместить в конце
  if (keys.has('stack')) {
    keys.delete('stack')
    stack = getStringOf(detail, 'stack')
  }
  if (keys.has('cause')) {
    keys.delete('cause')
    try {
      const raw = Reflect.get(detail, 'cause')
      if (typeof raw === 'object' && raw !== null) {
        if (!temp.has(raw)) {
          temp.add(raw)
          cause = _errorToString(raw, temp)
        }
      }
      else if (raw) {
        cause = safeAnyToString(raw)
      }
    } catch (_) { /**/ }
  }

  // Все остальные свойства.
  for (const name of keys) {
    let value: null | string = null
    try {
      const raw = Reflect.get(detail, name)
      if (typeof raw === 'object' && raw !== null) {
        if (!temp.has(raw)) {
          temp.add(raw)
          value = _errorToString(raw, temp)
        }
      }
      else if (raw) {
        value = safeAnyToString(raw)
      }
    } catch (_) { /**/ }
    if (value) {
      fields.push(`${name}: ${value}`)
    }
  }

  if (stack) {
    fields.push(`stack:\n${stack}`)
  }
  if (cause) {
    fields.push(`cause:\n${cause}`)
  }

  return fields
}

/**
 * Обходит объект и собирает список строк в формате `'propertyName: valueAsString'`.
 *
 * @param detail Обязательно должен быть объектом.
 */
function errorDetailToList (detail: IErrorDetail<any>): string[] {
  return _errorDetailToList(detail, new WeakSet())
}

/**
 * Форматирует {@link IErrorDetail} к строке.
 *
 * @param detail Объект деталей ошибки.
 */
function errorDetailToString (detail: IErrorDetail<any>): string {
  return errorDetailToList(detail).join('\n')
}

function _nativeErrorToString (error: Error, temp: WeakSet<any>): string {
  // Собственная ошибка уже извлекает имя
  const baseMessage = safeAnyToString(error)
  const stack = getStringOf(error, 'stack')
  let cause: null | string = null
  try {
    const raw = Reflect.get(error, 'cause')
    if (typeof raw === 'object' && raw !== null) {
      if (!temp.has(raw)) {
        temp.add(raw)
        // Здесь может быть все что угодно, в том числе и наши ошибки
        cause = _errorToString(raw, temp)
      }
    }
    else if (raw) {
      cause = safeAnyToString(raw)
    }
  } catch (_) { /**/ }
  return `${baseMessage}${stack ? `\nstack:\n${stack}` : ''}${cause ? `\ncause:\n${cause}` : ''}`
}

/**
 * Пытается извлечь строку из стандартной ошибки `JS`.
 *
 * @param error Должен быть типом {@link Error}.
 */
function nativeErrorToString (error: Error): string {
  return _nativeErrorToString(error, new WeakSet())
}

function _errorToString (anyValue: any, temp: WeakSet<any>): null | string {
  // Сюда попадет вызов BaseError.toString()
  if (anyValue instanceof BaseError) {
    return _errorDetailToList(anyValue.detail, temp).join('\n')
  }
  // Любая другая ошибка не связанная с интерфейсами BaseError
  if (anyValue instanceof Error) {
    return _nativeErrorToString(anyValue, temp)
  }
  // Можно предположить что объект будет совместимым типом
  if (typeof anyValue === 'object' && anyValue !== null) {
    return _errorDetailToList(anyValue, temp).join('\n')
  }
  // Неизвестное значение просто пытаемся привести к строке
  if (anyValue) {
    return safeAnyToString(anyValue)
  }
  return null
}

/**
 * Универсальная функция извлечения строки из ошибки.
 *
 * Эта функция всегда возвращает строку, даже если объект или значение оказались пустыми.
 *
 * @param anyValue Предполагаемая ошибка.
 */
function errorToString (anyValue: any): string {
  return _errorToString(anyValue, new WeakSet()) ?? ''
}

/**
 * В среде vitest + playwright не работает Error.captureStackTrace(...)
 * Добавляем в vitest.config.ts -> env: { FIX_CAPTURE_STACK_TRACE: true } для эмуляции захвата стека через стандартные механизмы ошибки.
 */
void function () {
  try {
    const isTest = Reflect.get(globalThis, 'FIX_CAPTURE_STACK_TRACE')
    if (typeof isTest === 'boolean' && isTest) {
      (createErrorLike as any) = <T extends IErrorDetail<any>> (detail: T, captureStack?: null | undefined | boolean): IErrorLike<T['code']> => {
        const props: IErrorDetail<any> = (typeof detail === 'object' && detail !== null)
          ? detail
          : {
            code: 0,
            message: 'IErrorLike was not created',
            level: 'error',
            cause: detail
          }
        if (captureStack) {
          props.stack = (new Error()).stack ?? null
        }
        return Object.assign(Object.create(ErrorLikeProto), props)
      }
    }
  } catch (_) { /**/ }
}()

export {
  type TErrorLevel,
  type IErrorDetail,
  type IErrorLike,
  ErrorLikeProto,
  BaseError,
  captureStackTrace,
  createErrorLike,
  isErrorLike,
  safeAnyToString,
  getStringOf,
  errorDetailToList,
  errorDetailToString,
  nativeErrorToString,
  errorToString
}
