import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  page: number;
  onLoad?: (pageCount: number) => void;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
}

export default function PdfViewer({
  url,
  page,
  onLoad,
  onDimensionsChange,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Store callbacks in refs to avoid dependency issues
  const onLoadRef = useRef(onLoad);
  const onDimensionsChangeRef = useRef(onDimensionsChange);
  const hasCalledOnLoad = useRef(false);
  const lastDimensions = useRef<{ width: number; height: number } | null>(null);

  // Update refs when callbacks change
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  useEffect(() => {
    onDimensionsChangeRef.current = onDimensionsChange;
  }, [onDimensionsChange]);

  // Load PDF document - only depends on url
  useEffect(() => {
    let isCancelled = false;
    hasCalledOnLoad.current = false;

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      setPdfDoc(null);

      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (!isCancelled) {
          setPdfDoc(pdf);
          // Call onLoad only once per PDF load
          if (!hasCalledOnLoad.current && onLoadRef.current) {
            hasCalledOnLoad.current = true;
            onLoadRef.current(pdf.numPages);
          }
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (!isCancelled) {
          setError('Failed to load PDF');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [url]); // Only re-run when URL changes

  // Render current page - only depends on pdfDoc and page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    // Clamp page to valid range
    const pageNum = Math.max(1, Math.min(page, pdfDoc.numPages));

    const renderPage = async () => {
      // Cancel any ongoing render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const pdfPage = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Use a scale for better quality
        const scale = 1.5;
        const viewport = pdfPage.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Report dimensions at scale 1 for measurement calculations
        const unscaledViewport = pdfPage.getViewport({ scale: 1 });
        const newDimensions = {
          width: unscaledViewport.width,
          height: unscaledViewport.height,
        };

        // Only call onDimensionsChange if dimensions actually changed
        if (
          onDimensionsChangeRef.current &&
          (!lastDimensions.current ||
            lastDimensions.current.width !== newDimensions.width ||
            lastDimensions.current.height !== newDimensions.height)
        ) {
          lastDimensions.current = newDimensions;
          onDimensionsChangeRef.current(newDimensions);
        }

        // Scale canvas CSS to show at original size
        canvas.style.width = `${unscaledViewport.width}px`;
        canvas.style.height = `${unscaledViewport.height}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTaskRef.current = pdfPage.render(renderContext);
        await renderTaskRef.current.promise;
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, page]); // Only re-run when document or page changes

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-96 bg-white rounded-lg shadow">
        <div className="text-slate-500">Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-96 bg-white rounded-lg shadow">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="bg-white shadow-lg"
      style={{ display: 'block' }}
    />
  );
}
