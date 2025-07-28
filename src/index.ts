/**
 * Статический метод [Error.captureStackTrace(...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace)
 *
 * Безопасная альтернатива явного вызова `Error.captureStackTrace()`. В окружениях, где он отсутствует, функция становится no-op.
 */
const captureStackTrace = ((): ((target: object, construct?: undefined | null | Function) => void) => {
  try {
    const fun = Reflect.get(Error, 'captureStackTrace')
    if (typeof fun === 'function') {
      const cstBind = fun.bind(Error)
      return function cst (target: object, construct?: undefined | null | Function) {
        if (typeof construct !== 'function') {
          construct = cst
        }
        const temp = {}
        cstBind(temp, construct)
        Reflect.set(target, 'stack', Reflect.get(temp, 'stack'))
      }
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
interface IErrorDetail<TCode extends number | string = number | string> {
  /**
   * Необязательное поле кода ошибки.
   */
  code?: undefined | null | TCode
  /**
   * Необязательное поле имя ошибки. Может быть установлено явно или будет извлечено из {@link Error}.
   */
  name?: undefined | null | string
  /**
   * Необязательное поле описания ошибки.
   */
  message?: undefined | null | string
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
 * Расширяет {@link IErrorDetail} методом форматирования `toString()` и `toJSON()`.
 */
interface IErrorLike<TCode extends number | string = number | string> extends IErrorDetail<TCode> {
  toString (): string
  toJSON (): Record<string, any>
}

/**
 * Массив ошибок с методом автоматического преобразования `toString()` всех вложенных {@link IErrorLike} к строке или
 * `toJSON()` к объекту `{errors: Record<string, any>[]}`.
 */
interface IErrorLikeCollection<T extends IErrorLike<any> = IErrorLike<any>> extends Array<T> {
  toString (): string
  toJSON (): Record<string, any>
}

/**
 * Прототип для реализации интерфейса {@link IErrorLike}.
 */
const ErrorLikeProto = Object.freeze({
  toString (): string {
    return errorDetailToString(this as IErrorDetail<any>)
  },
  toJSON (): Record<string, any> {
    return errorDetailToJsonLike(this as IErrorDetail<any>)
  }
} as const)

/**
 * Базовый класс ошибок.
 *
 * Обеспечивает прямой доступ к {@link IErrorDetail} и форматированию к строке.
 */
abstract class BaseError<T extends IErrorLike<any> = IErrorLike<any>> extends Error {
  readonly detail: T

  constructor(detail: T | Omit<T, 'toString' | 'toJSON'>) {
    super(detail.message ?? undefined)
    this.detail = isErrorLike(detail) ? detail : createErrorLike(detail, false)
    _writeNameAndStackOf(this.detail, this)
  }

  override get name (): string {
    return this.detail.name ?? super.name
  }

  get level (): TErrorLevel {
    return this.detail.level ?? 'error'
  }

  override toString (): string {
    return this.detail.toString()
  }

  toJSON (): Record<string, any> {
    return this.detail.toJSON()
  }
}

/**
 * Массив ошибок реализующий {@link IErrorLikeCollection}.
 *
 * **Warning**: Не устанавливайте элементы присвоением индексов, это невозможно проверить.
 * Методы `push()/unshift()/splice()` предварительно проверяют тип и принудительно приводят элемент к {@link IErrorLike}.
 * Другие методы не реализованы и могут возвратить не то что ожидается.
 *
 * Применяйте массив для агрегирования нескольких ошибок в одно поле {@link IErrorDetail}:
 *
 * ```ts
 * const detail = {
 *   // будет правильно преобразовано к строке с несколькими ошибками
 *   warnings: new ErrorLikeCollection('warnings', [{code: 1, level: 'warning'}])
 * }
 * ```
 */
class ErrorLikeCollection<T extends IErrorLike<any> = IErrorLike<any>> extends Array<T> implements IErrorLikeCollection<T> {
  protected _prefix: string

  /**
   * @param prefix Имя поля для форматирования к строке {@link toString()}. По молчанию `errors`.
   *               Поля будут именоваться как `errors.0: ... , errors.1: ... ` и т.д.
   *               Для метода {@link toJSON()} создается объект с одним полем `{[prefix]: Record<string, any>}`.
   * @param iterable Массивоподобный объект с ошибками.
   */
  constructor(prefix?: undefined | null | string, iterable?: undefined | null | Iterable<any> | ArrayLike<any>) {
    super()
    this._prefix = (typeof prefix === 'string') ? prefix : 'errors'
    if (iterable) {
      const items = Array.from(iterable)
      this.push(...items)
    }
  }

  get prefix (): string {
    return this._prefix
  }

  set prefix (v: string) {
    this._prefix = (typeof v === 'string') ? v : 'errors'
  }

  override push (...items: T[]): number {
    for (const item of items) {
      super.push(ensureErrorLike(item))
    }
    return this.length
  }

  override unshift (...items: T[]): number {
    for (const item of items) {
      super.unshift(ensureErrorLike(item))
    }
    return this.length
  }

  override splice (start: number, deleteCount?: number): ErrorLikeCollection<T>
  override splice (start: number, deleteCount: number, ...items: T[]): ErrorLikeCollection<T> {
    const rest = items?.map((item) => ensureErrorLike<T>(item)) ?? ([] as T[])
    return new ErrorLikeCollection<T>(this._prefix, super.splice(start, deleteCount, ...rest))
  }

  override toString (): string {
    const strings: string[] = []
    for (let i = 0; i < this.length; ++i) {
      strings.push(`${this._prefix}.${i}:`, this[i]!.toString())
    }
    return strings.join('\n')
  }

  toJSON (): Record<string, any> {
    const array: Record<string, any>[] = []
    for (let i = 0; i < this.length; ++i) {
      array.push(this[i]!.toJSON())
    }
    return { [this._prefix]: array }
  }
}

/**
 * Создает {@link IErrorLike} добавляя прототип {@link ErrorLikeProto} форматирования объекта к строке.
 *
 * @param detail Совместимый {@link IErrorDetail}.
 * @param captureStack Установка `true` вызывает `Error.captureStackTrace(detail)`.
 * @param construct Имя функции, котору надо исключить из стека. Смотри справку [Error.captureStackTrace(...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace)
 */
function createErrorLike<T extends IErrorLike<any> = IErrorLike<any>> (detail: Omit<T, 'toString' | 'toJSON'>, captureStack?: undefined | null | boolean, construct?: undefined | null | Function): T {
  const props: IErrorDetail<any> = (typeof detail === 'object' && detail !== null)
    ? detail
    : {
      message: 'IErrorLike was not created',
      level: 'error',
      cause: detail
    }
  if (captureStack) {
    captureStackTrace(props, construct)
  }
  return Object.assign(Object.create(ErrorLikeProto), props)
}

/**
 * Проверяет тип `maybeError` и возвращает {@link IErrorLike}. Если аргумент `maybeError` ошибка {@link BaseError}
 * извлекается свойство `detail`, иначе явно вызывается {@link createErrorLike}.
 *
 * Параметр типа `T` может использоваться для удобства типизации.
 *
 * @param maybeError Предполагаемый тип совместимый с {@link IErrorLike}.
 */
function ensureErrorLike<T extends IErrorLike<any> = IErrorLike<any>> (maybeError: any): T {
  if (isErrorLike(maybeError)) {
    return maybeError as T
  }
  if (maybeError instanceof BaseError) {
    return maybeError.detail
  }
  return createErrorLike(maybeError)
}

function _writeNameAndStackOf<T extends IErrorDetail<any>> (detail: T, error: Error): void {
  if (typeof detail.name !== 'string') {
    detail.name = error.constructor.name
  }
  if (typeof detail.stack !== 'string') {
    detail.stack = safeGetStringOf(error, 'stack')
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
function safeGetStringOf (obj: object, property: string): null | string {
  try {
    const value = Reflect.get(obj, property)
    if (typeof value !== 'undefined' && value !== null && value !== '') {
      return safeAnyToString(value)
    }
  } catch (_) { /**/ }
  return null
}

function _errorDetailToList (detail: IErrorDetail<any>, seen: WeakSet<any>): string[] {
  const keys = new Set(Object.keys(detail))
  if (!keys.has('stack') && ('stack' in detail)) {
    keys.add('stack')
  }
  const fields: string[] = []
  let stack: null | string = null
  let cause: null | string = null

  // Обходим известные свойства
  for (const name of ['name', 'code', 'message', 'level']) {
    if (keys.has(name)) {
      keys.delete(name)
      const value = safeGetStringOf(detail, name)
      if (value) {
        fields.push(`${name}: ${value}`)
      }
    }
  }

  // Эти свойства предпочтительней разместить в конце
  if (keys.has('stack')) {
    keys.delete('stack')
    stack = safeGetStringOf(detail, 'stack')
  }
  if (keys.has('cause')) {
    keys.delete('cause')
    try {
      const raw = Reflect.get(detail, 'cause')
      if (typeof raw === 'object' && raw !== null) {
        if (!seen.has(raw)) {
          seen.add(raw)
          cause = _errorToString(raw, seen)
        }
      }
      else if (typeof raw !== 'undefined' && raw !== null) {
        cause = safeAnyToString(raw)
      }
    } catch (_) { /**/ }
  }

  // Все остальные свойства приводятся к строке.
  for (const name of keys) {
    let value: null | string = null
    try {
      const raw = Reflect.get(detail, name)
      if (typeof raw === 'object' && raw !== null) {
        seen.add(raw)
      }
      if (typeof raw !== 'undefined' && raw !== null) {
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
  return _errorDetailToList(detail, new WeakSet()).join('\n')
}

function _nativeErrorToString (error: Error, seen: WeakSet<any>): string {
  // Собственная ошибка уже извлекает имя
  const baseMessage = safeAnyToString(error)
  // Имя ошибки и сообщение уже есть в стеке - сохраняем что-то одно
  let stackOrMsg = safeGetStringOf(error, 'stack')
  let prop: null | 'stack' | 'message' | 'name' = null
  if (stackOrMsg) {
    prop = 'stack'
  }
  else {
    // В сообщении не будет имени
    const name = safeGetStringOf(error, 'name')
    const message = safeGetStringOf(error, 'message')
    if (name && message) {
      stackOrMsg = `${name}: ${message}`
      prop = 'message'
    }
    else if (message) {
      stackOrMsg = message
      prop = 'message'
    }
    else if (name) {
      stackOrMsg = name
      prop = 'name'
    }
  }
  let cause: null | string = null
  try {
    const raw = Reflect.get(error, 'cause')
    if (typeof raw === 'object' && raw !== null) {
      if (!seen.has(raw)) {
        seen.add(raw)
        // Здесь может быть все что угодно, в том числе и наши ошибки
        cause = _errorToString(raw, seen)
      }
    }
    else if (typeof raw !== 'undefined' && raw !== null) {
      cause = safeAnyToString(raw)
    }
  } catch (_) { /**/ }
  return `${baseMessage}${prop ? `\n${prop}:\n${stackOrMsg}` : ''}${cause ? `\ncause:\n${cause}` : ''}`
}

/**
 * Пытается извлечь строку из стандартной ошибки `JS`.
 *
 * @param error Должен быть типом {@link Error}.
 */
function nativeErrorToString (error: Error): string {
  return _nativeErrorToString(error, new WeakSet())
}

function _errorToString (anyValue: any, seen: WeakSet<any>): null | string {
  // Сюда попадет вызов BaseError.toString()
  if (anyValue instanceof BaseError) {
    return _errorDetailToList(anyValue.detail, seen).join('\n')
  }
  if (anyValue instanceof ErrorLikeCollection) {
    return anyValue.toString()
  }
  // Любая другая ошибка не связанная с интерфейсами BaseError
  if (anyValue instanceof Error) {
    return _nativeErrorToString(anyValue, seen)
  }
  // Можно предположить что объект будет совместимым типом
  if (typeof anyValue === 'object' && anyValue !== null) {
    return _errorDetailToList(anyValue, seen).join('\n')
  }
  // Неизвестное значение просто пытаемся привести к строке
  if (typeof anyValue !== 'undefined' && anyValue !== null) {
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

//////////////////////////////////////////////////////////////

/**
 * Пытается преобразовать значение методом `toJSON()`. Возвращает любое значение исключая `undefined` и пустую строку.
 * Вызывающие функции могут удостовериться в наличие значение простой проверкой `value !== null`.
 */
function _safeAnyToJson (anyValue: any): null | unknown {
  if (typeof anyValue === 'object' && anyValue !== null) {
    try {
      if ('toJSON' in anyValue) {
        const value = anyValue.toJSON()
        // Игнорируем пустые строки
        if (typeof value !== 'undefined' && value !== '') {
          return value
        }
      }
    } catch (_) { /**/ }
  }
  return null
}

/**
 * Возвращает примитивное значение или пытается привести любой тип к строке.
 * Эта функция должна вызываться только для Не_Объектов - примитивов.
 */
function _safeAnyToPrimitive (anyValue: any): null | boolean | number | string {
  if ((typeof anyValue === 'boolean') || Number.isFinite(anyValue) || (typeof anyValue === 'string' && anyValue.length > 0)) {
    return anyValue
  }
  return safeAnyToString(anyValue)
}

/**
 * Записывает значение на объект и возвращает результат записи хотя бы одного поля.
 */
function _copyObjectToTarget (target: Record<string, any>, source: object): boolean {
  let ok = false
  try {
    for (const [key, value] of Object.entries(source)) {
      target[key] = value
      ok = true
    }
  } catch (_) { /**/ }
  return ok
}

/**
 * Пытается извлечь свойство и преобразовать к `JsonLike`. Возвратит `true` если поле было записано.
 */
function _tryExtractProperty (target: Record<string, any>, source: object, name: string, seen: WeakSet<any>): boolean {
  let ok = false
  try {
    const raw = Reflect.get(source, name)
    if (typeof raw !== 'undefined' && raw !== null) {
      const isObj = typeof raw === 'object'
      // Пропускаем рекурсивные записи
      if (!isObj || !seen.has(raw)) {
        if (isObj) {
          seen.add(raw)
        }
        const temp = {}
        const result = _errorToJsonLike(temp, raw, seen)
        if (result[0] === 1) {
          target[name] = temp
          ok = true
        }
        else if (result[0] === 2) {
          target[name] = result[1]
          ok = true
        }
      }
    }
  } catch (_) { /**/ }
  return ok
}

/**
 * Записывает поля ошибки в объект и возвращает результат записи:
 *
 *  + `[0, null]`    - Ничего не записано и значение не было извлечено.
 *  + `[1, null]`    - На `target` записано хотя бы одно поле.
 *  + `[2, unknown]` - Не удалось распознать объект, но во втором элементе одно из примитивных ненулевых значений.
 *
 * **Note** Результат описанный здесь используется во всех функциях ниже. Конкретно для этой функции вариант 3 игнорируется.
 */
function _errorDetailToJsonLike (target: Record<string, any>, detail: IErrorDetail<any>, seen: WeakSet<any>): [0, null] | [1, null] | [2, unknown] {
  let ok = false

  const keys = new Set(Object.keys(detail))
  if (!keys.has('stack') && ('stack' in detail)) {
    keys.add('stack')
  }

  // Обходим известные свойства
  if (keys.has('code')) {
    keys.delete('code')
    try {
      const code = Reflect.get(detail, 'code')
      // Код может быть строкой или целым числом
      if ((typeof code === 'string' && code.length > 0) || Number.isSafeInteger(code)) {
        target.code = code
        ok = true
      }
    } catch (_) { /**/ }
  }
  for (const name of ['name', 'message', 'level']) {
    if (keys.has(name)) {
      keys.delete(name)
      // только строки
      const value = safeGetStringOf(detail, name)
      if (value) {
        target[name] = value
        ok = true
      }
    }
  }

  // Эти свойства предпочтительней разместить в конце
  const hasStack = keys.delete('stack')
  const hasCause = keys.delete('cause')

  // Все остальные неизвестные поля.
  for (const name of keys) {
    if (_tryExtractProperty(target, detail, name, seen)) {
      ok = true
    }
  }

  if (hasStack) {
    const stack = safeGetStringOf(detail, 'stack')
    if (stack) {
      target.stack = stack
      ok = true
    }
  }
  if (hasCause && _tryExtractProperty(target, detail, 'cause', seen)) {
    ok = true
  }

  return [ok ? 1 : 0, null]
}

/**
 * Приводит {@link IErrorDetail} к `JsonLike` объекту.
 *
 * @param detail Объект деталей ошибки.
 */
function errorDetailToJsonLike (detail: IErrorDetail<any>): Record<string, any> {
  const target = {} as Record<string, any>
  const result = _errorDetailToJsonLike(target, detail, new WeakSet())
  if (result[0] === 2) {
    target.__value = result[1]
  }
  return target
}

/**
 * Записывает поля ошибки в объект и возвращает результат записи.
 */
function _nativeErrorToJsonLike (target: Record<string, any>, error: Error, seen: WeakSet<any>): [0, null] | [1, null] | [2, unknown] {
  let ok = false
  // Прежде всего пытаемся привести ошибку методом toJSON().
  let value = _safeAnyToJson(error)
  // Если это был объект, то будем считать что поля определены пользовательской ошибкой и не могут быть изменены.
  if (value !== null && typeof value === 'object' && _copyObjectToTarget(target, value)) {
    return [1, null]
  }
  const name = safeGetStringOf(error, 'name')
  if (name) {
    target.name = name
    ok = true
  }
  const message = safeGetStringOf(error, 'message')
  if (message) {
    target.message = message
    ok = true
  }
  const stack = safeGetStringOf(error, 'stack')
  if (stack) {
    target.stack = stack
    ok = true
  }
  if (_tryExtractProperty(target, error, 'cause', seen)) {
    ok = true
  }
  // Если нет ни одной записи в объект, смотрим было ли у нас примитивное значение
  if (!ok) {
    // Если нет и value - пытаемся получить любое значение
    if (value !== null || ((value = _safeAnyToPrimitive(error)) !== null)) {
      return [2, value]
    }
  }
  return [ok ? 1 : 0, null]
}

/**
 * Извлекает `name`, `message`, `stack` и `cause` из стандартной ошибки. Если ошибка имеет метод `toJSON()`, который возвращает
 * объект, функция возвратит результат `toJSON()` без чтения свойств.
 *
 * @param error Должен быть типом {@link Error}.
 */
function nativeErrorToJsonLike (error: Error): Record<string, any> {
  const target = {} as Record<string, any>
  const result = _nativeErrorToJsonLike(target, error, new WeakSet())
  if (result[0] === 2) {
    target.__value = result[1]
  }
  return target
}

/**
 * Записывает поля ошибки в объект и возвращает результат записи.
 */
function _errorToJsonLike (target: Record<string, any>, anyValue: any, seen: WeakSet<any>): [0, null] | [1, null] | [2, unknown] {
  // Сюда попадет вызов BaseError.toJSON()
  if (anyValue instanceof BaseError) {
    return _errorDetailToJsonLike(target, anyValue.detail, seen)
  }
  if (anyValue instanceof ErrorLikeCollection) {
    const obj = anyValue.toJSON()
    let ok = false
    for (const [key, value] of Object.entries(obj)) {
      target[key] = value
      ok = true
    }
    return [ok ? 1 : 0, null]
  }
  // Любая другая ошибка не связанная с интерфейсами BaseError
  if (anyValue instanceof Error) {
    return _nativeErrorToJsonLike(target, anyValue, seen)
  }
  // Можно предположить что объект будет IErrorLike или совместимым типом
  if (typeof anyValue === 'object' && anyValue !== null) {
    return _errorDetailToJsonLike(target, anyValue, seen)
  }
  // Неизвестное значение - пытаемся привести к любому типу
  if (typeof anyValue !== 'undefined' && anyValue !== null) {
    const value = _safeAnyToJson(anyValue) ?? _safeAnyToPrimitive(anyValue)
    if (value !== null) {
      if (typeof value === 'object') {
        return [_copyObjectToTarget(target, value) ? 1 : 0, null]
      }
      return [2, value]
    }
  }
  return [0, null]
}

/**
 * Универсальная функция извлечения `JsonLike` объекта из ошибки.
 *
 * Эта функция всегда возвращает `Record<string, any>`, даже если объект или значение оказались пустыми. Если значение
 * ненулевое и не может быть приведено к объекту, объект установит единственное свойство `{__value: ...}`.
 *
 * @param anyValue Предполагаемая ошибка.
 */
function errorToJsonLike (anyValue: any): Record<string, any> {
  const target = {} as Record<string, any>
  const result = _errorToJsonLike(target, anyValue, new WeakSet())
  if (result[0] === 2) {
    target.__value = result[1]
  }
  return target
}

export {
  type TErrorLevel,
  type IErrorDetail,
  type IErrorLike,
  type IErrorLikeCollection,
  ErrorLikeProto,
  BaseError,
  ErrorLikeCollection,
  captureStackTrace,
  createErrorLike,
  ensureErrorLike,
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
}
