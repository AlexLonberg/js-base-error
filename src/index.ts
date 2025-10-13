/**
 * Статический метод [Error.captureStackTrace(...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace)
 *
 * Безопасная альтернатива явного вызова `Error.captureStackTrace()`. В окружениях, где он
 * отсутствует(если такое вообще возможно), функция становится no-op.
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
        Object.defineProperty(target, 'stack', {
          configurable: true,
          writable: true,
          enumerable: true,
          value: Reflect.get(temp, 'stack')
        })
      }
    }
  } catch (_) { /**/ }
  return ((..._: any) => { /**/ })
})()

/**
 * Уровень ошибок.
 */
type TErrorLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal'

/**
 * Базовый интерфейс деталей ошибки с минимальным набором распространенных свойств.
 */
interface IErrorDetail {
  /**
   * Необязательное поле кода ошибки.
   */
  code?: undefined | null | number | string
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
   * Может быть установлен явно, или взято из {@link Error} если поле извлекается из ошибки.
   */
  stack?: undefined | null | string
  /**
   * Необязательное поле причины.
   */
  cause?: undefined | null | unknown
}

/**
 * Предоставляет методы приведения объекта к строке или `JsonLike` объекту.
 */
interface ISerializable {
  toString (): string
  toJSON (): Record<string, any>
}

/**
 * Расширяет {@link IErrorDetail} методами форматирования `toString()` и `toJSON()`.
 */
interface IErrorLike extends IErrorDetail, ISerializable { }

/**
 * Массив ошибок с методом автоматического преобразования `toString()` всех вложенных {@link IErrorLike} к строке или
 * `toJSON()` к объекту `{errors: Record<string, any>[]}`.
 */
interface IErrorLikeCollection<T extends IErrorLike = IErrorLike> extends Array<T>, ISerializable { }

/**
 * Прототип для реализации интерфейса {@link IErrorLike}.
 */
const ErrorLikeProto = Object.freeze({
  toString (): string {
    return errorDetailToString(this as IErrorLike)
  },
  toJSON (): Record<string, any> {
    return errorDetailToJsonLike(this as IErrorLike)
  }
} as const)

/**
 * Базовый класс ошибок.
 *
 * Обеспечивает прямой доступ к {@link IErrorLike} и форматированию к строке.
 *
 * **Note:** Собственные перечислимые свойства наследников автоматически копируются в объект деталей ошибок, при
 * условии, что последние явно не определены на объекте {@link IErrorDetail}.
 *
 * @template T Подробный тип ошибки `BaseError.detail`.
 * @template P Тип параметра конструктора `new BaseError(IErrorDetail)`. Может быть сокращенным типом ошибки, когда
 * константные свойства определяются на классах и не нуждаются в передачи конструкторам.
 *
 * @example
 * ```ts
 * class CustomError extends BaseError {
 *   code: 123
 * }
 * const error = new CustomError({})
 * // error.detail.code === 123
 * ```
 */
abstract class BaseError<T extends IErrorLike | IErrorDetail = IErrorDetail, P extends IErrorLike | IErrorDetail = T> extends Error {
  /**
   * Ссылка на оригинальный объект с деталями ошибки.
   *
   * Свойство {@link detail}, при инициализации класса, определено как `getter`. При первом доступе оригинальный
   * объект получает все перечислимые свойства класса ошибки и его прототипов, используя
   * {@link captureErrorProperties()}, после чего `detail` изменяет дескриптор на `value:_detail`.
   *
   * При острой необходимости, дескрипторы доступа(к обоим свойствам) можно изменить - важно чтобы {@link detail}
   * возвращал корректный объект {@link IErrorLike}.
   *
   * **Warning:** После вызова {@link detail}, перезаписать детали ошибки, путем изменения значений на классе,
   * невозможно. Для перезаписи одного из свойств {@link detail}, используйте прямой доступ. Getter помогает определить
   * константные свойства ошибок на классах наследниках, не прибегая к передаче этих свойств в объект {@link detail}.
   */
  declare protected readonly _detail: T
  /**
   * Детали ошибки {@link IErrorLike}.
   */
  declare readonly detail: T extends IErrorLike ? T : (T & { toString (): string, toJSON (): Record<string, any> })

  constructor(detail: P | Omit<P, 'toString' | 'toJSON'>) {
    super(detail.message ?? undefined)
    // Сохраняем оригинал и обеспечиваем ленивое копирование свойств через расширенный ниже прототип
    Object.defineProperty(this, '_detail', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: isErrorLike(detail) ? detail : createErrorLike(detail, false)
    })
  }

  override toString (): string {
    return this.detail.toString()
  }

  toJSON (): Record<string, any> {
    return this.detail.toJSON()
  }
}
// Чтобы не создавать несколько базовых классов - дополним прототип здесь, избегая инициализации свойств в конструкторе.
// Почему здесь: По причине невозможности определить get/set name(), на который будет ругаться TS после попытки
// установить свойство 'name' классам. Вот пример ошибки:
// class FooError extends BaseError {
//  name = 'FooError'
//  -> 'name' is defined as an accessor in class 'BaseError<IErrorLike, IErrorLike>', but is overridden here in 'FooError' as an instance property.
Object.defineProperties(BaseError.prototype, {
  detail: {
    configurable: true,
    enumerable: true,
    get () {
      // Одноразовая ленивая инициализация.
      captureErrorProperties(this, this._detail)
      Object.defineProperty(this, 'detail', {
        configurable: true,
        enumerable: true,
        writable: false,
        value: this._detail
      })
      return this._detail
    }
  },
  // Если пользователь переопределит свойство класса, имя ошибки будет получено при первом обращении к detail
  name: {
    configurable: true,
    enumerable: true, // По умолчанию у стандартных ошибок здесь false
    // !!! writable: true, По умолчанию, но нам нужны get/set
    get () {
      return (typeof this._detail.name === 'string') ? this._detail.name : this.constructor.name
    },
    set (_: string) {
      // Игнорируем установку имени - переопределение должно производиться через this.detail
    }
  }
})

/**
 * Массив ошибок реализующий {@link IErrorLikeCollection}.
 *
 * **Warning:** Не устанавливайте элементы присвоением индексов - это невозможно проверить.
 * Методы `push()/unshift()/splice()` предварительно проверяют тип и принудительно приводят элемент к {@link IErrorLike}.
 * Другие методы не реализованы и могут возвратить не то что ожидается.
 *
 * Коллекция не служит контейнером для хранения ошибок, а используется как конвертер к `string` или `JsonLike`.
 * Из инстансов {@link BaseError}, добавляемых к коллекции, будут извлечены структуры {@link IErrorLike}.
 *
 * Применяйте массив для агрегирования нескольких ошибок в одно поле {@link IErrorDetail}:
 *
 * ```ts
 * const detail: IErrorDetail = {
 *   // будет правильно преобразовано к строке или JsonLike с несколькими ошибками
 *   warnings: new ErrorLikeCollection('warnings', [{code: 1, level: 'warning'}])
 * }
 * ```
 */
class ErrorLikeCollection<T extends IErrorLike = IErrorLike> extends Array<T> implements IErrorLikeCollection<T> {
  protected _prefix: string

  /**
   * @param prefix Имя поля для форматирования к строке {@link toString()}. По молчанию `errors`.
   *               Поля именуются как `errors.0: ... , errors.1: ... ` и т.д.
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
 * Обеспечивает запись всех собственных перечислимых свойств ошибки `error` и его прототипов на объект `detail`, только
 * в том случае, если свойство еще не установлено в `detail`.
 *
 * **Note:** Эта функция применяется в геттере {@link BaseError.detail}, для отложенного получения пользовательских
 * свойств, определенных на расширяемых классах ошибок.
 *
 * Список свойств которые явно пропускаются:
 *  + `_detail` - Зарезервировано на классе для оригинальной ссылки на объект деталей ошибки.
 *  + `detail`  - Детали ошибки класса(временный геттер). Это второй параметр этой функции.
 *  + `toString() | toJSON()` - Методы конвертации.
 *
 * Свойства, для которых допустимы только строки: `name`, `message`, `stack`, `level`.
 *
 * Все другие свойства игнорируются, если они `undefined|null`.
 *
 * @param error  Ошибка {@link BaseError}, свойства которой будет записаны на `detail`.
 * @param detail Объект для записи.
 */
function captureErrorProperties (error: BaseError, detail: IErrorDetail | IErrorLike): void {
  // Исключаем стандартные свойства
  const existsKeys = new Set<string>([...Object.keys(detail), '_detail', 'detail', 'toString', 'toJSON'])

  // Обеспечиваем запись стека из любого прототипа
  if (!existsKeys.has('stack')) {
    const stack = safeGetStringOf(error, 'stack')
    if (stack) {
      existsKeys.add('stack')
      detail.stack = stack
    }
  }

  const copy = (obj: object, key: string) => {
    type _T = { [_ in typeof key]: any }
    try {
      const value = (obj as _T)[key]
      const type = typeof value
      if (
        type === 'undefined' || value === null ||
        ((key === 'name' || key === 'message' || key === 'stack' || key === 'level') && type !== 'string')
      ) {
        return
      }
      (detail as _T)[key] = value
      existsKeys.add(key)
    } catch (_) { /**/ }
  }

  // Проходим по всем прототипам, не включая базовую ошибку(на которой нет свойств). Читаем только перечислимые свойства.
  let cur: object | null = error
  while (cur && cur !== BaseError.prototype) {
    const keys = Object.keys(cur)
    for (const key of keys) {
      if (!existsKeys.has(key)) {
        copy(cur, key)
      }
    }
    cur = Object.getPrototypeOf(cur)
  }

  // Обеспечиваем запись обязательного имени
  if (!existsKeys.has('name')) {
    // Попытка получить имя из свойств была уже выше. теперь получаем только из имени конструктора или установим по
    // умолчанию. Получать напрямую из error.name нет никакого смысла, она всегда равна 'Error'.
    detail.name = safeGetStringOf(error.constructor, 'name') ?? 'Error'
  }
}

function _reserveErrorLike<T extends IErrorLike = IErrorLike> (props: object): T {
  const keys = Object.keys(props)
  const target = Object.create(ErrorLikeProto)
  for (const key of keys) {
    try {
      target[key] = (props as any)[key]
    } catch (_) { /**/ }
  }
  return target
}

/**
 * Создает {@link IErrorLike} добавляя прототип {@link ErrorLikeProto} форматирования объекта к строке.
 *
 * @param detail Совместимый {@link IErrorDetail}.
 * @param captureStack Установка `true` вызывает `Error.captureStackTrace(detail)`.
 * @param construct Имя функции, котору надо исключить из стека. Смотри справку [Error.captureStackTrace(...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace)
 */
function createErrorLike<T extends IErrorLike = IErrorLike> (detail: Omit<T, 'toString' | 'toJSON'>, captureStack?: undefined | null | boolean, construct?: undefined | null | Function): T {
  const props: IErrorDetail = (typeof detail === 'object' && detail !== null)
    ? detail
    : {
      message: 'IErrorLike was not created',
      level: 'error',
      cause: detail
    }
  if (captureStack) {
    captureStackTrace(props, construct)
  }
  try {
    // геттеры с ошибками могу поднять исключение
    return Object.assign(Object.create(ErrorLikeProto), props)
  } catch (_) {
    return _reserveErrorLike(props)
  }
}

/**
 * Проверяет тип `maybeError` и возвращает {@link IErrorLike}. Если аргумент `maybeError` ошибка {@link BaseError}
 * извлекается свойство `detail`, иначе явно вызывается {@link createErrorLike}.
 *
 * **Warning:** Нативная или неизвестная ошибка {@link Error} интерпретируется как обычный объект и передается в {@link createErrorLike()}.
 *
 * Параметр типа `T` может использоваться для удобства типизации.
 *
 * @param maybeError Предполагаемый тип совместимый с {@link IErrorLike}.
 */
function ensureErrorLike<T extends IErrorLike = IErrorLike> (maybeError: any): T {
  if (isErrorLike(maybeError)) {
    return maybeError as T
  }
  if (maybeError instanceof BaseError) {
    return maybeError.detail
  }
  return createErrorLike(maybeError)
}

/**
 * Имеет ли `maybeLikeError` в своем прототипе {@link ErrorLikeProto}.
 *
 * **Warning:** Предполагается что объекты {@link IErrorLike} созданы через {@link createErrorLike()}. Прототип
 * проверяется только на верхнем уровне.
 *
 * @param maybeLikeError Предполагаемый объект ошибки.
 */
function isErrorLike (maybeLikeError: any): maybeLikeError is IErrorLike {
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
      const str = value.toString()
      if (typeof str === 'string' && str.length > 0) {
        return str
      }
    }
  } catch (_) { /**/ }
  return null
}

function _extractStringOf (detail: IErrorDetail, prop: string, seen: WeakSet<any>): null | string {
  let raw: any
  try {
    raw = Reflect.get(detail, prop)
  } catch (_) { /* */ }
  let result: null | string = null
  const vt = typeof raw
  if (vt !== 'undefined' && raw !== null) {
    if (vt === 'object') {
      if (!seen.has(raw)) {
        seen.add(raw)
        result = _errorToString(raw, seen)
      }
    }
    else {
      result = safeAnyToString(raw)
    }
  }
  return result
}

function _errorDetailToList (detail: IErrorDetail, seen: WeakSet<any>): string[] {
  const keys = new Set(Object.keys(detail))

  const fields: string[] = []
  let stack: null | string = null
  let cause: null | string = null

  // Обходим известные свойства
  if (keys.has('code')) {
    keys.delete('code')
    try {
      const code = Reflect.get(detail, 'code')
      // Код может быть строкой или целым числом
      if ((typeof code === 'string' && code.length > 0) || Number.isSafeInteger(code)) {
        fields.push(`code: ${code}`)
      }
    } catch (_) { /**/ }
  }
  for (const name of ['name', 'message', 'level']) {
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
    cause = _extractStringOf(detail, 'cause', seen)
  }

  // Все остальные свойства приводятся к строке.
  for (const name of keys) {
    const value = _extractStringOf(detail, name, seen)
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
function errorDetailToList (detail: IErrorDetail): string[] {
  return _errorDetailToList(detail, new WeakSet([detail]))
}

/**
 * Форматирует {@link IErrorDetail} к строке.
 *
 * @param detail Объект деталей ошибки.
 */
function errorDetailToString (detail: IErrorDetail): string {
  return _errorDetailToList(detail, new WeakSet([detail])).join('\n')
}

function _nativeErrorToString (error: Error, seen: WeakSet<any>): string {
  // Собственная ошибка уже извлекает имя
  // const baseMessage = safeAnyToString(error)
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
  const cause = _extractStringOf(error, 'cause', seen)
  if (prop) {
    return `${prop}:\n${stackOrMsg}${cause ? `\ncause:\n${cause}` : ''}`
  }
  stackOrMsg = safeAnyToString(error)
  return `${stackOrMsg ?? ''}${cause ? `\ncause:\n${cause}` : ''}`
}

/**
 * Пытается извлечь строку из стандартной ошибки `JS`.
 *
 * @param error Должен быть типом {@link Error}.
 */
function nativeErrorToString (error: Error): string {
  return _nativeErrorToString(error, new WeakSet([error]))
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
  const set = (typeof anyValue === 'object' && anyValue !== null) ? new WeakSet([anyValue]) : new WeakSet()
  return _errorToString(anyValue, set) ?? ''
}

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
function _errorDetailToJsonLike (target: Record<string, any>, detail: IErrorDetail, seen: WeakSet<any>): [0, null] | [1, null] | [2, unknown] {
  let ok = false
  const keys = new Set(Object.keys(detail))

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
function errorDetailToJsonLike (detail: IErrorDetail): Record<string, any> {
  const target = {} as Record<string, any>
  const result = _errorDetailToJsonLike(target, detail, new WeakSet([detail]))
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
  const result = _nativeErrorToJsonLike(target, error, new WeakSet([error]))
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
  const set = (typeof anyValue === 'object' && anyValue !== null) ? new WeakSet([anyValue]) : new WeakSet()
  const result = _errorToJsonLike(target, anyValue, set)
  if (result[0] === 2) {
    target.__value = result[1]
  }
  return target
}

export {
  type TErrorLevel,
  type IErrorDetail,
  type ISerializable,
  type IErrorLike,
  type IErrorLikeCollection,
  ErrorLikeProto,
  BaseError,
  ErrorLikeCollection,
  captureErrorProperties,
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
