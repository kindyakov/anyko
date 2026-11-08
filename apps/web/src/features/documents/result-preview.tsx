'use client';
import { useState } from 'react';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { SegmentedControl } from '@/components/ui/segmented-control';
import { cyrillicMathMacros } from '@/features/documents/cyrillic-math';
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
      <div className="my-5">
        <SegmentedControl
          label="Представление результата"
          value={source ? 'source' : 'preview'}
          onValueChange={(value) => {
            setSource(value === 'source');
          }}
          items={[
            { value: 'preview', label: 'Просмотр' },
            { value: 'source', label: 'Markdown' },
          ]}
        />
      </div>
      {source ? (
        <pre>{markdown || 'В документе не найден текст.'}</pre>
      ) : (
        <div className="[&_h1]:font-heading [&_h2]:font-heading [&_td]:border-line [&_th]:border-line [&_th]:bg-canvas [&_blockquote]:border-brand overflow-x-auto leading-7 wrap-anywhere [&_.katex-display]:overflow-x-auto [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-5 [&_h1]:my-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:my-4 [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-5 [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:overflow-x-auto [&_table]:my-5 [&_table]:border-collapse [&_td]:border [&_td]:p-3 [&_th]:border [&_th]:p-3 [&_ul]:list-disc [&_ul]:pl-6">
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeRaw,
              [rehypeSanitize, schema],
              [
                rehypeKatex,
                {
                  trust: false,
                  macros: { ...cyrillicMathMacros },
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
                    <span className="text-muted text-sm leading-6">
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
