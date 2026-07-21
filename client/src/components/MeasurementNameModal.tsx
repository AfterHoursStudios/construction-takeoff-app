import { useState, useEffect, useRef } from 'react';
import { X, Ruler, Square, Hash } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { formatMeasurement } from '../utils/format';
import type { Measurement, MeasurementMaterial } from '../types';

interface MeasurementNameModalProps {
  onClose: () => void;
}

export default function MeasurementNameModal({ onClose }: MeasurementNameModalProps) {
  const {
    currentProject,
    currentPage,
    pendingMeasurement,
    setPendingMeasurement,
    addMeasurement,
    updateMeasurement,
    measurements,
    continuingMeasurementName,
    setContinuingMeasurementName,
    activeToolPreset,
  } = useProjectStore();
  const { user } = useAuthStore();

  const [name, setName] = useState(continuingMeasurementName || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  if (!pendingMeasurement || !currentProject) {
    return null;
  }

  // Check if name matches existing measurement on the same page
  const existingMeasurement = name.trim()
    ? measurements.find(
        (m) =>
          m.projectId === currentProject.id &&
          m.pageNumber === currentPage &&
          m.name.toLowerCase() === name.trim().toLowerCase() &&
          m.measurementType === pendingMeasurement.measurementType
      )
    : null;

  const handleSave = () => {
    if (!name.trim()) {
      inputRef.current?.focus();
      return;
    }

    const trimmedName = name.trim();

    // Check if a measurement with the same name exists in this project ON THE SAME PAGE
    const existingMeasurement = measurements.find(
      (m) =>
        m.projectId === currentProject.id &&
        m.pageNumber === currentPage &&
        m.name.toLowerCase() === trimmedName.toLowerCase() &&
        m.measurementType === pendingMeasurement.measurementType
    );

    if (existingMeasurement) {
      // Add new segment to existing measurement - keeps previous sections unchanged
      const existingSegments = existingMeasurement.segments || [existingMeasurement.points];
      const newGrossValue = existingMeasurement.value + pendingMeasurement.value;

      // Calculate net value accounting for existing subtractions
      const subtractionTotal = (existingMeasurement.subtractions || []).reduce((sum, s) => sum + s.value, 0);
      const newNetValue = newGrossValue - subtractionTotal;

      // Helper functions for stud/plate calculations
      const calcStudCount = (linearFeet: number, spacing: number, extra: number) => {
        return Math.ceil((linearFeet * 12) / spacing) + 1 + extra;
      };
      const calcPlateCount = (linearFeet: number, plateLength: number, plateCount: number) => {
        return Math.ceil(linearFeet / plateLength) * plateCount;
      };

      // Recalculate material quantities based on NET value (gross - subtractions)
      const updatedMaterials = existingMeasurement.materials.map((mat) => {
        if (mat.isStud && mat.studSpacing) {
          return { ...mat, quantity: calcStudCount(newNetValue, mat.studSpacing, mat.studExtra || 0) };
        } else if (mat.isPlate && mat.plateLength) {
          return { ...mat, quantity: calcPlateCount(newNetValue, mat.plateLength, mat.plateCount || 1) };
        } else if (mat.hasCoverage && mat.coverageAmount) {
          return { ...mat, quantity: newNetValue / mat.coverageAmount };
        }
        return mat;
      });

      updateMeasurement(existingMeasurement.id, {
        segments: [...existingSegments, pendingMeasurement.points],
        value: newGrossValue,
        materials: updatedMaterials,
      });
    } else {
      // Helper functions for stud/plate calculations
      const calcStudCount = (linearFeet: number, spacing: number, extra: number) => {
        return Math.ceil((linearFeet * 12) / spacing) + 1 + extra;
      };
      const calcPlateCount = (linearFeet: number, plateLength: number, plateCount: number) => {
        return Math.ceil(linearFeet / plateLength) * plateCount;
      };

      // Create materials from active preset (if any)
      const presetMaterials: MeasurementMaterial[] = activeToolPreset?.materials.map(mat => {
        let quantity: number | undefined;
        if (mat.isStud && mat.studSpacing) {
          quantity = calcStudCount(pendingMeasurement.value, mat.studSpacing, mat.studExtra || 0);
        } else if (mat.isPlate && mat.plateLength) {
          quantity = calcPlateCount(pendingMeasurement.value, mat.plateLength, mat.plateCount || 1);
        } else if (mat.hasCoverage && mat.coverageAmount) {
          quantity = pendingMeasurement.value / mat.coverageAmount;
        }

        return {
          id: crypto.randomUUID(),
          name: mat.name,
          hasCoverage: mat.hasCoverage,
          coverageAmount: mat.coverageAmount,
          coverageUnit: mat.coverageUnit,
          wasteFactor: mat.wasteFactor,
          isStud: mat.isStud,
          studSpacing: mat.studSpacing,
          studExtra: mat.studExtra,
          isPlate: mat.isPlate,
          plateLength: mat.plateLength,
          plateCount: mat.plateCount,
          quantity,
        };
      }) || [];

      // Create new measurement with first segment
      const newMeasurement: Measurement = {
        id: crypto.randomUUID(),
        projectId: currentProject.id,
        pageNumber: currentPage,
        name: trimmedName,
        measurementType: pendingMeasurement.measurementType,
        points: pendingMeasurement.points,
        segments: [pendingMeasurement.points],
        value: pendingMeasurement.value,
        unit: pendingMeasurement.unit,
        color: pendingMeasurement.color,
        lineWeight: pendingMeasurement.lineWeight,
        materials: presetMaterials,
        isVisible: true,
        createdAt: new Date().toISOString(),
      };
      addMeasurement(newMeasurement, user?.id);
    }

    // Keep the measurement name active so user can continue adding sections
    // User presses ESC to stop continuing
    setContinuingMeasurementName(trimmedName);
    setPendingMeasurement(null);
    onClose();
  };

  const handleCancel = () => {
    setPendingMeasurement(null);
    setContinuingMeasurementName(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const getIcon = () => {
    switch (pendingMeasurement.measurementType) {
      case 'linear':
        return <Ruler className="w-5 h-5" />;
      case 'area':
        return <Square className="w-5 h-5" />;
      case 'count':
        return <Hash className="w-5 h-5" />;
    }
  };

  const getTypeLabel = () => {
    switch (pendingMeasurement.measurementType) {
      case 'linear':
        return 'Linear Measurement';
      case 'area':
        return 'Area Measurement';
      case 'count':
        return 'Count';
    }
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: pendingMeasurement.color + '20', color: pendingMeasurement.color }}
            >
              {getIcon()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                Name This Measurement
              </h2>
              <p className="text-sm text-slate-500">
                {getTypeLabel()} - {formatMeasurement(pendingMeasurement.value, pendingMeasurement.unit)}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          <label className="input-label">Measurement Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Front Elevation, Kitchen Floor, North Wall"
            className="input-field"
            autoFocus
          />
          {existingMeasurement ? (
            <p className="text-xs text-green-600 mt-2 font-medium">
              Will add {formatMeasurement(pendingMeasurement.value, pendingMeasurement.unit)} to "{existingMeasurement.name}" (currently {formatMeasurement(existingMeasurement.value, existingMeasurement.unit)})
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-2">
              Give this measurement a descriptive name so you can identify it later.
            </p>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button onClick={handleCancel} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="btn btn-primary flex-1"
          >
            {existingMeasurement ? 'Add to Existing' : 'Save Measurement'}
          </button>
        </div>
      </div>
    </div>
  );
}
