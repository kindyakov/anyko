// Часы процесса. Сценарии получают их аргументом (правила кода: Date.now() и new Date() без
// аргументов внутри domain и application запрещены); тесты подменяют источник времени.
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
