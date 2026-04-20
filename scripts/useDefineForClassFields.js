//
// DOC # Определение полей класса и TS-флаг useDefineForClassFields
//
// tsconfig.json - https://www.typescriptlang.org/tsconfig/#useDefineForClassFields
// help - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#the-usedefineforclassfields-flag-and-the-declare-property-modifier
//
// Ранее, по умолчанию, поля класса, определенные как собственные свойства
// class Foo {
//   field = 123
// ... компилировались в конструкцию
// constructor() { this.field = 123
// ... что приводило к неоднозначности определения поля:
//   + определить поле класса на инстансе
//   + или использовать доступный аксессор прототипа
//
// Правильным поведение должно быть определение на инстансе и перекрытие аксессоров
// описание - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Public_class_fields#description
//
// Современные библиотеки не стоит компилировать с целью ниже "target": "es2022".
//
// Вот что получиться если установить цель "target":"es2021" и "useDefineForClassFields":true
// class Foo {
//   constructor(bar) {
//     Object.defineProperty(this, "_bar", {
//       enumerable: true,
//       configurable: true,
//       writable: true,
//       value: void 0
//         });
//     this._bar = bar;
//
// С целью "target":"es2022" и выше
// class Foo {
//   _bar;
//   constructor(bar) {
//     this._bar = bar;

// Ниже пример как это должно работать.
// Если это не так, следует проверить флаг tsconfig.json useDefineForClassFields:true или, при невозможности,
// явно вызывать Object.defineProperty(...) для поля внутри конструктора.

class Foo {
  _name = 'Foo'

  get name () {
    return this._name
  }
  set name (v) {
    this._name = v
  }
}

class Bar extends Foo {
  name = 'Bar'
}

const ins = new Bar()

console.log(ins.name) // 'Bar' <- перекрывает get name()

console.log(('value' in Object.getOwnPropertyDescriptor(ins, 'name')) ? 'ok' : 'failed')
// Аксессоры затенены
console.log(('get' in Object.getOwnPropertyDescriptor(Foo.prototype, 'name')) ? 'ok' : 'failed')
