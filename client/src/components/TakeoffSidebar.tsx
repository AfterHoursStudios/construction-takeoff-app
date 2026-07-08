import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Package,
  Play,
  Layers,
  X,
  Minus,
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { formatMeasurement } from '../utils/format';
import MaterialsModal from './MaterialsModal';
import type { Measurement, Point } from '../types';

export default function TakeoffSidebar() {
  const {
    currentProject,
    measurements,
    selectedMeasurementId,
    setSelectedMeasurement,
    setSelectedSegment,
    updateMeasurement,
    deleteMeasurement,
    deleteSubtraction,
    setCurrentPage,
    getPageName,
    getPageScale,
    setActiveTool,
    setDrawingConfig,
    setContinuingMeasurementName,
    setSubtractingFromSegment,
  } = useProjectStore();

  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set([1]));
  const [expandedMeasurements, setExpandedMeasurements] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);

  // Helper to calculate segment value
  const calculateSegmentValue = (segment: Point[], measurementType: string, projectId: string, pageNumber: number): number => {
    const scale = getPageScale(projectId, pageNumber);
    const pixelsPerUnit = scale?.pixelsPerUnit || 1;

    if (measurementType === 'linear') {
      let total = 0;
      for (let i = 1; i < segment.length; i++) {
        const dx = segment[i].x - segment[i - 1].x;
        const dy = segment[i].y - segment[i - 1].y;
        total += Math.sqrt(dx * dx + dy * dy);
      }
      return total / pixelsPerUnit;
    } else if (measurementType === 'area') {
      if (segment.length < 3) return 0;
      let area = 0;
      const n = segment.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += segment[i].x * segment[j].y;
        area -= segment[j].x * segment[i].y;
      }
      area = Math.abs(area) / 2;
      return area / (pixelsPerUnit * pixelsPerUnit);
    } else if (measurementType === 'count') {
      return 1;
    }
    return 0;
  };

  const toggleSections = (measurementId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(measurementId)) {
        next.delete(measurementId);
      } else {
        next.add(measurementId);
      }
      return next;
    });
  };

  const handleDeleteSegment = (e: React.MouseEvent, measurement: Measurement, segmentIndex: number) => {
    e.stopPropagation();

    const allSegments = measurement.segments && measurement.segments.length > 0
      ? measurement.segments
      : [measurement.points];

    // If only one segment, delete entire measurement
    if (allSegments.length <= 1) {
      if (window.confirm('Delete this measurement?')) {
        deleteMeasurement(measurement.id);
      }
      return;
    }

    if (!window.confirm('Delete this section?')) return;

    // Remove the segment
    const newSegments = allSegments.filter((_, idx) => idx !== segmentIndex);

    // Recalculate total value
    let newValue = 0;
    newSegments.forEach(seg => {
      newValue += calculateSegmentValue(seg, measurement.measurementType, measurement.projectId, measurement.pageNumber);
    });

    // Helper functions for stud/plate calculations
    const calcStudCount = (linearFeet: number, spacing: number, extra: number) => {
      return Math.ceil((linearFeet * 12) / spacing) + 1 + extra;
    };
    const calcPlateCount = (linearFeet: number, plateLength: number, plateCount: number) => {
      return Math.ceil(linearFeet / plateLength) * plateCount;
    };

    // Recalculate material quantities
    const updatedMaterials = measurement.materials.map((mat) => {
      if (mat.isStud && mat.studSpacing) {
        return { ...mat, quantity: calcStudCount(newValue, mat.studSpacing, mat.studExtra || 0) };
      } else if (mat.isPlate && mat.plateLength) {
        return { ...mat, quantity: calcPlateCount(newValue, mat.plateLength, mat.plateCount || 1) };
      } else if (mat.hasCoverage && mat.coverageAmount) {
        return { ...mat, quantity: newValue / mat.coverageAmount };
      }
      return mat;
    });

    updateMeasurement(measurement.id, {
      segments: newSegments,
      points: newSegments[0] || [],
      value: newValue,
      materials: updatedMaterials,
    });
  };

  const handleSelectSegment = (measurement: Measurement, segmentIndex: number) => {
    setSelectedSegment(measurement.id, segmentIndex);
    setCurrentPage(measurement.pageNumber);
  };

  const handleDeleteSubtraction = (e: React.MouseEvent, measurementId: string, subtractionId: string) => {
    e.stopPropagation();
    deleteSubtraction(measurementId, subtractionId);
  };

  const handleStartSubtract = (e: React.MouseEvent, measurement: Measurement, segmentIndex: number) => {
    e.stopPropagation();
    setSubtractingFromSegment({ measurementId: measurement.id, segmentIndex });
    setCurrentPage(measurement.pageNumber);
  };

  // Calculate net value for a segment (gross - subtractions)
  const calculateSegmentNetValue = (measurement: Measurement, segmentIndex: number): number => {
    const segment = measurement.segments?.[segmentIndex] || measurement.points;
    const grossValue = calculateSegmentValue(segment, measurement.measurementType, measurement.projectId, measurement.pageNumber);
    const segmentSubtractions = (measurement.subtractions || []).filter(s => s.segmentIndex === segmentIndex);
    const subtractionTotal = segmentSubtractions.reduce((sum, s) => sum + s.value, 0);
    return grossValue - subtractionTotal;
  };

  // Calculate total net value for measurement (sum of all segments minus all subtractions)
  const calculateMeasurementNetValue = (measurement: Measurement): number => {
    const subtractionTotal = (measurement.subtractions || []).reduce((sum, s) => sum + s.value, 0);
    return measurement.value - subtractionTotal;
  };

  // Get all measurements for current project
  const projectMeasurements = useMemo(() => {
    if (!currentProject) return [];
    return measurements.filter((m) => m.projectId === currentProject.id);
  }, [currentProject, measurements]);

  // Group measurements by page
  const measurementsByPage = useMemo(() => {
    const pageMap = new Map<number, Measurement[]>();

    projectMeasurements.forEach((measurement) => {
      if (!pageMap.has(measurement.pageNumber)) {
        pageMap.set(measurement.pageNumber, []);
      }
      pageMap.get(measurement.pageNumber)!.push(measurement);
    });

    // Sort pages by page number
    return new Map([...pageMap.entries()].sort((a, b) => a[0] - b[0]));
  }, [projectMeasurements]);

  const togglePage = (pageNumber: number) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  const toggleMeasurement = (measurementId: string) => {
    setExpandedMeasurements((prev) => {
      const next = new Set(prev);
      if (next.has(measurementId)) {
        next.delete(measurementId);
      } else {
        next.add(measurementId);
      }
      return next;
    });
  };

  const handleToggleVisibility = (e: React.MouseEvent, measurement: Measurement) => {
    e.stopPropagation();
    updateMeasurement(measurement.id, { isVisible: !measurement.isVisible });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this measurement?')) {
      deleteMeasurement(id);
    }
  };

  const handleSelectMeasurement = (measurement: Measurement) => {
    setSelectedMeasurement(measurement.id);
    setCurrentPage(measurement.pageNumber);
  };

  const handleOpenMaterials = (e: React.MouseEvent, measurement: Measurement) => {
    e.stopPropagation();
    setEditingMeasurement(measurement);
  };

  const handleContinueMeasuring = (e: React.MouseEvent, measurement: Measurement) => {
    e.stopPropagation();
    // Set color and tool type to match this measurement
    setDrawingConfig({ color: measurement.color, lineWeight: measurement.lineWeight || 3 });
    setContinuingMeasurementName(measurement.name);
    setActiveTool(measurement.measurementType);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const result = {
      linear: 0,
      area: 0,
      count: 0,
    };

    projectMeasurements.forEach((m) => {
      // Use net value (gross - subtractions) for totals
      const netValue = calculateMeasurementNetValue(m);
      if (m.measurementType === 'linear') {
        result.linear += netValue;
      } else if (m.measurementType === 'area') {
        result.area += netValue;
      } else if (m.measurementType === 'count') {
        result.count += netValue;
      }
    });

    return result;
  }, [projectMeasurements]);

  // Aggregate materials across all measurements (using net values)
  const materialTotals = useMemo(() => {
    const totals = new Map<string, { quantity: number; unit: string; rawValue: number; rawUnit: string }>();

    projectMeasurements.forEach((m) => {
      // Calculate net value for this measurement
      const netValue = calculateMeasurementNetValue(m);
      const grossValue = m.value;
      // Ratio to scale material quantities by (handles subtractions)
      const netRatio = grossValue > 0 ? netValue / grossValue : 1;

      m.materials.forEach((mat) => {
        const key = mat.name.toLowerCase();
        const existing = totals.get(key);
        const wasteFactor = 1 + (mat.wasteFactor || 0) / 100;

        if (mat.isStud && mat.quantity) {
          // Recalculate stud count based on net linear feet
          const qtyWithWaste = mat.quantity * netRatio * wasteFactor;
          if (existing) {
            existing.quantity += qtyWithWaste;
          } else {
            totals.set(key, { quantity: qtyWithWaste, unit: 'stud', rawValue: 0, rawUnit: m.unit });
          }
        } else if (mat.isPlate && mat.quantity) {
          const qtyWithWaste = mat.quantity * netRatio * wasteFactor;
          if (existing) {
            existing.quantity += qtyWithWaste;
          } else {
            totals.set(key, { quantity: qtyWithWaste, unit: 'plate', rawValue: 0, rawUnit: m.unit });
          }
        } else if (mat.hasCoverage && mat.quantity && mat.coverageUnit) {
          const qtyWithWaste = mat.quantity * netRatio * wasteFactor;
          if (existing) {
            existing.quantity += qtyWithWaste;
          } else {
            totals.set(key, { quantity: qtyWithWaste, unit: mat.coverageUnit, rawValue: 0, rawUnit: m.unit });
          }
        } else {
          // Use net value for raw value calculations too
          if (existing) {
            existing.rawValue += netValue;
          } else {
            totals.set(key, { quantity: 0, unit: '', rawValue: netValue, rawUnit: m.unit });
          }
        }
      });
    });

    return totals;
  }, [projectMeasurements, calculateMeasurementNetValue]);

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800">Takeoff Summary</h2>
        <p className="text-sm text-slate-500">
          {projectMeasurements.length} measurement{projectMeasurements.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Grand Totals */}
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold text-primary-600">
              {formatMeasurement(totals.linear, 'LF')}
            </div>
            <div className="text-xs text-slate-500">Linear</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-purple-600">
              {totals.area.toFixed(1)} SF
            </div>
            <div className="text-xs text-slate-500">Area</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">
              {totals.count}
            </div>
            <div className="text-xs text-slate-500">Count</div>
          </div>
        </div>
      </div>

      {/* Measurements by Page */}
      <div className="flex-1 overflow-y-auto">
        {measurementsByPage.size === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p>No measurements yet</p>
            <p className="text-sm mt-2">
              Select a tool and draw on the plan to start measuring
            </p>
          </div>
        ) : (
          Array.from(measurementsByPage.entries()).map(([pageNumber, pageMeasurements]) => (
            <div key={pageNumber} className="border-b border-slate-100">
              {/* Page Header */}
              <button
                onClick={() => togglePage(pageNumber)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedPages.has(pageNumber) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="font-medium text-slate-700">
                    {currentProject ? getPageName(currentProject.id, pageNumber) : `Page ${pageNumber}`}
                  </span>
                </div>
                <span className="text-sm text-slate-500">
                  {pageMeasurements.length} item{pageMeasurements.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Page Measurements */}
              {expandedPages.has(pageNumber) && (
                <div className="bg-slate-50 px-2 pb-2">
                  {pageMeasurements.map((measurement) => (
                    <div
                      key={measurement.id}
                      className={`mt-2 rounded-lg border transition-colors ${
                        selectedMeasurementId === measurement.id
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Measurement Header */}
                      <div
                        className="p-3 cursor-pointer group"
                        onClick={() => handleSelectMeasurement(measurement)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMeasurement(measurement.id);
                              }}
                              className="mt-0.5"
                            >
                              {expandedMeasurements.has(measurement.id) ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                              style={{ backgroundColor: measurement.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 truncate">
                                {measurement.name}
                              </div>
                              <div className="text-sm text-slate-500">
                                {(measurement.subtractions?.length || 0) > 0 ? (
                                  <>
                                    <span className="text-slate-400 line-through mr-1">
                                      {formatMeasurement(measurement.value, measurement.unit)}
                                    </span>
                                    <span className="text-green-600 font-medium">
                                      {formatMeasurement(calculateMeasurementNetValue(measurement), measurement.unit)}
                                    </span>
                                  </>
                                ) : (
                                  formatMeasurement(measurement.value, measurement.unit)
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleContinueMeasuring(e, measurement)}
                              className="p-1 hover:bg-green-100 rounded text-green-600"
                              title="Continue measuring with this tool"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleToggleVisibility(e, measurement)}
                              className="p-1 hover:bg-slate-100 rounded"
                              title={measurement.isVisible ? 'Hide' : 'Show'}
                            >
                              {measurement.isVisible ? (
                                <Eye className="w-4 h-4 text-slate-400" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, measurement.id)}
                              className="p-1 hover:bg-red-100 rounded text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content: Sections and Materials */}
                      {expandedMeasurements.has(measurement.id) && (
                        <div className="px-3 pb-3 pt-0">
                          <div className="border-t border-slate-100 pt-2">
                            {/* Sections List */}
                            {(() => {
                              const allSegments = measurement.segments && measurement.segments.length > 0
                                ? measurement.segments
                                : [measurement.points];

                              if (allSegments.length > 1 || measurement.measurementType !== 'count') {
                                return (
                                  <div className="mb-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSections(measurement.id);
                                      }}
                                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 mb-1"
                                    >
                                      {expandedSections.has(measurement.id) ? (
                                        <ChevronDown className="w-3 h-3" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3" />
                                      )}
                                      <Layers className="w-3 h-3" />
                                      <span>{allSegments.length} Section{allSegments.length !== 1 ? 's' : ''}</span>
                                    </button>

                                    {expandedSections.has(measurement.id) && (
                                      <div className="space-y-1 ml-4">
                                        {allSegments.map((segment, idx) => {
                                          const segValue = calculateSegmentValue(
                                            segment,
                                            measurement.measurementType,
                                            measurement.projectId,
                                            measurement.pageNumber
                                          );
                                          const segSubtractions = (measurement.subtractions || []).filter(s => s.segmentIndex === idx);
                                          const segNetValue = calculateSegmentNetValue(measurement, idx);
                                          const hasSubtractions = segSubtractions.length > 0;

                                          return (
                                            <div key={idx}>
                                              <div
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleSelectSegment(measurement, idx);
                                                }}
                                                className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer group"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: measurement.color }}
                                                  />
                                                  <span className="text-slate-600">Section {idx + 1}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  {hasSubtractions ? (
                                                    <span className="text-green-600 font-medium">
                                                      {formatMeasurement(segNetValue, measurement.unit)}
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-700 font-medium">
                                                      {formatMeasurement(segValue, measurement.unit)}
                                                    </span>
                                                  )}
                                                  <button
                                                    onClick={(e) => handleStartSubtract(e, measurement, idx)}
                                                    className="p-0.5 hover:bg-red-100 rounded text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Add subtraction"
                                                  >
                                                    <Minus className="w-3 h-3" />
                                                  </button>
                                                  <button
                                                    onClick={(e) => handleDeleteSegment(e, measurement, idx)}
                                                    className="p-0.5 hover:bg-red-100 rounded text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete section"
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              </div>
                                              {/* Show subtractions for this segment */}
                                              {segSubtractions.map((sub) => (
                                                <div
                                                  key={sub.id}
                                                  className="flex items-center justify-between text-xs py-1 px-2 ml-4 bg-red-50 border-l-2 border-red-300 rounded-r cursor-default group"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Minus className="w-2 h-2 text-red-400" />
                                                    <span className="text-red-600">Subtraction</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-red-600 font-medium">
                                                      -{formatMeasurement(sub.value, measurement.unit)}
                                                    </span>
                                                    <button
                                                      onClick={(e) => handleDeleteSubtraction(e, measurement.id, sub.id)}
                                                      className="p-0.5 hover:bg-red-100 rounded text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                      title="Delete subtraction"
                                                    >
                                                      <X className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Materials List */}
                            {measurement.materials.length > 0 ? (
                              <div className="space-y-1">
                                {measurement.materials.map((material) => {
                                  // Calculate net ratio to adjust quantities for subtractions
                                  const netValue = calculateMeasurementNetValue(measurement);
                                  const grossValue = measurement.value;
                                  const netRatio = grossValue > 0 ? netValue / grossValue : 1;

                                  return (
                                    <div
                                      key={material.id}
                                      className="flex items-center justify-between text-sm py-1 px-2 bg-slate-50 rounded"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Package className="w-3 h-3 text-slate-400" />
                                        <span className="text-slate-700">{material.name}</span>
                                      </div>
                                      <span className="text-slate-600 font-medium">
                                        {(() => {
                                          const wasteFactor = 1 + (material.wasteFactor || 0) / 100;
                                          const adjustedQty = material.quantity ? material.quantity * netRatio : undefined;
                                          if (material.isStud && adjustedQty) {
                                            return `${Math.ceil(adjustedQty * wasteFactor)} studs`;
                                          } else if (material.isPlate && adjustedQty) {
                                            return `${Math.ceil(adjustedQty * wasteFactor)} plates`;
                                          } else if (material.hasCoverage && adjustedQty) {
                                            return `${Math.ceil(adjustedQty * wasteFactor)} ${material.coverageUnit}s`;
                                          }
                                          return formatMeasurement(netValue, measurement.unit);
                                        })()}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic mb-2">No materials added</p>
                            )}
                            <button
                              onClick={(e) => handleOpenMaterials(e, measurement)}
                              className="mt-2 w-full py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded border border-dashed border-primary-300 flex items-center justify-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              {measurement.materials.length > 0 ? 'Edit Materials' : 'Add Material'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {/* Material Totals Section */}
        {materialTotals.size > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Material Totals
            </h3>
            <div className="space-y-2">
              {Array.from(materialTotals.entries()).map(([name, data]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span className="text-slate-600 capitalize">{name}</span>
                  <span className="font-medium text-slate-800">
                    {data.quantity > 0
                      ? `${Math.ceil(data.quantity)} ${data.unit}s`
                      : formatMeasurement(data.rawValue, data.rawUnit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Materials Modal */}
      {editingMeasurement && (
        <MaterialsModal
          measurement={editingMeasurement}
          onClose={() => setEditingMeasurement(null)}
        />
      )}
    </div>
  );
}
