import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { formatMeasurement } from '../utils/format';
import type { Measurement, MeasurementMaterial, SavedMaterial } from '../types';

interface MaterialsModalProps {
  measurement: Measurement;
  onClose: () => void;
}

const COVERAGE_UNITS = [
  'roll',
  'box',
  'bundle',
  'bucket',
  'bag',
  'gallon',
  'pallet',
  'sheet',
  'pack',
  'case',
  'stick',
];

const STUD_SPACINGS = [
  { value: 12, label: '12" OC' },
  { value: 16, label: '16" OC' },
  { value: 24, label: '24" OC' },
];

const PLATE_LENGTHS = [
  { value: 8, label: "8'" },
  { value: 10, label: "10'" },
  { value: 12, label: "12'" },
  { value: 16, label: "16'" },
  { value: 20, label: "20'" },
];

const WASTE_FACTORS = [
  { value: 0, label: 'None (0%)' },
  { value: 5, label: '5%' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
];

type MaterialType = 'regular' | 'stud' | 'plate';

export default function MaterialsModal({ measurement, onClose }: MaterialsModalProps) {
  const {
    savedMaterials,
    addSavedMaterial,
    addMaterialToMeasurement,
    updateMeasurementMaterial,
    removeMaterialFromMeasurement,
  } = useProjectStore();
  const { user } = useAuthStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialType, setNewMaterialType] = useState<MaterialType>('regular');
  const [newHasCoverage, setNewHasCoverage] = useState(false);
  const [newCoverageAmount, setNewCoverageAmount] = useState(100);
  const [newCoverageUnit, setNewCoverageUnit] = useState('roll');
  const [newStudSpacing, setNewStudSpacing] = useState(16);
  const [newStudExtra, setNewStudExtra] = useState(2);
  const [newPlateLength, setNewPlateLength] = useState(8);
  const [newPlateCount, setNewPlateCount] = useState(2);
  const [newWasteFactor, setNewWasteFactor] = useState(10);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate net value (gross - subtractions)
  const netValue = useMemo(() => {
    const subtractionTotal = (measurement.subtractions || []).reduce((sum, s) => sum + s.value, 0);
    return measurement.value - subtractionTotal;
  }, [measurement.value, measurement.subtractions]);

  // Calculate stud count: (linear feet * 12 / spacing) + 1 + extra
  const calcStudCount = (linearFeet: number, spacing: number, extra: number) => {
    return Math.ceil((linearFeet * 12) / spacing) + 1 + extra;
  };

  // Calculate plate count: (linear feet / plate length) * number of plates, rounded up
  const calcPlateCount = (linearFeet: number, plateLength: number, plateCount: number) => {
    return Math.ceil(linearFeet / plateLength) * plateCount;
  };

  // Filter saved materials that match search and aren't already added
  const filteredSavedMaterials = useMemo(() => {
    const addedNames = new Set(measurement.materials.map(m => m.name.toLowerCase()));
    return savedMaterials.filter(
      (m) =>
        !addedNames.has(m.name.toLowerCase()) &&
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [savedMaterials, measurement.materials, searchQuery]);

  const handleAddFromTemplate = (template: SavedMaterial) => {
    let quantity: number | undefined;

    if (template.isStud && template.studSpacing) {
      quantity = calcStudCount(netValue, template.studSpacing, template.studExtra || 0);
    } else if (template.isPlate && template.plateLength) {
      quantity = calcPlateCount(netValue, template.plateLength, template.plateCount || 1);
    } else if (template.hasCoverage && template.coverageAmount) {
      quantity = netValue / template.coverageAmount;
    }

    const material: MeasurementMaterial = {
      id: crypto.randomUUID(),
      name: template.name,
      hasCoverage: template.hasCoverage,
      coverageAmount: template.coverageAmount,
      coverageUnit: template.coverageUnit,
      wasteFactor: template.wasteFactor,
      isStud: template.isStud,
      studSpacing: template.studSpacing,
      studExtra: template.studExtra,
      isPlate: template.isPlate,
      plateLength: template.plateLength,
      plateCount: template.plateCount,
      quantity,
    };
    addMaterialToMeasurement(measurement.id, material);
    setSearchQuery('');
  };

  const handleAddNewMaterial = () => {
    if (!newMaterialName.trim()) return;

    let material: MeasurementMaterial;

    if (newMaterialType === 'stud') {
      material = {
        id: crypto.randomUUID(),
        name: newMaterialName.trim(),
        hasCoverage: false,
        wasteFactor: newWasteFactor,
        isStud: true,
        studSpacing: newStudSpacing,
        studExtra: newStudExtra,
        quantity: calcStudCount(netValue, newStudSpacing, newStudExtra),
      };
    } else if (newMaterialType === 'plate') {
      material = {
        id: crypto.randomUUID(),
        name: newMaterialName.trim(),
        hasCoverage: false,
        wasteFactor: newWasteFactor,
        isPlate: true,
        plateLength: newPlateLength,
        plateCount: newPlateCount,
        quantity: calcPlateCount(netValue, newPlateLength, newPlateCount),
      };
    } else {
      material = {
        id: crypto.randomUUID(),
        name: newMaterialName.trim(),
        hasCoverage: newHasCoverage,
        coverageAmount: newHasCoverage ? newCoverageAmount : undefined,
        coverageUnit: newHasCoverage ? newCoverageUnit : undefined,
        wasteFactor: newWasteFactor,
        quantity: newHasCoverage ? netValue / newCoverageAmount : undefined,
      };
    }

    addMaterialToMeasurement(measurement.id, material);

    // Save as template if requested
    if (saveAsTemplate) {
      const template: SavedMaterial = {
        id: crypto.randomUUID(),
        name: newMaterialName.trim(),
        hasCoverage: newMaterialType === 'regular' ? newHasCoverage : false,
        coverageAmount: newMaterialType === 'regular' && newHasCoverage ? newCoverageAmount : undefined,
        coverageUnit: newMaterialType === 'regular' && newHasCoverage ? newCoverageUnit : undefined,
        wasteFactor: newWasteFactor,
        isStud: newMaterialType === 'stud',
        studSpacing: newMaterialType === 'stud' ? newStudSpacing : undefined,
        studExtra: newMaterialType === 'stud' ? newStudExtra : undefined,
        isPlate: newMaterialType === 'plate',
        plateLength: newMaterialType === 'plate' ? newPlateLength : undefined,
        plateCount: newMaterialType === 'plate' ? newPlateCount : undefined,
      };
      addSavedMaterial(template, user?.id);
    }

    // Reset form
    setNewMaterialName('');
    setNewMaterialType('regular');
    setNewHasCoverage(false);
    setNewCoverageAmount(100);
    setNewCoverageUnit('roll');
    setNewStudSpacing(16);
    setNewStudExtra(2);
    setNewPlateLength(8);
    setNewPlateCount(2);
    setNewWasteFactor(10);
    setSaveAsTemplate(false);
    setIsAdding(false);
  };

  const handleRemoveMaterial = (materialId: string) => {
    removeMaterialFromMeasurement(measurement.id, materialId);
  };

  const handleToggleCoverage = (material: MeasurementMaterial) => {
    if (material.hasCoverage) {
      updateMeasurementMaterial(measurement.id, material.id, {
        hasCoverage: false,
        coverageAmount: undefined,
        coverageUnit: undefined,
        quantity: undefined,
      });
    } else {
      const defaultAmount = 100;
      updateMeasurementMaterial(measurement.id, material.id, {
        hasCoverage: true,
        coverageAmount: defaultAmount,
        coverageUnit: 'roll',
        quantity: netValue / defaultAmount,  // Store decimal
      });
    }
  };

  const handleUpdateCoverage = (material: MeasurementMaterial, amount: number, unit: string) => {
    updateMeasurementMaterial(measurement.id, material.id, {
      coverageAmount: amount,
      coverageUnit: unit,
      quantity: netValue / amount,  // Store decimal
    });
  };

  const handleUpdateWasteFactor = (material: MeasurementMaterial, wasteFactor: number) => {
    updateMeasurementMaterial(measurement.id, material.id, { wasteFactor });
  };

  // Apply waste factor to quantity for display
  const getQuantityWithWaste = (quantity: number, wasteFactor?: number) => {
    const factor = 1 + (wasteFactor || 0) / 100;
    return quantity * factor;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: measurement.color + '20' }}
            >
              <Package className="w-5 h-5" style={{ color: measurement.color }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                {measurement.name}
              </h2>
              <p className="text-sm text-slate-500">
                {(measurement.subtractions?.length || 0) > 0 ? (
                  <>
                    <span className="text-slate-400 line-through mr-1">
                      {formatMeasurement(measurement.value, measurement.unit)}
                    </span>
                    <span className="text-green-600">
                      {formatMeasurement(netValue, measurement.unit)} net
                    </span>
                  </>
                ) : (
                  formatMeasurement(netValue, measurement.unit)
                )}
                {' - '}{measurement.materials.length} material{measurement.materials.length !== 1 ? 's' : ''}
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

        <div className="p-6 max-h-96 overflow-y-auto">
          {/* Existing Materials */}
          {measurement.materials.length > 0 && (
            <div className="space-y-3 mb-6">
              {measurement.materials.map((material) => (
                <div
                  key={material.id}
                  className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{material.name}</div>
                      {material.hasCoverage ? (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className="text-slate-500">1 {material.coverageUnit} =</span>
                          <input
                            type="number"
                            value={material.coverageAmount || 100}
                            onChange={(e) =>
                              handleUpdateCoverage(
                                material,
                                parseFloat(e.target.value) || 100,
                                material.coverageUnit || 'roll'
                              )
                            }
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                            min="1"
                          />
                          <span className="text-slate-500">{measurement.unit}</span>
                          <span className="text-slate-400">|</span>
                          <select
                            value={material.coverageUnit}
                            onChange={(e) =>
                              handleUpdateCoverage(
                                material,
                                material.coverageAmount || 100,
                                e.target.value
                              )
                            }
                            className="px-2 py-1 border border-slate-300 rounded text-sm"
                          >
                            {COVERAGE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 mt-1">
                          Raw {measurement.unit}: {formatMeasurement(netValue, measurement.unit)}
                        </div>
                      )}
                      {material.isStud && (
                        <div className="text-sm text-amber-600 mt-1">
                          {material.studSpacing}" OC + {material.studExtra || 0} extra
                        </div>
                      )}
                      {material.isPlate && (
                        <div className="text-sm text-blue-600 mt-1">
                          {material.plateLength}' plates × {material.plateCount}
                        </div>
                      )}
                      {/* Waste Factor Selector */}
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Waste:</span>
                        <select
                          value={material.wasteFactor || 0}
                          onChange={(e) => handleUpdateWasteFactor(material, parseInt(e.target.value))}
                          className="px-2 py-1 border border-slate-300 rounded text-sm"
                        >
                          {WASTE_FACTORS.map((wf) => (
                            <option key={wf.value} value={wf.value}>{wf.label}</option>
                          ))}
                          {/* Allow custom values if not in list */}
                          {material.wasteFactor && !WASTE_FACTORS.find(wf => wf.value === material.wasteFactor) && (
                            <option value={material.wasteFactor}>{material.wasteFactor}%</option>
                          )}
                        </select>
                      </div>
                      {material.quantity && (
                        <div className="text-sm font-semibold text-green-700 mt-2">
                          Quantity: {Math.ceil(getQuantityWithWaste(material.quantity, material.wasteFactor))} {material.isStud ? 'studs' : material.isPlate ? 'plates' : material.coverageUnit + 's'}
                          {material.wasteFactor ? ` (incl. ${material.wasteFactor}% waste)` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleCoverage(material)}
                        className={`text-xs px-2 py-1 rounded ${
                          material.hasCoverage
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {material.hasCoverage ? 'Has Coverage' : 'No Coverage'}
                      </button>
                      <button
                        onClick={() => handleRemoveMaterial(material.id)}
                        className="p-1 text-red-500 hover:bg-red-100 rounded"
                        title="Remove material"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Material Section */}
          {isAdding ? (
            <div className="p-4 border border-primary-200 rounded-lg bg-primary-50">
              <h3 className="font-medium text-slate-800 mb-3">Add New Material</h3>

              {/* Search existing templates */}
              {savedMaterials.length > 0 && (
                <div className="mb-4">
                  <label className="text-sm text-slate-600 mb-1 block">
                    Search saved materials:
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type to search..."
                    className="input-field"
                  />
                  {searchQuery && filteredSavedMaterials.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {filteredSavedMaterials.slice(0, 5).map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleAddFromTemplate(template)}
                          className="w-full text-left p-2 bg-white border border-slate-200 rounded hover:border-primary-300 hover:bg-primary-50 text-sm"
                        >
                          <span className="font-medium">{template.name}</span>
                          {template.hasCoverage && (
                            <span className="text-slate-500 ml-2">
                              (1 {template.coverageUnit} = {template.coverageAmount} {measurement.unit})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 mt-4">
                <label className="text-sm text-slate-600 mb-1 block">
                  Or create a new material:
                </label>
                <input
                  type="text"
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  placeholder="Material name (e.g., Studs, Plates, Lath)"
                  className="input-field mb-3"
                />

                {/* Material Type Selection - only show stud/plate for linear */}
                {measurement.measurementType === 'linear' && (
                  <div className="flex gap-2 mb-3">
                    {(['regular', 'stud', 'plate'] as MaterialType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewMaterialType(type)}
                        className={`flex-1 py-2 px-3 text-sm rounded border ${
                          newMaterialType === type
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {type === 'regular' ? 'Regular' : type === 'stud' ? 'Studs' : 'Plates'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Stud Options */}
                {newMaterialType === 'stud' && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-600 w-20">Spacing:</label>
                      <select
                        value={newStudSpacing}
                        onChange={(e) => setNewStudSpacing(parseInt(e.target.value))}
                        className="input-field flex-1"
                      >
                        {STUD_SPACINGS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-600 w-20">Extra:</label>
                      <input
                        type="number"
                        value={newStudExtra}
                        onChange={(e) => setNewStudExtra(parseInt(e.target.value) || 0)}
                        className="input-field w-20"
                        min="0"
                      />
                      <span className="text-sm text-slate-500">(for corners, ends, etc.)</span>
                    </div>
                    <div className="text-sm text-amber-700 font-medium">
                      = {calcStudCount(netValue, newStudSpacing, newStudExtra)} studs
                    </div>
                  </div>
                )}

                {/* Plate Options */}
                {newMaterialType === 'plate' && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-600 w-24">Plate Length:</label>
                      <select
                        value={newPlateLength}
                        onChange={(e) => setNewPlateLength(parseInt(e.target.value))}
                        className="input-field flex-1"
                      >
                        {PLATE_LENGTHS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-600 w-24"># of Plates:</label>
                      <select
                        value={newPlateCount}
                        onChange={(e) => setNewPlateCount(parseInt(e.target.value))}
                        className="input-field flex-1"
                      >
                        <option value={1}>1 (single)</option>
                        <option value={2}>2 (top + bottom)</option>
                        <option value={3}>3 (double top + bottom)</option>
                      </select>
                    </div>
                    <div className="text-sm text-blue-700 font-medium">
                      = {calcPlateCount(netValue, newPlateLength, newPlateCount)} plates
                    </div>
                  </div>
                )}

                {/* Regular Coverage Options */}
                {newMaterialType === 'regular' && (
                  <label className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-50 border border-slate-200 mb-3">
                    <input
                      type="checkbox"
                      checked={newHasCoverage}
                      onChange={(e) => setNewHasCoverage(e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700">Has coverage rate</span>
                      <p className="text-xs text-slate-500">e.g., 1 roll covers 100 SF</p>
                    </div>
                  </label>
                )}

                {newHasCoverage && (
                  <div className="flex items-center gap-2 mb-3 p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-600">1</span>
                    <select
                      value={newCoverageUnit}
                      onChange={(e) => setNewCoverageUnit(e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded text-sm"
                    >
                      {COVERAGE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-slate-600">=</span>
                    <input
                      type="number"
                      value={newCoverageAmount}
                      onChange={(e) => setNewCoverageAmount(parseFloat(e.target.value) || 100)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                      min="1"
                    />
                    <span className="text-sm text-slate-600">{measurement.unit}</span>
                  </div>
                )}

                {/* Waste Factor */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 mb-3">
                  <span className="text-sm font-medium text-slate-700">Waste Factor:</span>
                  <select
                    value={newWasteFactor}
                    onChange={(e) => setNewWasteFactor(parseInt(e.target.value))}
                    className="px-2 py-1 border border-slate-300 rounded text-sm flex-1"
                  >
                    {WASTE_FACTORS.map((wf) => (
                      <option key={wf.value} value={wf.value}>{wf.label}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-50 border border-slate-200 mb-4">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Save as template for future use</span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewMaterialName('');
                      setSearchQuery('');
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNewMaterial}
                    disabled={!newMaterialName.trim()}
                    className="btn btn-primary flex-1"
                  >
                    Add Material
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full p-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Material
            </button>
          )}
        </div>

        <div className="p-6 border-t border-slate-200">
          <button onClick={onClose} className="btn btn-primary w-full">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
