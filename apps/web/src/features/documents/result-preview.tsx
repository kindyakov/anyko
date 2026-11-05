'use client';
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', 'language-math', 'math-inline', 'math-display'],
    ],
    td: ['colSpan', 'rowSpan'],
    th: ['colSpan', 'rowSpan'],
  },
};
export function ResultPreview({
  markdown,
  images,
}: {
  markdown: string;
  images: { path: string; url: string }[];
}) {
  const [source, setSource] = useState(false);
  return (
    <>
      <div
        className="result-toolbar"
        role="group"
        aria-label="Представление результата"
      >
        <button
          className="secondary"
          aria-pressed={!source}
          onClick={() => {
            setSource(false);
          }}
        >
          Просмотр
        </button>
        <button
          className="secondary"
          aria-pressed={source}
          onClick={() => {
            setSource(true);
          }}
        >
          Markdown
        </button>
      </div>
      {source ? (
        <pre>{markdown || 'В документе не найден текст.'}</pre>
      ) : (
        <div className="document-preview">
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeRaw,
              [rehypeSanitize, schema],
              [
                rehypeKatex,
                {
                  trust: false,
                  throwOnError: false,
                  maxExpand: 1000,
                  maxSize: 20,
                },
              ],
            ]}
            components={{
              img({ src, alt }) {
                let path = typeof src === 'string' ? src : '';
                try {
                  path = decodeURIComponent(path).replace(/^\.\//, '');
                } catch {
                  path = '';
                }
                const image = images.find((item) => item.path === path);
                if (
                  !image ||
                  !/^\/api\/documents\/[^/]+\/images\/\d+$/.test(image.url)
                )
                  return (
                    <span className="muted">
                      [Изображение недоступно{alt ? `: ${alt}` : ''}]
                    </span>
                  );
                // Private API bytes retain the session without an image optimizer proxy.
                return (
                  <img
                    src={image.url}
                    alt={alt ?? 'Изображение из документа'}
                    loading="lazy"
                  />
                );
              },
              a({ href, children }) {
                return (
                  <a href={href} rel="noreferrer noopener" target="_blank">
                    {children}
                  </a>
                );
              },
            }}
          >
            {markdown || 'В документе не найден текст.'}
          </Markdown>
        </div>
      )}
    </>
  );
}
