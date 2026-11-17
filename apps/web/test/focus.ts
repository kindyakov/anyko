import { expect } from 'bun:test';

// Testing Library не даёт матчера фокуса, а jest-dom в web не подключён: проверка фокуса собрана здесь.
export function expectFocused(element: Element | null): void {
  expect(document.activeElement).toBe(element);
}
