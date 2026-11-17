import { expect, test } from 'bun:test';

import { renderToStaticMarkup } from 'react-dom/server';

import { ResultPreview } from '@/features/document-recognition/result-preview';

test('renders DOCX Cyrillic math symbols without unknown command errors', () => {
  const view = renderToStaticMarkup(
    <ResultPreview
      markdown={
        '$P=P_2 \\cdot \\CYRK\\CYRP\\CYRD$\n\n$P_{\\cyrg\\cyre\\cyro\\cyrm}$'
      }
      images={[]}
      imageUrl={() => ''}
    />,
  );
  expect(view).toContain('>К<');
  expect(view).toContain('>П<');
  expect(view).toContain('>Д<');
  expect(view).not.toContain('color:#cc0000');
});

test('renders headings, GFM and HTML tables, math and only authorized images', () => {
  const view = renderToStaticMarkup(
    <ResultPreview
      markdown={
        '# Title\n\n| Amount | Value |\n|---|---|\n| Total | 123 |\n\n<table><tr><td>Native table</td></tr></table>\n\n$\\frac{1}{2}$\n\n$$\nx^2+y^2=z^2\n$$\n\n![Figure](images/chart.png)\n\n![External](https://example.test/track.png)\n\n<img src="https://example.test/html-track.png" onerror="alert(1)"><script>alert(1)</script>\n\n[bad](javascript:alert(1))'
      }
      images={[{ path: 'images/chart.png' }]}
      imageUrl={(index) =>
        `/api/v1/workspaces/workspace-1/recognitions/test-id/images/${String(index)}`
      }
    />,
  );
  expect(view).toContain('<h1>Title</h1>');
  expect(view).toContain('<table>');
  expect(view).toContain('Native table');
  expect(view).toContain('class="katex"');
  expect(view).toContain('katex-display');
  expect(view).toContain(
    'src="/api/v1/workspaces/workspace-1/recognitions/test-id/images/0"',
  );
  expect(view).not.toContain('src="https://');
  expect(view).not.toContain('<script');
  expect(view).not.toContain('onerror');
  expect(view).not.toContain('href="javascript:');
});

test('keeps an unsupported formula readable and blocks KaTeX external resources', () => {
  const view = renderToStaticMarkup(
    <ResultPreview
      markdown={
        '$\\unknowncommand{x}$\n\n$\\includegraphics{https://example.test/leak.png}$'
      }
      images={[]}
      imageUrl={() => ''}
    />,
  );
  expect(view).toContain('unknowncommand');
  expect(view).not.toContain('<img');
});
