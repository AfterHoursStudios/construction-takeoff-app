// Core data types for the construction takeoff application

export interface Project {
  id: string;
  name: string;
  clientName: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  planFileId?: string;
  planFileName?: string;
}

export interface PlanFile {
  id: string;
  projectId: string;
  fileName: string;
  filePath: string;
  pageCount: number;
  uploadedAt: string;
}

export interface PageScale {
  id: string;
  projectId: string;
  pageNumber: number;
  pixelsPerUnit: number; // pixels per foot
  calibrationPoints: {
    point1: Point;
    point2: Point;
    realWorldDistance: number;
    unit: 'ft' | 'in' | 'm' | 'cm';
  } | null;
}

export interface Point {
  x: number;
  y: number;
}

export type MeasurementType = 'linear' | 'area' | 'count';
export type UnitType = 'LF' | 'SF' | 'EA';

// Material attached to a measurement
export interface MeasurementMaterial {
  id: string;
  name: string;
  hasCoverage: boolean; // false = just show raw SF/LF
  coverageAmount?: number; // e.g., 100 (SF per unit)
  coverageUnit?: string; // e.g., "roll", "box", "bundle", "bucket"
  quantity?: number; // calculated: measurement value / coverageAmount
  wasteFactor?: number; // percentage to add for waste (0-100), e.g., 10 = 10% extra
  // Stud calculation options (for linear measurements)
  isStud?: boolean; // true = use stud spacing calculation
  studSpacing?: number; // inches on center (16, 24, etc.)
  studExtra?: number; // extra studs to add (e.g., 2 for wall ends)
  // Plate calculation options (for linear measurements)
  isPlate?: boolean; // true = use plate length calculation
  plateLength?: number; // length of plate material in feet (8, 10, 12, etc.)
  plateCount?: number; // number of plates (1 for single, 2 for top+bottom, 3 for double top)
}

// Saved material template for reuse
export interface SavedMaterial {
  id: string;
  name: string;
  hasCoverage: boolean;
  coverageAmount?: number;
  coverageUnit?: string;
  wasteFactor?: number; // percentage to add for waste (0-100)
  // Stud calculation options
  isStud?: boolean;
  studSpacing?: number;
  studExtra?: number;
  // Plate calculation options
  isPlate?: boolean;
  plateLength?: number;
  plateCount?: number;
}

// Tool preset - a saved tool configuration with pre-attached materials
export interface ToolPreset {
  id: string;
  name: string; // e.g., "Stone Wall", "Waterproofing"
  measurementType: MeasurementType;
  color: string;
  materials: SavedMaterial[]; // materials that will be auto-attached
  createdAt: string;
}

// Subtraction from a measurement segment
export interface MeasurementSubtraction {
  id: string;
  segmentIndex: number; // which segment this applies to
  points: Point[];
  value: number; // calculated value to subtract
  createdAt: string;
}

// Measurement with materials
export interface Measurement {
  id: string;
  projectId: string;
  pageNumber: number;
  name: string; // user-defined name like "Front Elevation"
  measurementType: MeasurementType;
  points: Point[]; // legacy single segment
  segments: Point[][]; // multiple independent sections
  value: number; // calculated length, area, or count
  unit: UnitType;
  color: string;
  lineWeight?: number; // line thickness for rendering
  materials: MeasurementMaterial[]; // materials attached
  isVisible: boolean;
  createdAt: string;
  subtractions?: MeasurementSubtraction[]; // subtractions from segments
}

// Plan notes/annotations
export interface PlanNote {
  id: string;
  projectId: string;
  pageNumber: number;
  position: Point;
  text: string;
  color: string;
  createdAt: string;
}

// Quick measurements (reference only, not in takeoff summary)
export interface QuickMeasurement {
  id: string;
  projectId: string;
  pageNumber: number;
  points: Point[];
  createdAt: string;
}

// Reference lines - visual markup only, no measurements displayed after drawing
export interface ReferenceLine {
  id: string;
  projectId: string;
  pageNumber: number;
  points: Point[];
  color: string;
  lineWeight: number;
  createdAt: string;
}

// UI State types
export type ActiveTool = 'select' | 'pan' | 'scale' | 'linear' | 'area' | 'count' | 'note' | 'measure' | 'line';

// Quick draw modes - modifiers for linear/area tools
export type QuickDrawMode = 'default' | 'line' | 'rectangle';

// Current drawing config
export interface DrawingConfig {
  color: string;
  lineWeight: number;
}

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Pending measurement waiting for name
export interface PendingMeasurement {
  measurementType: MeasurementType;
  points: Point[];
  value: number;
  unit: UnitType;
  color: string;
  lineWeight?: number;
}

// Helper to convert units for display
export function formatUnit(unit: UnitType): string {
  const unitLabels: Record<UnitType, string> = {
    'LF': 'Linear Feet',
    'SF': 'Square Feet',
    'EA': 'Each',
  };
  return unitLabels[unit] || unit;
}

export function formatValue(value: number, unit: UnitType): string {
  if (unit === 'EA') {
    return Math.round(value).toString();
  }
  return value.toFixed(2);
}
