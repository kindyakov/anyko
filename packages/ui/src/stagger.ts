// Literal classes so Tailwind can see them; later items share the last delay.
const delays = [
  '[animation-delay:0ms]',
  '[animation-delay:50ms]',
  '[animation-delay:100ms]',
  '[animation-delay:150ms]',
  '[animation-delay:200ms]',
  '[animation-delay:250ms]',
  '[animation-delay:300ms]',
  '[animation-delay:350ms]',
];

export function stagger(index: number) {
  return delays[Math.min(index, delays.length - 1)] ?? '';
}
