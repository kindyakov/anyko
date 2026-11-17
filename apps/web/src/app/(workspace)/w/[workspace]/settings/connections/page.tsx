import { ConnectionSettings } from '@/features/connections';

export default function ConnectionsPage() {
  return (
    <>
      <header className="animate-rise mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Настройки пространства
        </h1>
        <p className="text-muted mt-3 max-w-2xl leading-7">
          Подключение модели, которая читает изображения и извлекает сведения.
        </p>
      </header>
      <div className="animate-rise max-w-3xl [animation-delay:60ms]">
        <ConnectionSettings />
      </div>
    </>
  );
}
