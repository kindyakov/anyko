import { afterEach } from 'bun:test';

import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Registered before testing-library is loaded: it reads `document` and `window` on import.
GlobalRegistrator.register();

const { cleanup } = await import('@testing-library/react');

afterEach(() => {
  cleanup();
});
