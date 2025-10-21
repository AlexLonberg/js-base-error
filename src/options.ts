import type { TNullish, IErrorDetail } from './types.js'
import type { ErrorLike } from './errors.ts'

const _lazyGlobalParams = {
  get ins (): SerializationParameters {
    const value = SerializationParameters.createDefault()
    Object.defineProperty(_lazyGlobalParams, 'ins', { writable: true, value })
    return value
  },
  set ins (value: SerializationParameters) {
    Object.defineProperty(_lazyGlobalParams, 'ins', { writable: true, value })
  }
}

class ReadonlySetImpl extends Set<string> {
  constructor() {
    super()
  }
  override add (_: any): this {
    return this
  }
  override delete (_: any): false {
    return false
  }
  override clear (): void {
    // ...
  }

  _internalAdd (item: string): void {
    super.add(item)
  }

  _internalDelete (item: string): void {
    super.delete(item)
  }
}

function _normalizeStringSet (value: any): null | ReadonlySetImpl {
  if (typeof value === 'string') {
    const set = new ReadonlySetImpl()
    set._internalAdd(value)
    return set
  }
  if (Array.isArray(value)) {
    const set = new ReadonlySetImpl()
    for (const item of value) {
      if (typeof item === 'string') {
        set._internalAdd(item)
      }
    }
    if (set.size > 0) {
      return set
    }
  }
  return null
}

function _normalizeInt (value: any, min: number, max: number, defaultValue: number): number {
  if (Number.isSafeInteger(value)) {
    if (value < min) {
      return min
    }
    if (value > max) {
      return max
    }
    return value
  }
  return defaultValue
}

/**
 * Опции сериализации.
 */
type TSerializationOptions = {
  /**
   * Включить в вывод поля с именем `stack`. По умолчанию `false`. Эта опция, если явно указана, имеет приоритет над
   * {@link TSerializationOptions.include} и {@link TSerializationOptions.exclude}.
   */
  includeStack?: TNullish | boolean
  /**
   * Оставить ли первую строку стека. По умолчанию `false`. Эта строка не несет никакой полезной информации и содержит
   * дублированное `name` и `message`. Кроме того:
   *
   *  + NodeJS позволяет изменить сообщение до первого обращения к стеку.
   *  + Chrome использует строку переданную в конструктор, но {@link ErrorLike} не читает и не передает `message` при
   *    инициализации, что делает строку еще более бесполезной.
   */
  keepStackHeader?: TNullish | boolean
  /**
   * Максимальная вложенность структур. По умолчанию `2`. `min:1, max:16`.
   */
  maxDepth?: TNullish | number
  /**
   * Максимальное количество элементов массива или полей структуры. По умолчанию `16`. `min:1, max:256`.
   */
  maxItems?: TNullish | number
  /**
   * Максимальное суммарное количество полей и элементов массивов ошибки. По умолчанию `128`. `min:1, max:4096`.
   * Этот параметр не константный и может быть превышен из-за механики обхода. Счетчик объекта увеличится только после
   * завершения обхода, при этом количество записей уже может достигнуть лимита.
   */
  maxTotalItems?: TNullish | number
  /**
   * Максимальная длина строки поля. По умолчанию `256`. `min:8, max:4096`. Это относится ко всем полям приводимым к
   * строке, кроме: `'name'`, `'code'`, `'level'` и полей с типом {@link Date}.
   */
  maxStringLength?: TNullish | number
  /**
   * Игнорировать пользовательские поля `null` пустые строки `''` или пустые массивы с объектами. По умолчанию `false`.
   * К именам этих полей не относятся {@link IErrorDetail}, которые строго типизированы и не могут быть пустыми строками
   * или `null`. Поля `undefined` никогда не включаются и не считаются значимыми.
   */
  ignoreEmpty?: TNullish | boolean
  /**
   * Включить только указанные поля и, если {@link TSerializationOptions.includeStack}, добавить поля `'stack'`. Поле
   * `'stack'` может быть указано в любом месте опций. По умолчанию включаются все поля(кроме `'stack'`).
   */
  include?: TNullish | string | string[] | (readonly string[])
  /**
   * Исключить поля с этими именами. Правила исключения имеют приоритет над {@link TSerializationOptions.include}.
   */
  exclude?: TNullish | string | string[] | (readonly string[])
  /**
   * Имя поля для мета информации о полях, которые не могут войти в результат из-за превышения лимитов.
   * По умолчанию `'__meta'`. Имя не может быть пустой строкой.
   */
  metaFieldName?: TNullish | string
  /**
   * Исключить ли из результата метаинформацию об усеченных объекта и массивах или о превышении глубины. По умолчанию `false`.
   */
  ignoreMeta?: TNullish | boolean
}

/**
 * Нормализованные опции {@link TSerializationOptions}.
 */
type TNormalizedSerializationOptions = {
  readonly includeStack: boolean
  readonly keepStackHeader: boolean
  readonly ignoreEmpty: boolean
  readonly maxDepth: number
  readonly maxItems: number
  readonly maxTotalItems: number
  readonly maxStringLength: number
  readonly include: null | ReadonlySet<string>
  readonly exclude: null | ReadonlySet<string>
  readonly metaFieldName: string
  readonly ignoreMeta: boolean
}

/**
 * Нормализованные опции {@link TNormalizedSerializationOptions} по умолчанию.
 */
const DEFAULT_SERIALIZATION_OPTIONS: TNormalizedSerializationOptions = Object.freeze({
  includeStack: false,
  keepStackHeader: false,
  ignoreEmpty: false,
  maxDepth: 2,
  maxItems: 16,
  maxTotalItems: 128,
  maxStringLength: 512,
  include: null,
  exclude: null,
  metaFieldName: '__meta',
  ignoreMeta: false
})

/**
 * Нормализует пользовательские опции сериализации {@link TSerializationOptions}.
 */
function normalizeSerializationOptions (options?: TNullish | TSerializationOptions): TNormalizedSerializationOptions {
  if (typeof options !== 'object' || options === null) {
    return DEFAULT_SERIALIZATION_OPTIONS
  }
  const rawOptions: Map<string, any> = new Map()
  const keys = Object.keys(options) as (keyof TSerializationOptions)[]
  for (const key of keys) {
    try {
      const value = options[key]
      rawOptions.set(key, value)
    } catch { /**/ }
  }

  const maxDepth = _normalizeInt(rawOptions.get('maxDepth'), 1, 16, DEFAULT_SERIALIZATION_OPTIONS.maxDepth)
  let maxItems = _normalizeInt(rawOptions.get('maxItems'), 1, 256, DEFAULT_SERIALIZATION_OPTIONS.maxItems)
  const maxTotalItems = _normalizeInt(rawOptions.get('maxTotalItems'), 1, 4096, DEFAULT_SERIALIZATION_OPTIONS.maxTotalItems)
  if (maxItems > maxTotalItems) {
    maxItems = maxTotalItems
  }
  const maxStringLength = _normalizeInt(rawOptions.get('maxStringLength'), 8, 4096, DEFAULT_SERIALIZATION_OPTIONS.maxStringLength)

  const include = _normalizeStringSet(rawOptions.get('include'))
  const exclude = _normalizeStringSet(rawOptions.get('exclude'))
  let stack: null | boolean = null
  if (include && exclude) {
    for (const item of exclude) {
      include._internalDelete(item)
    }
  }
  if (exclude?.has('stack')) {
    stack = false
  }
  else if (include?.has('stack')) {
    stack = true
  }

  let includeStack = rawOptions.get('includeStack') as boolean
  if (typeof includeStack !== 'boolean') {
    includeStack = typeof stack === 'boolean' ? stack : DEFAULT_SERIALIZATION_OPTIONS.includeStack
  }
  if (includeStack) {
    include?._internalAdd('stack')
    exclude?._internalDelete('stack')
  }
  else {
    include?._internalDelete('stack')
    exclude?._internalAdd('stack')
  }
  const keepStackHeader = !!rawOptions.get('keepStackHeader')

  let ignoreEmpty = rawOptions.get('ignoreEmpty') as boolean
  if (typeof ignoreEmpty !== 'boolean') {
    ignoreEmpty = DEFAULT_SERIALIZATION_OPTIONS.ignoreEmpty
  }

  let metaFieldName = rawOptions.get('metaFieldName')
  if (typeof metaFieldName !== 'string' || metaFieldName.length === 0) {
    metaFieldName = DEFAULT_SERIALIZATION_OPTIONS.metaFieldName
  }
  let ignoreMeta = rawOptions.get('ignoreMeta') as boolean
  if (typeof ignoreMeta !== 'boolean') {
    ignoreMeta = DEFAULT_SERIALIZATION_OPTIONS.ignoreMeta
  }

  return {
    includeStack,
    keepStackHeader,
    ignoreEmpty,
    maxDepth,
    maxItems,
    maxTotalItems,
    maxStringLength,
    include,
    exclude,
    metaFieldName,
    ignoreMeta
  }
}

/**
 * Параметры сериализации.
 */
class SerializationParameters {
  protected readonly _includeStack: boolean
  protected readonly _keepStackHeader: boolean
  protected readonly _ignoreEmpty: boolean
  protected readonly _maxDepth: number
  protected readonly _maxItems: number
  protected readonly _maxTotalItems: number
  protected readonly _maxStringLength: number
  protected readonly _include: null | ReadonlySet<string> = null
  protected readonly _exclude: null | ReadonlySet<string> = null
  protected readonly _metaFieldName: string
  protected readonly _ignoreMeta: boolean

  constructor(options?: TNullish | TSerializationOptions) {
    const norm = (options === DEFAULT_SERIALIZATION_OPTIONS)
      ? (options as TNormalizedSerializationOptions)
      : normalizeSerializationOptions(options)
    this._includeStack = norm.includeStack
    this._keepStackHeader = norm.keepStackHeader
    this._ignoreEmpty = norm.ignoreEmpty
    this._maxDepth = norm.maxDepth
    this._maxItems = norm.maxItems
    this._maxTotalItems = norm.maxTotalItems
    this._maxStringLength = norm.maxStringLength
    this._include = norm.include
    this._exclude = norm.exclude
    this._metaFieldName = norm.metaFieldName
    this._ignoreMeta = norm.ignoreMeta
  }

  get includeStack (): boolean { return this._includeStack }
  get keepStackHeader (): boolean { return this._keepStackHeader }
  get ignoreEmpty (): boolean { return this._ignoreEmpty }
  get maxDepth (): number { return this._maxDepth }
  get maxItems (): number { return this._maxItems }
  get maxTotalItems (): number { return this._maxTotalItems }
  get maxStringLength (): number { return this._maxStringLength }
  get include (): null | ReadonlySet<string> { return this._include }
  get exclude (): null | ReadonlySet<string> { return this._exclude }
  get metaFieldName (): string { return this._metaFieldName }
  get ignoreMeta (): boolean { return this._ignoreMeta }

  test (fieldName: string): boolean {
    if (fieldName === 'stack') {
      return this._includeStack
    }
    if (this._exclude?.has(fieldName)) {
      return false
    }
    return this._include?.has(fieldName) ?? true
  }

  static createDefault (): SerializationParameters {
    // @ts-expect-error
    return new SerializationParameters(DEFAULT_SERIALIZATION_OPTIONS)
  }

  /**
   * Установить глобальные параметры сериализации ошибок.
   *
   * @param options Опции {@link TSerializationOptions} или {@link SerializationParameters}. Для удаления передайте `undefined|null`.
   * @returns Глобально определенные параметры или, в случае удаления, параметры по умолчанию.
   */
  static configure (options?: TNullish | TSerializationOptions | SerializationParameters): SerializationParameters {
    _lazyGlobalParams.ins = options
      ? ((options instanceof SerializationParameters) ? options : new SerializationParameters(options))
      : SerializationParameters.createDefault()
    return _lazyGlobalParams.ins
  }
}

/**
 * Проверяет является ли аргумент `options` типом {@link SerializationParameters}, и:
 *  +  если это опции - вызывает конструктор.
 *  +  если нет - возвращает кешированный через {@link SerializationParameters.configure()} объект по умолчанию.
 */
function ensureSerializationParameters (options?: TNullish | TSerializationOptions | SerializationParameters): SerializationParameters {
  return options
    ? ((options instanceof SerializationParameters) ? options : new SerializationParameters(options))
    : _lazyGlobalParams.ins
}

export {
  type IErrorDetail as _IErrorDetail,
  type ErrorLike as _ErrorLike,
  //
  ReadonlySetImpl,
  type TSerializationOptions,
  type TNormalizedSerializationOptions,
  DEFAULT_SERIALIZATION_OPTIONS,
  normalizeSerializationOptions,
  SerializationParameters,
  ensureSerializationParameters
}
