'use client';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

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

/** Recognized text rendered as a readable sheet of paper. */
export function ResultPreview({
  markdown,
  images,
}: {
  markdown: string;
  images: { path: string; url: string }[];
}) {
  return (
    <div className="[&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading mx-auto w-full max-w-[860px] rounded-sm bg-white px-6 py-8 text-[15px] leading-7 wrap-break-word text-zinc-800 shadow-[0_1px_0_#ffffff,0_20px_60px_-20px_#000,0_0_0_1px_#0000000d] sm:px-12 sm:py-12 [&_.katex-display]:overflow-x-auto [&_a]:text-[#b0102f] [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#db143c] [&_blockquote]:bg-rose-50/60 [&_blockquote]:py-1 [&_blockquote]:pl-4 [&_h1]:mt-2 [&_h1]:mb-5 [&_h1]:text-[26px] [&_h1]:leading-tight [&_h1]:font-extrabold [&_h1]:text-zinc-950 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-zinc-950 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-zinc-950 [&_hr]:my-6 [&_hr]:border-zinc-200 [&_img]:mx-auto [&_img]:my-5 [&_img]:max-w-full [&_img]:rounded [&_img]:border [&_img]:border-zinc-200 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-100 [&_pre]:p-4 [&_pre]:text-sm [&_strong]:text-zinc-950 [&_table]:my-5 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:min-w-24 [&_td]:border [&_td]:border-zinc-300 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:min-w-24 [&_th]:border [&_th]:border-zinc-300 [&_th]:bg-zinc-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_tr:nth-child(even)_td]:bg-zinc-50 [&_ul]:list-disc [&_ul]:pl-6">
      <div className="overflow-x-auto">
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
                  <span className="inline-block rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-500">
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
    </div>
  );
}
