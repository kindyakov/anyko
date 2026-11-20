export type ScrollSource = {
  viewport: Element;
  content: HTMLElement;
};

type Anchor = { element: Element; text: string };
type Position = { original: number; recognized: number };

function uniqueAnchors(content: HTMLElement) {
  const anchors = new Map<string, Anchor | null>();
  const blocks = content.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, p, li, td, th, [data-scroll-anchor]',
  );
  for (const element of blocks) {
    if (element.querySelector('p, li')) continue;
    const text =
      element.getAttribute('data-scroll-anchor') ?? element.textContent;
    if (!text) continue;
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const page = /^страница \d+$/i.test(text.trim());
    const key = words.slice(0, 5).join(' ');
    if (!page && key.length < 16) continue;
    anchors.set(key, anchors.has(key) ? null : { element, text: key });
  }
  return anchors;
}

function scrollRange(viewport: Element) {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
}

function topInViewport(element: Element, viewport: Element) {
  const doc = viewport.ownerDocument;
  const origin =
    doc.scrollingElement === viewport
      ? 0
      : viewport.getBoundingClientRect().top + viewport.clientTop;
  return element.getBoundingClientRect().top - origin + viewport.scrollTop;
}

function positions(original: ScrollSource, recognized: ScrollSource) {
  const matches = uniqueAnchors(recognized.content);
  const end = {
    original: scrollRange(original.viewport),
    recognized: scrollRange(recognized.viewport),
  };
  let previous = { original: 0, recognized: 0 };
  const anchors: Position[] = [previous];
  for (const match of uniqueAnchors(original.content).values()) {
    const other = match && matches.get(match.text);
    if (!other) continue;
    const point = {
      original: topInViewport(match.element, original.viewport),
      recognized: topInViewport(other.element, recognized.viewport),
    };
    if (
      point.original > previous.original &&
      point.recognized > previous.recognized &&
      point.original < end.original &&
      point.recognized < end.recognized
    ) {
      anchors.push(point);
      previous = point;
    }
  }
  return [...anchors, end];
}

function correspondingTop(
  anchors: Position[],
  from: keyof Position,
  to: keyof Position,
  top: number,
) {
  let low = 0;
  let high = anchors.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if ((anchors[middle]?.[from] ?? Infinity) <= top) low = middle;
    else high = middle;
  }
  const start = anchors[low];
  const end = anchors[high];
  if (!start || !end) return 0;
  const span = end[from] - start[from];
  const ratio = span ? Math.max(0, Math.min(1, (top - start[from]) / span)) : 0;
  return start[to] + ratio * (end[to] - start[to]);
}

export function synchronizeScrolling(
  original: ScrollSource,
  recognized: ScrollSource,
) {
  const sources = { original, recognized };
  const applied = new Map<Element, number>();
  let anchors: Position[] | undefined;
  const invalidate = () => {
    anchors = undefined;
  };
  const resize = new ResizeObserver(invalidate);
  const mutation = new MutationObserver(invalidate);

  const listen = (from: keyof Position, to: keyof Position) => {
    const { viewport, content } = sources[from];
    const target = sources[to].viewport;
    const eventTarget =
      viewport.ownerDocument.scrollingElement === viewport
        ? viewport.ownerDocument
        : viewport;
    resize.observe(viewport);
    resize.observe(content);
    mutation.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const scroll = () => {
      const top = viewport.scrollTop;
      const propagated = applied.get(viewport);
      applied.delete(viewport);
      if (propagated === top || !scrollRange(viewport)) return;
      anchors ??= positions(original, recognized);
      const previous = target.scrollTop;
      target.scrollTop = correspondingTop(anchors, from, to, top);
      // Browsers round scroll offsets; remember the applied value to ignore its event.
      if (target.scrollTop !== previous) applied.set(target, target.scrollTop);
    };
    eventTarget.addEventListener('scroll', scroll, { passive: true });
    return () => {
      eventTarget.removeEventListener('scroll', scroll);
    };
  };
  const stopOriginal = listen('original', 'recognized');
  const stopRecognized = listen('recognized', 'original');
  return () => {
    stopOriginal();
    stopRecognized();
    resize.disconnect();
    mutation.disconnect();
  };
}
