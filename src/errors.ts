import type {
  TNullish,
  IErrorDetail,
  ISerializable,
  IErrorSerializable,
  IErrorLike,
  IErrorCollection
} from './types.ts'
import { ERROR_LIKE_MARKER_ID, ERROR_LIKE_MARKER } from './constants.ts'
import {
  type TSerializationOptions,
  type SerializationParameters,
  ensureSerializationParameters
} from './options.ts'
import {
  VALUE_TYPES,
  SerializationContext,
  jsonArrayInto,
  inspectAny,
  ensureSerResultAsObject,
  errorLikeToJsonLike,
  errorLikeToToString
} from './serialization.ts'

const _ELM = ERROR_LIKE_MARKER
const _hasOwnProperty = Object.prototype.hasOwnProperty

/**
 * Вспомогательный временный прокси, обеспечивающий передачу пользователю объекта {@link ErrorLike.detail} во время его
 * инициализации.
 *
 * @param detail     Ссылка на реальный `_detail`.
 * @param existsKeys Установленные ключи.
 */
function _createProxy<T extends IErrorDetail> (detail: T, existsKeys: Set<string>): T {
  return new Proxy(detail, {
    get (_: any, key: string, _receiver: any) {
      return detail[key as keyof T]
    },
    set (_: any, key: string, value: any, _receiver: any) {
      // Явная пользовательская установка не проверяет тип значения и/или его отсутствие(`undefined|null`).
      detail[key as keyof T] = value
      existsKeys.add(key) // Помечаем установку
      return true
    }
  }) as T
}

/**
 * Общие для всех классов ошибок поля прототипа.
 */
const _descriptors = Object.freeze({
  [_ELM]: {
    configurable: false,
    enumerable: false,
    writable: false,
    value: ERROR_LIKE_MARKER_ID
  },
  detail: {
    configurable: false,
    enumerable: false,
    get (this: ErrorLike<any> & { _detail: IErrorDetail }): IErrorDetail {
      // Одноразовая ленивая инициализация, обеспечивающая корректность объекта detail.
      // К этому get обращаются всего один раз - captureErrorProperties() самостоятельно завершит инициализацию.
      let detail: undefined | null | IErrorDetail
      try {
        detail = this._detail
      } catch { /**/ }
      if (typeof detail !== 'object' || detail === null) {
        detail = {}
      }
      return captureErrorProperties(this, detail)
    },
    set (_: any) {
      // ... игнорируем - устновить это свойство нельзя, но можно получить доступ к полям и перезаписать их.
    }
  },
  name: {
    configurable: false,
    enumerable: false, // По умолчанию у стандартных ошибок здесь false
    // !!! writable: true, По умолчанию, но нам нужны get/set
    get (this: { detail: IErrorDetail }) {
      const detail = this.detail
      return (typeof detail.name === 'string') ? detail.name : this.constructor.name
    },
    set (this: { detail: IErrorDetail }, v: string) {
      if (typeof v === 'string') {
        this.detail.name = v
      }
    }
  },
  message: {
    configurable: false,
    enumerable: false,
    get (this: { detail: IErrorDetail }) {
      const detail = this.detail
      return (typeof detail.message === 'string') ? detail.message : ''
    },
    set (this: { detail: IErrorDetail }, v: string) {
      if (typeof v === 'string') {
        this.detail.message = v
      }
    }
  },
  toString: {
    configurable: false,
    enumerable: false,
    writable: false,
    value: function (this: { detail: IErrorDetail }) {
      return errorLikeToToString(this)
    }
  },
  toStringWith: {
    configurable: false,
    enumerable: false,
    writable: false,
    value: function (this: { detail: IErrorDetail }, options?: TNullish | TSerializationOptions | SerializationParameters) {
      return errorLikeToToString(this, options)
    }
  },
  toJson: {
    configurable: false,
    enumerable: false,
    writable: false,
    value: function (this: { detail: IErrorDetail }) {
      return errorLikeToJsonLike(this)
    }
  },
  toJSON: {
    configurable: false,
    enumerable: false,
    writable: false,
    value: function (this: { detail: IErrorDetail }) {
      return errorLikeToJsonLike(this)
    }
  },
  toJsonWith: {
    configurable: false,
    enumerable: false,
    writable: false,
    value: function (this: { detail: IErrorDetail }, options?: TNullish | TSerializationOptions | SerializationParameters) {
      return errorLikeToJsonLike(this, options)
    }
  }
})

/**
 * Обеспечивает запись всех собственных перечислимых свойств ошибки `error` и его прототипов на объект `detail`, только
 * в том случае, если свойство еще не установлено в `detail`.
 *
 * **Note:** Эта функция применяется в аксессоре {@link ErrorLike.detail}, для отложенного получения пользовательских
 * свойств, определенных на расширяемых классах ошибок.
 *
 * Список свойств которые явно пропускаются:
 *  + `_detail` - Зарезервировано для оригинальной ссылки на объект деталей ошибки - второй параметр этой функции.
 *  + `detail`  - Детали ошибки класса(getter).
 *  + `toString/toStringWith/toJSON/toJson/toJsonWith` - Методы конвертации.
 *
 * Свойства, для которых допустимы только непустые строки: `name`, `message`, `stack`, `level`.
 *
 * Все другие свойства игнорируются, если они `undefined`.
 *
 * @param error  Ошибка {@link ErrorLike}, свойства которой будут записаны на `detail`.
 * @param detail Объект для записи. По умолчанию это должно быть поле `_detail` пользовательской ошибки.
 * @returns Возвращает аргумент `detail` заполненный перечислимыми полями ошибки.
 */
function captureErrorProperties<T extends IErrorDetail> (error: ErrorLike<any>, detail: T): T {
  // Если эта функция вызвана рекурсивно - объект уже должен быть определен
  if (_hasOwnProperty.call(error, 'detail')) {
    try {
      return error.detail as T
    } catch {
      return detail
    }
  }

  // Исключаем имеющиеся и зарезервированные свойства.
  // Поле stack может установить только пользователь - читать его на нативной ошибке, вообще нельзя - нативный стек
  // ленивый и начинает читать поля name и message.
  const existsKeys: Set<string> = new Set([...Object.keys(detail), 'stack', '_detail', 'detail', 'toString', 'toStringWith', 'toJson', 'toJSON', 'toJsonWith'])

  let tmpProxy: null | T = null
  let getDetail = (): T => tmpProxy ?? (tmpProxy = _createProxy(detail, existsKeys))

  // Сразу определяем detail. Если объект нерасширяем - это проблема пользователя, но она не вызовет ошибок.
  // Отсутствие detail уже проверено выше.
  if (Object.isExtensible(error)) {
    Object.defineProperty(error, 'detail', {
      configurable: false,
      enumerable: false,
      get () { return getDetail() },
      set (_) { /**/ }
    })
  }

  const copy = (cur: object, key: string) => {
    try {
      // Проблема в этом месте, когда пользовательский класс определил аксессор для записи свойства, и одновременно
      // обратился к detail, который еще не инициализирован - здесь может быть круговой вызов `get detail()`
      const value = Reflect.get(cur, key, error)
      const type = typeof value
      // Свойство могло быть уже установлено через круговые ссылки - проверяем existsKeys повторно
      if (
        // Все что undefined - игнорируется
        existsKeys.has(key) || type === 'undefined' ||
        // Типизированные свойства могут быть только непустыми строками
        ((key === 'name' || key === 'message' || key === 'level') && (type !== 'string' || value.length === 0)) ||
        // Код ошибки должен быть непустой строкой или числом Int
        (key === 'code' && (type === 'string' ? value.length === 0 : !Number.isSafeInteger(value)))
      ) {
        return
      }
      detail[key as keyof T] = value
      existsKeys.add(key)
    } catch { /**/ }
  }

  // Проходим по всем прототипам не включая базовую ошибку(на которой нет свойств). Читаем только перечислимые свойства.
  // Останавливаемся на базовом прототипе ErrorLike, BaseError или вообще пользовательском типе.
  let cur: object | null = error
  while (cur && !_hasOwnProperty.call(cur, _ELM)) {
    const keys = Object.keys(cur)
    for (const key of keys) {
      if (!existsKeys.has(key)) {
        copy(cur, key)
      }
    }
    try {
      cur = Object.getPrototypeOf(cur)
    } catch {
      cur = null
    }
  }

  // Обеспечиваем запись обязательного name
  if (!existsKeys.has('name')) {
    // Попытка получить имя из свойств была уже выше. Теперь получаем только из имени конструктора или установим по
    // умолчанию. Получать напрямую из error.name нет никакого смысла - она всегда равна 'Error'.
    // Может еще быть вариант неперечислимого аксессора, но это уже проблема пользователя не читающего справку.
    try {
      let name = error.constructor.name
      if (typeof name !== 'string' || name.length === 0) {
        name = 'Error'
      }
      detail.name = name
      // existsKeys.add('name')
    } catch { /**/ }
  }

  // Переопределяем
  getDetail = () => detail
  tmpProxy = null

  return detail
}

/**
 * Определяет на любом объекте методы реализующие {@link IErrorLike}.
 *
 * **Note:** Эта функция применяется для реализации классов {@link ErrorLike} и {@link BaseError}.
 *
 * @param classPrototype Прототип класса, например `MyError.prototype`.
 * @returns Возвращает аргумент `classPrototype`.
 * @throws Прерывает выполнение если на объекте обнаружено хотя бы одно зарезервированное свойство из списка:
 * `detail|name|message|toString|toStringWith|toJson|toJSON|toJsonWith`, маркер типа {@link ERROR_LIKE_MARKER} или
 * объект не может быть расширен(например заморожен).
 * @template T Необязательный уточненный тип для удобства использования.
 *
 * @example
 * class MyError {
 *   // это поле будет прочитано при первом доступе к this.detail и должно(но необязательно) быть определено на инстансе.
 *   protected readonly _detail: IErrorDetail
 *   constructor(detail: IErrorDetail) {
 *     this._detail
 *   }
 * }
 * defineErrorLike(MyError.prototype)
 */
function defineErrorLike<T extends IErrorLike<any>> (classPrototype: object | T): T {
  const keys = Reflect.ownKeys(classPrototype)
  const reserved = new Set([_ELM, 'detail', 'name', 'message', 'toString', 'toStringWith', 'toJson', 'toJSON', 'toJsonWith'])
  const found = keys.filter((key) => reserved.has(key))
  if (found.length > 0) {
    const conflicting = found.map((key) => key === _ELM ? 'Symbol(ERROR_LIKE_MARKER)' : key).join('", "')
    throw new BaseError({
      message: `Failed to define ErrorLike behavior. The class prototype already contains reserved properties: "${conflicting}". Please rename or remove these properties to avoid conflicts.`
    })
  }
  try {
    return Object.defineProperties(classPrototype, _descriptors) as T
  } catch (cause) {
    const message = Object.isExtensible(classPrototype)
      ? 'An unexpected error occurred while defining ErrorLike behavior on the class prototype.'
      : 'Failed to define ErrorLike behavior. The class prototype is not extensible (it might be frozen or sealed) and cannot be modified.'
    throw new BaseError({ message, cause })
  }
}

/**
 * Базовый(абстрактный) класс ошибок. Не наследуется от нативной `Error`, избегая создания стека вызовов `Error.stack`
 *
 * Обеспечивает прямой доступ к {@link IErrorDetail} и форматированию к строке или JSON.
 *
 * **Note:** Собственные перечислимые свойства наследников автоматически копируются в объект деталей ошибок, при
 * условии, что последние явно не определены на объекте {@link IErrorDetail}.
 *
 * @template T Подробный тип свойства `ErrorLike.detail`.
 *
 * @example
 * ```ts
 * class CustomError extends ErrorLike<IErrorDetail> {
 *   // Будет автоматически скопировано на ErrorLike.detail.code
 *   code: 'E0058'
 *   // Будет прочитано при первом обращении к ErrorLike.detail
 *   protected readonly _detail: undefined | null | IErrorDetail
 *   constructor(detail?: IErrorDetail) {
 *     this._detail = detail
 *   }
 * }
 * const error = new CustomError({message: '...'})
 * // error.detail.code === 'E0058'
 * // error.detail.message === '...'
 * ```
 */
abstract class ErrorLike<T extends IErrorDetail = IErrorDetail> implements IErrorLike<T> {
  declare readonly detail: T
  declare readonly toString: ISerializable['toString']
  declare readonly toJson: ISerializable['toJson']
  declare readonly toJSON: ISerializable['toJSON']
  declare readonly toStringWith: IErrorSerializable['toStringWith']
  declare readonly toJsonWith: IErrorSerializable['toJsonWith']

  declare name: string
  declare message: string
}

/**
 * Легкая реализация {@link ErrorLike}.
 *
 * Обеспечивает прямой доступ к {@link IErrorDetail} и форматированию к строке или JSON.
 *
 * **Note:** Собственные перечислимые свойства наследников автоматически копируются в объект деталей ошибок, при
 * условии, что последние явно не определены на объекте {@link IErrorDetail}.
 *
 * @template T Подробный тип свойства `LiteError.detail`.
 * @template P Тип параметра конструктора `new LiteError(IErrorDetail)`. Может быть сокращенным типом ошибки, когда
 * константные свойства определяются на классах(при наследовании) и не нуждаются в передачи конструкторам.
 *
 * @example
 * ```ts
 * const error = new LiteError({message: '...'})
 * // error.detail.message === '...'
 * // error.message === '...'
 * ```
 */
class LiteError<T extends IErrorDetail = IErrorDetail, P extends IErrorDetail = T> extends ErrorLike<T> {
  /**
   * Ссылка на оригинальный объект с деталями ошибки.
   *
   * Свойство {@link detail}, при инициализации класса, определено как `getter`. При первом доступе оригинальный
   * объект `_detail` получает все перечислимые свойства класса ошибки и его прототипов, используя
   * {@link captureErrorProperties()}, после чего {@link detail} устанавливается инстанту и доступен напрямую.
   * Аксессор(get) помогает определить константные свойства ошибок на классах наследниках, не прибегая к передаче этих
   * свойств в объект {@link detail}.
   *
   * **Note:** При острой необходимости, можно определить собственные `_detail` и `detail`(лучше этого не делать) -
   * важно чтобы {@link detail} возвращал корректный объект {@link IErrorDetail}.
   *
   * **Warning:** После вызова {@link detail}, перезаписать детали ошибки, путем изменения значений на классе,
   * невозможно. Для перезаписи одного из свойств {@link detail}, используйте прямой доступ.
   * Единственный способ синхронизировать свойства - создать перечислимые(`enumerable:true`) аксессоры.
   */
  protected readonly _detail: TNullish | P

  constructor(detail?: TNullish | P) {
    super()
    // Не проверяем объект(проверку сделает getter) - класс может быть создан только для использования оператора
    // instanceof без полей detail.
    // Сохраняем оригинал и обеспечиваем ленивое копирование свойств через расширенный прототип.
    this._detail = detail
  }
}

/**
 * Базовый класс ошибок совместимый с {@link ErrorLike}.
 *
 * Обеспечивает прямой доступ к {@link IErrorDetail} и форматированию к строке или JSON.
 *
 * **Note:** Собственные перечислимые свойства наследников автоматически копируются в объект деталей ошибок, при
 * условии, что последние явно не определены на объекте {@link IErrorDetail}.
 *
 * @template T Подробный тип свойства `BaseError.detail`.
 * @template P Тип параметра конструктора `new BaseError(IErrorDetail)`. Может быть сокращенным типом ошибки, когда
 * константные свойства определяются на классах(при наследовании) и не нуждаются в передачи конструкторам.
 *
 * @example
 * ```ts
 * class CustomError extends BaseError {
 *   code: 'E0058'
 * }
 * const error = new CustomError({})
 * // error.detail.code === 'E0058'
 * ```
 */
class BaseError<T extends IErrorDetail = IErrorDetail, P extends IErrorDetail = T> extends Error implements ErrorLike<T> {
  declare readonly detail: T
  declare readonly toString: ISerializable['toString']
  declare readonly toJson: ISerializable['toJson']
  declare readonly toJSON: ISerializable['toJSON']
  declare readonly toStringWith: IErrorSerializable['toStringWith']
  declare readonly toJsonWith: IErrorSerializable['toJsonWith']
  /**
   * Подробности {@link LiteError._detail}.
   */
  protected readonly _detail: TNullish | P

  constructor(detail?: TNullish | P) {
    // Сообщение будет доступно через `get detail()`
    super()
    this._detail = detail
  }
}

// Переопределяем оператор `instanceof` - теперь он будет работать со всеми ошибками ErrorLike и BaseError
Object.defineProperty(ErrorLike, Symbol.hasInstance, {
  configurable: false,
  enumerable: false,
  writable: false,
  value: function (ins: any) {
    try {
      return _ELM in ins
    } catch {
      return false
    }
  }
})

// Определяем методы класса, симулируя наследование от ErrorLike, и замораживаем прототипы.
defineErrorLike(ErrorLike.prototype)
defineErrorLike(BaseError.prototype)
Object.freeze(ErrorLike.prototype)
Object.freeze(LiteError.prototype)
Object.freeze(BaseError.prototype)

/**
 * Массив ошибок реализующий {@link IErrorCollection}.
 *
 * **Warning:** Не устанавливайте элементы присвоением индексов - это невозможно проверить.
 * Методы `push()/unshift()/splice()` предварительно проверяют тип и принудительно приводят элемент к {@link ErrorLike}.
 * Другие методы не реализованы и могут возвратить не то что ожидается.
 *
 * Коллекция не служит контейнером для хранения ошибок, а используется как конвертер к `string` или `JsonLike`.
 * Из инстансов {@link ErrorLike}, добавляемых к коллекции, будут извлечены структуры {@link IErrorDetail}.
 *
 * Применяйте массив для агрегирования нескольких ошибок в одно поле {@link IErrorDetail}:
 *
 * ```ts
 * const detail: IErrorDetail = {
 *   // будет правильно преобразовано к строке или JsonLike с несколькими ошибками
 *   warnings: new ErrorCollection([{code: 1, level: 'warn'}])
 * }
 * ```
 */
class ErrorCollection<T extends ErrorLike<any> = ErrorLike<any>, P extends (ErrorLike<any> | IErrorDetail) = (ErrorLike<any> | IErrorDetail)> extends Array<T> implements IErrorCollection<T> {
  /**
   * @param iterable Массивоподобный объект с ошибками.
   */
  constructor(iterable?: TNullish | Iterable<any> | ArrayLike<any>) {
    super()
    if (iterable) {
      const items = Array.from(iterable)
      this.push(...items)
    }
  }

  /**
   * Гарантирует, что аргумент `maybeError` любого типа - будет приведен к {@link ErrorLike}.
   */
  protected _ensureError (maybeError: any): T {
    try {
      if (_ELM in maybeError) {
        return maybeError
      }
    } catch { /**/ }
    const type = typeof maybeError
    const detail = (type === 'undefined' || maybeError === null) ? null : (type === 'object' ? maybeError : { cause: maybeError })
    return new LiteError(detail) as unknown as T
  }

  override push (...items: (T | P)[]): number {
    for (const item of items) {
      super.push(this._ensureError(item))
    }
    return this.length
  }

  override unshift (...items: (T | P)[]): number {
    for (const item of items) {
      super.unshift(this._ensureError(item))
    }
    return this.length
  }

  override splice (start: number, deleteCount?: number): ErrorCollection<T>
  override splice (start: number, deleteCount: number, ...items: (T | P)[]): ErrorCollection<T>
  override splice (start: number, deleteCount?: number, ...items: (T | P)[]): ErrorCollection<T> {
    const rest = items.map((item) => this._ensureError(item))
    return new ErrorCollection<T>(super.splice(start, deleteCount as any, ...rest))
  }

  override toString (): string {
    return this.toStringWith()
  }

  toStringWith (options?: TNullish | TSerializationOptions | SerializationParameters): string {
    const errors = this.toJsonWith(options)
    const receiver: string[] = []
    jsonArrayInto(errors, receiver, 0)
    return receiver.join('\n')
  }

  toJson (): Record<string, any>[] {
    return this.toJsonWith()
  }

  toJSON (): Record<string, any>[] {
    return this.toJsonWith()
  }

  toJsonWith (options?: TNullish | TSerializationOptions | SerializationParameters): Record<string, any>[] {
    if (this.length === 0) {
      return []
    }
    const params = ensureSerializationParameters(options)
    const ctx = new SerializationContext(params.maxTotalItems, params.maxItems)
    const collection: Record<string, any>[] = []
    for (const item of this) {
      if (ctx.isTotalFull()) {
        break
      }
      const result = inspectAny(item, params, ctx, 1)
      if (result[0] !== VALUE_TYPES.undefined) {
        collection.push(ensureSerResultAsObject(result, params.metaFieldName))
        ctx.increment()
      }
    }
    return collection
  }
}

export {
  captureErrorProperties,
  defineErrorLike,
  ErrorLike,
  LiteError,
  BaseError,
  ErrorCollection
}
