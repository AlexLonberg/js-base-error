
# 🚀 JS Base Error

Унифицированная система ошибок для `TypeScript`.

    npm install js-base-error

* Базовый класс `BaseError`
* Поддержка вложенных ошибок (`cause`)
* Преобразование чего угодно к строке (`errorToString`)
* Простое расширение через наследование (`class MyError extends BaseError`)

## 🔥 Использование

```ts
import { 
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
  errorToString
} from 'js-base-error'

/** Коды ошибок. */
const errorCodes = Object.freeze({
  UnknownError: 0,
  ValueError: 1
} as const)
type TErrorCode = typeof errorCodes[keyof typeof errorCodes]

class ValueError extends BaseError<IErrorLike<TErrorCode>> {
  constructor(message: string, cause?: unknown) {
    super({ 
      name: 'MyLib.ValueError', 
      code: errorCodes.ValueError, 
      message, 
      cause 
    })
  }
}

const asString = `${new ValueError('Oh no 😮', '🕷️')}`
// name: MyLib.ValueError
// code: 1
// message: Oh no 😮
// stack:
// ...
// cause:
// 🕷️
```

Для комбинированных ошибок используйте `ErrorLikeCollection`:

```ts
// Мы можем не создавать экземпляр BaseError
// а завернуть ошибку в IErrorLike с методом toString()
const aggregateError = createErrorLike({
  code: 0x1001,
  name: 'MyLib.AggregateError',
  errors: new ErrorLikeCollection('errors', [err1, err2, ...])
}, /* captureStack */ true)

isErrorLike(aggregateError) // true

// Поле массива 'errors' будет приведено к именованным индексам
const asString = `${aggregateError}`
// name: MyLib.AggregateError
// code: 4097
// errors.0:
// ...
// errors.1:
// ...
// stack:
// ...
```
