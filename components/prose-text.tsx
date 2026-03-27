"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface ProseTextProps {
  content: string;
  className?: string;
}

export function ProseText({ content, className }: ProseTextProps) {
  if (!content) return null;

  return (
    <div className={cn("prose-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <p className="text-sm font-semibold text-foreground">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="text-sm font-semibold text-foreground">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="text-sm font-semibold text-foreground">{children}</p>
          ),
          p: ({ children }) => (
            <p className="mt-1.5 text-sm leading-6 text-inherit first:mt-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mt-1.5 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>
          ),
          li: ({ children }) => <li className="text-sm leading-6">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ children }) => <span>{children}</span>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
