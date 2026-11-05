import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultPreview } from './result-preview';

test('renders headings, GFM and HTML tables, math and only authorized images', () => {
  const html = renderToStaticMarkup(
    <ResultPreview
      markdown={
        '# Title\n\n| Amount | Value |\n|---|---|\n| Total | 123 |\n\n<table><tr><td>Native table</td></tr></table>\n\n$\\frac{1}{2}$\n\n$$\nx^2+y^2=z^2\n$$\n\n![Figure](images/chart.png)\n\n![External](https://example.test/track.png)\n\n<img src="https://example.test/html-track.png" onerror="alert(1)"><script>alert(1)</script>\n\n[bad](javascript:alert(1))'
      }
      images={[
        { path: 'images/chart.png', url: '/api/documents/test-id/images/0' },
      ]}
    />,
  );
  expect(html).toContain('<h1>Title</h1>');
  expect(html).toContain('<table>');
  expect(html).toContain('Native table');
  expect(html).toContain('class="katex"');
  expect(html).toContain('katex-display');
  expect(html).toContain('src="/api/documents/test-id/images/0"');
  expect(html).not.toContain('src="https://');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('onerror');
  expect(html).not.toContain('href="javascript:');
});

test('keeps an unsupported formula readable and blocks KaTeX external resources', () => {
  const html = renderToStaticMarkup(
    <ResultPreview
      markdown={
        '$\\unknowncommand{x}$\n\n$\\includegraphics{https://example.test/leak.png}$'
      }
      images={[]}
    />,
  );
  expect(html).toContain('unknowncommand');
  expect(html).not.toContain('<img');
});
