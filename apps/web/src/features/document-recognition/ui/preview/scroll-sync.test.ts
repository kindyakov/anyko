import { expect, test } from 'bun:test';

import { synchronizeScrolling } from './scroll-sync';

function pane(scrollHeight: number, paragraphTop: number, text: string) {
  const viewport = document.createElement('section');
  const content = document.createElement('article');
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  content.append(paragraph);
  viewport.append(content);
  Object.defineProperties(viewport, {
    scrollHeight: { value: scrollHeight },
    clientHeight: { value: 300 },
  });
  paragraph.getBoundingClientRect = () =>
    new DOMRect(0, paragraphTop - viewport.scrollTop, 200, 20);
  return {
    viewport,
    content,
    scroll(top: number) {
      viewport.scrollTop = top;
      viewport.dispatchEvent(new Event('scroll'));
    },
  };
}

test('sync aligns the matching paragraph in both directions and unsubscribes when disabled', () => {
  const original = pane(1300, 200, 'Первая строка общего абзаца');
  const recognized = pane(2300, 700, 'Первая строка общего абзаца.');
  const stop = synchronizeScrolling(original, recognized);
  try {
    original.scroll(200);
    expect(recognized.viewport.scrollTop).toBe(700);
    recognized.scroll(700); // Event dispatched by the linked scroll.
    expect(original.viewport.scrollTop).toBe(200);
    recognized.scroll(350);
    expect(original.viewport.scrollTop).toBe(100);
  } finally {
    stop();
  }
  original.scroll(400);
  expect(recognized.viewport.scrollTop).toBe(350);
});

test('sync uses relative progress when there are no matching blocks', () => {
  const original = pane(1300, 200, 'Первая строка оригинала');
  const recognized = pane(2300, 700, 'Текст отличается от оригинала');
  const stop = synchronizeScrolling(original, recognized);
  try {
    original.scroll(250);
    expect(recognized.viewport.scrollTop).toBe(500);
    original.scroll(1000);
    expect(recognized.viewport.scrollTop).toBe(2000);
  } finally {
    stop();
  }
});
