import { describe, test, expect } from 'vitest'

// # Проблемы, которые нужно учесть при чтении свойств и переопределении ленивого detail

describe('problems', () => {
  test('read properties', () => {
    // Опасность чтения аксессоров
    const obj = Object.defineProperties({}, {
      foo: {
        enumerable: true,
        get () {
          throw new Error()
        },
        set (_) {
          //
        }
      },
      bar: {
        enumerable: true,
        value: 123
      }
    })

    // Бросит исключение
    expect(() => Object.entries(obj)).toThrowError(Error)

    // Безопасное чтение
    const keys = Object.keys(obj)
    const receiver = {} as any
    for (const key of keys) {
      try {
        receiver[key] = (obj as any)[key]
      } catch { /**/ }
    }
    expect(receiver).toStrictEqual({ bar: 123 })
  })

  test('secure reading of properties with circular dependencies', () => {
    const hasOwnProperty = Object.prototype.hasOwnProperty
    const actions: string[] = []

    class Base extends Error {
      declare protected _detail: Record<string, any>
      // Ленивое свойство
      get detail (): Record<string, any> {
        actions.push('call get detail()')

        // Обеспечиваем корректность типа
        if (typeof this._detail !== 'object' || this._detail === null) {
          actions.push('ensure this._detail')
          this._detail = {}
        }
        const detail = this._detail

        // До окончания инициализации определяем временную ссылку.
        // Второй вход в наш аксессор невозможен.
        // На всякий случай предотвратим хакерские штучки - наш объект не вызывает ошибок
        if (hasOwnProperty.call(this, 'detail')) {
          actions.push('fallback detail')
          try {
            return this.detail
          } catch {
            return detail
          }
        }

        // Установленные и зарезервированные свойства
        const exists = new Set([...Object.keys(detail), '_detail', 'detail'])

        const ref: { get (): object, proxy?: null | object } = {
          get (): any {
            if (!ref.proxy) {
              actions.push('create Proxy') // NOTE
              ref.proxy = new Proxy(detail, {
                get (_: any, key: string, _receiver: any) {
                  actions.push(`Proxy.get(key:${key})`)
                  return detail[key]
                },
                set (_: any, key: string, value: any, _receiver: any) {
                  actions.push(`Proxy.set(key:${key}, value:${value})`) // NOTE
                  if (key === 'message') {
                    value = `[from Proxy] ${value}`
                  }
                  detail[key] = value
                  exists.add(key) // Помечаем установку
                  return true
                }
              })
            }
            return ref.proxy
          }
        }

        // Проверим возможность добавить свойство - мало ли кому придет в голову заморозить ошибку
        actions.push('before define detail')
        if (Object.isExtensible(this)) {
          actions.push(`define detail for "${this.constructor.name}"`)
          Object.defineProperty(this, 'detail', {
            configurable: false,
            enumerable: false,
            get () { return ref.get() },
            set (_) { /**/ }
          })
        }
        actions.push('after define detail')

        // Читаем все перечислимые свойства и переносим на основной detail
        let cur: any = this
        while (cur && cur !== Base.prototype) {
          const keys = Object.keys(cur)
          for (const key of keys) {
            if (exists.has(key)) {
              continue
            }
            actions.push(`before read key:${key}`)
            if (key === 'message') {
              actions.push(`read key:message from ${cur.constructor.name}`)
            }
            try {
              // Проблема - в этом месте может быть круговой вызов `get detail()`, когда пользовательский класс
              // определил аксессор для записи свойства
              const value = Reflect.get(cur, key, this)
              // Свойство могло быть уже установлено через круговые ссылки
              if (!exists.has(key)) {
                detail[key] = value
                exists.add(key)
              }
              else if (key === 'message') {
                actions.push('skip key:message')
              }
            } catch { /**/ }
          }
          cur = Object.getPrototypeOf(cur)
        }

        // Завершаем инициализацию
        ref.get = () => detail
        ref.proxy = null

        return detail
      }
      set detail (_) {
        // ... игнорируем чтобы не упасть
      }
    }

    class Custom extends Base {
      override name = 'MyCustomError'
      declare message: string
    }
    // Предположим пользователь определяет аксессоры
    Object.defineProperties(Custom.prototype, {
      boom: {
        enumerable: true,
        get () {
          throw new Error('Boom')
        }
      },
      message: { // Круговая зависимость с ленивым свойством, которое невозможно получить до инициализации
        enumerable: true,
        get () {
          const detail = this.detail
          detail.hiddenProp = 'write hiddenProp'
          return detail.message ?? ''
        },
        set (v: string) {
          const detail = this.detail
          detail.message = v
        }
      }
    })

    const error = new Custom()
    error.message = 'error message recording test'

    expect(error.detail).toStrictEqual({
      name: 'MyCustomError',
      hiddenProp: 'write hiddenProp',
      message: 'error message recording test'
    })

    expect(actions).toStrictEqual([
      'call get detail()',
      'ensure this._detail',
      'before define detail',
      'define detail for "Custom"',
      'after define detail',
      'before read key:name',
      'before read key:boom',
      'before read key:message',
      'read key:message from Custom',
      'create Proxy',
      'Proxy.set(key:hiddenProp, value:write hiddenProp)',
      'Proxy.get(key:message)'
    ])
  })

  test('extensible', () => {
    // Безопасное расширение ленивых свойств

    const frozen = Object.freeze({ foo: 'bar' })
    const nonExpandable = Object.preventExtensions({ foo: 'bar' })
    const sealed = Object.seal({ foo: 'bar' })

    expect(Object.isFrozen(frozen)).toBe(true)
    expect(Object.isExtensible(frozen)).toBe(false)
    expect(Object.isSealed(frozen)).toBe(true)

    expect(Object.isFrozen(nonExpandable)).toBe(false)
    expect(Object.isExtensible(nonExpandable)).toBe(false)
    expect(Object.isSealed(nonExpandable)).toBe(false)

    expect(Object.isFrozen(sealed)).toBe(false)
    expect(Object.isExtensible(sealed)).toBe(false)
    expect(Object.isSealed(sealed)).toBe(true)

    // Неочевидное поведение - те же операции, но отсутствие хотя бы одного изменяемого свойства делает объект полностью
    // замороженным.
    const frozenEmpty = Object.freeze({})
    const nonExpandableEmpty = Object.preventExtensions({})
    const sealedEmpty = Object.seal({})

    expect(Object.isFrozen(frozenEmpty)).toBe(true)
    expect(Object.isExtensible(frozenEmpty)).toBe(false)
    expect(Object.isSealed(frozenEmpty)).toBe(true)

    expect(Object.isFrozen(nonExpandableEmpty)).toBe(true) // <= !!!
    expect(Object.isExtensible(nonExpandableEmpty)).toBe(false)
    expect(Object.isSealed(nonExpandableEmpty)).toBe(true) // <= !!!

    expect(Object.isFrozen(sealedEmpty)).toBe(true) // <= !!!
    expect(Object.isExtensible(sealedEmpty)).toBe(false)
    expect(Object.isSealed(sealedEmpty)).toBe(true)

    // Для проверки безопасного затенения ленивого detail - достаточно проверить его наличие и isExtensible()
    const proto = Object.defineProperty({}, 'detail', {
      enumerable: false,
      get () {
        return {}
      },
      set (_) {
        //
      }
    })
    const insLazyError = Object.create(proto, { name: { value: 'Error' } }) as any
    const insError = Object.create(proto, { detail: {} }) as any

    if (!Object.hasOwn(insLazyError, 'detail') && Object.isExtensible(insLazyError)) {
      Object.defineProperty(insLazyError, 'detail', { get () { return {} } })
    }
    else {
      throw new Error('Test Error')
    }

    // Это не должно сработать
    if (!Object.hasOwn(insError, 'detail') && Object.isExtensible(insError)) {
      throw new Error('Test Error')
    }
  })

  test('copying descriptors', () => {
    function getValue (this: { _value: number }) {
      return this._value
    }

    const descriptors = Object.freeze({
      getValue: {
        value: getValue
      },
      accGetSet: {
        get () {
          return (this as any)._value
        },
        set (v: number) {
          (this as any)._value = v
        }
      }
    })

    class Foo {
      declare getValue: (this: this) => number
      declare accGetSet: number
      _value = 0
    }
    Object.defineProperties(Foo.prototype, descriptors)

    const ins = new Foo()

    expect(ins.getValue()).toBe(0)
    ins.accGetSet = 1
    expect(ins.accGetSet).toBe(1)
    expect(ins.getValue()).toBe(1)

    const refGetValue = Object.getOwnPropertyDescriptor(Foo.prototype, 'getValue')?.value
    expect(refGetValue).toBe(getValue)

    // Аксессоры сохраняют оригинальные ссылки на определения как и функция в свойстве данных
    const ds = Object.getOwnPropertyDescriptor(Foo.prototype, 'accGetSet')!
    expect(ds.get).toBe(descriptors.accGetSet.get)
    expect(ds.set).toBe(descriptors.accGetSet.set)
    expect(ds).not.toBe(descriptors.accGetSet)
  })
})
