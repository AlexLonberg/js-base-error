import { defineConfig } from 'eslint/config'
import jsEslint from '@eslint/js'
import tsEslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

const jsRules = jsEslint.configs.recommended.rules
const tsRules = tsEslint.configs.strictTypeChecked.reduce(
  (a, item) => (item.rules ? (a = { ...a, ...item.rules }) : a, a),
  {}
)

const rules = {
  ...jsRules,
  ...tsRules,
  // Это правило `a === b` не установлено в jsEslint.configs.recommended и вероятно во всех плагинах.
  eqeqeq: [
    'error',
    'always'
  ],
  // Разрешаем пустые блоки только в catch (ex) {}
  'no-empty': ['error', { allowEmptyCatch: true }],
  // Правила для JS путают сигнатуры типов(например функций) с реальными, их следует отключить
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', {
    vars: 'all',
    varsIgnorePattern: '^_',
    args: 'all',
    argsIgnorePattern: '^_',
    caughtErrors: 'all',
    caughtErrorsIgnorePattern: '^_'
  }],
  // Не дает использовать type и предлагает явно interface
  '@typescript-eslint/consistent-type-definitions': 'off',
  // Требовать импорта типов как 'import {type Foo} from ...'
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
  // Требует Record<A, B> или наоборот, вместо {[k: A]: B}
  '@typescript-eslint/consistent-indexed-object-style': 'off',
  // Требует заменить `if(!value) value = ...` на `value ??= ...`, что не всегда очевидно - ignoreIfStatements
  // Не дает использовать в условных выражениях if( || ) - ignoreConditionalTests
  'prefer-nullish-coalescing': 'off',
  '@typescript-eslint/prefer-nullish-coalescing': ['error', {
    // allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: true,
    // ignoreBooleanCoercion: true,
    // ignoreConditionalTests: true,
    // ignoreIfStatements: true,
    // ignoreMixedLogicalExpressions: true,
    // ignorePrimitives: true,
    ignoreTernaryTests: true
  }],
  // Не дает явно объявить тип параметра `once: boolean = false`, считая что это лишнее.
  '@typescript-eslint/no-inferrable-types': 'off',
  // Требует вместо for/i использовать for/of.
  '@typescript-eslint/prefer-for-of': 'off',
  // Не дает использовать геттеры в литеральных свойствах классов вроде `get [Symbol.toStringTag] () { return 'Foo' }`
  '@typescript-eslint/class-literal-property-style': 'off',
  // По умолчанию(constructor) не дает определить аннотации слева(map: Map<> = new Map()),
  // но этого требует правило TS(--isolatedDeclarations)
  '@typescript-eslint/consistent-generic-constructors': ['error', 'type-annotation'],
  // Заставляет использовать ненулевое утверждение(!), вместо `as`, но ошибается в типах.
  '@typescript-eslint/non-nullable-type-assertion-style': 'off',
  // Разрешаем обращение к свойству через точку(foo.bar) или через строку(foo['bar'])
  '@typescript-eslint/dot-notation': 'off',
  // Не дает использовать сигнатуру интерфейса при определении типа функции
  '@typescript-eslint/prefer-function-type': 'off',
  // Не дает использовать любое значение с оператором throw myType
  '@typescript-eslint/only-throw-error': 'off',
  // Разрешает `(...args: any[])`
  '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],

  // Не дает определять самодокументирующиеся типы `(arg: any | 'foo')`
  '@typescript-eslint/no-redundant-type-constituents': 'off',
  // Оба правила не дают написать `void function() {}()`
  '@typescript-eslint/no-meaningless-void-operator': 'off',
  '@typescript-eslint/no-confusing-void-expression': 'off',
  // Это правило не понимает разницы между undefined и полным отсутствием аргумента `(arg?: undefined | string)` и считает это избыточным
  '@typescript-eslint/no-duplicate-type-constituents': 'off',
  // Это правило неверно работает и не понимает как используются дженерики в перегрузках или наследовании классов
  '@typescript-eslint/no-unnecessary-type-parameters': 'off',
  // Не дает поставить комментарии @ts-expect-error и тому подобное
  '@typescript-eslint/ban-ts-comment': ['warn', { 'ts-expect-error': false }],
  // Не дает использовать метод без биндинга
  '@typescript-eslint/unbound-method': 'off',
  // Два правила не дают использовать шаблонную строку без явного приведения типа: `${value:number}`
  '@typescript-eslint/restrict-template-expressions': 'off',
  '@typescript-eslint/no-base-to-string': 'off',
  // В этой библиотеке повсюду неизвестные типы - отключаем все правила связанные с `any`.
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-function-type': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  // Это правило может работать неверно
  '@typescript-eslint/unified-signatures': 'off',
  // Для отключения предупреждений использования оператора debugger
  // 'no-debugger': 'off',
  //
  // ## Стиль ##
  //
  '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
  '@stylistic/no-extra-semi': 'error',
  '@stylistic/arrow-parens': 'error',
  '@stylistic/comma-dangle': 'error',
  '@stylistic/comma-style': ['error', 'last'],
  '@stylistic/no-floating-decimal': 'error',
  '@stylistic/semi-style': ['error', 'last']
}

// DOC eslint    https://eslint.org/docs/latest/use/configure/configuration-files
//     ts        https://typescript-eslint.io/getting-started/
//     stylistic https://eslint.style/rules
export default defineConfig([
  {
    ignores: [
      '.*/**',
      '**/_*',
      'node_modules/**',
      'dist/**'
    ]
  },
  {
    name: 'js-base-error',
    files: [
      'src/**/*.{ts,js}'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsEslint.parser,
      parserOptions: {
        projectService: true
      }
    },
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      '@stylistic': stylistic
    },
    rules
  },
  {
    name: 'js-base-error-tests',
    files: [
      'src/**/*.{test,bench}.ts',
      'scripts/**/*.{ts,js}',
      'eslint.config.js',
      'vitest.config.ts'
    ],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off'
    }
  }
])
