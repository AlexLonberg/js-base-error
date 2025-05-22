
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
      name: 'Lib.ValueError', 
      code: errorCodes.ValueError, 
      message, 
      cause 
    })
  }
}

const asString = `${new ValueError('Oh no 😮', '🕷️')}`
// name: ValueError
// code: 1
// message: Oh no 😮
// stack:
// ...
// cause:
// 🕷️
```
