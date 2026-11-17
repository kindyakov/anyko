// Знак бренда без ссылки: адрес задаёт место использования (в web — LogoLink с next/link).
export const logoClassName =
  'group focus-visible:outline-brand-hot flex w-fit items-center gap-2.5 rounded-lg text-2xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4';

export function LogoMark() {
  return (
    <>
      <img
        src="/brand/anyko-mark-source.svg"
        width="32"
        height="32"
        alt=""
        className="transition-transform duration-500 group-hover:-rotate-12"
      />
      anyko
      <span className="bg-brand-hot animate-blink ml-0.5 size-1.5 rounded-full shadow-[0_0_8px_#ff3b62]" />
    </>
  );
}
