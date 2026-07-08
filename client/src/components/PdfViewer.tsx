import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  page: number;
  onPageCountChange: (count: number) => void;
  onDimensionsChange: (dimensions: { width: number; height: number }) => void;
}

export default function PdfViewer({
  url,
  page,
  onPageCountChange,
  onDimensionsChange,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load PDF document
  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (!isCancelled) {
          setPdfDoc(pdf);
          onPageCountChange(pdf.numPages);
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
  }, [url, onPageCountChange]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      // Cancel any ongoing render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const pdfPage = await pdfDoc.getPage(page);
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
        onDimensionsChange({
          width: unscaledViewport.width,
          height: unscaledViewport.height,
        });

        // Scale canvas CSS to show at original size
        canvas.style.width = `${unscaledViewport.width}px`;
        canvas.style.height = `${unscaledViewport.height}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTaskRef.current = pdfPage.render(renderContext);
        await renderTaskRef.current.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
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
  }, [pdfDoc, page, onDimensionsChange]);

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
