import { useState } from 'react';
import { X } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';

interface ColorPickerModalProps {
  onClose: () => void;
}

const PRESET_COLORS = [
  // Row 1 - Blues
  '#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#0ea5e9', '#0284c7',
  // Row 2 - Purples
  '#6366f1', '#8b5cf6', '#a855f7', '#7c3aed', '#d946ef', '#c026d3',
  // Row 3 - Pinks/Reds
  '#ec4899', '#f472b6', '#db2777', '#ef4444', '#dc2626', '#f43f5e',
  // Row 4 - Oranges/Yellows
  '#f97316', '#ea580c', '#fb923c', '#eab308', '#f59e0b', '#fbbf24',
  // Row 5 - Greens
  '#22c55e', '#16a34a', '#4ade80', '#15803d', '#84cc16', '#65a30d',
  // Row 6 - Teals/Neutrals
  '#14b8a6', '#0d9488', '#06b6d4', '#64748b', '#78716c', '#000000',
];

const LINE_WEIGHTS = [1, 2, 3, 4, 5, 6, 8, 10];

export default function ColorPickerModal({ onClose }: ColorPickerModalProps) {
  const { activeTool, drawingConfig, setDrawingConfig } = useProjectStore();
  const [color, setColor] = useState(drawingConfig.color);
  const [lineWeight, setLineWeight] = useState(drawingConfig.lineWeight);

  const handleSave = () => {
    setDrawingConfig({ color, lineWeight });
    onClose();
  };

  const getToolTypeLabel = () => {
    switch (activeTool) {
      case 'linear':
        return 'Linear Measurement';
      case 'area':
        return 'Area Measurement';
      case 'count':
        return 'Count Measurement';
      default:
        return 'Measurement';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              Pick a Color
            </h2>
            <p className="text-sm text-slate-500">{getToolTypeLabel()}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Color Grid */}
          <div className="grid grid-cols-6 gap-2 mb-4">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-lg transition-all hover:scale-110 ${
                  color === c ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          {/* Custom color picker */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
            <label className="text-sm text-slate-600">Custom:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-300 hover:border-slate-400 transition-colors"
              style={{ padding: 0 }}
            />
            <input
              type="text"
              value={color}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                  setColor(val);
                }
              }}
              placeholder="#000000"
              className="w-24 px-2 py-1 text-sm border border-slate-300 rounded-md font-mono"
            />
            <div
              className="w-10 h-10 rounded-lg border-2 border-slate-300"
              style={{ backgroundColor: color }}
              title="Selected color"
            />
          </div>

          {/* Line Weight selector */}
          {(activeTool === 'linear' || activeTool === 'line' || activeTool === 'area') && (
            <div className="pt-4 mt-4 border-t border-slate-200">
              <label className="text-sm text-slate-600 mb-2 block">Line Weight:</label>
              <div className="flex items-center gap-2">
                {LINE_WEIGHTS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setLineWeight(w)}
                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                      lineWeight === w
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                    title={`${w}px`}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: `${Math.min(w * 3, 24)}px`,
                        height: `${Math.min(w * 3, 24)}px`,
                        backgroundColor: color
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary flex-1">
            Start Drawing
          </button>
        </div>
      </div>
    </div>
  );
}
