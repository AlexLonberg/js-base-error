import type {
  TNullish,
  TPrimitive,
  TJsonPrimitive,
  TJsonObject,
  TJsonArray,
  TJsonLike,
  IErrorDetail,
  IErrorLike,
  TMetaValue,
  TMetaTruncated,
  TMetaPlaceholder
} from './types.ts'
import { ERROR_LIKE_MARKER } from './constants.ts'
import {
  type TSerializationOptions,
  type SerializationParameters,
  ensureSerializationParameters
} from './options.ts'
import type { ErrorLike, BaseError } from './errors.ts'

const _ELM = ERROR_LIKE_MARKER
const _RE_AT = /^[\t ]*at[\t ]+/i
const _VALUE_TYPE = {
  undefined: 0,
  null: 1,
  boolean: 2,
  number: 3,
  string: 4,
  object: 5,
  array: 6,
  meta: 7
} as const
type TValueTypes = typeof _VALUE_TYPE
const VALUE_TYPES: TValueTypes = Object.freeze(_VALUE_TYPE)

type TSerResultUndefined = readonly [TValueTypes['undefined'], null]
type TSerResultPrimitive = readonly [TValueTypes['null' | 'boolean' | 'number' | 'string'], TJsonPrimitive]
type TSerResultObject = readonly [TValueTypes['object'], TJsonObject]
type TSerResultArray = readonly [TValueTypes['array'], TJsonArray]
type TSerResultMeta = readonly [TValueTypes['meta'], { [_: string]: TMetaValue | TMetaTruncated | TMetaPlaceholder }]
type TSerResult = TSerResultUndefined | TSerResultPrimitive | TSerResultObject | TSerResultArray | TSerResultMeta

const _UNDEFINED: TSerResultUndefined = Object.freeze([VALUE_TYPES.undefined, null] as const)

/**
 * Проверяет - принадлежит ли тип к {@link ErrorLike} или {@link BaseError}.
 *
 * **Note:** Такая проверка эквивалентна `error instanceof ErrorLike`, но использует внутренний маркер типа.
 *
 * @param error Предполагаемая ошибка.
 * @template T Необязательный уточненный тип для удобства использования после `if...`, если расширенная ошибка имеет
 * пользовательские свойства.
 */
function isErrorLike<T extends (ErrorLike<any> | BaseError<any, any>)> (error: any | T): error is T {
  try {
    return (_ELM in error)
  } catch { /**/ }
  return false
}

class SerializationContext {
  protected readonly _seen: WeakSet<any> = new WeakSet()
  protected readonly _maxTotalItems: number
  protected readonly _maxItems: number
  protected _totalItems = 0

  constructor(maxTotalItems: number, maxItems: number, objForSeen?: object) {
    this._maxTotalItems = maxTotalItems
    this._maxItems = maxItems
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof objForSeen === 'object' && objForSeen !== null) {
      this._seen.add(objForSeen)
    }
  }

  has (obj: object): boolean {
    return this._seen.has(obj)
  }

  add (obj: object): void {
    this._seen.add(obj)
  }

  maxTotalItems (): number {
    return this._maxTotalItems
  }

  totalItems (): number {
    return this._totalItems
  }

  increment (): number {
    ++this._totalItems
    return this._totalItems
  }

  // decrement (): number {
  //   --this._totalItems
  //   return this._totalItems
  // }

  hasTotalSpace (): boolean {
    return this._totalItems < this._maxTotalItems
  }

  hasLevelSpace (count: number): boolean {
    return count < this._maxItems
  }

  /**
   * Есть ли место для текущего уровня и глобально.
   *
   * @param count Количество записанных свойств текущего уровня.
   */
  hasSpace (count: number): boolean {
    return count < this._maxItems && this._totalItems < this._maxTotalItems
  }

  isTotalFull (): boolean {
    return this._totalItems >= this._maxTotalItems
  }

  isLevelFull (count: number): boolean {
    return count >= this._maxItems
  }

  /**
   * Переполнен ли счетчик текущего уровня и глобально.
   *
   * @param count Количество записанных свойств текущего уровня.
   */
  isFull (count: number): boolean {
    return count >= this._maxItems || this._totalItems >= this._maxTotalItems
  }
}

/**
 * Приводит одно значение к строке. Строки содержащие _"break line"_ - заполняют несколько строк с добавлением двух пробелов.
 *
 * **Note:** Эта функция вызывается из {@link jsonObjectInto()} или {@link jsonObjectInto()} для каждого свойства.
 *
 * @param key      Текущий ключ. Для массива это `[123]`, для объекта строка имени свойства.
 * @param value    Корректный тип JSON.
 * @param receiver Массив для добавления строк.
 * @param level    Текущий уровень.
 */
function jsonPropInto (key: string, value: TJsonLike, receiver: string[], level: number): void {
  const indent = '  '.repeat(level)
  if (value === null) {
    receiver.push(`${indent}${key}: null`)
    return
  }

  const type = typeof value

  if (type === 'number' || type === 'boolean') {
    receiver.push(`${indent}${key}: ${value}`)
    return
  }

  if (type === 'string') {
    if ((value as string).includes('\n')) {
      const [first, ...rest] = (value as string).split('\n') as [string, ...string[]]
      receiver.push(`${indent}${key}: ${first}`)
      for (const line of rest) {
        receiver.push(`${indent}  ${line}`) // добавляем два пробела
      }
    }
    else {
      receiver.push(`${indent}${key}: ${value}`)
    }
    return
  }

  if (type === 'object') {
    receiver.push(`${indent}${key}:`)
    if (Array.isArray(value)) {
      jsonArrayInto(value, receiver, level + 1)
    }
    else {
      jsonObjectInto(value as TJsonObject, receiver, level + 1)
    }
  }
}

/**
 * Приводит результат сериализации к строкам.
 *
 * @param objectSource Должен быть корректным Json-объектом `{}` с допустимыми типами.
 * @param receiver     Массив для добавления строк.
 * @param level        Текущий уровень.
 *
 * @example
 * ```ts
 * const str = jsonObjectInto({stack: 'Error: ...'}, [], 0).join('\n')
 * // stack: Error: ...
 * //   at ...
 * //   at ...
 * ```
 */
function jsonObjectInto (objectSource: TJsonObject, receiver: string[], level: number): void {
  const keys = Object.keys(objectSource)
  for (const key of keys) {
    const value = objectSource[key] as TJsonLike
    jsonPropInto(key, value, receiver, level)
  }
}

/**
 * Приводит результат сериализации к строкам.
 *
 * @param objectSource Должен быть корректным Json-массивом `[]` с допустимыми типами.
 * @param receiver     Массив для добавления строк.
 * @param level        Текущий уровень.
 *
 * @example
 * ```ts
 * const str = jsonArrayInto([], [], 0).join('\n')
 * // [0] ...
 * // [1] ...
 * // __meta: kind:array, total:256, truncated:254
 * ```
 */
function jsonArrayInto (arraySource: TJsonArray, receiver: string[], level: number): void {
  for (let i = 0; i < arraySource.length; ++i) {
    const value = arraySource[i] as TJsonLike
    jsonPropInto(`[${i}]`, value, receiver, level)
  }
}

function ensureErrorMeta (error: { name?: TNullish | string, message?: TNullish | string }, maxStringLength: number): { kind: 'error', name: string, message?: string } {
  let name: TNullish | string
  let message: TNullish | string
  try {
    name = error.name
    message = error.message
  } catch { /**/ }
  const meta = { kind: 'error', name: (typeof name === 'string') ? name : '' } as { kind: 'error', name: string, message?: string }
  if (typeof message === 'string' && message.length > 0) {
    if (message.length > maxStringLength) {
      message = message.substring(0, maxStringLength)
    }
    meta.message = message
  }
  return meta
}

function safeArrayLength (array: any[]): number {
  let length: undefined | number
  try {
    length = array.length
  } catch { /**/ }
  return Number.isSafeInteger(length) ? length as number : 0
}

function safeReadCodeInto (obj: Record<string, any>, receiver: Record<string, any>): boolean {
  let value: undefined | string
  try {
    value = obj['code']
  } catch { /**/ }
  if ((typeof value === 'string' && value.length > 0) || Number.isSafeInteger(value)) {
    receiver['code'] = value
    return true
  }
  return false
}

function safeReadStackInto (obj: Record<string, any>, receiver: Record<string, any>, maxStringLength: number, keepStackHeader: boolean): boolean {
  let value: undefined | string
  try {
    value = obj['stack']
  } catch { /**/ }
  if (typeof value !== 'string' || value.length === 0) {
    return false
  }
  if (!keepStackHeader && !_RE_AT.test(value)) {
    const i = value.indexOf('\n')
    // Первая строка единственная и она не трассировка стека
    if (i === -1) {
      return false
    }
    value = value.slice(i + 1)
  }
  if (value.length > maxStringLength) {
    value = value.substring(0, maxStringLength)
  }
  if (value.length === 0) {
    return false
  }
  receiver['stack'] = value
  return true
}

function safeReadStringInto (obj: Record<string, any>, receiver: Record<string, any>, key: string, maxStringLength: null | number, allowEmpty: boolean): boolean {
  let value: undefined | string
  try {
    value = obj[key]
  } catch { /**/ }
  if (typeof value !== 'string') {
    return false
  }
  if (value.length > 0) {
    if (maxStringLength !== null && value.length > maxStringLength) {
      value = value.substring(0, maxStringLength)
    }
    receiver[key] = value
    return true
  }
  if (allowEmpty) {
    receiver[key] = value
    return true
  }
  return false
}

function safeReadPropsInto (objectSource: Record<string, any>, params: SerializationParameters, ctx: SerializationContext, level: 0 | number, count: number, keys: Iterable<string>, receiver: Record<string, any>): [number, number] {
  let ignored = 0
  for (const key of keys) {
    if (ctx.isFull(count)) {
      break
    }
    if (!params.test(key)) {
      ++ignored
      continue
    }
    let value: any
    try {
      value = objectSource[key]
    } catch { /**/ }
    const result = inspectAny(value, params, ctx, level)
    if (result[0] === VALUE_TYPES.undefined) {
      ++ignored
    }
    else {
      receiver[key] = result[1]
      ctx.increment()
      ++count
    }
  }
  return [count, ignored]
}

// typeof - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#description
function _inspectPrimitive (type: 'undefined' | 'boolean' | 'number' | 'bigint' | 'string' | 'symbol' | 'function', primitiveSource: Exclude<TPrimitive, null | object>, params: SerializationParameters): TSerResultUndefined | TSerResultPrimitive | TSerResultMeta {
  if (type === 'string') {
    const length = (primitiveSource as string).length
    if (length === 0) {
      return params.ignoreEmpty ? _UNDEFINED : [VALUE_TYPES.string, '']
    }
    if (length > params.maxStringLength) {
      primitiveSource = (primitiveSource as string).substring(0, params.maxStringLength)
    }
    return [VALUE_TYPES.string, primitiveSource as string]
  }

  if (type === 'number' && Number.isFinite(primitiveSource)) {
    return [VALUE_TYPES.number, primitiveSource as number]
  }

  if (type === 'boolean') {
    return [VALUE_TYPES.boolean, primitiveSource as boolean]
  }

  if (type !== 'undefined') {
    try {
      const value = String(primitiveSource)
      if (value.length > 0 || !params.ignoreEmpty) {
        // Какой там будет тип неважно
        return [VALUE_TYPES.meta, { [params.metaFieldName]: { type: type as 'bigint', value } }]
      }
    } catch { /**/ }
  }

  return _UNDEFINED
}

function inspectPrimitive (primitiveSource: TPrimitive, params: SerializationParameters): TSerResultUndefined | TSerResultPrimitive | TSerResultMeta {
  if (primitiveSource === null) {
    return params.ignoreEmpty ? _UNDEFINED : [VALUE_TYPES.null, null]
  }
  return _inspectPrimitive((typeof primitiveSource) as any, primitiveSource, params)
}

function inspectDate (dateSource: Date, params: SerializationParameters): TSerResultUndefined | TSerResultMeta {
  let value: undefined | string
  try {
    value = dateSource.toJSON()
  } catch { /**/ }
  return (typeof value === 'string' && value.length > 0)
    ? [VALUE_TYPES.meta, { [params.metaFieldName]: { type: 'date', value } }]
    : _UNDEFINED
}

function inspectRegExp (reSource: RegExp, params: SerializationParameters): TSerResultUndefined | TSerResultMeta {
  let value: undefined | string
  try {
    value = String(reSource)
  } catch { /**/ }
  return (typeof value === 'string' && value.length > 0)
    ? [VALUE_TYPES.meta, { [params.metaFieldName]: { type: 'regexp', value } }]
    : _UNDEFINED
}

function inspectObject (objectSource: Record<string, any>, params: SerializationParameters, ctx: SerializationContext, level: 0 | number): TSerResultUndefined | TSerResultObject | TSerResultMeta {
  if (ctx.has(objectSource)) {
    return _UNDEFINED
  }
  ctx.add(objectSource)

  const keys: string[] = Object.keys(objectSource)
  let total = keys.length
  if (level >= params.maxDepth) {
    if (params.ignoreMeta) {
      return _UNDEFINED
    }
    return total === 0
      ? (params.ignoreEmpty ? _UNDEFINED : [VALUE_TYPES.object, {}])
      : [VALUE_TYPES.meta, { [params.metaFieldName]: { kind: 'object', length: total } }]
  }

  ++level

  // Независимо от объекта - проверяем поле stack
  let hasStack = false
  const stackIndex = keys.indexOf('stack')
  if (stackIndex !== -1) {
    keys.splice(stackIndex, 1)
    if (params.includeStack) {
      hasStack = true
    }
    else {
      --total
    }
  }

  const receiver: Record<string, any> = {}
  const ci = safeReadPropsInto(objectSource, params, ctx, level, 0, keys, receiver)
  let count = ci[0]
  total -= ci[1]

  if (hasStack) {
    if (safeReadStackInto(objectSource, receiver, params.maxStringLength, params.keepStackHeader)) {
      ctx.increment()
      ++count
    }
    else {
      --total
    }
  }

  if (total > count && !params.ignoreMeta) {
    receiver[params.metaFieldName] = { kind: 'object', total, truncated: total - count }
    ctx.increment()
    ++count
  }

  if (count > 0 || !params.ignoreEmpty) {
    return [VALUE_TYPES.object, receiver]
  }
  return _UNDEFINED
}

function inspectArray (arraySource: any[], params: SerializationParameters, ctx: SerializationContext, level: 0 | number): TSerResultUndefined | TSerResultArray | TSerResultMeta {
  if (ctx.has(arraySource)) {
    return _UNDEFINED
  }
  ctx.add(arraySource)

  let total = safeArrayLength(arraySource)
  if (level >= params.maxDepth) {
    if (params.ignoreMeta) {
      return _UNDEFINED
    }
    return total === 0
      ? (params.ignoreEmpty ? _UNDEFINED : [VALUE_TYPES.array, []])
      : [VALUE_TYPES.meta, { [params.metaFieldName]: { kind: 'array', length: total } }]
  }

  ++level
  let ignored = 0
  const receiver: any[] = []

  for (let i = 0; i < total; ++i) {
    if (ctx.isFull(receiver.length)) {
      break
    }
    let value: any
    try {
      value = arraySource[i]
    } catch { /**/ }
    const result = inspectAny(value, params, ctx, level)
    if (result[0] === VALUE_TYPES.undefined) {
      ++ignored
    }
    else {
      receiver.push(result[1])
      ctx.increment()
    }
  }

  total -= ignored
  if (total > receiver.length && !params.ignoreMeta) {
    receiver.push({ [params.metaFieldName]: { kind: 'array', total, truncated: total - receiver.length } })
    ctx.increment()
  }

  if (receiver.length > 0 || !params.ignoreEmpty) {
    return [VALUE_TYPES.array, receiver]
  }
  return _UNDEFINED
}

function inspectDetail (likeSource: { detail: IErrorDetail }, params: SerializationParameters, ctx: SerializationContext, level: 0 | number): TSerResultUndefined | TSerResultObject | TSerResultMeta {
  if (ctx.has(likeSource)) {
    return _UNDEFINED
  }
  ctx.add(likeSource)

  let detailSource!: IErrorDetail
  try {
    detailSource = likeSource.detail
  } catch { /**/ }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof detailSource !== 'object' || detailSource === null || ctx.has(detailSource)) {
    return _UNDEFINED
  }
  ctx.add(detailSource)

  if (level >= params.maxDepth) {
    return params.ignoreMeta
      ? _UNDEFINED
      : [VALUE_TYPES.meta, { [params.metaFieldName]: ensureErrorMeta(detailSource, params.maxStringLength) }]
  }

  ++level
  const keys: string[] = Object.keys(detailSource)
  let total = keys.length
  let count = 0
  let ignored = 0
  const exists: Set<string> = new Set(keys)
  const receiver: Record<string, any> = {}

  // Читаем ключи в строгом порядке

  // Есть ли значение вообще
  if (exists.delete('name')) {
    // Если оно запрещено, то сразу отнимаем счетчик
    if (!params.test('name')) {
      ++ignored
    }
    // Если нет места, то счетчик отнимать нельзя
    else if (ctx.hasSpace(count)) {
      if (safeReadStringInto(detailSource, receiver, 'name', null, false)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  if (exists.delete('message')) {
    if (!params.test('message')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      if (safeReadStringInto(detailSource, receiver, 'message', params.maxStringLength, false)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  if (exists.delete('code')) {
    if (!params.test('code')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      if (safeReadCodeInto(detailSource, receiver)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  const includeStack = params.test('stack')
  const hasSpace = ctx.hasSpace(count)
  // Пытаемся прочитать пользовательский stack
  if (exists.delete('stack')) {
    if (!includeStack) {
      ++ignored
    }
    else if (hasSpace) {
      if (safeReadStackInto(detailSource, receiver, params.maxStringLength, params.keepStackHeader)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  // ... иначе, если это нативная ошибка - читаем напрямую
  else if (includeStack && hasSpace && ('stack' in likeSource) && safeReadStackInto(likeSource, receiver, params.maxStringLength, params.keepStackHeader)) {
    ctx.increment()
    ++count
  }
  if (exists.delete('cause')) {
    if (!params.test('cause')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      let value: any
      try {
        value = detailSource.cause
      } catch { /**/ }
      const result = inspectAny(value, params, ctx, level)
      if (result[0] === VALUE_TYPES.undefined) {
        ++ignored
      }
      else {
        receiver['cause'] = result[1]
        ctx.increment()
        ++count
      }
    }
  }
  if (exists.delete('level')) {
    if (!params.test('level')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      if (safeReadStringInto(detailSource, receiver, 'level', null, false)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }

  if (ctx.hasSpace(count) && exists.size > 0) {
    const ci = safeReadPropsInto(detailSource, params, ctx, level, count, exists, receiver)
    count = ci[0]
    ignored += ci[1]
  }

  total -= ignored
  if (total > count && !params.ignoreMeta) {
    receiver[params.metaFieldName] = { kind: 'object', total, truncated: total - count }
    ctx.increment()
    ++count
  }

  if (count > 0 || !params.ignoreEmpty) {
    return [VALUE_TYPES.object, receiver]
  }
  return _UNDEFINED
}

function inspectError (errorSource: Error, params: SerializationParameters, ctx: SerializationContext, level: 0 | number): TSerResultUndefined | TSerResultObject | TSerResultMeta {
  if (ctx.has(errorSource)) {
    return _UNDEFINED
  }
  ctx.add(errorSource)

  if (level >= params.maxDepth) {
    return params.ignoreMeta
      ? _UNDEFINED
      : [VALUE_TYPES.meta, { [params.metaFieldName]: ensureErrorMeta(errorSource, params.maxStringLength) }]
  }

  ++level
  const keys: string[] = Object.keys(errorSource)
  let total = keys.length

  const exists: Set<string> = new Set(keys)

  let count = 0
  let ignored = 0
  const receiver: Record<string, any> = {}

  if (exists.delete('name') || ('name' in errorSource)) {
    // Если оно запрещено, то сразу отнимаем счетчик
    if (!params.test('name')) {
      ++ignored
    }
    // Если нет места, то счетчик отнимать нельзя
    else if (ctx.hasSpace(count)) {
      if (safeReadStringInto(errorSource, receiver, 'name', null, false)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  if (exists.delete('message') || ('message' in errorSource)) {
    if (!params.test('message')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      if (safeReadStringInto(errorSource, receiver, 'message', params.maxStringLength, false)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  if (exists.delete('code') || ('code' in errorSource)) {
    if (!params.test('code')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      if (safeReadCodeInto(errorSource, receiver)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  if (exists.delete('stack') || ('stack' in errorSource)) {
    if (!params.test('stack')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      if (safeReadStackInto(errorSource, receiver, params.maxStringLength, params.keepStackHeader)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }
  if (exists.delete('cause') || ('cause' in errorSource)) {
    if (!params.test('cause')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      let value: any
      try {
        value = errorSource.cause
      } catch { /**/ }
      const result = inspectAny(value, params, ctx, level)
      if (result[0] === VALUE_TYPES.undefined) {
        ++ignored
      }
      else {
        receiver['cause'] = result[1]
        ctx.increment()
        ++count
      }
    }
  }
  if (exists.delete('level') || ('level' in errorSource)) {
    if (!params.test('level')) {
      ++ignored
    }
    else if (ctx.hasSpace(count)) {
      if (safeReadStringInto(errorSource, receiver, 'level', null, false)) {
        ctx.increment()
        ++count
      }
      else {
        ++ignored
      }
    }
  }

  if (ctx.hasSpace(count) && exists.size > 0) {
    const ci = safeReadPropsInto(errorSource, params, ctx, level, count, exists, receiver)
    count = ci[0]
    ignored += ci[1]
  }

  total -= ignored
  if (total > count && !params.ignoreMeta) {
    receiver[params.metaFieldName] = { kind: 'object', total, truncated: total - count }
    ctx.increment()
    ++count
  }

  if (count > 0 || !params.ignoreEmpty) {
    return [VALUE_TYPES.object, receiver]
  }
  return _UNDEFINED
}

function inspectAny (anySource: any, params: SerializationParameters, ctx: SerializationContext, level: 0 | number): TSerResult {
  if (anySource === null) {
    return params.ignoreEmpty ? _UNDEFINED : [VALUE_TYPES.null, null]
  }
  const type = typeof anySource
  if (type !== 'object') {
    return _inspectPrimitive(type, anySource, params)
  }

  // Типы Date и RegExp не следует считать объектами
  if (anySource instanceof Date) {
    return inspectDate(anySource, params)
  }

  if (anySource instanceof RegExp) {
    return inspectRegExp(anySource, params)
  }

  // Дальше одни объекты - чтоб лишний раз не входить проверим и здесь
  if (ctx.has(anySource)) {
    return _UNDEFINED
  }

  if (isErrorLike(anySource)) {
    return inspectDetail(anySource, params, ctx, level)
  }

  if (Array.isArray(anySource)) {
    return inspectArray(anySource, params, ctx, level)
  }

  // Любая другая ошибка не связанная с интерфейсами ErrorLike
  // NOTE Error.isError(), пока это малодоступно https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError
  if (anySource instanceof Error) {
    return inspectError(anySource, params, ctx, level)
  }

  return inspectObject(anySource, params, ctx, level)
}

/**
 * Заворачивает результат сериализации в объект, если тип отличен от ожидаемого(например примитив или массив).
 *
 * **Note:** Эта функция используется после {@link errorLikeToJsonLike()}, {@link nativeErrorToJsonLike()} или {@link errorToJsonLike()}.
 *
 * @param serResult     Результат сериализации.
 * @param metaFieldName Имя поля метаданных.
 * @returns JsonLike объект или обертка {@link TMetaValue}. Объект может быть пустым `{}`.
 */
function ensureSerResultAsObject (serResult: TSerResult, metaFieldName: string): Record<string, any> | TMetaValue {
  const value = serResult[1]
  switch (serResult[0]) {
    case VALUE_TYPES.object:
      return value as Record<string, any>
    case VALUE_TYPES.meta:
      return value as Record<string, any>
    case VALUE_TYPES.null:
      return { [metaFieldName]: { type: 'null', value: null } }
    case VALUE_TYPES.boolean:
      return { [metaFieldName]: { type: 'boolean', value: value } }
    case VALUE_TYPES.number:
      return { [metaFieldName]: { type: 'number', value: value } }
    case VALUE_TYPES.string:
      return { [metaFieldName]: { type: 'string', value: value } }
    case VALUE_TYPES.array:
      return { [metaFieldName]: { type: 'array', value: value } }
    // default: // VALUE_TYPES.undefined
  }
  return {}
}

/**
 * Приводит {@link IErrorLike} к `JsonLike` объекту.
 *
 * Эта функция всегда возвращает `Record<string, any>`, даже если объект пуст.
 *
 * @param error  Должен быть объектом `{ detail: ... }`.
 * @param options Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
 */
function errorLikeToJsonLike (error: { detail: IErrorDetail }, options?: TNullish | TSerializationOptions | SerializationParameters): Record<string, any> {
  const params = ensureSerializationParameters(options)
  const result = inspectDetail(error, params, new SerializationContext(params.maxTotalItems, params.maxItems), 0)
  return ensureSerResultAsObject(result, params.metaFieldName)
}

/**
 * Извлекает `name`, `message`, `stack`, `cause` и перечисляемые свойства из стандартной ошибки.
 *
 * Эта функция всегда возвращает `Record<string, any>`, даже если ошибка пуста.
 *
 * @param error   Должен быть типом {@link Error}.
 * @param options Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
 */
function nativeErrorToJsonLike (error: Error, options?: TNullish | TSerializationOptions | SerializationParameters): Record<string, any> {
  const params = ensureSerializationParameters(options)
  const result = inspectError(error, params, new SerializationContext(params.maxTotalItems, params.maxItems), 0)
  return ensureSerResultAsObject(result, params.metaFieldName)
}

/**
 * Универсальная функция извлечения `JsonLike` объекта из ошибки.
 *
 * Эта функция всегда возвращает `Record<string, any>`, даже если объект или значение оказались пустыми. Если значение
 * ненулевое и не может быть приведено к объекту - объект будет приведен к {@link TMetaValue}.
 *
 * @param anyValue Предполагаемая ошибка.
 * @param options  Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
 */
function errorToJsonLike (anyValue: any, options?: TNullish | TSerializationOptions | SerializationParameters): Record<string, any> | TMetaValue {
  const params = ensureSerializationParameters(options)
  const result = inspectAny(anyValue, params, new SerializationContext(params.maxTotalItems, params.maxItems), 0)
  return ensureSerResultAsObject(result, params.metaFieldName)
}

/**
 * Форматирует {@link IErrorLike} к строке.
 *
 * Эта функция всегда возвращает строку, даже если объект пуст.
 *
 * @param error   Должен быть объектом `{ detail: ... }`.
 * @param options Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
 */
function errorLikeToToString (error: { detail: IErrorDetail }, options?: TNullish | TSerializationOptions | SerializationParameters): string {
  const json = errorLikeToJsonLike(error, options)
  const receiver: string[] = []
  jsonObjectInto(json, receiver, 0)
  return receiver.join('\n')
}

/**
 * Пытается извлечь строку из стандартной ошибки JS `Error`.
 *
 * Эта функция всегда возвращает строку, даже если ошибка пуста.
 *
 * @param error   Должен быть типом {@link Error}.
 * @param options Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
 */
function nativeErrorToString (error: Error, options?: TNullish | TSerializationOptions | SerializationParameters): string {
  const json = nativeErrorToJsonLike(error, options)
  const receiver: string[] = []
  jsonObjectInto(json, receiver, 0)
  return receiver.join('\n')
}

/**
 * Универсальная функция извлечения строки из любого типа.
 *
 * Эта функция всегда возвращает строку, даже если объект или значение оказались пустыми.
 *
 * @param anyValue Предполагаемая ошибка.
 * @param options  Пользовательские опции {@link TSerializationOptions} или {@link SerializationParameters}.
 */
function errorToString (anyValue: any, options?: TNullish | TSerializationOptions | SerializationParameters): string {
  const json = errorToJsonLike(anyValue, options)
  const receiver: string[] = []
  jsonObjectInto(json, receiver, 0)
  return receiver.join('\n')
}

export {
  type IErrorLike as _IErrorLike,
  //
  type TValueTypes,
  VALUE_TYPES,
  type TSerResultUndefined,
  type TSerResultPrimitive,
  type TSerResultObject,
  type TSerResultArray,
  type TSerResultMeta,
  type TSerResult,
  isErrorLike,
  SerializationContext,
  jsonPropInto,
  jsonObjectInto,
  jsonArrayInto,
  ensureErrorMeta,
  safeArrayLength,
  safeReadCodeInto,
  safeReadStackInto,
  safeReadStringInto,
  safeReadPropsInto,
  inspectPrimitive,
  inspectDate,
  inspectRegExp,
  inspectObject,
  inspectArray,
  inspectDetail,
  inspectError,
  inspectAny,
  ensureSerResultAsObject,
  errorLikeToJsonLike,
  nativeErrorToJsonLike,
  errorToJsonLike,
  errorLikeToToString,
  nativeErrorToString,
  errorToString
}
