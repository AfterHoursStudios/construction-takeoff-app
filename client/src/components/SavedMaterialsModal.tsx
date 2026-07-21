import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Package } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import type { SavedMaterial } from '../types';

interface SavedMaterialsModalProps {
  onClose: () => void;
}

const COVERAGE_UNITS = ['box', 'roll', 'bundle', 'bag', 'bucket', 'gallon', 'tube', 'stick', 'sheet', 'pallet'];

const WASTE_FACTORS = [
  { value: 0, label: 'None (0%)' },
  { value: 5, label: '5%' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
];

export default function SavedMaterialsModal({ onClose }: SavedMaterialsModalProps) {
  const { savedMaterials, addSavedMaterial, updateSavedMaterial, deleteSavedMaterial } = useProjectStore();
  const { user } = useAuthStore();

  const [isCreating, setIsCreating] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<SavedMaterial | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formHasCoverage, setFormHasCoverage] = useState(false);
  const [formCoverageAmount, setFormCoverageAmount] = useState('100');
  const [formCoverageUnit, setFormCoverageUnit] = useState('box');
  const [formWasteFactor, setFormWasteFactor] = useState(10);
  const [formIsStud, setFormIsStud] = useState(false);
  const [formStudSpacing, setFormStudSpacing] = useState(16);
  const [formStudExtra, setFormStudExtra] = useState(2);
  const [formIsPlate, setFormIsPlate] = useState(false);
  const [formPlateLength, setFormPlateLength] = useState(8);
  const [formPlateCount, setFormPlateCount] = useState(2);

  const resetForm = () => {
    setFormName('');
    setFormHasCoverage(false);
    setFormCoverageAmount('100');
    setFormCoverageUnit('box');
    setFormWasteFactor(10);
    setFormIsStud(false);
    setFormStudSpacing(16);
    setFormStudExtra(2);
    setFormIsPlate(false);
    setFormPlateLength(8);
    setFormPlateCount(2);
    setIsCreating(false);
    setEditingMaterial(null);
  };

  const handleEdit = (material: SavedMaterial) => {
    setEditingMaterial(material);
    setFormName(material.name);
    setFormHasCoverage(material.hasCoverage);
    setFormCoverageAmount(material.coverageAmount?.toString() || '100');
    setFormCoverageUnit(material.coverageUnit || 'box');
    setFormWasteFactor(material.wasteFactor || 10);
    setFormIsStud(material.isStud || false);
    setFormStudSpacing(material.studSpacing || 16);
    setFormStudExtra(material.studExtra || 2);
    setFormIsPlate(material.isPlate || false);
    setFormPlateLength(material.plateLength || 8);
    setFormPlateCount(material.plateCount || 2);
    setIsCreating(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    const materialData: Omit<SavedMaterial, 'id'> = {
      name: formName.trim(),
      hasCoverage: formHasCoverage,
      coverageAmount: formHasCoverage ? parseFloat(formCoverageAmount) || undefined : undefined,
      coverageUnit: formHasCoverage ? formCoverageUnit : undefined,
      wasteFactor: formWasteFactor,
      isStud: formIsStud,
      studSpacing: formIsStud ? formStudSpacing : undefined,
      studExtra: formIsStud ? formStudExtra : undefined,
      isPlate: formIsPlate,
      plateLength: formIsPlate ? formPlateLength : undefined,
      plateCount: formIsPlate ? formPlateCount : undefined,
    };

    if (editingMaterial) {
      updateSavedMaterial(editingMaterial.id, materialData);
    } else {
      const newMaterial: SavedMaterial = {
        id: crypto.randomUUID(),
        ...materialData,
      };
      addSavedMaterial(newMaterial, user?.id);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this saved material?')) {
      deleteSavedMaterial(id);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Saved Materials</h2>
              <p className="text-sm text-slate-500">Manage your reusable material templates</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isCreating ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-800">
                  {editingMaterial ? 'Edit Material' : 'Create New Material'}
                </h3>
                <button onClick={resetForm} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
              </div>

              <div>
                <label className="input-label">Material Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Drywall, Insulation, Paint"
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Coverage Toggle */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formHasCoverage}
                  onChange={(e) => setFormHasCoverage(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Has coverage rate</span>
                  <p className="text-xs text-slate-500">e.g., 1 roll covers 100 SF</p>
                </div>
              </label>

              {formHasCoverage && (
                <div className="flex gap-2 items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">1</span>
                  <select value={formCoverageUnit} onChange={(e) => setFormCoverageUnit(e.target.value)} className="input-field w-28">
                    {COVERAGE_UNITS.map((unit) => (<option key={unit} value={unit}>{unit}</option>))}
                  </select>
                  <span className="text-sm text-slate-600">=</span>
                  <input
                    type="number"
                    value={formCoverageAmount}
                    onChange={(e) => setFormCoverageAmount(e.target.value)}
                    className="input-field w-24"
                    min="1"
                  />
                  <span className="text-sm text-slate-600">SF/LF</span>
                </div>
              )}

              {/* Stud Toggle */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsStud}
                  onChange={(e) => { setFormIsStud(e.target.checked); if (e.target.checked) setFormIsPlate(false); }}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm font-medium text-slate-700">Stud calculation</span>
              </label>

              {formIsStud && (
                <div className="p-3 bg-amber-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 w-20">Spacing:</span>
                    <select value={formStudSpacing} onChange={(e) => setFormStudSpacing(parseInt(e.target.value))} className="input-field flex-1">
                      <option value={12}>12" OC</option>
                      <option value={16}>16" OC</option>
                      <option value={24}>24" OC</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 w-20">Extra:</span>
                    <input type="number" value={formStudExtra} onChange={(e) => setFormStudExtra(parseInt(e.target.value) || 0)} className="input-field w-20" min="0" />
                  </div>
                </div>
              )}

              {/* Plate Toggle */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsPlate}
                  onChange={(e) => { setFormIsPlate(e.target.checked); if (e.target.checked) setFormIsStud(false); }}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm font-medium text-slate-700">Plate calculation</span>
              </label>

              {formIsPlate && (
                <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 w-24">Plate length:</span>
                    <select value={formPlateLength} onChange={(e) => setFormPlateLength(parseInt(e.target.value))} className="input-field flex-1">
                      <option value={8}>8'</option>
                      <option value={10}>10'</option>
                      <option value={12}>12'</option>
                      <option value={16}>16'</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 w-24"># of plates:</span>
                    <select value={formPlateCount} onChange={(e) => setFormPlateCount(parseInt(e.target.value))} className="input-field flex-1">
                      <option value={1}>1 (single)</option>
                      <option value={2}>2 (top + bottom)</option>
                      <option value={3}>3 (double top)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Waste Factor */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Waste Factor:</span>
                <select value={formWasteFactor} onChange={(e) => setFormWasteFactor(parseInt(e.target.value))} className="input-field flex-1">
                  {WASTE_FACTORS.map((wf) => (<option key={wf.value} value={wf.value}>{wf.label}</option>))}
                </select>
              </div>

              <button onClick={handleSave} disabled={!formName.trim()} className="btn btn-primary w-full">
                {editingMaterial ? 'Save Changes' : 'Create Material'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setIsCreating(true)}
                className="w-full py-3 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg border border-dashed border-primary-300 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Material
              </button>

              {savedMaterials.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No saved materials yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedMaterials.map((material) => (
                    <div key={material.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <div className="font-medium text-slate-800">{material.name}</div>
                        <div className="text-sm text-slate-500">
                          {material.isStud && `${material.studSpacing}" OC studs`}
                          {material.isPlate && `${material.plateLength}' plates x${material.plateCount}`}
                          {material.hasCoverage && `${material.coverageAmount} SF/${material.coverageUnit}`}
                          {!material.isStud && !material.isPlate && !material.hasCoverage && 'Raw quantity'}
                          {material.wasteFactor ? ` +${material.wasteFactor}% waste` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(material)} className="p-2 hover:bg-slate-200 rounded"><Edit2 className="w-4 h-4 text-slate-400" /></button>
                        <button onClick={() => handleDelete(material.id)} className="p-2 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
