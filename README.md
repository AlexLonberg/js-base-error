
# 🚀 JS Base Error

Унифицированная система ошибок для `TypeScript`.

    npm i js-base-error

* Базовый класс `BaseError`
* Поддержка вложенных ошибок (`cause`)
* Преобразование чего угодно к строке (`errorToString`)
* Простое расширение через наследование (`class MyError extends BaseError`)

[Использование в зависимых библиотеках 👇](#использование-в-зависимых-библиотеках)

## 🔥 Использование

```ts
import { 
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
} from 'js-base-error'

/** Необязательные коды ошибок. */
const errorCodes = Object.freeze({
  UnknownError: 0,
  ValueError: 1
} as const)
type TErrorCode = typeof errorCodes[keyof typeof errorCodes]

class ValueError extends BaseError<IErrorLike> {
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
// code: 1
// name: MyLib.ValueError
// message: Oh no 😮
// stack:
// ...
// cause:
// 🕷️
```

Для комбинированных ошибок используйте `ErrorLikeCollection`:

```ts
// Можно не создавать экземпляр BaseError, а завернуть ошибку в IErrorLike
const aggregateError = createErrorLike({
  code: 0x1001,
  name: 'MyLib.AggregateError',
  errors: new ErrorLikeCollection('errors', [err1, err2, ...])
}, /* captureStack */ true)

isErrorLike(aggregateError) // true

// Поле массива 'errors' будет приведено к именованным индексам
const asString = `${aggregateError}`
// code: 4097
// name: MyLib.AggregateError
// errors.0:
// ...
// errors.1:
// ...
// stack:
// ...
```

## Использование в зависимых библиотеках

Когда несколько библиотек зависят от одного общего пакета `js-base-error`, рекомендуется указывать его в разделе `peerDependencies` каждой библиотеки. Это необходимо для обеспечения корректной работы функций, таких как `isErrorLike()` и `toString()/toJSON()`, которые опираются на идентичность класса  `BaseError` и прототипа `IErrorLike`. Несогласованность версий или множественные экземпляры `js-base-error` могут нарушить сравнение через `instanceof` и логические проверки типов, приводя к неочевидным ошибкам.

**Подход, рекомендуемый при работе с библиотеками, разделяющими общие классы:**

В библиотеке зависимой от `js-base-error` [peerDependencies](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#peerdependencies):

```json
"peerDependencies": {
  "js-base-error": "0.5.0"
}
```

В основном приложении обеспечьте одну версию `js-base-error` для всех зависимостей через [overrides](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#overrides):

```json
"dependencies": {
  "js-base-error": "0.5.0"
},
"overrides": {
  "js-base-error": "0.5.0"
}
```

Проверить все установленные версии одного пакета можно командой `npm list js-base-error`. Если обнаружено несколько версий, команда покажет дерево зависимостей:

```
my-app@1.0.0
├─┬ my-lib@0.1.0
│ └── js-base-error@0.3.0
└── js-base-error@0.5.0
```

Смотрите так же [npm dedupe](https://docs.npmjs.com/cli/v11/commands/npm-dedupe).
