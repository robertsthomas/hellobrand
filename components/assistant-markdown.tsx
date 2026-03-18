"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { replaceDashesWithCommas } from "@/lib/assistant/text";

type AssistantMarkdownProps = {
  content: string;
};

export function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  const normalizedContent = replaceDashesWithCommas(content);

  return (
    <div className="space-y-4 text-black/80 dark:text-white/82">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold leading-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold leading-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold leading-tight">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap leading-7">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) => {
            const isBlock = Boolean(className);

            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-md bg-black px-3 py-3 text-sm text-white">
                  {children}
                </code>
              );
            }

            return (
              <code className="rounded bg-black/5 px-1.5 py-0.5 text-[0.95em] text-foreground dark:bg-white/10">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-black/15 pl-4 text-black/70 dark:border-white/15 dark:text-white/72">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-ocean underline underline-offset-2"
            >
              {children}
            </a>
          )
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
