import { describe, test, expect } from 'vitest'
//
import {
  ReadonlySetImpl,
  type TSerializationOptions,
  type TNormalizedSerializationOptions,
  DEFAULT_SERIALIZATION_OPTIONS,
  normalizeSerializationOptions,
  SerializationParameters,
  ensureSerializationParameters
} from './options.ts'

describe('options', () => {
  test('ReadonlySetImpl', () => {
    const set = new ReadonlySetImpl()
    expect([...set]).toStrictEqual([])
    set.add('foo')
    expect([...set]).toStrictEqual([])
    set._internalAdd('foo')
    expect([...set]).toStrictEqual(['foo'])
  })

  test('normalizeSerializationOptions: returns defaults for null or undefined input', () => {
    expect(normalizeSerializationOptions(null)).toStrictEqual(DEFAULT_SERIALIZATION_OPTIONS)
    expect(normalizeSerializationOptions(undefined)).toStrictEqual(DEFAULT_SERIALIZATION_OPTIONS)
    expect(normalizeSerializationOptions({})).toStrictEqual(DEFAULT_SERIALIZATION_OPTIONS) // Empty object
  })

  test('normalizeSerializationOptions: normalizes integer values with min/max bounds', () => {
    const options: TSerializationOptions = {
      maxDepth: 0, // Below min 1 -> 1
      maxItems: 300, // Above max 256 -> 256
      maxTotalItems: -10, // Invalid -> min 128
      maxStringLength: 'invalid' as any // Invalid -> default
    }

    const normalized: TNormalizedSerializationOptions = normalizeSerializationOptions(options)

    expect(normalized.maxDepth).toBe(1)
    expect(normalized.maxItems).toBe(1) // = maxTotalItems
    expect(normalized.maxTotalItems).toBe(1) // min: 1
    expect(normalized.maxStringLength).toBe(512)
  })

  test('normalizeSerializationOptions: handles include and exclude as strings or arrays', () => {
    const options1: TSerializationOptions = {
      include: 'field1',
      exclude: ['field2', 'field3']
    }
    const norm1 = normalizeSerializationOptions(options1)
    expect([...norm1.include!]).toStrictEqual(['field1'])
    expect([...norm1.exclude!]).toStrictEqual(['field2', 'field3', 'stack'])

    const options2: TSerializationOptions = {
      include: ['fieldA', 'fieldB'],
      exclude: 'fieldB' // Should remove from include
    }
    const norm2 = normalizeSerializationOptions(options2)
    expect([...norm2.include!]).toStrictEqual(['fieldA'])
    expect([...norm2.exclude!]).toStrictEqual(['fieldB', 'stack'])
  })

  test('normalizeSerializationOptions: handles includeStack priority and stack in include/exclude', () => {
    // includeStack true has priority, removes 'stack' from exclude if present
    const options1: TSerializationOptions = {
      includeStack: true,
      exclude: 'stack'
    }
    const norm1 = normalizeSerializationOptions(options1)
    expect(norm1.includeStack).toBe(true)
    expect(norm1.exclude?.has('stack')).toBe(false) // deleted from exclude
    expect(norm1.include).toBe(null)

    // includeStack false has priority, removes 'stack' from include if present, but does not create exclude if null
    const options2: TSerializationOptions = {
      includeStack: false,
      include: 'stack'
    }
    const norm2 = normalizeSerializationOptions(options2)
    expect(norm2.includeStack).toBe(false)
    expect(norm2.include?.has('stack')).toBe(false) // deleted from include
    expect(norm2.exclude).toBe(null) // not created

    // Default: includeStack false, no changes to null sets
    const options3: TSerializationOptions = {}
    const norm3 = normalizeSerializationOptions(options3)
    expect(norm3.includeStack).toBe(false)
    expect(norm3.include).toBe(null)
    expect(norm3.exclude).toBe(null)

    // includeStack true, adds to include only if include exists, but flag is set
    const options4: TSerializationOptions = {
      includeStack: true
    }
    const norm4 = normalizeSerializationOptions(options4)
    expect(norm4.includeStack).toBe(true)
    expect(norm4.include).toBe(null) // not created
    expect(norm4.exclude).toBe(null)

    // includeStack false, adds to exclude only if exclude exists
    const options5: TSerializationOptions = {
      includeStack: false
    }
    const norm5 = normalizeSerializationOptions(options5)
    expect(norm5.includeStack).toBe(false)
    expect(norm5.include).toBe(null)
    expect(norm5.exclude).toBe(null)

    // Case where include is created implicitly? No, but if include exists without stack
    const options6: TSerializationOptions = {
      include: ['other']
    }
    const norm6 = normalizeSerializationOptions(options6)
    expect(norm6.includeStack).toBe(false) // default since no stack in include/exclude
    expect(norm6.include?.has('stack')).toBe(false)
    expect(norm6.exclude).toBe(null)
  })

  test('normalizeSerializationOptions: ignoreEmpty defaults to false, sets to boolean', () => {
    expect(normalizeSerializationOptions({ ignoreEmpty: true }).ignoreEmpty).toBe(true)
    expect(normalizeSerializationOptions({ ignoreEmpty: 'invalid' as any }).ignoreEmpty).toBe(false)
  })

  test('normalizeSerializationOptions: metaFieldName defaults to __meta, min length', () => {
    expect(normalizeSerializationOptions({ metaFieldName: '' }).metaFieldName).toBe('__meta')
    expect(normalizeSerializationOptions({ metaFieldName: 'custom' }).metaFieldName).toBe('custom')
    expect(normalizeSerializationOptions({ metaFieldName: 123 as any }).metaFieldName).toBe('__meta')
  })

  test('normalizeSerializationOptions: filters non-string items in include/exclude', () => {
    const options: TSerializationOptions = {
      include: ['valid', 123 as any, null as any],
      exclude: [true as any, 'invalid']
    }
    const norm = normalizeSerializationOptions(options)
    expect([...norm.include!]).toStrictEqual(['valid'])
    expect([...norm.exclude!]).toStrictEqual(['invalid', 'stack'])
  })

  test('SerializationParameters: constructor normalizes options', () => {
    const params = new SerializationParameters({
      maxDepth: 5,
      includeStack: true
    })

    expect(params.maxDepth).toBe(5)
    expect(params.includeStack).toBe(true)
    expect(params.include).toBe(null) // Default
  })

  test('SerializationParameters: freezes sets if freezeParams true', () => {
    const params = new SerializationParameters({
      include: ['a', 'b']
    })

    expect(params.include).toBeInstanceOf(Set)
    expect(params.include?.has('a')).toBe(true);

    // Frozen: modifications ignored
    (params.include as Set<string>).add('c')
    expect(params.include?.has('c')).toBe(false)
  })

  test('SerializationParameters: default creation', () => {
    const defaults = SerializationParameters.createDefault()
    expect(defaults.maxDepth).toBe(2)
    expect(defaults.includeStack).toBe(false)
  })

  test('SerializationParameters: test method checks fields correctly', () => {
    const params = new SerializationParameters({
      include: ['allowed', 'stack'],
      exclude: ['excluded'],
      includeStack: true
    })

    expect(params.test('allowed')).toBe(true)
    expect(params.test('excluded')).toBe(false)
    expect(params.test('stack')).toBe(true) // includeStack true
    expect(params.test('unknown')).toBe(false) // Since include is set, only included allowed

    const paramsNoInclude = new SerializationParameters({
      exclude: ['excluded']
    })
    expect(paramsNoInclude.test('unknown')).toBe(true) // No include -> all except exclude
    expect(paramsNoInclude.test('stack')).toBe(false) // Default !includeStack
  })

  test('ensureSerializationParameters: returns instance if already SerializationParameters', () => {
    const instance = new SerializationParameters()
    expect(ensureSerializationParameters(instance)).toBe(instance) // Same reference
  })

  test('ensureSerializationParameters: creates new if not instance', () => {
    const options: TSerializationOptions = { maxDepth: 3 }
    const result = ensureSerializationParameters(options)
    expect(result).toBeInstanceOf(SerializationParameters)
    expect(result.maxDepth).toBe(3)

    expect(ensureSerializationParameters(undefined)).toBeInstanceOf(SerializationParameters)
    expect(ensureSerializationParameters(undefined).maxDepth).toBe(2)
  })

  test('ensureSerializationParameters: handles null', () => {
    const result = ensureSerializationParameters(null)
    expect(result).toBeInstanceOf(SerializationParameters)
    expect(result.maxDepth).toBe(2)
  })
})
