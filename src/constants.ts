/**
 * Уникальный идентификатор библиотеки `js-base-error`.
 */
const LIB_ID = 'js-base-error-fa16eee0-6f43-4a9f-b173-039be69e0690'
/**
 * Уникальный глобальный идентификатор символа маркера {@link ERROR_LIKE_MARKER}.
 */
const ERROR_LIKE_MARKER_ID: `${typeof LIB_ID}-error-like-marker` = `${LIB_ID}-error-like-marker`
/**
 * Уникальный маркер универсального класса(его инстанса) ошибок.
 */
const ERROR_LIKE_MARKER: unique symbol = Symbol.for(ERROR_LIKE_MARKER_ID)

export {
  LIB_ID,
  ERROR_LIKE_MARKER_ID,
  ERROR_LIKE_MARKER
}
