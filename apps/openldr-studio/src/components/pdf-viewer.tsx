import { cn } from "@/lib/utils";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  RotateCw,
  //   Maximize2,
  //   Minimize2,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function PDFViewer({
  className,
  base64Data,
}: {
  className: string;
  base64Data: string;
}) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  //   const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pageInput, setPageInput] = useState<string>("1");
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pdfTitle, setPdfTitle] = useState<string>("");

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
    } else {
      setPageInput(pageNumber.toString());
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = base64Data;
    link.download = pdfTitle || "document.pdf";
    link.click();
  };

  const handlePrint = async () => {
    if (!pdfDocument) return;

    try {
      // Create a hidden iframe for printing
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) return;

      // Create print container
      const printContainer = iframeWindow.document.createElement("div");
      iframeWindow.document.body.appendChild(printContainer);

      // Add styles for printing
      const style = iframeWindow.document.createElement("style");
      style.textContent = `
        @media print {
          body { margin: 0; }
          .print-page { 
            page-break-after: always; 
            page-break-inside: avoid;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
        }
        @page { margin: 0; }
      `;
      iframeWindow.document.head.appendChild(style);

      // Render all pages
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High quality print

        const canvas = iframeWindow.document.createElement("canvas");
        canvas.className = "print-page";
        const context = canvas.getContext("2d");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        printContainer.appendChild(canvas);
      }

      // Trigger print
      iframeWindow.focus();
      iframeWindow.print();

      // Cleanup after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    } catch (error) {
      console.error("Print error:", error);
    }
  };

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2">
        {/* Left section - Title (1/3 width) */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {pdfTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-center shrink-0">
          <Button
            onClick={() => {
              const newPage = Math.max(1, pageNumber - 1);
              setPageNumber(newPage);
              setPageInput(newPage.toString());
            }}
            disabled={pageNumber <= 1 || !isLoaded}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <form
            onSubmit={handlePageInputSubmit}
            className="flex items-center gap-2"
          >
            <Input
              disabled={!isLoaded}
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={() => setPageInput(pageNumber.toString())}
              className="w-12 h-8 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              / {numPages}
            </span>
          </form>

          <Button
            onClick={() => {
              const newPage = Math.min(numPages, pageNumber + 1);
              setPageNumber(newPage);
              setPageInput(newPage.toString());
            }}
            disabled={pageNumber >= numPages || !isLoaded}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="min-h-6 mx-1" />

          <Button
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || !isLoaded}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium text-muted-foreground min-w-15 text-center">
            {Math.round(scale * 100)}%
          </span>

          <Button
            onClick={handleZoomIn}
            disabled={scale >= 3 || !isLoaded}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="min-h-6 mx-1" />

          <Button
            disabled={!isLoaded}
            onClick={handleRotate}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Right controls - Actions (1/3 width) */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <Button
            disabled={!isLoaded}
            onClick={handleDownload}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            disabled={!isLoaded}
            onClick={handlePrint}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Separator />

      {/* PDF Viewer */}
      <div className={cn("flex-1 overflow-auto p-8 ")}>
        <div className="flex justify-center">
          <Document
            file={base64Data}
            onLoadSuccess={async ({ numPages /*, _pdfInfo*/ }) => {
              setNumPages(numPages);
              setPageInput("1");

              // Load PDF document and get metadata
              const loadedPdf = await pdfjs.getDocument(base64Data).promise;
              setPdfDocument(loadedPdf);

              // Get metadata
              const metadata: any = await loadedPdf.getMetadata();

              // Try to get title from metadata
              const title =
                metadata.info?.Title ||
                metadata.metadata?.get("dc:title") ||
                "document.pdf";

              setPdfTitle(title);
              setIsLoaded(true);

              //   // Log all available metadata (for debugging)
              //   console.log("PDF Metadata:", {
              //     title: metadata.info?.Title,
              //     author: metadata.info?.Author,
              //     subject: metadata.info?.Subject,
              //     keywords: metadata.info?.Keywords,
              //     creator: metadata.info?.Creator,
              //     producer: metadata.info?.Producer,
              //     creationDate: metadata.info?.CreationDate,
              //     modificationDate: metadata.info?.ModDate,
              //   });
            }}
            className="shadow-lg"
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              scale={scale}
              rotate={rotation}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
