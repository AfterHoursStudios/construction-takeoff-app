import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import { useProjectStore } from '../stores/projectStore';
import { formatMeasurement } from '../utils/format';
import type { Point, Measurement, MeasurementType, MeasurementSubtraction, PageScale, PlanNote, QuickMeasurement, PendingMeasurement, UnitType, ReferenceLine } from '../types';

interface MeasurementCanvasProps {
  width: number;
  height: number;
  onScaleCalibrationComplete: () => void;
}

export default function MeasurementCanvas({
  width,
  height,
  onScaleCalibrationComplete,
}: MeasurementCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);

  const {
    currentProject,
    currentPage,
    activeTool,
    calibrationPoints,
    addCalibrationPoint,
    isDrawing,
    setIsDrawing,
    currentPoints,
    addCurrentPoint,
    clearCurrentPoints,
    measurements,
    selectedMeasurementId,
    selectedSegmentIndex,
    setSelectedMeasurement,
    setSelectedSegment,
    updateMeasurement,
    drawingConfig,
    pageScales,
    deleteMeasurement,
    planNotes,
    selectedNoteId,
    setSelectedNote,
    setPendingNotePosition,
    deletePlanNote,
    quickMeasurements,
    selectedQuickMeasurementId,
    setSelectedQuickMeasurement,
    addQuickMeasurement,
    updateQuickMeasurement,
    deleteQuickMeasurement,
    referenceLines,
    selectedReferenceLineId,
    setSelectedReferenceLine,
    addReferenceLine,
    updateReferenceLine,
    deleteReferenceLine,
    setPendingMeasurement,
    snapToAngle,
    isSubtractMode,
    subtractingFromSegment,
    setSubtractingFromSegment,
    addSubtraction,
  } = useProjectStore();

  const [mousePos, setMousePos] = useState<Point | null>(null);

  // Snap point to 45/90 degree angles from last point
  const snapPoint = (pos: Point, lastPoint: Point | null): Point => {
    if (!lastPoint || !snapToAngle) return pos;

    const dx = pos.x - lastPoint.x;
    const dy = pos.y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Snap to nearest 45 degrees (PI/4)
    const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

    return {
      x: lastPoint.x + Math.cos(snapAngle) * distance,
      y: lastPoint.y + Math.sin(snapAngle) * distance,
    };
  };

  // Handle measurement point drag
  const handleMeasurementPointDrag = (measurementId: string, encodedIndex: number, newPos: Point) => {
    const measurement = measurements.find((m) => m.id === measurementId);
    if (!measurement) return;

    // Decode segment index and point index (encoded as segIdx * 1000 + pointIdx)
    const segIdx = Math.floor(encodedIndex / 1000);
    const pointIdx = encodedIndex % 1000;

    // Get segments (fall back to single segment from points)
    const allSegments = measurement.segments && measurement.segments.length > 0
      ? measurement.segments
      : [measurement.points];

    // Update the specific segment
    const newSegments = allSegments.map((seg, sIdx) => {
      if (sIdx === segIdx) {
        const newSeg = [...seg];
        if (pointIdx < newSeg.length) {
          newSeg[pointIdx] = newPos;
        }
        return newSeg;
      }
      return seg;
    });

    // Also update legacy points array (first segment)
    const newPoints = newSegments[0] || [];

    // Recalculate value based on measurement type by summing all segments
    let newValue = 0;
    if (measurement.measurementType === 'linear') {
      newSegments.forEach(seg => {
        newValue += calculatePolylineLength(seg);
      });
    } else if (measurement.measurementType === 'area') {
      newSegments.forEach(seg => {
        newValue += calculatePolygonArea(seg);
      });
    } else if (measurement.measurementType === 'count') {
      newValue = newSegments.length; // Each segment is one count
    }

    // Recalculate material quantities based on new value
    const updatedMaterials = measurement.materials.map((mat) => {
      if (mat.hasCoverage && mat.coverageAmount) {
        return { ...mat, quantity: newValue / mat.coverageAmount };
      }
      return mat;
    });

    // Update the measurement
    updateMeasurement(measurementId, {
      points: newPoints,
      segments: newSegments,
      value: newValue,
      materials: updatedMaterials
    });
  };

  // Handle quick measurement point drag
  const handleQuickMeasurementPointDrag = (quickMeasurementId: string, pointIndex: number, newPos: Point) => {
    const qm = quickMeasurements.find((q) => q.id === quickMeasurementId);
    if (!qm) return;

    // Update the points array
    const newPoints = [...qm.points];
    newPoints[pointIndex] = newPos;

    // Update the quick measurement
    updateQuickMeasurement(quickMeasurementId, { points: newPoints });
  };

  // Handle segment deletion with proper scale-aware calculation
  const handleDeleteSegment = (measurementId: string, segmentIndex: number) => {
    const measurement = measurements.find((m) => m.id === measurementId);
    if (!measurement) return;

    const allSegments = measurement.segments && measurement.segments.length > 0
      ? measurement.segments
      : [measurement.points];

    // If only one segment, delete the entire measurement
    if (allSegments.length <= 1) {
      deleteMeasurement(measurementId);
      return;
    }

    // Remove the segment
    const newSegments = allSegments.filter((_, idx) => idx !== segmentIndex);

    // Recalculate total value using scale-aware functions
    let newValue = 0;
    if (measurement.measurementType === 'linear') {
      newSegments.forEach(seg => {
        newValue += calculatePolylineLength(seg);
      });
    } else if (measurement.measurementType === 'area') {
      newSegments.forEach(seg => {
        newValue += calculatePolygonArea(seg);
      });
    } else if (measurement.measurementType === 'count') {
      newValue = newSegments.length;
    }

    // Recalculate material quantities
    const updatedMaterials = measurement.materials.map((mat) => {
      if (mat.hasCoverage && mat.coverageAmount) {
        return { ...mat, quantity: newValue / mat.coverageAmount };
      }
      return mat;
    });

    // Update the measurement
    updateMeasurement(measurementId, {
      segments: newSegments,
      points: newSegments[0] || [],
      value: newValue,
      materials: updatedMaterials,
    });

    // Clear segment selection
    setSelectedSegment(measurementId, null);
  };

  // Handle reference line point drag
  const handleReferenceLinePointDrag = (lineId: string, pointIndex: number, newPos: Point) => {
    const line = referenceLines.find((l) => l.id === lineId);
    if (!line) return;

    const newPoints = [...line.points];
    newPoints[pointIndex] = newPos;
    updateReferenceLine(lineId, { points: newPoints });
  };

  // Get measurements for current page
  const pageMeasurements = measurements.filter(
    (m) => m.projectId === currentProject?.id && m.pageNumber === currentPage && m.isVisible
  );

  // Get notes for current page
  const pageNotes = planNotes.filter(
    (n) => n.projectId === currentProject?.id && n.pageNumber === currentPage
  );

  // Get quick measurements for current page
  const pageQuickMeasurements = quickMeasurements.filter(
    (q) => q.projectId === currentProject?.id && q.pageNumber === currentPage
  );

  // Get reference lines for current page
  const pageReferenceLines = referenceLines.filter(
    (l) => l.projectId === currentProject?.id && l.pageNumber === currentPage
  );

  // Get current page scale
  const pageScale = currentProject
    ? pageScales[`${currentProject.id}-${currentPage}`]
    : null;

  // Calculate real-world distance between two points
  const calculateDistance = (p1: Point, p2: Point): number => {
    const pixelDistance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    if (pageScale) {
      return pixelDistance / pageScale.pixelsPerUnit;
    }
    return pixelDistance;
  };

  // Calculate polygon area using shoelace formula
  const calculatePolygonArea = (points: Point[]): number => {
    if (points.length < 3) return 0;

    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    area = Math.abs(area) / 2;

    // Convert from pixels² to feet² if scale is set
    if (pageScale) {
      area = area / Math.pow(pageScale.pixelsPerUnit, 2);
    }

    return area;
  };

  // Calculate total length of polyline
  const calculatePolylineLength = (points: Point[]): number => {
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      totalLength += calculateDistance(points[i - 1], points[i]);
    }
    return totalLength;
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!currentProject) return;

    // Ignore middle mouse button (used for panning)
    if (e.evt.button === 1) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Apply snap if we're drawing and have existing points
    const lastPoint = currentPoints.length > 0 ? currentPoints[currentPoints.length - 1] : null;
    const snappedPos = (isDrawing && lastPoint) ? snapPoint(pos, lastPoint) : pos;
    const point: Point = { x: snappedPos.x, y: snappedPos.y };

    // Handle scale calibration
    if (activeTool === 'scale') {
      addCalibrationPoint(point);
      if (calibrationPoints.length === 1) {
        // Second point added, open calibration modal
        onScaleCalibrationComplete();
      }
      return;
    }

    // Handle subtract mode - takes priority over select tool
    if (isSubtractMode && subtractingFromSegment) {
      if (!isDrawing) {
        setIsDrawing(true);
        clearCurrentPoints();
      }
      addCurrentPoint(point);
      return;
    }

    // Handle selection
    if (activeTool === 'select') {
      // Check if clicking on a note first
      const clickedNote = pageNotes.find((n) => {
        return Math.abs(n.position.x - point.x) < 20 && Math.abs(n.position.y - point.y) < 20;
      });

      if (clickedNote) {
        setSelectedNote(clickedNote.id);
        setSelectedMeasurement(null);
        setSelectedQuickMeasurement(null);
        setSelectedReferenceLine(null);
        return;
      }

      // Check if clicking on a reference line
      const clickedReferenceLine = pageReferenceLines.find((l) => {
        return l.points.some(
          (p) => Math.abs(p.x - point.x) < 15 && Math.abs(p.y - point.y) < 15
        );
      });

      if (clickedReferenceLine) {
        setSelectedReferenceLine(clickedReferenceLine.id);
        setSelectedMeasurement(null);
        setSelectedNote(null);
        setSelectedQuickMeasurement(null);
        return;
      }

      // Check if clicking on a quick measurement
      const clickedQuickMeasurement = pageQuickMeasurements.find((q) => {
        return q.points.some(
          (p) => Math.abs(p.x - point.x) < 15 && Math.abs(p.y - point.y) < 15
        );
      });

      if (clickedQuickMeasurement) {
        setSelectedQuickMeasurement(clickedQuickMeasurement.id);
        setSelectedMeasurement(null);
        setSelectedNote(null);
        setSelectedReferenceLine(null);
        return;
      }

      const clickedMeasurement = pageMeasurements.find((m) => {
        // Check if click is near any point in the measurement
        return m.points.some(
          (p) => Math.abs(p.x - point.x) < 15 && Math.abs(p.y - point.y) < 15
        );
      });

      if (clickedMeasurement) {
        setSelectedMeasurement(clickedMeasurement.id);
        setSelectedNote(null);
        setSelectedQuickMeasurement(null);
        setSelectedReferenceLine(null);
      } else {
        setSelectedMeasurement(null);
        setSelectedNote(null);
        setSelectedQuickMeasurement(null);
        setSelectedReferenceLine(null);
      }
      return;
    }

    // Handle note tool - set pending position for modal
    if (activeTool === 'note') {
      setPendingNotePosition(point);
      return;
    }

    // Handle count tool - opens name modal immediately
    if (activeTool === 'count') {
      const pendingMeasurement: PendingMeasurement = {
        measurementType: 'count',
        points: [point],
        value: 1,
        unit: 'EA',
        color: drawingConfig.color,
        lineWeight: drawingConfig.lineWeight,
      };
      setPendingMeasurement(pendingMeasurement);
      return;
    }

    // Handle linear and area tools - start drawing
    if (activeTool === 'linear' || activeTool === 'area') {
      if (!isDrawing) {
        setIsDrawing(true);
        clearCurrentPoints();
      }
      addCurrentPoint(point);
    }

    // Handle quick measure tool - persistent measurement
    if (activeTool === 'measure') {
      if (!isDrawing) {
        setIsDrawing(true);
        clearCurrentPoints();
      }
      addCurrentPoint(point);
    }

    // Handle line tool - reference lines (visual only)
    if (activeTool === 'line') {
      if (!isDrawing) {
        setIsDrawing(true);
        clearCurrentPoints();
      }
      addCurrentPoint(point);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (pos) {
      // Apply snap if drawing and we have at least one point
      const lastPoint = currentPoints.length > 0 ? currentPoints[currentPoints.length - 1] : null;
      const snappedPos = isDrawing ? snapPoint(pos, lastPoint) : pos;
      setMousePos({ x: snappedPos.x, y: snappedPos.y });
    }
  };

  const handleDoubleClick = () => {
    if (!currentProject || !isDrawing) return;

    // Handle subtraction mode - save subtraction to the target segment
    if (isSubtractMode && subtractingFromSegment && currentPoints.length >= 2) {
      const targetMeasurement = measurements.find((m) => m.id === subtractingFromSegment.measurementId);
      if (targetMeasurement) {
        // Calculate subtraction value based on parent measurement type
        let subtractionValue: number;
        if (targetMeasurement.measurementType === 'area') {
          subtractionValue = calculatePolygonArea(currentPoints);
        } else {
          subtractionValue = calculatePolylineLength(currentPoints);
        }

        const newSubtraction: MeasurementSubtraction = {
          id: crypto.randomUUID(),
          segmentIndex: subtractingFromSegment.segmentIndex,
          points: [...currentPoints],
          value: subtractionValue,
          createdAt: new Date().toISOString(),
        };

        addSubtraction(subtractingFromSegment.measurementId, newSubtraction);
      }
      setIsDrawing(false);
      clearCurrentPoints();
      return;
    }

    // Handle quick measure tool - save to store (persists but not in takeoff summary)
    if (activeTool === 'measure') {
      if (currentPoints.length >= 2) {
        const newQuickMeasurement: QuickMeasurement = {
          id: crypto.randomUUID(),
          projectId: currentProject.id,
          pageNumber: currentPage,
          points: [...currentPoints],
          createdAt: new Date().toISOString(),
        };
        addQuickMeasurement(newQuickMeasurement);
      }
      setIsDrawing(false);
      clearCurrentPoints();
      return;
    }

    // Handle line tool - save reference line (visual only, no measurement display)
    if (activeTool === 'line') {
      if (currentPoints.length >= 2) {
        const newReferenceLine: ReferenceLine = {
          id: crypto.randomUUID(),
          projectId: currentProject.id,
          pageNumber: currentPage,
          points: [...currentPoints],
          color: drawingConfig.color,
          lineWeight: drawingConfig.lineWeight,
          createdAt: new Date().toISOString(),
        };
        addReferenceLine(newReferenceLine);
      }
      setIsDrawing(false);
      clearCurrentPoints();
      return;
    }

    // Finish the current measurement and open name modal
    if (currentPoints.length >= 2) {
      const measurementType: MeasurementType =
        activeTool === 'area' ? 'area' : 'linear';

      let value: number;
      let unit: UnitType = 'LF';

      if (measurementType === 'area') {
        value = calculatePolygonArea(currentPoints);
        unit = 'SF';
      } else {
        value = calculatePolylineLength(currentPoints);
        unit = 'LF';
      }

      const pendingMeasurement: PendingMeasurement = {
        measurementType,
        points: [...currentPoints],
        value,
        unit,
        color: drawingConfig.color,
        lineWeight: drawingConfig.lineWeight,
      };

      setPendingMeasurement(pendingMeasurement);
    }

    setIsDrawing(false);
    clearCurrentPoints();
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawing(false);
        clearCurrentPoints();
        setSelectedMeasurement(null);
        setSelectedNote(null);
        setSelectedQuickMeasurement(null);
        setSelectedReferenceLine(null);
        setSubtractingFromSegment(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedMeasurementId) {
          if (selectedSegmentIndex !== null) {
            // Delete just the selected segment
            handleDeleteSegment(selectedMeasurementId, selectedSegmentIndex);
          } else {
            // Delete the entire measurement
            deleteMeasurement(selectedMeasurementId);
          }
        }
        if (selectedNoteId) {
          deletePlanNote(selectedNoteId);
        }
        if (selectedQuickMeasurementId) {
          deleteQuickMeasurement(selectedQuickMeasurementId);
        }
        if (selectedReferenceLineId) {
          deleteReferenceLine(selectedReferenceLineId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMeasurementId, selectedSegmentIndex, selectedNoteId, selectedQuickMeasurementId, selectedReferenceLineId, deleteMeasurement, deletePlanNote, deleteQuickMeasurement, deleteReferenceLine, clearCurrentPoints, setSelectedMeasurement, setSelectedNote, setSelectedQuickMeasurement, setSelectedReferenceLine, setSubtractingFromSegment, setIsDrawing, measurements, updateMeasurement, setSelectedSegment, pageScale]);

  const getCursor = () => {
    if (isSubtractMode) {
      return 'crosshair';
    }
    switch (activeTool) {
      case 'pan':
        return 'grab';
      case 'select':
        return 'default';
      default:
        return 'crosshair';
    }
  };

  if (width === 0 || height === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        cursor: getCursor(),
      }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDblClick={handleDoubleClick}
      >
        <Layer>
          {/* Render existing measurements */}
          {pageMeasurements.map((measurement) => (
            <MeasurementShape
              key={measurement.id}
              measurement={measurement}
              isSelected={measurement.id === selectedMeasurementId}
              selectedSegmentIndex={measurement.id === selectedMeasurementId ? selectedSegmentIndex : null}
              pageScale={pageScale}
              onPointDrag={handleMeasurementPointDrag}
              onSegmentClick={(measurementId, segIdx) => setSelectedSegment(measurementId, segIdx)}
              onStartSubtract={(measurementId, segIdx) => setSubtractingFromSegment({ measurementId, segmentIndex: segIdx })}
              isSubtractMode={isSubtractMode}
              subtractingFromSegment={subtractingFromSegment}
            />
          ))}

          {/* Render notes */}
          {pageNotes.map((note) => (
            <NoteMarker
              key={note.id}
              note={note}
              isSelected={note.id === selectedNoteId}
            />
          ))}

          {/* Render calibration points */}
          {activeTool === 'scale' &&
            calibrationPoints.map((point, i) => (
              <Group key={i}>
                <Circle
                  x={point.x}
                  y={point.y}
                  radius={8}
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <Text
                  x={point.x + 12}
                  y={point.y - 8}
                  text={`Point ${i + 1}`}
                  fontSize={12}
                  fill="#ef4444"
                  fontStyle="bold"
                />
              </Group>
            ))}

          {/* Render calibration line preview */}
          {activeTool === 'scale' && calibrationPoints.length === 1 && mousePos && (
            <Line
              points={[
                calibrationPoints[0].x,
                calibrationPoints[0].y,
                mousePos.x,
                mousePos.y,
              ]}
              stroke="#ef4444"
              strokeWidth={2}
              dash={[5, 5]}
            />
          )}

          {/* Render current drawing */}
          {isDrawing && currentPoints.length > 0 && (
            <CurrentDrawing
              points={currentPoints}
              mousePos={mousePos}
              activeTool={isSubtractMode ? 'subtract' : activeTool}
              color={isSubtractMode ? '#ef4444' : (activeTool === 'measure' ? '#f59e0b' : drawingConfig.color)}
              pageScale={pageScale}
            />
          )}

          {/* Render quick measurements */}
          {pageQuickMeasurements.map((qm) => (
            <QuickMeasurementDisplay
              key={qm.id}
              quickMeasurement={qm}
              isSelected={qm.id === selectedQuickMeasurementId}
              pageScale={pageScale}
              onPointDrag={handleQuickMeasurementPointDrag}
            />
          ))}

          {/* Render reference lines */}
          {pageReferenceLines.map((line) => (
            <ReferenceLineDisplay
              key={line.id}
              referenceLine={line}
              isSelected={line.id === selectedReferenceLineId}
              onPointDrag={handleReferenceLinePointDrag}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

interface MeasurementShapeProps {
  measurement: Measurement;
  isSelected: boolean;
  selectedSegmentIndex: number | null;
  pageScale: PageScale | null;
  onPointDrag: (measurementId: string, pointIndex: number, newPos: Point) => void;
  onSegmentClick: (measurementId: string, segmentIndex: number) => void;
  onStartSubtract?: (measurementId: string, segmentIndex: number) => void;
  isSubtractMode?: boolean;
  subtractingFromSegment?: { measurementId: string; segmentIndex: number } | null;
}

function MeasurementShape({ measurement, isSelected, selectedSegmentIndex, pageScale, onPointDrag, onSegmentClick, onStartSubtract, isSubtractMode, subtractingFromSegment }: MeasurementShapeProps) {
  const { points, segments, measurementType, color, unit, name, subtractions } = measurement;

  // Use segments if available, otherwise fall back to points as single segment
  const allSegments = segments && segments.length > 0 ? segments : [points];

  // Calculate distance between two points
  const calcDistance = (p1: Point, p2: Point): number => {
    const pixelDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    return pageScale ? pixelDist / pageScale.pixelsPerUnit : pixelDist;
  };

  // Calculate polyline length for a segment
  const calcSegmentLength = (seg: Point[]): number => {
    let total = 0;
    for (let i = 1; i < seg.length; i++) {
      total += calcDistance(seg[i - 1], seg[i]);
    }
    return total;
  };

  // Calculate polygon area for a segment (shoelace formula)
  const calcSegmentArea = (seg: Point[]): number => {
    if (seg.length < 3) return 0;
    let area = 0;
    const n = seg.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += seg[i].x * seg[j].y;
      area -= seg[j].x * seg[i].y;
    }
    area = Math.abs(area) / 2;
    return pageScale ? area / Math.pow(pageScale.pixelsPerUnit, 2) : area;
  };

  // Get midpoint of a linear segment
  const getSegmentMidpoint = (seg: Point[]): { x: number; y: number } => {
    if (seg.length < 2) return { x: seg[0]?.x || 0, y: seg[0]?.y || 0 };
    const midIndex = Math.floor(seg.length / 2);
    return {
      x: (seg[midIndex - 1].x + seg[midIndex].x) / 2,
      y: (seg[midIndex - 1].y + seg[midIndex].y) / 2,
    };
  };

  // Get centroid of a polygon segment
  const getSegmentCentroid = (seg: Point[]): { x: number; y: number } => {
    if (seg.length === 0) return { x: 0, y: 0 };
    let cx = 0, cy = 0;
    seg.forEach((p) => { cx += p.x; cy += p.y; });
    return { x: cx / seg.length, y: cy / seg.length };
  };

  if (measurementType === 'count') {
    // Count uses segments - each segment is a count point
    return (
      <Group>
        {allSegments.map((seg, segIdx) => {
          const isSegmentSelected = isSelected && selectedSegmentIndex === segIdx;
          return (
            <Group key={segIdx}>
              {/* Highlight ring for selected count */}
              {isSegmentSelected && (
                <Circle
                  x={seg[0].x}
                  y={seg[0].y}
                  radius={18}
                  fill="transparent"
                  stroke="#fff"
                  strokeWidth={4}
                  listening={false}
                />
              )}
              <Circle
                x={seg[0].x}
                y={seg[0].y}
                radius={isSegmentSelected ? 14 : 12}
                fill={color}
                stroke={isSegmentSelected ? '#fff' : isSelected ? '#fff' : color}
                strokeWidth={isSegmentSelected ? 4 : isSelected ? 3 : 2}
                opacity={isSegmentSelected ? 1 : 0.8}
                draggable={isSegmentSelected}
                onClick={() => onSegmentClick(measurement.id, segIdx)}
                onTap={() => onSegmentClick(measurement.id, segIdx)}
                onDragMove={(e) => {
                  if (isSegmentSelected) {
                    onPointDrag(measurement.id, segIdx * 1000, { x: e.target.x(), y: e.target.y() });
                  }
                }}
                style={{ cursor: isSegmentSelected ? 'move' : 'pointer' }}
              />
              <Text
                x={seg[0].x - 5}
                y={seg[0].y - 6}
                text="1"
                fontSize={12}
                fill="#fff"
                fontStyle="bold"
                listening={false}
              />
              {segIdx === 0 && (
                <Text
                  x={seg[0].x + 16}
                  y={seg[0].y - 6}
                  text={name}
                  fontSize={10}
                  fill={color}
                  fontStyle="bold"
                  listening={false}
                />
              )}
            </Group>
          );
        })}
      </Group>
    );
  }

  if (measurementType === 'linear') {
    // Get subtractions for this measurement
    const segmentSubtractions = subtractions || [];

    return (
      <Group>
        {allSegments.map((seg, segIdx) => {
          const flatPoints = seg.flatMap((p) => [p.x, p.y]);
          const segValue = calcSegmentLength(seg);
          const midpoint = getSegmentMidpoint(seg);
          const isSegmentSelected = isSelected && selectedSegmentIndex === segIdx;
          const isBeingSubtractedFrom = subtractingFromSegment?.measurementId === measurement.id && subtractingFromSegment?.segmentIndex === segIdx;

          // Get subtractions for this segment
          const segSubs = segmentSubtractions.filter(s => s.segmentIndex === segIdx);
          const subtractionTotal = segSubs.reduce((sum, s) => sum + s.value, 0);
          const netValue = segValue - subtractionTotal;

          return (
            <Group key={segIdx}>
              {/* Clickable hit area for segment selection */}
              <Line
                points={flatPoints}
                stroke="transparent"
                strokeWidth={20}
                lineCap="round"
                lineJoin="round"
                onClick={() => onSegmentClick(measurement.id, segIdx)}
                onTap={() => onSegmentClick(measurement.id, segIdx)}
                style={{ cursor: 'pointer' }}
              />
              {/* Highlight for selected segment */}
              {isSegmentSelected && (
                <Line
                  points={flatPoints}
                  stroke="#fff"
                  strokeWidth={8}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              )}
              {/* Highlight when being subtracted from */}
              {isBeingSubtractedFrom && (
                <Line
                  points={flatPoints}
                  stroke="#ef4444"
                  strokeWidth={8}
                  lineCap="round"
                  lineJoin="round"
                  dash={[10, 5]}
                  listening={false}
                />
              )}
              <Line
                points={flatPoints}
                stroke={color}
                strokeWidth={isSegmentSelected ? 5 : isSelected ? 4 : 3}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
              {isSegmentSelected && seg.map((point, i) => (
                <Circle
                  key={i}
                  x={point.x}
                  y={point.y}
                  radius={8}
                  fill="#fff"
                  stroke={color}
                  strokeWidth={3}
                  draggable={true}
                  onDragMove={(e) => {
                    onPointDrag(measurement.id, segIdx * 1000 + i, { x: e.target.x(), y: e.target.y() });
                  }}
                  style={{ cursor: 'move' }}
                />
              ))}

              {/* Render subtractions for this segment */}
              {segSubs.map((sub) => {
                const subFlatPoints = sub.points.flatMap((p) => [p.x, p.y]);
                const subMidpoint = getSegmentMidpoint(sub.points);
                return (
                  <Group key={sub.id}>
                    <Line
                      points={subFlatPoints}
                      stroke="#ef4444"
                      strokeWidth={2}
                      lineCap="round"
                      lineJoin="round"
                      dash={[6, 4]}
                      opacity={0.8}
                      listening={false}
                    />
                    {/* Subtraction label */}
                    <Group x={subMidpoint.x} y={subMidpoint.y - 15} listening={false}>
                      <Rect
                        x={-25}
                        y={-7}
                        width={50}
                        height={14}
                        fill="#fef2f2"
                        stroke="#ef4444"
                        strokeWidth={1}
                        cornerRadius={2}
                        opacity={0.95}
                      />
                      <Text
                        x={-23}
                        y={-5}
                        text={`-${formatMeasurement(sub.value, unit)}`}
                        fontSize={9}
                        fill="#dc2626"
                        fontStyle="bold"
                      />
                    </Group>
                  </Group>
                );
              })}

              {/* Segment label - show net value if subtractions exist */}
              <Group x={midpoint.x} y={midpoint.y - 20} listening={false}>
                <Rect
                  x={-30}
                  y={-8}
                  width={segSubs.length > 0 ? 70 : 60}
                  height={18}
                  fill={isSegmentSelected ? color : 'white'}
                  cornerRadius={3}
                  opacity={0.9}
                />
                <Text
                  x={-28}
                  y={-6}
                  text={segSubs.length > 0 ? `${formatMeasurement(netValue, unit)} net` : formatMeasurement(segValue, unit)}
                  fontSize={11}
                  fill={isSegmentSelected ? '#fff' : color}
                  fontStyle="bold"
                />
              </Group>

              {/* Subtract button - show when segment is selected and not in subtract mode */}
              {isSegmentSelected && !isSubtractMode && onStartSubtract && (
                <Group x={midpoint.x + 45} y={midpoint.y - 20}>
                  <Rect
                    x={0}
                    y={-8}
                    width={18}
                    height={18}
                    fill="#ef4444"
                    cornerRadius={3}
                    onClick={() => onStartSubtract(measurement.id, segIdx)}
                    onTap={() => onStartSubtract(measurement.id, segIdx)}
                    style={{ cursor: 'pointer' }}
                  />
                  <Text
                    x={5}
                    y={-4}
                    text="−"
                    fontSize={14}
                    fill="#fff"
                    fontStyle="bold"
                    listening={false}
                  />
                </Group>
              )}
            </Group>
          );
        })}
      </Group>
    );
  }

  if (measurementType === 'area') {
    // Get subtractions for this measurement
    const segmentSubtractions = subtractions || [];

    return (
      <Group>
        {allSegments.map((seg, segIdx) => {
          const flatPoints = seg.flatMap((p) => [p.x, p.y]);
          const segValue = calcSegmentArea(seg);
          const centroid = getSegmentCentroid(seg);
          const isSegmentSelected = isSelected && selectedSegmentIndex === segIdx;
          const isBeingSubtractedFrom = subtractingFromSegment?.measurementId === measurement.id && subtractingFromSegment?.segmentIndex === segIdx;

          // Get subtractions for this segment
          const segSubs = segmentSubtractions.filter(s => s.segmentIndex === segIdx);
          const subtractionTotal = segSubs.reduce((sum, s) => sum + s.value, 0);
          const netValue = segValue - subtractionTotal;

          return (
            <Group key={segIdx}>
              {/* Clickable hit area for segment selection */}
              <Line
                points={flatPoints}
                stroke="transparent"
                strokeWidth={15}
                fill="transparent"
                closed
                onClick={() => onSegmentClick(measurement.id, segIdx)}
                onTap={() => onSegmentClick(measurement.id, segIdx)}
                style={{ cursor: 'pointer' }}
              />
              {/* Highlight for selected segment */}
              {isSegmentSelected && (
                <Line
                  points={flatPoints}
                  stroke="#fff"
                  strokeWidth={6}
                  closed
                  listening={false}
                />
              )}
              {/* Highlight when being subtracted from */}
              {isBeingSubtractedFrom && (
                <Line
                  points={flatPoints}
                  stroke="#ef4444"
                  strokeWidth={6}
                  closed
                  dash={[10, 5]}
                  listening={false}
                />
              )}
              <Line
                points={flatPoints}
                stroke={color}
                strokeWidth={isSegmentSelected ? 4 : isSelected ? 3 : 2}
                fill={color}
                opacity={isSegmentSelected ? 0.5 : 0.3}
                closed
                listening={false}
              />
              <Line
                points={flatPoints}
                stroke={color}
                strokeWidth={isSegmentSelected ? 4 : isSelected ? 3 : 2}
                closed
                listening={false}
              />
              {isSegmentSelected && seg.map((point, i) => (
                <Circle
                  key={i}
                  x={point.x}
                  y={point.y}
                  radius={8}
                  fill="#fff"
                  stroke={color}
                  strokeWidth={3}
                  draggable={true}
                  onDragMove={(e) => {
                    onPointDrag(measurement.id, segIdx * 1000 + i, { x: e.target.x(), y: e.target.y() });
                  }}
                  style={{ cursor: 'move' }}
                />
              ))}

              {/* Render subtractions for this segment (area subtractions) */}
              {segSubs.map((sub) => {
                const subFlatPoints = sub.points.flatMap((p) => [p.x, p.y]);
                const subCentroid = getSegmentCentroid(sub.points);
                return (
                  <Group key={sub.id}>
                    <Line
                      points={subFlatPoints}
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="#ef4444"
                      opacity={0.2}
                      closed
                      dash={[6, 4]}
                      listening={false}
                    />
                    <Line
                      points={subFlatPoints}
                      stroke="#ef4444"
                      strokeWidth={2}
                      closed
                      dash={[6, 4]}
                      opacity={0.8}
                      listening={false}
                    />
                    {/* Subtraction label */}
                    <Group x={subCentroid.x} y={subCentroid.y} listening={false}>
                      <Rect
                        x={-30}
                        y={-8}
                        width={60}
                        height={16}
                        fill="#fef2f2"
                        stroke="#ef4444"
                        strokeWidth={1}
                        cornerRadius={2}
                        opacity={0.95}
                      />
                      <Text
                        x={-28}
                        y={-5}
                        text={`-${formatMeasurement(sub.value, unit)}`}
                        fontSize={10}
                        fill="#dc2626"
                        fontStyle="bold"
                      />
                    </Group>
                  </Group>
                );
              })}

              {/* Segment label - show net value if subtractions exist */}
              <Group x={centroid.x} y={centroid.y} listening={false}>
                <Rect
                  x={-35}
                  y={-10}
                  width={segSubs.length > 0 ? 80 : 70}
                  height={20}
                  fill={isSegmentSelected ? color : 'white'}
                  cornerRadius={3}
                  opacity={0.9}
                />
                <Text
                  x={-33}
                  y={-7}
                  text={segSubs.length > 0 ? `${formatMeasurement(netValue, unit)} net` : formatMeasurement(segValue, unit)}
                  fontSize={12}
                  fill={isSegmentSelected ? '#fff' : color}
                  fontStyle="bold"
                />
              </Group>

              {/* Subtract button - show when segment is selected and not in subtract mode */}
              {isSegmentSelected && !isSubtractMode && onStartSubtract && (
                <Group x={centroid.x + 50} y={centroid.y}>
                  <Rect
                    x={0}
                    y={-10}
                    width={20}
                    height={20}
                    fill="#ef4444"
                    cornerRadius={3}
                    onClick={() => onStartSubtract(measurement.id, segIdx)}
                    onTap={() => onStartSubtract(measurement.id, segIdx)}
                    style={{ cursor: 'pointer' }}
                  />
                  <Text
                    x={5}
                    y={-6}
                    text="−"
                    fontSize={16}
                    fill="#fff"
                    fontStyle="bold"
                    listening={false}
                  />
                </Group>
              )}
            </Group>
          );
        })}
      </Group>
    );
  }

  return null;
}

interface CurrentDrawingProps {
  points: Point[];
  mousePos: Point | null;
  activeTool: string;
  color: string;
  pageScale: PageScale | null;
}

function CurrentDrawing({ points, mousePos, activeTool, color, pageScale }: CurrentDrawingProps) {
  const allPoints = mousePos ? [...points, mousePos] : points;
  const flatPoints = allPoints.flatMap((p) => [p.x, p.y]);

  // Calculate distance between two points
  const calculateDistance = (p1: Point, p2: Point): number => {
    const pixelDistance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    if (pageScale) {
      return pixelDistance / pageScale.pixelsPerUnit;
    }
    return pixelDistance;
  };

  // Calculate total length of all segments
  const calculateTotalLength = (pts: Point[]): number => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += calculateDistance(pts[i - 1], pts[i]);
    }
    return total;
  };

  // Calculate polygon area using shoelace formula
  const calculatePolygonArea = (pts: Point[]): number => {
    if (pts.length < 3) return 0;
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    area = Math.abs(area) / 2;
    if (pageScale) {
      area = area / Math.pow(pageScale.pixelsPerUnit, 2);
    }
    return area;
  };

  // Get current segment distance (from last point to mouse)
  const currentSegmentDistance = mousePos && points.length > 0
    ? calculateDistance(points[points.length - 1], mousePos)
    : 0;

  // Get total distance including current segment
  const totalDistance = calculateTotalLength(allPoints);

  // Get area for area tool or subtract tool (when subtracting from area)
  const currentArea = (activeTool === 'area' || activeTool === 'subtract') && allPoints.length >= 3
    ? calculatePolygonArea(allPoints)
    : 0;

  // Check if this is a subtraction
  const isSubtraction = activeTool === 'subtract';

  // Format the measurement display
  const unit = pageScale ? '' : 'px';
  const formatValue = (val: number, forArea?: boolean) => {
    const prefix = isSubtraction ? '-' : '';
    if (pageScale) {
      return prefix + formatMeasurement(val, forArea ? 'SF' : 'LF');
    }
    return `${prefix}${val.toFixed(0)}${unit}`;
  };

  return (
    <Group>
      <Line
        points={flatPoints}
        stroke={color}
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        closed={activeTool === 'area'}
        fill={activeTool === 'area' ? color : undefined}
        opacity={activeTool === 'area' ? 0.3 : 1}
        dash={[5, 5]}
      />
      {points.map((point, i) => (
        <Circle
          key={i}
          x={point.x}
          y={point.y}
          radius={5}
          fill={color}
          stroke="#fff"
          strokeWidth={1}
        />
      ))}
      {mousePos && (
        <>
          <Circle
            x={mousePos.x}
            y={mousePos.y}
            radius={5}
            fill={color}
            stroke="#fff"
            strokeWidth={1}
            opacity={0.5}
          />
          {/* Live measurement label near cursor */}
          <Group x={mousePos.x + 15} y={mousePos.y - 25}>
            <Rect
              x={0}
              y={0}
              width={isSubtraction ? 95 : (activeTool === 'area' ? 90 : 75)}
              height={(activeTool === 'area' || isSubtraction) && allPoints.length >= 3 ? 38 : 22}
              fill={isSubtraction ? "rgba(185, 28, 28, 0.9)" : "rgba(0, 0, 0, 0.8)"}
              cornerRadius={4}
            />
            {/* Current segment distance */}
            <Text
              x={5}
              y={4}
              text={isSubtraction ? `Subtract: ${formatValue(currentSegmentDistance)}` : `Seg: ${formatValue(currentSegmentDistance)}`}
              fontSize={10}
              fill="#fff"
            />
            {/* Total distance (for linear) or show total + area (for area) */}
            {activeTool === 'linear' && points.length > 0 && (
              <Text
                x={5}
                y={14}
                text={`Total: ${formatValue(totalDistance)}`}
                fontSize={10}
                fill="#4ade80"
                fontStyle="bold"
              />
            )}
            {activeTool === 'area' && (
              <>
                <Text
                  x={5}
                  y={14}
                  text={`Perim: ${formatValue(totalDistance)}`}
                  fontSize={10}
                  fill="#fff"
                />
                {allPoints.length >= 3 && (
                  <Text
                    x={5}
                    y={24}
                    text={`Area: ${formatValue(currentArea, true)}`}
                    fontSize={10}
                    fill="#4ade80"
                    fontStyle="bold"
                  />
                )}
              </>
            )}
            {/* Subtraction mode shows length or area depending on what's being subtracted */}
            {isSubtraction && points.length > 0 && (
              <Text
                x={5}
                y={14}
                text={`Total: ${formatValue(totalDistance)}`}
                fontSize={10}
                fill="#fca5a5"
                fontStyle="bold"
              />
            )}
          </Group>
        </>
      )}
      {/* Show segment labels along each completed segment */}
      {points.length >= 2 && points.map((point, i) => {
        if (i === 0) return null;
        const prevPoint = points[i - 1];
        const segmentDist = calculateDistance(prevPoint, point);
        const midX = (prevPoint.x + point.x) / 2;
        const midY = (prevPoint.y + point.y) / 2;

        return (
          <Group key={`seg-${i}`} x={midX} y={midY - 12}>
            <Rect
              x={-25}
              y={-8}
              width={50}
              height={16}
              fill="rgba(255, 255, 255, 0.9)"
              cornerRadius={3}
            />
            <Text
              x={-23}
              y={-5}
              text={formatValue(segmentDist)}
              fontSize={9}
              fill={color}
              fontStyle="bold"
            />
          </Group>
        );
      })}
    </Group>
  );
}

interface NoteMarkerProps {
  note: PlanNote;
  isSelected: boolean;
}

function NoteMarker({ note, isSelected }: NoteMarkerProps) {
  const { position, text, color } = note;

  // Wrap text to max width
  const maxWidth = 150;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > 25) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);

  // Limit to 4 lines
  const displayLines = lines.slice(0, 4);
  if (lines.length > 4) {
    displayLines[3] = displayLines[3].slice(0, -3) + '...';
  }

  const lineHeight = 14;
  const padding = 8;
  const boxHeight = displayLines.length * lineHeight + padding * 2;
  const boxWidth = Math.min(maxWidth, Math.max(...displayLines.map(l => l.length * 7)) + padding * 2);

  return (
    <Group x={position.x} y={position.y}>
      {/* Pin/marker */}
      <Circle
        x={0}
        y={0}
        radius={8}
        fill={color}
        stroke={isSelected ? '#000' : '#fff'}
        strokeWidth={isSelected ? 3 : 2}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={4}
        shadowOffsetY={2}
      />
      {/* Note icon in center */}
      <Text
        x={-4}
        y={-5}
        text="N"
        fontSize={10}
        fill="#fff"
        fontStyle="bold"
      />
      {/* Text bubble */}
      <Group x={12} y={-boxHeight / 2}>
        {/* Arrow pointing to marker */}
        <Line
          points={[-8, boxHeight / 2, 0, boxHeight / 2 - 6, 0, boxHeight / 2 + 6]}
          fill={color}
          closed
        />
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={boxWidth}
          height={boxHeight}
          fill={color}
          cornerRadius={4}
          shadowColor="rgba(0,0,0,0.2)"
          shadowBlur={6}
          shadowOffsetY={2}
          stroke={isSelected ? '#000' : undefined}
          strokeWidth={isSelected ? 2 : 0}
        />
        {/* Text lines */}
        {displayLines.map((line, i) => (
          <Text
            key={i}
            x={padding}
            y={padding + i * lineHeight}
            text={line}
            fontSize={11}
            fill="#000"
            fontFamily="Arial"
          />
        ))}
      </Group>
    </Group>
  );
}

interface QuickMeasurementDisplayProps {
  quickMeasurement: QuickMeasurement;
  isSelected: boolean;
  pageScale: PageScale | null;
  onPointDrag: (quickMeasurementId: string, pointIndex: number, newPos: Point) => void;
}

function QuickMeasurementDisplay({ quickMeasurement, isSelected, pageScale, onPointDrag }: QuickMeasurementDisplayProps) {
  const { points } = quickMeasurement;
  const color = '#f59e0b'; // amber color for quick measure
  const flatPoints = points.flatMap((p) => [p.x, p.y]);
  const arrowSize = 10;

  // Calculate distance between two points
  const calculateDistance = (p1: Point, p2: Point): number => {
    const pixelDistance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    if (pageScale) {
      return pixelDistance / pageScale.pixelsPerUnit;
    }
    return pixelDistance;
  };

  // Calculate total length
  const calculateTotalLength = (pts: Point[]): number => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += calculateDistance(pts[i - 1], pts[i]);
    }
    return total;
  };

  // Get arrow points for a given position and angle
  const getArrowPoints = (tip: Point, angle: number, size: number): number[] => {
    const angle1 = angle + Math.PI * 0.8;
    const angle2 = angle - Math.PI * 0.8;
    return [
      tip.x, tip.y,
      tip.x + Math.cos(angle1) * size, tip.y + Math.sin(angle1) * size,
      tip.x + Math.cos(angle2) * size, tip.y + Math.sin(angle2) * size,
    ];
  };

  const totalLength = calculateTotalLength(points);

  // Format the measurement
  const formatValue = (val: number) => {
    if (pageScale) {
      return formatMeasurement(val, 'LF');
    }
    return `${val.toFixed(0)}px`;
  };

  // Calculate midpoint for total label (for multi-segment lines)
  let midX = 0, midY = 0;
  if (points.length >= 2) {
    const midIndex = Math.floor(points.length / 2);
    midX = (points[midIndex - 1].x + points[midIndex].x) / 2;
    midY = (points[midIndex - 1].y + points[midIndex].y) / 2;
  }

  return (
    <Group>
      {/* Main line */}
      <Line
        points={flatPoints}
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />

      {/* Arrows pointing outward from center */}
      {points.length >= 2 && (
        <>
          {/* Arrow at start pointing outward (away from point 1) */}
          <Line
            points={getArrowPoints(
              points[0],
              Math.atan2(points[0].y - points[1].y, points[0].x - points[1].x),
              arrowSize
            )}
            fill={color}
            stroke={color}
            strokeWidth={isSelected ? 2 : 1.5}
            closed
            listening={false}
          />
          {/* Arrow at end pointing outward (away from second-to-last point) */}
          <Line
            points={getArrowPoints(
              points[points.length - 1],
              Math.atan2(
                points[points.length - 1].y - points[points.length - 2].y,
                points[points.length - 1].x - points[points.length - 2].x
              ),
              arrowSize
            )}
            fill={color}
            stroke={color}
            strokeWidth={isSelected ? 2 : 1.5}
            closed
            listening={false}
          />
        </>
      )}

      {/* Draggable points - only visible when selected */}
      {isSelected && points.map((point, i) => (
        <Circle
          key={i}
          x={point.x}
          y={point.y}
          radius={8}
          fill="#fff"
          stroke={color}
          strokeWidth={3}
          draggable={true}
          onDragMove={(e) => {
            onPointDrag(quickMeasurement.id, i, { x: e.target.x(), y: e.target.y() });
          }}
          style={{ cursor: 'move' }}
        />
      ))}

      {/* Total length label centered on the line */}
      {points.length >= 2 && (
        <Group x={midX} y={midY} listening={false}>
          <Rect
            x={-22}
            y={-7}
            width={44}
            height={14}
            fill="white"
            cornerRadius={2}
            opacity={0.9}
          />
          <Text
            x={-20}
            y={-5}
            text={formatValue(totalLength)}
            fontSize={9}
            fill={color}
            fontStyle="bold"
          />
        </Group>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <Group x={points[0].x} y={points[0].y - 40} listening={false}>
          <Rect
            x={-35}
            y={-8}
            width={70}
            height={16}
            fill="rgba(0, 0, 0, 0.85)"
            cornerRadius={3}
          />
          <Text
            x={-30}
            y={-5}
            text="Drag points to edit"
            fontSize={9}
            fill="#fff"
          />
        </Group>
      )}
    </Group>
  );
}

interface ReferenceLineDisplayProps {
  referenceLine: ReferenceLine;
  isSelected: boolean;
  onPointDrag: (lineId: string, pointIndex: number, newPos: Point) => void;
}

function ReferenceLineDisplay({ referenceLine, isSelected, onPointDrag }: ReferenceLineDisplayProps) {
  const { points, color } = referenceLine;
  const flatPoints = points.flatMap((p) => [p.x, p.y]);

  return (
    <Group>
      {/* Main line - no endpoints, no measurement label */}
      <Line
        points={flatPoints}
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />

      {/* Draggable points - only visible when selected */}
      {isSelected && points.map((point, i) => (
        <Circle
          key={i}
          x={point.x}
          y={point.y}
          radius={8}
          fill="#fff"
          stroke={color}
          strokeWidth={3}
          draggable={true}
          onDragMove={(e) => {
            onPointDrag(referenceLine.id, i, { x: e.target.x(), y: e.target.y() });
          }}
          style={{ cursor: 'move' }}
        />
      ))}

      {/* Selection indicator */}
      {isSelected && (
        <Group x={points[0].x} y={points[0].y - 30} listening={false}>
          <Rect
            x={-35}
            y={-8}
            width={70}
            height={16}
            fill="rgba(0, 0, 0, 0.85)"
            cornerRadius={3}
          />
          <Text
            x={-30}
            y={-5}
            text="DEL to remove"
            fontSize={9}
            fill="#fff"
          />
        </Group>
      )}
    </Group>
  );
}
