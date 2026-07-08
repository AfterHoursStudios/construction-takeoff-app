# Measurement System Refactor Specification

## Overview
Refactor the takeoff system from tool-based to measurement-based with materials.

## Current System (Remove)
- Tools have names, categories, colors assigned upfront
- Each measurement tied to a specific tool type
- ToolConfigModal for configuring tools before drawing

## New System

### Flow
1. Select Area/Linear/Count tool
2. Pick a color (simple color picker, no tool config)
3. Draw the measurement
4. Enter measurement name (e.g., "Front Elevation", "Kitchen Floor")
5. Measurement appears in sidebar
6. Click measurement to add/edit materials

### Data Structures

```typescript
// Material attached to a measurement
interface MeasurementMaterial {
  id: string;
  name: string;
  hasCoverage: boolean; // false = just show raw SF/LF
  coverageAmount?: number; // e.g., 100 (SF per unit)
  coverageUnit?: string; // e.g., "roll", "box", "bundle", "bucket"
  quantity?: number; // calculated: measurement value / coverageAmount
}

// Saved material template for reuse
interface SavedMaterial {
  id: string;
  name: string;
  hasCoverage: boolean;
  coverageAmount?: number;
  coverageUnit?: string;
}

// Updated Measurement (modify existing)
interface Measurement {
  id: string;
  projectId: string;
  pageNumber: number;
  name: string; // NEW: user-defined name like "Front Elevation"
  measurementType: 'linear' | 'area' | 'count';
  points: Point[];
  value: number;
  unit: 'LF' | 'SF' | 'EA';
  color: string;
  materials: MeasurementMaterial[]; // NEW: materials attached
  isVisible: boolean;
  createdAt: string;
  // REMOVE: toolId, toolName, category, wasteFactor, adjustedValue, notes, isDeduction
}
```

### Store Changes
- Add `savedMaterials: SavedMaterial[]` to state
- Add actions: `addSavedMaterial`, `updateMeasurementMaterials`
- Remove: `customTools`, `currentToolConfig` related code
- Update `addMeasurement` for new structure

### UI Components

#### Replace ToolConfigModal
- Simple color picker modal when selecting linear/area/count tool
- Just pick color, no name/category/waste factor

#### New: MeasurementNameModal
- Opens after completing a measurement
- Text input for measurement name
- Save button

#### New: MaterialsModal
- Opens when clicking a measurement in sidebar
- Shows current materials list
- Add material button:
  - Autocomplete from savedMaterials
  - Name input
  - Toggle: "Has coverage" checkbox
  - If has coverage: amount input + unit dropdown (roll, box, bundle, bucket, bag, etc.)
- Delete material button per row
- Shows calculated quantity if coverage is set

#### Redesign TakeoffSidebar
```
Page 1
├─ ▼ Front Elevation (850 SF) [color dot]
│    • Lath - 9 rolls (1 roll = 100 SF)
│    • Waterproofing - 17 buckets (1 bucket = 50 SF)
│    • Stone Veneer - 850 SF
│    [+ Add Material button]
│
├─ ▼ Side Wall (620 SF) [color dot]
│    • Lap Siding - 620 SF
│    • House Wrap - 7 rolls (1 roll = 100 SF)
│    [+ Add Material button]
```

- Click measurement name to select/highlight on plan
- Expand/collapse materials
- Hover shows delete button for measurement
- "+ Add Material" opens MaterialsModal

### PDF Export Changes

#### Per-Measurement Section
```
Front Elevation - 850 SF
  Item              Coverage        Quantity
  Lath              1 roll/100 SF   9 rolls
  Waterproofing     1 bucket/50 SF  17 buckets
  Stone Veneer      -               850 SF

Side Wall - 620 SF
  Item              Coverage        Quantity
  Lap Siding        -               620 SF
  House Wrap        1 roll/100 SF   7 rolls
```

#### Totals Section at End
```
MATERIAL TOTALS
  Material          Total Quantity
  Lath              15 rolls
  Waterproofing     17 buckets
  Stone Veneer      850 SF
  Lap Siding        620 SF
  House Wrap        12 rolls
```

### Files to Modify
1. `types/index.ts` - Update Measurement, add MeasurementMaterial, SavedMaterial (partially done)
2. `stores/projectStore.ts` - Update state and actions
3. `components/ToolConfigModal.tsx` - Replace with simple ColorPickerModal
4. `components/MeasurementCanvas.tsx` - Update flow, trigger name modal after draw
5. `components/TakeoffSidebar.tsx` - Complete redesign
6. `components/ExportModal.tsx` - Update PDF generation
7. `pages/ProjectView.tsx` - Update tool handling
8. NEW: `components/MeasurementNameModal.tsx`
9. NEW: `components/MaterialsModal.tsx`

### Files to Delete
- Remove DEFAULT_TOOLS from types/index.ts
- Remove CustomTool interface

### Migration
- Existing measurements in localStorage will need migration or clear storage
