import { useState } from 'react';
import { X, Ruler, MousePointer, Edit3 } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import type { PageScale } from '../types';

interface ScaleCalibrationModalProps {
  onClose: () => void;
}

// Common architectural and engineering scales
// Value is inches on paper per 1 foot real-world
const PRESET_SCALES = [
  { label: '1/8" = 1\'', value: 0.125, ratio: '1:96' },
  { label: '3/16" = 1\'', value: 0.1875, ratio: '1:64' },
  { label: '1/4" = 1\'', value: 0.25, ratio: '1:48' },
  { label: '3/8" = 1\'', value: 0.375, ratio: '1:32' },
  { label: '1/2" = 1\'', value: 0.5, ratio: '1:24' },
  { label: '3/4" = 1\'', value: 0.75, ratio: '1:16' },
  { label: '1" = 1\'', value: 1, ratio: '1:12' },
  { label: '1-1/2" = 1\'', value: 1.5, ratio: '1:8' },
  { label: '3" = 1\'', value: 3, ratio: '1:4' },
  { label: '1" = 10\'', value: 0.1, ratio: '1:120' },
  { label: '1" = 20\'', value: 0.05, ratio: '1:240' },
  { label: '1" = 30\'', value: 0.0333, ratio: '1:360' },
  { label: '1" = 40\'', value: 0.025, ratio: '1:480' },
  { label: '1" = 50\'', value: 0.02, ratio: '1:600' },
  { label: '1" = 100\'', value: 0.01, ratio: '1:1200' },
];

// PDF standard DPI
const PDF_DPI = 72;

export default function ScaleCalibrationModal({
  onClose,
}: ScaleCalibrationModalProps) {
  const {
    currentProject,
    currentPage,
    calibrationPoints,
    clearCalibrationPoints,
    setPageScale,
    setActiveTool,
  } = useProjectStore();

  const [mode, setMode] = useState<'calibrate' | 'manual'>('calibrate');
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'ft' | 'in' | 'm' | 'cm'>('ft');
  const [error, setError] = useState('');

  // Manual mode state
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customScale, setCustomScale] = useState('');
  const [customScaleUnit, setCustomScaleUnit] = useState<'inch' | 'foot'>('inch');

  const handleCalibrateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentProject) {
      setError('No project selected');
      return;
    }

    if (calibrationPoints.length !== 2) {
      setError('Please select two points on the plan first');
      return;
    }

    const distanceValue = parseFloat(distance);
    if (isNaN(distanceValue) || distanceValue <= 0) {
      setError('Please enter a valid distance');
      return;
    }

    const pixelDistance = Math.sqrt(
      Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
        Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
    );

    let distanceInFeet = distanceValue;
    switch (unit) {
      case 'in':
        distanceInFeet = distanceValue / 12;
        break;
      case 'm':
        distanceInFeet = distanceValue * 3.28084;
        break;
      case 'cm':
        distanceInFeet = distanceValue * 0.0328084;
        break;
    }

    const pixelsPerUnit = pixelDistance / distanceInFeet;

    const pageScale: PageScale = {
      id: crypto.randomUUID(),
      projectId: currentProject.id,
      pageNumber: currentPage,
      pixelsPerUnit,
      calibrationPoints: {
        point1: calibrationPoints[0],
        point2: calibrationPoints[1],
        realWorldDistance: distanceValue,
        unit,
      },
    };

    setPageScale(currentProject.id, currentPage, pageScale);
    clearCalibrationPoints();
    setActiveTool('select');
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentProject) {
      setError('No project selected');
      return;
    }

    let inchesPerFoot: number;

    if (selectedPreset) {
      const preset = PRESET_SCALES.find(p => p.label === selectedPreset);
      if (!preset) {
        setError('Invalid preset selected');
        return;
      }
      inchesPerFoot = preset.value;
    } else if (customScale) {
      const scaleValue = parseFloat(customScale);
      if (isNaN(scaleValue) || scaleValue <= 0) {
        setError('Please enter a valid scale value');
        return;
      }
      // Convert to inches per foot
      if (customScaleUnit === 'foot') {
        // e.g., "1" = 10'" means 1 inch = 10 feet, so inches per foot = 1/10 = 0.1
        inchesPerFoot = 1 / scaleValue;
      } else {
        // e.g., "1/4" = 1'" means 0.25 inches = 1 foot
        inchesPerFoot = scaleValue;
      }
    } else {
      setError('Please select a preset or enter a custom scale');
      return;
    }

    // Calculate pixels per foot based on PDF DPI
    const pixelsPerUnit = PDF_DPI * inchesPerFoot;

    const pageScale: PageScale = {
      id: crypto.randomUUID(),
      projectId: currentProject.id,
      pageNumber: currentPage,
      pixelsPerUnit,
      calibrationPoints: null,
    };

    setPageScale(currentProject.id, currentPage, pageScale);
    clearCalibrationPoints();
    setActiveTool('select');
    onClose();
  };

  const handleCancel = () => {
    clearCalibrationPoints();
    setActiveTool('select');
    onClose();
  };

  const getPreviewScale = () => {
    if (calibrationPoints.length !== 2 || !distance) return null;

    const pixelDistance = Math.sqrt(
      Math.pow(calibrationPoints[1].x - calibrationPoints[0].x, 2) +
        Math.pow(calibrationPoints[1].y - calibrationPoints[0].y, 2)
    );

    const distanceValue = parseFloat(distance);
    if (isNaN(distanceValue) || distanceValue <= 0) return null;

    let distanceInFeet = distanceValue;
    switch (unit) {
      case 'in':
        distanceInFeet = distanceValue / 12;
        break;
      case 'm':
        distanceInFeet = distanceValue * 3.28084;
        break;
      case 'cm':
        distanceInFeet = distanceValue * 0.0328084;
        break;
    }

    const pixelsPerFoot = pixelDistance / distanceInFeet;
    const inchesPerFoot = pixelsPerFoot / PDF_DPI;

    return {
      pixelsPerFoot: pixelsPerFoot.toFixed(2),
      scale: `${inchesPerFoot.toFixed(3)}" = 1'`,
    };
  };

  const previewScale = getPreviewScale();

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Ruler className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                Set Page Scale
              </h2>
              <p className="text-sm text-slate-500">Page {currentPage}</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setMode('calibrate')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              mode === 'calibrate'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MousePointer className="w-4 h-4" />
            Calibrate
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              mode === 'manual'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Manual / Preset
          </button>
        </div>

        {mode === 'calibrate' ? (
          <form onSubmit={handleCalibrateSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                {calibrationPoints.length === 0 && 'Click "Set Scale" tool, then click 2 points on a known dimension.'}
                {calibrationPoints.length === 1 && 'Click one more point to complete the measurement.'}
                {calibrationPoints.length === 2 && 'Enter the real-world distance between the points.'}
              </p>
            </div>

            <div>
              <label className="input-label">Real-World Distance</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="e.g., 10"
                  className="input-field w-full text-lg py-3"
                  style={{ flex: '1 1 50%' }}
                  step="0.01"
                  min="0"
                  autoFocus
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as typeof unit)}
                  className="input-field text-sm text-center"
                  style={{ flex: '0 0 50px' }}
                >
                  <option value="ft">ft</option>
                  <option value="in">in</option>
                  <option value="m">m</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>

            {previewScale && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Detected Scale</p>
                <p className="text-lg font-semibold text-green-700 mt-1">
                  {previewScale.scale}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={handleCancel} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={calibrationPoints.length !== 2 || !distance}
              >
                Set Scale
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="input-label">Select Preset Scale</label>
              <select
                value={selectedPreset}
                onChange={(e) => {
                  setSelectedPreset(e.target.value);
                  setCustomScale('');
                }}
                className="input-field"
              >
                <option value="">-- Choose a scale --</option>
                <optgroup label="Architectural">
                  {PRESET_SCALES.slice(0, 9).map((scale) => (
                    <option key={scale.label} value={scale.label}>
                      {scale.label} ({scale.ratio})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Engineering / Site">
                  {PRESET_SCALES.slice(9).map((scale) => (
                    <option key={scale.label} value={scale.label}>
                      {scale.label} ({scale.ratio})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-xs text-slate-400">OR</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>

            <div>
              <label className="input-label">Enter Custom Scale</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={customScale}
                  onChange={(e) => {
                    setCustomScale(e.target.value);
                    setSelectedPreset('');
                  }}
                  placeholder="e.g., 0.25 or 1/4"
                  className="input-field text-lg py-3"
                  style={{ flex: '1 1 50%' }}
                />
                <span className="text-slate-600 text-sm">" = 1</span>
                <select
                  value={customScaleUnit}
                  onChange={(e) => setCustomScaleUnit(e.target.value as 'inch' | 'foot')}
                  className="input-field text-center"
                  style={{ flex: '0 0 40px' }}
                >
                  <option value="foot">'</option>
                  <option value="inch">"</option>
                </select>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Examples: 0.25 for 1/4", 0.375 for 3/8", or 10 for 1"=10'
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> Manual scale assumes standard PDF at 72 DPI.
                For best accuracy, use the Calibrate method with a known dimension.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={handleCancel} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={!selectedPreset && !customScale}
              >
                Set Scale
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
