// Адреса разделов. Feature не знает, на каком маршруте её показывают, поэтому ссылки строятся здесь.
// На этапе #9 адреса получат префикс рабочей области /w/[workspace].
export const routes = {
  works: () => '/' as const,
  work: (id: string) => `/works/${id}` as const,
  recognition: () => '/documents' as const,
};
