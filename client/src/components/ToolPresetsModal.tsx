import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Ruler, Square, Hash, Package, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import type { ToolPreset, SavedMaterial, MeasurementType } from '../types';

interface ToolPresetsModalProps {
  onClose: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

const COVERAGE_UNITS = ['box', 'roll', 'bundle', 'bag', 'bucket', 'gallon', 'tube', 'stick', 'sheet', 'pallet'];

const WASTE_FACTORS = [
  { value: 0, label: 'None (0%)' },
  { value: 5, label: '5%' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
];

export default function ToolPresetsModal({ onClose }: ToolPresetsModalProps) {
  const {
    toolPresets,
    savedMaterials,
    addToolPreset,
    updateToolPreset,
    deleteToolPreset,
    addSavedMaterial,
  } = useProjectStore();
  const { user } = useAuthStore();

  const [editingPreset, setEditingPreset] = useState<ToolPreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedPresets, setExpandedPresets] = useState<Set<string>>(new Set());

  // Form state for creating/editing
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<MeasurementType>('area');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formMaterials, setFormMaterials] = useState<SavedMaterial[]>([]);

  // Material form state
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialName, setMaterialName] = useState('');
  const [materialHasCoverage, setMaterialHasCoverage] = useState(true);
  const [materialCoverageAmount, setMaterialCoverageAmount] = useState('');
  const [materialCoverageUnit, setMaterialCoverageUnit] = useState('box');
  const [materialWasteFactor, setMaterialWasteFactor] = useState(10);

  const resetForm = () => {
    setFormName('');
    setFormType('area');
    setFormColor(PRESET_COLORS[0]);
    setFormMaterials([]);
    setEditingPreset(null);
    setIsCreating(false);
    setShowMaterialForm(false);
    resetMaterialForm();
  };

  const resetMaterialForm = () => {
    setMaterialName('');
    setMaterialHasCoverage(true);
    setMaterialCoverageAmount('');
    setMaterialCoverageUnit('box');
    setMaterialWasteFactor(10);
  };

  const handleEdit = (preset: ToolPreset) => {
    setEditingPreset(preset);
    setFormName(preset.name);
    setFormType(preset.measurementType);
    setFormColor(preset.color);
    setFormMaterials([...preset.materials]);
    setIsCreating(true);
  };

  const handleCreate = () => {
    setIsCreating(true);
    resetForm();
    setIsCreating(true);
  };

  const handleAddMaterial = () => {
    if (!materialName.trim()) return;

    const newMaterial: SavedMaterial = {
      id: crypto.randomUUID(),
      name: materialName.trim(),
      hasCoverage: materialHasCoverage,
      coverageAmount: materialHasCoverage ? parseFloat(materialCoverageAmount) || undefined : undefined,
      coverageUnit: materialHasCoverage ? materialCoverageUnit : undefined,
      wasteFactor: materialWasteFactor,
    };

    setFormMaterials([...formMaterials, newMaterial]);

    // Also save to global saved materials for reuse
    if (!savedMaterials.some(m => m.name.toLowerCase() === newMaterial.name.toLowerCase())) {
      addSavedMaterial(newMaterial, user?.id);
    }

    resetMaterialForm();
    setShowMaterialForm(false);
  };

  const handleRemoveMaterial = (materialId: string) => {
    setFormMaterials(formMaterials.filter(m => m.id !== materialId));
  };

  const handleAddExistingMaterial = (material: SavedMaterial) => {
    if (formMaterials.some(m => m.name.toLowerCase() === material.name.toLowerCase())) {
      return; // Already added
    }
    setFormMaterials([...formMaterials, { ...material, id: crypto.randomUUID() }]);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    if (editingPreset) {
      updateToolPreset(editingPreset.id, {
        name: formName.trim(),
        measurementType: formType,
        color: formColor,
        materials: formMaterials,
      });
    } else {
      const newPreset: ToolPreset = {
        id: crypto.randomUUID(),
        name: formName.trim(),
        measurementType: formType,
        color: formColor,
        materials: formMaterials,
        createdAt: new Date().toISOString(),
      };
      addToolPreset(newPreset, user?.id);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this tool preset?')) {
      deleteToolPreset(id);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedPresets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getTypeIcon = (type: MeasurementType) => {
    switch (type) {
      case 'linear': return <Ruler className="w-4 h-4" />;
      case 'area': return <Square className="w-4 h-4" />;
      case 'count': return <Hash className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: MeasurementType) => {
    switch (type) {
      case 'linear': return 'Linear (LF)';
      case 'area': return 'Area (SF)';
      case 'count': return 'Count (EA)';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                Tool Presets
              </h2>
              <p className="text-sm text-slate-500">
                Create reusable measurement tools with pre-attached materials
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isCreating ? (
            /* Create/Edit Form */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-800">
                  {editingPreset ? 'Edit Tool Preset' : 'Create New Tool Preset'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              {/* Preset Name */}
              <div>
                <label className="input-label">Preset Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Stone Wall, Waterproofing, Drywall"
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Measurement Type */}
              <div>
                <label className="input-label">Measurement Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['linear', 'area', 'count'] as MeasurementType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormType(type)}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
                        formType === type
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {getTypeIcon(type)}
                      <span className="text-sm font-medium">{getTypeLabel(type)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="input-label">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        formColor === color ? 'border-slate-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {formColor === color && (
                        <Check className="w-4 h-4 text-white mx-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Materials */}
              <div>
                <label className="input-label">Materials</label>

                {formMaterials.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {formMaterials.map((mat) => (
                      <div
                        key={mat.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-700">{mat.name}</span>
                          {mat.hasCoverage && mat.coverageAmount && (
                            <span className="text-sm text-slate-500">
                              ({mat.coverageAmount} {formType === 'area' ? 'SF' : 'LF'}/{mat.coverageUnit})
                            </span>
                          )}
                          {mat.wasteFactor && mat.wasteFactor > 0 && (
                            <span className="text-xs text-amber-600">+{mat.wasteFactor}% waste</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveMaterial(mat.id)}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add from saved materials */}
                {savedMaterials.length > 0 && !showMaterialForm && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 mb-2">Add from saved materials:</p>
                    <div className="flex flex-wrap gap-2">
                      {savedMaterials
                        .filter(m => !formMaterials.some(fm => fm.name.toLowerCase() === m.name.toLowerCase()))
                        .slice(0, 6)
                        .map((mat) => (
                          <button
                            key={mat.id}
                            onClick={() => handleAddExistingMaterial(mat)}
                            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
                          >
                            + {mat.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {showMaterialForm ? (
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <input
                      type="text"
                      value={materialName}
                      onChange={(e) => setMaterialName(e.target.value)}
                      placeholder="Material name (e.g., Waterproofing, Lath, Stone)"
                      className="input-field"
                      autoFocus
                    />

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={materialHasCoverage}
                        onChange={(e) => setMaterialHasCoverage(e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-slate-600">Has coverage rate</span>
                    </label>

                    {materialHasCoverage && (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={materialCoverageAmount}
                          onChange={(e) => setMaterialCoverageAmount(e.target.value)}
                          placeholder="Coverage"
                          className="input-field w-32"
                        />
                        <span className="self-center text-slate-500 text-sm whitespace-nowrap">
                          {formType === 'area' ? 'SF' : formType === 'linear' ? 'LF' : 'EA'} per
                        </span>
                        <select
                          value={materialCoverageUnit}
                          onChange={(e) => setMaterialCoverageUnit(e.target.value)}
                          className="input-field w-20"
                        >
                          {COVERAGE_UNITS.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Waste Factor */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Waste Factor:</span>
                      <select
                        value={materialWasteFactor}
                        onChange={(e) => setMaterialWasteFactor(parseInt(e.target.value))}
                        className="input-field flex-1"
                      >
                        {WASTE_FACTORS.map((wf) => (
                          <option key={wf.value} value={wf.value}>{wf.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowMaterialForm(false)}
                        className="btn btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddMaterial}
                        disabled={!materialName.trim()}
                        className="btn btn-primary flex-1"
                      >
                        Add Material
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowMaterialForm(true)}
                    className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded border border-dashed border-primary-300 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Material
                  </button>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={!formName.trim()}
                className="btn btn-primary w-full"
              >
                {editingPreset ? 'Save Changes' : 'Create Tool Preset'}
              </button>
            </div>
          ) : (
            /* Preset List */
            <div className="space-y-4">
              {toolPresets.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 mb-2">No tool presets yet</p>
                  <p className="text-sm text-slate-400 mb-4">
                    Create presets to quickly use measurement tools with pre-attached materials
                  </p>
                  <button
                    onClick={handleCreate}
                    className="btn btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Preset
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleCreate}
                    className="w-full py-3 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg border border-dashed border-primary-300 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Create New Preset
                  </button>

                  {toolPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                        onClick={() => toggleExpanded(preset.id)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedPresets.has(preset.id) ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: preset.color + '20', color: preset.color }}
                          >
                            {getTypeIcon(preset.measurementType)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{preset.name}</div>
                            <div className="text-sm text-slate-500">
                              {getTypeLabel(preset.measurementType)} · {preset.materials.length} material{preset.materials.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(preset);
                            }}
                            className="p-2 hover:bg-slate-100 rounded"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(preset.id);
                            }}
                            className="p-2 hover:bg-red-100 rounded text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {expandedPresets.has(preset.id) && preset.materials.length > 0 && (
                        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                          <p className="text-xs text-slate-500 mb-2 mt-3">Materials:</p>
                          <div className="space-y-1">
                            {preset.materials.map((mat) => (
                              <div
                                key={mat.id}
                                className="flex items-center justify-between text-sm py-1 px-2 bg-slate-50 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <Package className="w-3 h-3 text-slate-400" />
                                  <span className="text-slate-700">{mat.name}</span>
                                  {mat.wasteFactor && mat.wasteFactor > 0 && (
                                    <span className="text-xs text-amber-600">+{mat.wasteFactor}%</span>
                                  )}
                                </div>
                                {mat.hasCoverage && mat.coverageAmount && (
                                  <span className="text-slate-500">
                                    {mat.coverageAmount} {preset.measurementType === 'area' ? 'SF' : 'LF'}/{mat.coverageUnit}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isCreating && toolPresets.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500 text-center">
              Use presets from the toolbar to quickly start measuring with pre-configured materials
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
