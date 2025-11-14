import type { TNullish, IErrorDetail } from './types.ts'

/**
 * Статический метод [Error.captureStackTrace(...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace)
 *
 * Безопасная альтернатива явного вызова `Error.captureStackTrace()`. В окружениях, где он
 * отсутствует(если такое вообще возможно), функция становится no-op.
 */
const _captureStackTrace = ((): ((target: object, construct?: TNullish | Function) => void) => {
  try {
    const fn = Reflect.get(Error, 'captureStackTrace')
    if (typeof fn === 'function') {
      const cstBind = fn.bind(Error)
      return function cst (target: any, construct?: TNullish | Function) {
        if (typeof construct !== 'function') {
          construct = cst
        }
        const temp = {} as { stack: string }
        try {
          cstBind(temp, construct)
          target.stack = temp.stack
        } catch { /**/ }
      }
    }
  } catch { /**/ }
  return ((..._: any) => { /**/ })
})()

/**
 * Безопасная альтернатива явного вызова `Error.captureStackTrace()`.
 *
 * @param detail Совместимый {@link IErrorDetail}.
 * @param construct Имя функции, котору надо исключить из стека. Смотри справку [Error.captureStackTrace(...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace)
 * @returns Возвращает аргумент `detail` или, если тип некорректен(не является объектом), новый объект.
 */
function captureStackTrace<T extends IErrorDetail = IErrorDetail> (detail: T, construct?: TNullish | Function): T {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const props = (typeof detail === 'object' && detail !== null)
    ? detail
    : {
      message: 'IErrorDetail was not created',
      level: 'error',
      cause: detail
    } as unknown as T
  _captureStackTrace(props, construct)
  return props
}

export {
  captureStackTrace
}
