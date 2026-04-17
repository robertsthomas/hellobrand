"use client";

/**
 * This file renders the document attachment preview experience.
 * It handles preview loading and client-side display state while parsing and extraction stay outside the component.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  Minus,
  Plus,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";

type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
  destroy?: () => void;
  cleanup?: () => void;
};

type PdfPageLike = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{
    items: Array<{ str?: string }>;
  }>;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    transform?: [number, number, number, number, number, number];
  }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
};

type PdfRenderTaskLike = {
  promise: Promise<void>;
  cancel?: () => void;
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function renderHighlightedText(text: string, query: string) {
  if (!query) {
    return text;
  }

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="bg-[#fde68a] px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function MatchNavigator({
  matchCount,
  activeIndex,
  onPrevious,
  onNext,
}: {
  matchCount: number;
  activeIndex: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPrevious}
        disabled={matchCount === 0}
        className="inline-flex h-9 w-9 items-center justify-center border border-black/10 bg-white text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous match"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={matchCount === 0}
        className="inline-flex h-9 w-9 items-center justify-center border border-black/10 bg-white text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next match"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="min-w-[72px] text-right text-[11px] font-medium text-muted-foreground">
        {matchCount === 0 ? "No matches" : `${activeIndex + 1} / ${matchCount}`}
      </span>
    </div>
  );
}

function PdfPageCanvas({
  pdfDocument,
  pageNumber,
  isSearchMatch,
  zoomLevel,
  registerRef,
}: {
  pdfDocument: PdfDocumentLike;
  pageNumber: number;
  isSearchMatch: boolean;
  zoomLevel: number;
  registerRef: (pageNumber: number, element: HTMLDivElement | null) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<PdfRenderTaskLike | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    registerRef(pageNumber, element);
    setContainerWidth(element.clientWidth);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? element.clientWidth;
      setContainerWidth(width);
    });

    observer.observe(element);

    return () => {
      registerRef(pageNumber, null);
      observer.disconnect();
    };
  }, [pageNumber, registerRef]);

  useEffect(() => {
    let cancelled = false;

// fallow-ignore-next-line complexity
    async function renderPage() {
      if (!canvasRef.current || !containerWidth) {
        return;
      }

      try {
        setRenderError(null);

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel?.();
          try {
            await renderTaskRef.current.promise;
          } catch {
            // Ignore cancellations from the previous render before reusing the canvas.
          }
          renderTaskRef.current = null;
        }

        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled || !canvasRef.current) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(Math.min(containerWidth / baseViewport.width, 2.2), 0.4);
        const scale = Math.max(Math.min(fitScale * zoomLevel, 4), 0.25);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) {
          setRenderError("Could not render this PDF page.");
          return;
        }

        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * devicePixelRatio);
        canvas.height = Math.floor(viewport.height * devicePixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderTask = page.render({
          canvasContext: context,
          viewport,
          transform:
            devicePixelRatio !== 1 ? [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] : undefined,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not render this PDF page.";

        if (!cancelled && !/cancelled|canceled/i.test(message)) {
          setRenderError(
            error instanceof Error ? error.message : "Could not render this PDF page."
          );
        }
      } finally {
        if (cancelled) {
          renderTaskRef.current = null;
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [containerWidth, pageNumber, pdfDocument, zoomLevel]);

  return (
    <div
      ref={wrapperRef}
      className={`mx-auto w-full max-w-[860px] border bg-white p-3 sm:p-4 ${
        isSearchMatch ? "border-amber-300 ring-1 ring-amber-200" : "border-black/8"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Page {pageNumber}
        </span>
        {isSearchMatch ? (
          <span className="bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
            Search match
          </span>
        ) : null}
      </div>

      {renderError ? (
        <div className="flex min-h-[240px] items-center justify-center border border-dashed border-black/10 bg-black/[0.02] px-4 text-center text-sm text-muted-foreground">
          {renderError}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <canvas ref={canvasRef} className="mx-auto block border border-black/6" />
        </div>
      )}
    </div>
  );
}

function PdfDocumentPreview({
  previewUrl,
  downloadUrl,
}: {
  previewUrl: string;
  downloadUrl: string;
}) {
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentLike | null>(null);
  const [pageTexts, setPageTexts] = useState<Array<{ pageNumber: number; text: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    let activeDocument: PdfDocumentLike | null = null;

    async function loadDocument() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setPdfDocument(null);
        setPageTexts([]);
        setZoomLevel(1);

        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";

        const response = await fetch(previewUrl);
        if (!response.ok) {
          throw new Error("Could not load this document preview.");
        }

        const bytes = await response.arrayBuffer();
        const loaded = (await pdfjs.getDocument({ data: bytes }).promise) as PdfDocumentLike;
        activeDocument = loaded;

        const texts = await Promise.all(
          Array.from({ length: loaded.numPages }, async (_, index) => {
            const pageNumber = index + 1;
            const page = await loaded.getPage(pageNumber);
            const textContent = await page.getTextContent();
            return {
              pageNumber,
              text: textContent.items.map((item) => item.str ?? "").join(" "),
            };
          })
        );

        if (!cancelled) {
          setPdfDocument(loaded);
          setPageTexts(texts);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load this document preview."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
      activeDocument?.cleanup?.();
      activeDocument?.destroy?.();
    };
  }, [previewUrl]);

  const matchingPages = useMemo(() => {
    const query = normalizeSearchValue(deferredSearchQuery);
    if (!query) {
      return [];
    }

    return pageTexts
      .filter((page) => normalizeSearchValue(page.text).includes(query))
      .map((page) => page.pageNumber);
  }, [deferredSearchQuery, pageTexts]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [deferredSearchQuery]);

  function jumpToMatch(nextIndex: number) {
    if (matchingPages.length === 0) {
      return;
    }

    const boundedIndex = (nextIndex + matchingPages.length) % matchingPages.length;
    setActiveMatchIndex(boundedIndex);
    const pageNumber = matchingPages[boundedIndex];
    pageRefs.current[pageNumber]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function updateZoom(direction: "in" | "out") {
    setZoomLevel((current) => {
      const next = direction === "in" ? current + 0.2 : current - 0.2;
      return Math.max(0.6, Math.min(next, 2.4));
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f8f8f6]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading document…
        </div>
      </div>
    );
  }

  if (errorMessage || !pdfDocument) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f8f8f6] px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          {errorMessage ?? "Could not load this document preview."}
        </p>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-black/8 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder="Search this document"
                className="h-10 border-black/15 bg-[#fcfcfb] pl-10 text-sm text-foreground placeholder:text-black/45 focus-visible:border-black/30 focus-visible:ring-black/10"
              />
            </div>
            <MatchNavigator
              matchCount={matchingPages.length}
              activeIndex={activeMatchIndex}
              onPrevious={() => jumpToMatch(activeMatchIndex - 1)}
              onNext={() => jumpToMatch(activeMatchIndex + 1)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateZoom("out")}
                disabled={zoomLevel <= 0.6}
                className="inline-flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="min-w-[56px] text-center text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {Math.round(zoomLevel * 100)}%
              </div>
              <button
                type="button"
                onClick={() => updateZoom("in")}
                disabled={zoomLevel >= 2.4}
                className="inline-flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {pdfDocument.numPages} page{pdfDocument.numPages === 1 ? "" : "s"}
            </span>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-black/10 bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
            >
              <ExternalLink className="h-4 w-4" />
              Open in new tab
            </a>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8f8f6] px-3 py-4 sm:px-5 sm:py-5">
        <div className="space-y-3 sm:space-y-4">
          {Array.from({ length: pdfDocument.numPages }, (_, index) => {
            const pageNumber = index + 1;

            return (
              <PdfPageCanvas
                key={pageNumber}
                pdfDocument={pdfDocument}
                pageNumber={pageNumber}
                isSearchMatch={matchingPages.includes(pageNumber)}
                zoomLevel={zoomLevel}
                registerRef={(nextPageNumber, element) => {
                  pageRefs.current[nextPageNumber] = element;
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TextDocumentPreview({
  previewUrl,
  downloadUrl,
}: {
  previewUrl: string;
  downloadUrl: string;
}) {
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const response = await fetch(previewUrl);
        if (!response.ok) {
          throw new Error("Could not load this document preview.");
        }

        const text = await response.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load this document preview."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  const normalizedQuery = normalizeSearchValue(deferredSearchQuery);
  const lines = useMemo(() => content.split(/\r?\n/), [content]);
  const matchCount = useMemo(() => {
    if (!normalizedQuery) {
      return 0;
    }

    return lines.filter((line) => normalizeSearchValue(line).includes(normalizedQuery)).length;
  }, [lines, normalizedQuery]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f8f8f6]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading document…
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f8f8f6] px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{errorMessage}</p>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-black/8 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="Search this document"
              className="h-10 border-black/15 bg-[#fcfcfb] pl-10 text-sm text-foreground placeholder:text-black/45 focus-visible:border-black/30 focus-visible:ring-black/10"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {matchCount === 0
                ? "No matches"
                : `${matchCount} matching line${matchCount === 1 ? "" : "s"}`}
            </span>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-black/10 bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20"
            >
              <ExternalLink className="h-4 w-4" />
              Open in new tab
            </a>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8f8f6] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[860px] border border-black/8 bg-white p-4 sm:p-5">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-foreground">
            {lines.map((line, index) => (
              <div
                key={`${index}-${line.length}`}
                className={
                  normalizedQuery && normalizeSearchValue(line).includes(normalizedQuery)
                    ? "bg-[#fff7ed]"
                    : undefined
                }
              >
                {renderHighlightedText(line || " ", normalizedQuery)}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function AttachmentDocumentPreview({
  kind,
  previewUrl,
  downloadUrl,
}: {
  kind: "pdf" | "text";
  previewUrl: string;
  downloadUrl: string;
}) {
  if (kind === "text") {
    return <TextDocumentPreview previewUrl={previewUrl} downloadUrl={downloadUrl} />;
  }

  return <PdfDocumentPreview previewUrl={previewUrl} downloadUrl={downloadUrl} />;
}
