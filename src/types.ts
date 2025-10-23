import type { TSerializationOptions, SerializationParameters } from './options.ts'

type TNullish = undefined | null
type TPrimitive = undefined | null | boolean | number | string | bigint | symbol

type TJsonPrimitive = null | boolean | number | string
type TJsonObject = { [_: string]: TJsonLike }
type TJsonArray = TJsonLike[]
type TJsonLike = TJsonPrimitive | TJsonObject | TJsonArray

/**
 * Уровень ошибок.
 */
type TErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Базовый интерфейс деталей ошибки с минимальным набором распространенных свойств.
 */
interface IErrorDetail {
  /**
   * Необязательное поле имя ошибки. Может быть установлено явно или будет извлечено из {@link Error}.
   */
  name?: TNullish | string
  /**
   * Необязательное поле описания ошибки.
   */
  message?: TNullish | string
  /**
   * Необязательное поле кода ошибки.
   */
  code?: TNullish | number | string
  /**
   * Может быть установлен явно, или взято из {@link Error} если поле извлекается из ошибки.
   */
  stack?: TNullish | string
  /**
   * Необязательное поле причины. Может быть любым типом, кроме `undefined`.
   */
  cause?: TNullish | unknown
  /**
   * Необязательное поле уровня ошибки. По умолчанию все ошибки считаются `'error'`.
   */
  level?: TNullish | TErrorLevel
}

/**
 * Предоставляет методы приведения объекта к строке или `JsonLike` объекту.
 */
interface ISerializable {
  /**
   * Преобразование к строке с параметрами по умолчанию {@link TSerializationOptions}.
   */
  toString (): string
  /**
   * Преобразование к JSON-объекту `Record<string, any>` с параметрами по умолчанию {@link TSerializationOptions}.
   */
  toJson (): Record<string, any>
  /**
   * Псевдоним {@link toJson()}, который распознается `JSON.stringify()`.
   */
  toJSON (): Record<string, any>
}

/**
 * Расширяет {@link ISerializable} методами форматирования с параметрами.
 */
interface IErrorSerializable extends ISerializable {
  /**
   * Преобразование к строке.
   *
   * @param options  Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
   */
  toStringWith (options?: TNullish | TSerializationOptions | SerializationParameters): string
  /**
   * Преобразование к JSON-объекту `Record<string, any>`.
   *
   * @param options Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
   */
  toJsonWith (options?: TNullish | TSerializationOptions | SerializationParameters): Record<string, any>
}

/**
 * Структура совместимая с нативной `Error` и полем данных `detail:{}` деталей ошибки.
 *
 * @template T Уточненный тип поля `detail`.
 */
interface IErrorLike<T extends IErrorDetail> extends IErrorSerializable {
  /**
   * Объект деталей ошибки {@link IErrorDetail}.
   */
  readonly detail: T

  name: string
  message: string
}

/**
 * Массив ошибок с методами преобразования `toString()/toJSON()` всех вложенных {@link IErrorLike} к строке или массиву
 * объектов `Record<string, any>[]`.
 */
interface IErrorCollection<T extends IErrorLike<any> = IErrorLike<any>> extends Array<T>, IErrorSerializable {
  /**
   * Преобразование к массиву `Record<string, any>[]` с параметрами по умолчанию {@link TSerializationOptions}.
   */
  toJson (): Record<string, any>[]
  /**
   * Псевдоним {@link toJson()}, который распознается `JSON.stringify()`.
   */
  toJSON (): Record<string, any>[]
  /**
   * Преобразование к массиву `Record<string, any>[]`.
   *
   * @param options Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
   */
  toJsonWith (options?: TNullish | TSerializationOptions | SerializationParameters): Record<string, any>[]
}

/**
 * Метаинформация о значениях верхнего уровня или объектах с типами не подлежащими структурной сериализации.
 */
type TMetaValue =
  { type: 'null', value: null } |
  { type: 'boolean', value: boolean } |
  { type: 'number', value: number } |
  { type: 'string' | 'date' | 'regexp' | 'bigint' | 'symbol' | 'function', value: string } |
  { type: 'array', value: TJsonArray }

/**
 * Метаинформация об усеченном объекте.
 *
 *  + `total`     - Общее количество элементов или свойств объекта.
 *  + `truncated` - Сколько элементов не вошло в результат.
 *
 * Количество реальных элементов может отличаться от `total`. Счетчик игнорирует поля, которые исключены, `undefined`
 * или вызывали ошибку чтения.
 *
 * `kind:'object'` может принадлежать только ошибке или объекту и находится на одном уровне с другими свойствами:
 * ```ts
 * {
 *   name: 'Error',
 *   __meta: { kind: 'object', total: 8, truncated: 7 }
 * }
 * ```
 *
 * `kind:'array'` находится в элементе усеченного массива(как правило последний):
 * ```ts
 * [
 *   { ... },
 *   { __meta: { kind: 'array', total: 8, truncated: 7 } }
 * ]
 * ```
 */
type TMetaTruncated = { kind: 'object' | 'array', total: number, truncated: number }

/**
 * Метаинформация о замещенном объекте, который не смог войти в результат по причине превышения глубины.
 */
type TMetaPlaceholder =
  { kind: 'object' | 'array', length: number } |
  { kind: 'error', name: string, message?: string }

export {
  type TNullish,
  type TPrimitive,
  type TJsonPrimitive,
  type TJsonObject,
  type TJsonArray,
  type TJsonLike,
  type TErrorLevel,
  type IErrorDetail,
  type ISerializable,
  type IErrorSerializable,
  type IErrorLike,
  type IErrorCollection,
  type TMetaValue,
  type TMetaTruncated,
  type TMetaPlaceholder
}
