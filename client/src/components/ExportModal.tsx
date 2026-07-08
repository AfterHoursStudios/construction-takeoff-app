import { useState, useMemo } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';
import { useProjectStore } from '../stores/projectStore';
import { formatMeasurement } from '../utils/format';
import type { Measurement, MeasurementSubtraction, PlanNote, QuickMeasurement, Point, PageScale } from '../types';
import pdfLogo from '../assets/pdflogo.png';
import headerLogo from '../assets/headerlogo.png';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface ExportModalProps {
  onClose: () => void;
}

interface ExportOptions {
  companyName: string;
  preparedBy: string;
  includePageNumbers: boolean;
  includeMaterialTotals: boolean;
  includeMarkedPages: boolean;
}

// Helper function to calculate net value (gross - subtractions)
function calculateNetValue(measurement: Measurement): number {
  const subtractionTotal = (measurement.subtractions || []).reduce((sum, s) => sum + s.value, 0);
  return measurement.value - subtractionTotal;
}

// Helper function to calculate segment value
function calculateSegmentValue(segment: Point[], measurementType: string): number {
  if (measurementType === 'linear') {
    let total = 0;
    for (let i = 1; i < segment.length; i++) {
      const dx = segment[i].x - segment[i - 1].x;
      const dy = segment[i].y - segment[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  } else if (measurementType === 'area') {
    if (segment.length < 3) return 0;
    let area = 0;
    const n = segment.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += segment[i].x * segment[j].y;
      area -= segment[j].x * segment[i].y;
    }
    return Math.abs(area) / 2;
  }
  return 1; // count
}

// Helper function to draw subtractions on a canvas context
function drawSubtractionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  subtractions: MeasurementSubtraction[],
  measurementType: string,
  unit: string,
  pageScale: PageScale | null,
  scale: number
) {
  subtractions.forEach((sub) => {
    const points = sub.points;
    if (!points || points.length < 2) return;

    ctx.save();
    ctx.setLineDash([6, 4]);

    if (measurementType === 'linear') {
      // Draw dashed line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Draw label
      const midIndex = Math.floor(points.length / 2);
      const midX = (points[midIndex - 1].x + points[midIndex].x) / 2;
      const midY = (points[midIndex - 1].y + points[midIndex].y) / 2;

      const realValue = pageScale ? sub.value / scale : sub.value / scale;
      const labelText = `-${formatMeasurement(realValue, unit)}`;

      ctx.setLineDash([]);
      ctx.font = 'bold 9px Arial';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(midX - textWidth / 2 - 3, midY - 18, textWidth + 6, 14);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - textWidth / 2 - 3, midY - 18, textWidth + 6, 14);

      ctx.fillStyle = '#dc2626';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, midX, midY - 11);
    } else if (measurementType === 'area' && points.length >= 3) {
      // Draw dashed polygon
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = '#ef4444';
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label at centroid
      let centroidX = 0, centroidY = 0;
      points.forEach((p) => {
        centroidX += p.x;
        centroidY += p.y;
      });
      centroidX /= points.length;
      centroidY /= points.length;

      const realValue = pageScale ? sub.value / (scale * scale) : sub.value / (scale * scale);
      const labelText = `-${formatMeasurement(realValue, unit)}`;

      ctx.setLineDash([]);
      ctx.font = 'bold 10px Arial';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(centroidX - textWidth / 2 - 3, centroidY - 8, textWidth + 6, 16);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(centroidX - textWidth / 2 - 3, centroidY - 8, textWidth + 6, 16);

      ctx.fillStyle = '#dc2626';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, centroidX, centroidY);
    }

    ctx.restore();
  });
}

// Helper function to draw measurements on a canvas context
function drawMeasurementsOnCanvas(
  ctx: CanvasRenderingContext2D,
  measurements: Measurement[],
  pageScale: PageScale | null,
  scale: number
) {
  measurements.forEach((measurement) => {
    const { segments, points, measurementType, color, unit, name, subtractions } = measurement;

    // Use segments if available, otherwise fall back to points as single segment
    const allSegments = segments && segments.length > 0 ? segments : [points];

    ctx.save();

    if (measurementType === 'count') {
      // Draw each count marker
      allSegments.forEach((seg, segIdx) => {
        if (!seg || seg.length === 0) return;

        ctx.beginPath();
        ctx.arc(seg[0].x, seg[0].y, 12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw "1" text
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', seg[0].x, seg[0].y);

        // Draw name only on first count
        if (segIdx === 0) {
          ctx.fillStyle = color;
          ctx.textAlign = 'left';
          ctx.font = 'bold 10px Arial';
          ctx.fillText(name, seg[0].x + 16, seg[0].y + 4);
        }
      });
    } else if (measurementType === 'linear') {
      // Draw each linear segment
      allSegments.forEach((seg) => {
        if (!seg || seg.length < 2) return;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x, seg[i].y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw points
        seg.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Draw label at midpoint
        const midIndex = Math.floor(seg.length / 2);
        const midX = (seg[midIndex - 1].x + seg[midIndex].x) / 2;
        const midY = (seg[midIndex - 1].y + seg[midIndex].y) / 2;

        // Calculate segment value
        const pixelValue = calculateSegmentValue(seg, measurementType);
        const realValue = pageScale ? pixelValue / pageScale.pixelsPerUnit / scale : pixelValue / scale;
        const labelText = formatMeasurement(realValue, unit);

        ctx.font = 'bold 11px Arial';
        const textWidth = ctx.measureText(labelText).width;

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(midX - textWidth / 2 - 4, midY - 26, textWidth + 8, 18);

        // Text
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, midX, midY - 17);
      });
    } else if (measurementType === 'area') {
      // Draw each area segment
      allSegments.forEach((seg) => {
        if (!seg || seg.length < 3) return;

        // Draw filled polygon
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x, seg[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw points
        seg.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Draw label at centroid
        let centroidX = 0, centroidY = 0;
        seg.forEach((p) => {
          centroidX += p.x;
          centroidY += p.y;
        });
        centroidX /= seg.length;
        centroidY /= seg.length;

        // Calculate segment value
        const pixelValue = calculateSegmentValue(seg, measurementType);
        const realValue = pageScale ? pixelValue / (pageScale.pixelsPerUnit * pageScale.pixelsPerUnit) / (scale * scale) : pixelValue / (scale * scale);
        const labelText = formatMeasurement(realValue, unit);

        ctx.font = 'bold 12px Arial';
        const textWidth = ctx.measureText(labelText).width;

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(centroidX - textWidth / 2 - 4, centroidY - 10, textWidth + 8, 20);

        // Text
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, centroidX, centroidY);
      });
    }

    ctx.restore();

    // Draw subtractions for this measurement
    if (subtractions && subtractions.length > 0) {
      // Scale the subtraction points
      const scaledSubtractions = subtractions.map(sub => ({
        ...sub,
        points: sub.points.map(p => ({ x: p.x * scale, y: p.y * scale })),
      }));
      drawSubtractionsOnCanvas(ctx, scaledSubtractions, measurementType, unit, pageScale, scale);
    }
  });
}

// Helper function to draw notes on a canvas context
function drawNotesOnCanvas(
  ctx: CanvasRenderingContext2D,
  notes: PlanNote[],
  scale: number
) {
  notes.forEach((note) => {
    const x = note.position.x * scale;
    const y = note.position.y * scale;
    const { text, color } = note;

    ctx.save();

    // Draw marker circle
    ctx.beginPath();
    ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw "N" in marker
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${10 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x, y);

    // Draw text bubble
    const padding = 6 * scale;
    const maxWidth = 120 * scale;
    const lineHeight = 12 * scale;
    const fontSize = 9 * scale;

    // Wrap text
    ctx.font = `${fontSize}px Arial`;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth - padding * 2) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);

    // Limit to 3 lines
    const displayLines = lines.slice(0, 3);
    if (lines.length > 3) {
      displayLines[2] = displayLines[2].slice(0, -3) + '...';
    }

    const boxWidth = Math.min(maxWidth, Math.max(...displayLines.map(l => ctx.measureText(l).width)) + padding * 2);
    const boxHeight = displayLines.length * lineHeight + padding * 2;
    const boxX = x + 12 * scale;
    const boxY = y - boxHeight / 2;

    // Draw bubble background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4 * scale);
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#000';
    displayLines.forEach((line, i) => {
      ctx.fillText(line, boxX + padding, boxY + padding + (i + 0.7) * lineHeight);
    });

    ctx.restore();
  });
}

// Helper function to draw quick measurements on a canvas context
function drawQuickMeasurementsOnCanvas(
  ctx: CanvasRenderingContext2D,
  quickMeasurements: QuickMeasurement[],
  scale: number,
  pageScale: PageScale | null
) {
  const color = '#f59e0b'; // amber
  const arrowSize = 10 * scale;

  // Calculate distance between two points
  const calculateDistance = (p1: Point, p2: Point): number => {
    const pixelDistance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    if (pageScale) {
      return pixelDistance / pageScale.pixelsPerUnit / scale;
    }
    return pixelDistance / scale;
  };

  // Calculate total length
  const calculateTotalLength = (pts: Point[]): number => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += calculateDistance(pts[i - 1], pts[i]);
    }
    return total;
  };

  // Draw arrow at a point
  const drawArrow = (tip: Point, angle: number, size: number) => {
    const angle1 = angle + Math.PI * 0.8;
    const angle2 = angle - Math.PI * 0.8;

    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x + Math.cos(angle1) * size, tip.y + Math.sin(angle1) * size);
    ctx.lineTo(tip.x + Math.cos(angle2) * size, tip.y + Math.sin(angle2) * size);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  quickMeasurements.forEach((qm) => {
    const points = qm.points.map(p => ({ x: p.x * scale, y: p.y * scale }));
    if (points.length < 2) return;

    ctx.save();

    // Draw main line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw arrows pointing outward from center
    // Start arrow: direction from point 1 toward point 0 (outward from start)
    const startAngle = Math.atan2(
      points[0].y - points[1].y,
      points[0].x - points[1].x
    );
    drawArrow(points[0], startAngle, arrowSize);

    // End arrow: direction from second-to-last toward last point (outward from end)
    const endAngle = Math.atan2(
      points[points.length - 1].y - points[points.length - 2].y,
      points[points.length - 1].x - points[points.length - 2].x
    );
    drawArrow(points[points.length - 1], endAngle, arrowSize);

    // Calculate midpoint for label
    const midIndex = Math.floor(points.length / 2);
    const midX = (points[midIndex - 1].x + points[midIndex].x) / 2;
    const midY = (points[midIndex - 1].y + points[midIndex].y) / 2;

    // Calculate total length
    const totalLength = calculateTotalLength(points);
    const labelText = pageScale
      ? formatMeasurement(totalLength, 'LF')
      : `${totalLength.toFixed(0)}px`;

    // Draw label background
    ctx.font = `bold ${11 * scale}px Arial`;
    const textWidth = ctx.measureText(labelText).width;
    const padding = 4 * scale;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 16 * scale;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.roundRect(midX - boxWidth / 2, midY - 20 * scale - boxHeight / 2, boxWidth, boxHeight, 3 * scale);
    ctx.fill();

    // Draw label text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, midX, midY - 20 * scale);

    ctx.restore();
  });
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { currentProject, measurements, planNotes, quickMeasurements, pageScales, getPageName } = useProjectStore();

  const [options, setOptions] = useState<ExportOptions>({
    companyName: '',
    preparedBy: '',
    includePageNumbers: true,
    includeMaterialTotals: true,
    includeMarkedPages: true,
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // Get all measurements for current project
  const projectMeasurements = useMemo(() => {
    if (!currentProject) return [];
    return measurements.filter((m) => m.projectId === currentProject.id);
  }, [currentProject, measurements]);

  // Group measurements by page
  const measurementsByPage = useMemo(() => {
    const pageMap = new Map<number, Measurement[]>();
    projectMeasurements.forEach((m) => {
      if (!pageMap.has(m.pageNumber)) {
        pageMap.set(m.pageNumber, []);
      }
      pageMap.get(m.pageNumber)!.push(m);
    });
    return new Map([...pageMap.entries()].sort((a, b) => a[0] - b[0]));
  }, [projectMeasurements]);

  // Calculate material totals (using net values after subtractions)
  const materialTotals = useMemo(() => {
    const totals = new Map<string, { quantity: number; unit: string; rawValue: number; rawUnit: string }>();

    projectMeasurements.forEach((m) => {
      const netValue = calculateNetValue(m);
      const grossValue = m.value;
      // Ratio to scale material quantities by (handles subtractions)
      const netRatio = grossValue > 0 ? netValue / grossValue : 1;

      m.materials.forEach((mat) => {
        const key = mat.name;
        const existing = totals.get(key);
        const adjustedQuantity = mat.quantity ? mat.quantity * netRatio : 0;

        if (mat.isStud && mat.quantity) {
          if (existing) {
            existing.quantity += adjustedQuantity;
          } else {
            totals.set(key, {
              quantity: adjustedQuantity,
              unit: 'stud',
              rawValue: 0,
              rawUnit: m.unit,
            });
          }
        } else if (mat.isPlate && mat.quantity) {
          if (existing) {
            existing.quantity += adjustedQuantity;
          } else {
            totals.set(key, {
              quantity: adjustedQuantity,
              unit: 'plate',
              rawValue: 0,
              rawUnit: m.unit,
            });
          }
        } else if (mat.hasCoverage && mat.quantity && mat.coverageUnit) {
          if (existing) {
            existing.quantity += adjustedQuantity;
          } else {
            totals.set(key, {
              quantity: adjustedQuantity,
              unit: mat.coverageUnit,
              rawValue: 0,
              rawUnit: m.unit,
            });
          }
        } else {
          if (existing) {
            existing.rawValue += netValue;
          } else {
            totals.set(key, {
              quantity: 0,
              unit: '',
              rawValue: netValue,
              rawUnit: m.unit,
            });
          }
        }
      });
    });

    return totals;
  }, [projectMeasurements]);

  const handleExport = async () => {
    if (!currentProject) return;

    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Load the cover logo (pdflogo.png)
      let coverLogoImg: HTMLImageElement | null = null;
      let coverLogoAspectRatio = 1;
      try {
        coverLogoImg = new Image();
        coverLogoImg.src = pdfLogo;
        await new Promise((resolve) => {
          coverLogoImg!.onload = resolve;
        });
        coverLogoAspectRatio = coverLogoImg.width / coverLogoImg.height;
      } catch (logoErr) {
        console.warn('Could not load cover logo:', logoErr);
      }

      // Load the header logo (headerlogo.png)
      let headerLogoImg: HTMLImageElement | null = null;
      let headerLogoAspectRatio = 1;
      try {
        headerLogoImg = new Image();
        headerLogoImg.src = headerLogo;
        await new Promise((resolve) => {
          headerLogoImg!.onload = resolve;
        });
        headerLogoAspectRatio = headerLogoImg.width / headerLogoImg.height;
      } catch (logoErr) {
        console.warn('Could not load header logo:', logoErr);
      }

      // ============ COVER PAGE ============
      if (coverLogoImg) {
        const coverLogoHeight = 75;
        const coverLogoWidth = coverLogoHeight * coverLogoAspectRatio;
        const logoX = (pageWidth - coverLogoWidth) / 2;
        doc.addImage(coverLogoImg, 'PNG', logoX, 35, coverLogoWidth, coverLogoHeight);
      }

      doc.setFontSize(28);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(currentProject.name, pageWidth / 2, 140, { align: 'center' });

      if (currentProject.address) {
        doc.setFontSize(14);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.text(currentProject.address, pageWidth / 2, 155, { align: 'center' });
      }

      if (currentProject.clientName) {
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(currentProject.clientName, pageWidth / 2, 170, { align: 'center' });
      }

      doc.setFontSize(11);
      doc.setTextColor(148, 163, 184);
      doc.text(
        new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        pageWidth / 2,
        185,
        { align: 'center' }
      );

      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.text('Takeoff Report', pageWidth / 2, 205, { align: 'center' });

      // ============ HELPER: Add page header ============
      const addPageHeader = () => {
        let headerY = 15;

        if (headerLogoImg) {
          const logoHeight = 10;
          const logoWidth = logoHeight * headerLogoAspectRatio;
          doc.addImage(headerLogoImg, 'PNG', 15, headerY, logoWidth, logoHeight);
        }

        let infoY = 30;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(currentProject.name, 15, infoY);
        infoY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        if (currentProject.clientName) {
          doc.text(currentProject.clientName, 15, infoY);
          infoY += 3.5;
        }
        if (options.preparedBy) {
          doc.text(`Prepared by: ${options.preparedBy}`, 15, infoY);
        }

        return 45;
      };

      // ============ CONTENT PAGES ============
      doc.addPage();
      let yPos = addPageHeader();

      // Per-measurement sections grouped by page
      measurementsByPage.forEach((pageMeasurements, pageNumber) => {
        // Page section header
        if (yPos > 250) {
          doc.addPage();
          yPos = addPageHeader();
        }

        const pageName = getPageName(currentProject.id, pageNumber);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(pageName, 15, yPos);
        yPos += 8;

        pageMeasurements.forEach((measurement) => {
          if (yPos > 250) {
            doc.addPage();
            yPos = addPageHeader();
          }

          // Measurement name and value
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          const netValue = calculateNetValue(measurement);
          const subtractionTotal = (measurement.subtractions || []).reduce((sum, s) => sum + s.value, 0);

          if (subtractionTotal > 0) {
            // Show breakdown: gross, minus openings, net
            doc.text(`${measurement.name}`, 20, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text(`Total: ${formatMeasurement(measurement.value, measurement.unit)}`, 25, yPos);
            yPos += 4;
            doc.setTextColor(220, 38, 38); // red color
            doc.text(`Less Openings: -${formatMeasurement(subtractionTotal, measurement.unit)}`, 25, yPos);
            yPos += 4;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(22, 163, 74); // green color
            doc.text(`Net: ${formatMeasurement(netValue, measurement.unit)}`, 25, yPos);
            yPos += 6;
          } else {
            doc.text(`${measurement.name} - ${formatMeasurement(netValue, measurement.unit)}`, 20, yPos);
            yPos += 6;
          }

          // Materials table for this measurement
          if (measurement.materials.length > 0) {
            // Calculate ratio to adjust quantities for subtractions
            const grossValue = measurement.value;
            const netRatio = grossValue > 0 ? netValue / grossValue : 1;

            const tableData = measurement.materials.map((mat) => {
              const coverage = mat.hasCoverage && mat.coverageAmount && mat.coverageUnit
                ? `1 ${mat.coverageUnit}/${mat.coverageAmount} ${measurement.unit}`
                : mat.isStud && mat.studSpacing
                ? `${mat.studSpacing}" OC`
                : mat.isPlate && mat.plateLength
                ? `${mat.plateLength}' plates`
                : '-';
              // Adjust quantity by net ratio to account for subtractions
              const adjustedQty = mat.quantity ? mat.quantity * netRatio : undefined;
              const wasteFactor = 1 + (mat.wasteFactor || 0) / 100;
              let quantity: string;
              if (mat.isStud && adjustedQty) {
                quantity = `${Math.ceil(adjustedQty * wasteFactor)} studs`;
              } else if (mat.isPlate && adjustedQty) {
                quantity = `${Math.ceil(adjustedQty * wasteFactor)} plates`;
              } else if (mat.hasCoverage && adjustedQty && mat.coverageUnit) {
                quantity = `${Math.ceil(adjustedQty * wasteFactor)} ${mat.coverageUnit}s`;
              } else {
                quantity = formatMeasurement(netValue, measurement.unit);
              }
              return [mat.name, coverage, quantity];
            });

            autoTable(doc, {
              startY: yPos,
              head: [['Item', 'Coverage', 'Quantity']],
              body: tableData,
              theme: 'plain',
              headStyles: {
                fillColor: [241, 245, 249],
                textColor: [51, 65, 85],
                fontStyle: 'bold',
                fontSize: 8,
              },
              styles: {
                fontSize: 8,
                cellPadding: 2,
              },
              margin: { left: 25, right: 15 },
              tableWidth: pageWidth - 40,
            });

            yPos = (doc as any).lastAutoTable.finalY + 8;
          } else {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(148, 163, 184);
            doc.text('No materials assigned', 25, yPos);
            yPos += 8;
          }
        });

        yPos += 5; // Extra space between pages
      });

      // ============ MATERIAL TOTALS ============
      if (options.includeMaterialTotals && materialTotals.size > 0) {
        if (yPos > 220) {
          doc.addPage();
          yPos = addPageHeader();
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text('MATERIAL TOTALS', 15, yPos);
        yPos += 8;

        const totalsData = Array.from(materialTotals.entries()).map(([name, data]) => {
          const quantity = data.quantity > 0
            ? `${Math.ceil(data.quantity)} ${data.unit}s`
            : formatMeasurement(data.rawValue, data.rawUnit);
          return [name, quantity];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Material', 'Total Quantity']],
          body: totalsData,
          theme: 'striped',
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: 255,
            fontStyle: 'bold',
          },
          styles: {
            fontSize: 10,
            cellPadding: 3,
          },
          margin: { left: 15, right: 15 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // ============ PROJECT NOTES ============
      if (currentProject.notes) {
        if (yPos > 240) {
          doc.addPage();
          yPos = addPageHeader();
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Project Notes', 15, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(currentProject.notes, pageWidth - 30);
        doc.text(splitNotes, 15, yPos);
      }

      // ============ MARKED-UP PAGES ============
      if (options.includeMarkedPages && currentProject.planFileId) {
        try {
          const projectNotes = planNotes.filter((n) => n.projectId === currentProject.id);
          const projectQuickMeasurements = quickMeasurements.filter((q) => q.projectId === currentProject.id);
          const pagesWithContent = [...new Set([
            ...projectMeasurements.map((m) => m.pageNumber),
            ...projectNotes.map((n) => n.pageNumber),
            ...projectQuickMeasurements.map((q) => q.pageNumber),
          ])].sort((a, b) => a - b);

          if (pagesWithContent.length > 0) {
            const pdfUrl = `/api/files/${currentProject.planFileId}`;
            const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;

            for (const pageNum of pagesWithContent) {
              const pageMeasurements = projectMeasurements.filter(
                (m) => m.pageNumber === pageNum && m.isVisible
              );
              const pageNotes = projectNotes.filter(
                (n) => n.pageNumber === pageNum
              );
              const pageQuickMeasurements = projectQuickMeasurements.filter(
                (q) => q.pageNumber === pageNum
              );

              if (pageMeasurements.length === 0 && pageNotes.length === 0 && pageQuickMeasurements.length === 0) continue;

              const pdfPage = await pdfDoc.getPage(pageNum);
              const scale = 1.5;
              const viewport = pdfPage.getViewport({ scale });

              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext('2d');

              if (!ctx) continue;

              await pdfPage.render({
                canvasContext: ctx,
                viewport: viewport,
              }).promise;

              const pageScaleData = pageScales[`${currentProject.id}-${pageNum}`] || null;

              const scaledMeasurements = pageMeasurements.map((m) => {
                const scaledPoints = m.points.map((p) => ({
                  x: p.x * scale,
                  y: p.y * scale,
                }));
                const scaledSegments = (m.segments && m.segments.length > 0)
                  ? m.segments.map((seg) =>
                      seg.map((p) => ({
                        x: p.x * scale,
                        y: p.y * scale,
                      }))
                    )
                  : [scaledPoints];
                return {
                  ...m,
                  points: scaledPoints,
                  segments: scaledSegments,
                };
              });
              drawMeasurementsOnCanvas(ctx, scaledMeasurements, pageScaleData, scale);
              drawNotesOnCanvas(ctx, pageNotes, scale);
              drawQuickMeasurementsOnCanvas(ctx, pageQuickMeasurements, scale, pageScaleData);

              doc.addPage('a4', 'landscape');

              const landscapeWidth = doc.internal.pageSize.getWidth();
              const landscapeHeight = doc.internal.pageSize.getHeight();

              let headerY = 15;
              if (headerLogoImg) {
                const logoHeight = 10;
                const logoWidth = logoHeight * headerLogoAspectRatio;
                doc.addImage(headerLogoImg, 'PNG', 15, headerY, logoWidth, logoHeight);
              }

              const pageName = getPageName(currentProject.id, pageNum);
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 41, 59);
              doc.text(`Sheet: ${pageName}`, 15, 30);

              // Build legend (using net values)
              const measurementsOnPage = new Map<string, { color: string; value: number; unit: string }>();
              pageMeasurements.forEach((m) => {
                const key = m.name;
                const netVal = calculateNetValue(m);
                if (measurementsOnPage.has(key)) {
                  const existing = measurementsOnPage.get(key)!;
                  existing.value += netVal;
                } else {
                  measurementsOnPage.set(key, {
                    color: m.color,
                    value: netVal,
                    unit: m.unit,
                  });
                }
              });

              let legendX = landscapeWidth - 70;
              let legendY = 15;
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(71, 85, 105);
              doc.text('Legend:', legendX, legendY);
              legendY += 5;

              doc.setFont('helvetica', 'normal');
              measurementsOnPage.forEach((data, name) => {
                const hexColor = data.color.replace('#', '');
                const r = parseInt(hexColor.substring(0, 2), 16);
                const g = parseInt(hexColor.substring(2, 4), 16);
                const b = parseInt(hexColor.substring(4, 6), 16);
                doc.setFillColor(r, g, b);
                doc.rect(legendX, legendY - 2.5, 3, 3, 'F');

                doc.setTextColor(51, 65, 85);
                doc.text(`${name}: ${formatMeasurement(data.value, data.unit)}`, legendX + 5, legendY);
                legendY += 4;
              });

              const legendHeight = Math.max(35, 15 + (measurementsOnPage.size * 4) + 5);
              const pdfPageWidth = landscapeWidth - 20;
              const pdfPageHeight = landscapeHeight - legendHeight - 15;

              const imgAspectRatio = canvas.width / canvas.height;
              let imgWidth = pdfPageWidth;
              let imgHeight = imgWidth / imgAspectRatio;

              if (imgHeight > pdfPageHeight) {
                imgHeight = pdfPageHeight;
                imgWidth = imgHeight * imgAspectRatio;
              }

              const imgX = (landscapeWidth - imgWidth) / 2;
              const imgY = legendHeight;

              const imgData = canvas.toDataURL('image/jpeg', 0.85);
              doc.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight);
            }
          }
        } catch (err) {
          console.warn('Could not add marked-up pages:', err);
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Generated by TakeoffPro | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      const fileName = `${currentProject.name.replace(/[^a-zA-Z0-9]/g, '_')}_Takeoff_${
        new Date().toISOString().split('T')[0]
      }.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                Export Takeoff Report
              </h2>
              <p className="text-sm text-slate-500">
                {projectMeasurements.length} measurements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="input-label">Company Name (optional)</label>
            <input
              type="text"
              value={options.companyName}
              onChange={(e) =>
                setOptions({ ...options, companyName: e.target.value })
              }
              placeholder="Your Company Name"
              className="input-field"
            />
          </div>

          <div>
            <label className="input-label">Prepared By (optional)</label>
            <input
              type="text"
              value={options.preparedBy}
              onChange={(e) =>
                setOptions({ ...options, preparedBy: e.target.value })
              }
              placeholder="Your Name"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <label className="input-label">Options</label>

            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
              <input
                type="checkbox"
                checked={options.includePageNumbers}
                onChange={(e) =>
                  setOptions({ ...options, includePageNumbers: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-slate-700">Include sheet names</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
              <input
                type="checkbox"
                checked={options.includeMaterialTotals}
                onChange={(e) =>
                  setOptions({ ...options, includeMaterialTotals: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-slate-700">Include material totals</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
              <input
                type="checkbox"
                checked={options.includeMarkedPages}
                onChange={(e) =>
                  setOptions({ ...options, includeMarkedPages: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-slate-700">Include marked-up plan pages</span>
            </label>
          </div>

          {/* Preview info */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-700 mb-2">Report Preview</h3>
            <div className="text-sm text-slate-600 space-y-1">
              <p>Project: {currentProject.name}</p>
              <p>Client: {currentProject.clientName || 'N/A'}</p>
              <p>Total Measurements: {projectMeasurements.length}</p>
              <p>Pages: {measurementsByPage.size}</p>
              {materialTotals.size > 0 && (
                <p>Materials: {materialTotals.size} types</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isGenerating || projectMeasurements.length === 0}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
