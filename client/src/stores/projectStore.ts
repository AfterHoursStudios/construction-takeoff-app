import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Project,
  PageScale,
  Measurement,
  MeasurementMaterial,
  MeasurementSubtraction,
  SavedMaterial,
  ToolPreset,
  ActiveTool,
  QuickDrawMode,
  Point,
  DrawingConfig,
  PlanNote,
  QuickMeasurement,
  PendingMeasurement,
  ReferenceLine,
} from '../types';
import * as db from '../lib/database';

interface ProjectState {
  // Auth-related
  isDataLoaded: boolean;
  isSyncing: boolean;

  // Projects
  projects: Project[];
  currentProject: Project | null;

  // Plan state
  currentPage: number;
  totalPages: number;
  pageScales: Record<string, PageScale>; // keyed by `${projectId}-${pageNumber}`
  pageNames: Record<string, string>; // keyed by `${projectId}-${pageNumber}`
  pageSourceMap: Record<string, number>; // keyed by `${projectId}-${pageNumber}`, value is source PDF page number
  originalPageCounts: Record<string, number>; // keyed by projectId, stores original PDF page count

  // Drawing config (simple color picker)
  activeTool: ActiveTool;
  drawingConfig: DrawingConfig;
  continuingMeasurementName: string | null; // When reusing a measurement's settings

  // Saved materials for reuse
  savedMaterials: SavedMaterial[];

  // Tool presets - saved tool configurations with materials
  toolPresets: ToolPreset[];
  activeToolPreset: ToolPreset | null; // Currently selected preset for measuring

  // Measurements
  measurements: Measurement[];
  selectedMeasurementId: string | null;
  selectedSegmentIndex: number | null; // Which segment within the measurement is selected
  pendingMeasurement: PendingMeasurement | null; // measurement waiting for name

  // Plan notes
  planNotes: PlanNote[];
  selectedNoteId: string | null;
  pendingNotePosition: Point | null;

  // Quick measurements (reference only, not in takeoff)
  quickMeasurements: QuickMeasurement[];
  selectedQuickMeasurementId: string | null;

  // Reference lines (visual markup only)
  referenceLines: ReferenceLine[];
  selectedReferenceLineId: string | null;

  // Scale calibration state
  isCalibrating: boolean;
  calibrationPoints: Point[];

  // Subtraction mode state
  isSubtractMode: boolean;
  subtractingFromSegment: { measurementId: string; segmentIndex: number } | null;

  // Drawing state
  isDrawing: boolean;
  currentPoints: Point[];
  snapToAngle: boolean; // Snap to 45/90 degree angles
  rectangleStartPoint: Point | null; // Starting corner for rectangle tool
  quickDrawMode: QuickDrawMode; // Quick draw mode for linear/area tools

  // Viewport
  viewportScale: number;
  viewportOffset: { x: number; y: number };

  // Actions
  loadUserData: (userId: string) => Promise<void>;
  clearUserData: () => void;

  setProjects: (projects: Project[]) => void;
  addProject: (project: Project, userId?: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;

  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;

  setPageScale: (projectId: string, pageNumber: number, scale: PageScale, userId?: string) => void;
  getPageScale: (projectId: string, pageNumber: number) => PageScale | null;

  setPageName: (projectId: string, pageNumber: number, name: string) => void;
  getPageName: (projectId: string, pageNumber: number) => string;

  duplicatePage: (projectId: string, sourcePageNumber: number) => number;
  getSourcePage: (projectId: string, pageNumber: number) => number;
  setOriginalPageCount: (projectId: string, count: number) => void;

  setActiveTool: (tool: ActiveTool) => void;
  setDrawingConfig: (config: DrawingConfig) => void;
  setContinuingMeasurementName: (name: string | null) => void;

  // Saved materials
  addSavedMaterial: (material: SavedMaterial, userId?: string) => void;
  updateSavedMaterial: (id: string, updates: Partial<SavedMaterial>) => void;
  deleteSavedMaterial: (id: string) => void;

  // Tool presets
  addToolPreset: (preset: ToolPreset, userId?: string) => void;
  updateToolPreset: (id: string, updates: Partial<ToolPreset>) => void;
  deleteToolPreset: (id: string) => void;
  setActiveToolPreset: (preset: ToolPreset | null) => void;
  useToolPreset: (preset: ToolPreset) => void; // Activates the preset and sets tool/color

  // Measurement actions
  addMeasurement: (measurement: Measurement, userId?: string) => void;
  updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  deleteMeasurement: (id: string) => void;
  deleteSegment: (measurementId: string, segmentIndex: number) => void;
  setSelectedMeasurement: (id: string | null) => void;
  setSelectedSegment: (measurementId: string | null, segmentIndex: number | null) => void;
  getMeasurementsForPage: (projectId: string, pageNumber: number) => Measurement[];
  getMeasurementsForProject: (projectId: string) => Measurement[];
  setPendingMeasurement: (measurement: PendingMeasurement | null) => void;

  // Material actions on measurements
  addMaterialToMeasurement: (measurementId: string, material: MeasurementMaterial) => void;
  updateMeasurementMaterial: (measurementId: string, materialId: string, updates: Partial<MeasurementMaterial>) => void;
  removeMaterialFromMeasurement: (measurementId: string, materialId: string) => void;

  // Plan note actions
  addPlanNote: (note: PlanNote) => void;
  updatePlanNote: (id: string, updates: Partial<PlanNote>) => void;
  deletePlanNote: (id: string) => void;
  setSelectedNote: (id: string | null) => void;
  setPendingNotePosition: (position: Point | null) => void;
  getNotesForPage: (projectId: string, pageNumber: number) => PlanNote[];

  // Quick measurement actions
  addQuickMeasurement: (measurement: QuickMeasurement) => void;
  updateQuickMeasurement: (id: string, updates: Partial<QuickMeasurement>) => void;
  deleteQuickMeasurement: (id: string) => void;
  setSelectedQuickMeasurement: (id: string | null) => void;
  getQuickMeasurementsForPage: (projectId: string, pageNumber: number) => QuickMeasurement[];

  // Reference line actions
  addReferenceLine: (line: ReferenceLine) => void;
  updateReferenceLine: (id: string, updates: Partial<ReferenceLine>) => void;
  deleteReferenceLine: (id: string) => void;
  setSelectedReferenceLine: (id: string | null) => void;

  // Calibration actions
  setIsCalibrating: (isCalibrating: boolean) => void;
  addCalibrationPoint: (point: Point) => void;
  clearCalibrationPoints: () => void;

  // Subtraction actions
  setSubtractMode: (enabled: boolean) => void;
  setSubtractingFromSegment: (info: { measurementId: string; segmentIndex: number } | null) => void;
  addSubtraction: (measurementId: string, subtraction: MeasurementSubtraction) => void;
  deleteSubtraction: (measurementId: string, subtractionId: string) => void;

  // Drawing actions
  setIsDrawing: (isDrawing: boolean) => void;
  addCurrentPoint: (point: Point) => void;
  clearCurrentPoints: () => void;
  setSnapToAngle: (snap: boolean) => void;
  setRectangleStartPoint: (point: Point | null) => void;
  setQuickDrawMode: (mode: QuickDrawMode) => void;
  toggleQuickDrawMode: (mode: 'line' | 'rectangle') => void;

  // Viewport actions
  setViewportScale: (scale: number) => void;
  setViewportOffset: (offset: { x: number; y: number }) => void;

  loadProjectData: (projectId: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isDataLoaded: false,
    isSyncing: false,
    projects: [],
    currentProject: null,
    currentPage: 1,
    totalPages: 1,
    pageScales: {},
    pageNames: {},
    pageSourceMap: {},
    originalPageCounts: {},
    activeTool: 'select',
    drawingConfig: {
      color: '#3b82f6',
      lineWeight: 3,
    },
    continuingMeasurementName: null,
    savedMaterials: [],
    toolPresets: [],
    activeToolPreset: null,
    measurements: [],
    selectedMeasurementId: null,
    selectedSegmentIndex: null,
    pendingMeasurement: null,
    planNotes: [],
    selectedNoteId: null,
    pendingNotePosition: null,
    quickMeasurements: [],
    selectedQuickMeasurementId: null,
    referenceLines: [],
    selectedReferenceLineId: null,
    isCalibrating: false,
    calibrationPoints: [],
    isSubtractMode: false,
    subtractingFromSegment: null,
    isDrawing: false,
    currentPoints: [],
    snapToAngle: false,
    rectangleStartPoint: null,
    quickDrawMode: 'default',
    viewportScale: 1,
    viewportOffset: { x: 0, y: 0 },

    // Load all user data from Supabase
    loadUserData: async (userId: string) => {
      set({ isSyncing: true });
      try {
        const data = await db.loadAllUserData(userId);
        set({
          projects: data.projects,
          measurements: data.measurements,
          pageScales: data.pageScales,
          savedMaterials: data.savedMaterials,
          toolPresets: data.toolPresets,
          isDataLoaded: true,
          isSyncing: false,
        });
      } catch (error) {
        console.error('Error loading user data:', error);
        set({ isSyncing: false, isDataLoaded: true });
      }
    },

    // Clear user data on logout
    clearUserData: () => {
      set({
        isDataLoaded: false,
        projects: [],
        currentProject: null,
        measurements: [],
        pageScales: {},
        savedMaterials: [],
        toolPresets: [],
        planNotes: [],
        quickMeasurements: [],
        referenceLines: [],
        pageNames: {},
        pageSourceMap: {},
        originalPageCounts: {},
      });
    },

    // Project actions
    setProjects: (projects) => set({ projects }),

    addProject: (project, userId) => {
      set((state) => ({
        projects: [...state.projects, project],
      }));
      // Sync to Supabase if userId provided
      if (userId) {
        db.createProject(userId, project).catch(console.error);
      }
    },

    updateProject: (id, updates) => {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ),
        currentProject: state.currentProject?.id === id
          ? { ...state.currentProject, ...updates, updatedAt: new Date().toISOString() }
          : state.currentProject,
      }));
      // Sync to Supabase
      db.updateProject(id, updates).catch(console.error);
    },

    deleteProject: (id) => {
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        measurements: state.measurements.filter((m) => m.projectId !== id),
        planNotes: state.planNotes.filter((n) => n.projectId !== id),
        quickMeasurements: state.quickMeasurements.filter((q) => q.projectId !== id),
        referenceLines: state.referenceLines.filter((l) => l.projectId !== id),
      }));
      // Sync to Supabase - cascade will handle related data
      db.deleteProject(id).catch(console.error);
    },

    setCurrentProject: (project) => set({
      currentProject: project,
      currentPage: 1,
      selectedMeasurementId: null,
      isCalibrating: false,
      calibrationPoints: [],
      isDrawing: false,
      currentPoints: [],
    }),

    // Page actions
    setCurrentPage: (page) => set({
      currentPage: page,
      isCalibrating: false,
      calibrationPoints: [],
      isDrawing: false,
      currentPoints: [],
      selectedMeasurementId: null,
    }),

    setTotalPages: (total) => set({ totalPages: total }),

    // Scale actions
    setPageScale: (projectId, pageNumber, scale, userId) => {
      set((state) => ({
        pageScales: {
          ...state.pageScales,
          [`${projectId}-${pageNumber}`]: scale,
        },
      }));
      // Sync to Supabase if userId provided
      if (userId) {
        db.upsertPageScale(userId, projectId, pageNumber, scale).catch(console.error);
      }
    },

    getPageScale: (projectId, pageNumber) => {
      const state = get();
      return state.pageScales[`${projectId}-${pageNumber}`] || null;
    },

    // Page name actions
    setPageName: (projectId, pageNumber, name) => set((state) => ({
      pageNames: {
        ...state.pageNames,
        [`${projectId}-${pageNumber}`]: name,
      },
    })),

    getPageName: (projectId, pageNumber) => {
      const state = get();
      return state.pageNames[`${projectId}-${pageNumber}`] || `Page ${pageNumber}`;
    },

    duplicatePage: (projectId, sourcePageNumber) => {
      const state = get();
      const newPageNumber = state.totalPages + 1;
      const sourcePdfPage = state.pageSourceMap[`${projectId}-${sourcePageNumber}`] || sourcePageNumber;

      set({
        pageSourceMap: {
          ...state.pageSourceMap,
          [`${projectId}-${newPageNumber}`]: sourcePdfPage,
        },
        totalPages: newPageNumber,
        pageNames: {
          ...state.pageNames,
          [`${projectId}-${newPageNumber}`]: `${state.pageNames[`${projectId}-${sourcePageNumber}`] || `Page ${sourcePageNumber}`} (Copy)`,
        },
      });

      return newPageNumber;
    },

    getSourcePage: (projectId, pageNumber) => {
      const state = get();
      return state.pageSourceMap[`${projectId}-${pageNumber}`] || pageNumber;
    },

    setOriginalPageCount: (projectId, count) => {
      const state = get();
      if (!state.originalPageCounts[projectId]) {
        set({
          originalPageCounts: {
            ...state.originalPageCounts,
            [projectId]: count,
          },
        });
      }
    },

    // Active tool actions
    setActiveTool: (tool) => set({
      activeTool: tool,
      isCalibrating: tool === 'scale',
      calibrationPoints: [],
      isDrawing: false,
      currentPoints: [],
      isSubtractMode: false,
      subtractingFromSegment: null,
      rectangleStartPoint: null,
    }),

    setDrawingConfig: (config) => set({ drawingConfig: config }),

    setContinuingMeasurementName: (name) => set({ continuingMeasurementName: name }),

    // Saved materials actions
    addSavedMaterial: (material, userId) => {
      set((state) => ({
        savedMaterials: [...state.savedMaterials, material],
      }));
      if (userId) {
        db.createSavedMaterial(userId, material).catch(console.error);
      }
    },

    updateSavedMaterial: (id, updates) => {
      set((state) => ({
        savedMaterials: state.savedMaterials.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      }));
      db.updateSavedMaterial(id, updates).catch(console.error);
    },

    deleteSavedMaterial: (id) => {
      set((state) => ({
        savedMaterials: state.savedMaterials.filter((m) => m.id !== id),
      }));
      db.deleteSavedMaterial(id).catch(console.error);
    },

    // Tool preset actions
    addToolPreset: (preset, userId) => {
      set((state) => ({
        toolPresets: [...state.toolPresets, preset],
      }));
      if (userId) {
        db.createToolPreset(userId, preset).catch(console.error);
      }
    },

    updateToolPreset: (id, updates) => {
      set((state) => ({
        toolPresets: state.toolPresets.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }));
      db.updateToolPreset(id, updates).catch(console.error);
    },

    deleteToolPreset: (id) => {
      set((state) => ({
        toolPresets: state.toolPresets.filter((p) => p.id !== id),
        activeToolPreset: state.activeToolPreset?.id === id ? null : state.activeToolPreset,
      }));
      db.deleteToolPreset(id).catch(console.error);
    },

    setActiveToolPreset: (preset) => set({ activeToolPreset: preset }),

    useToolPreset: (preset) => set((state) => ({
      activeToolPreset: preset,
      activeTool: preset.measurementType,
      drawingConfig: { color: preset.color, lineWeight: state.drawingConfig.lineWeight },
      continuingMeasurementName: preset.name,
    })),

    // Measurement actions
    addMeasurement: (measurement, userId) => {
      set((state) => ({
        measurements: [...state.measurements, measurement],
      }));
      if (userId) {
        db.createMeasurement(userId, measurement).catch(console.error);
      }
    },

    updateMeasurement: (id, updates) => {
      set((state) => ({
        measurements: state.measurements.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      }));
      db.updateMeasurement(id, updates).catch(console.error);
    },

    deleteMeasurement: (id) => {
      set((state) => ({
        measurements: state.measurements.filter((m) => m.id !== id),
        selectedMeasurementId: state.selectedMeasurementId === id ? null : state.selectedMeasurementId,
        selectedSegmentIndex: state.selectedMeasurementId === id ? null : state.selectedSegmentIndex,
      }));
      db.deleteMeasurement(id).catch(console.error);
    },

    deleteSegment: (measurementId, segmentIndex) => {
      const state = get();
      const measurement = state.measurements.find((m) => m.id === measurementId);
      if (!measurement) return;

      const allSegments = measurement.segments && measurement.segments.length > 0
        ? measurement.segments
        : [measurement.points];

      // If only one segment, delete the entire measurement
      if (allSegments.length <= 1) {
        get().deleteMeasurement(measurementId);
        return;
      }

      // Remove the segment at the specified index
      const newSegments = allSegments.filter((_, idx) => idx !== segmentIndex);

      // Update subtractions: remove those for deleted segment, re-index rest
      const updatedSubtractions = (measurement.subtractions || [])
        .filter((sub) => sub.segmentIndex !== segmentIndex)
        .map((sub) => ({
          ...sub,
          segmentIndex: sub.segmentIndex > segmentIndex ? sub.segmentIndex - 1 : sub.segmentIndex,
        }));

      // Recalculate total value
      let newValue = 0;
      if (measurement.measurementType === 'linear') {
        newSegments.forEach(seg => {
          for (let i = 1; i < seg.length; i++) {
            const dx = seg[i].x - seg[i - 1].x;
            const dy = seg[i].y - seg[i - 1].y;
            newValue += Math.sqrt(dx * dx + dy * dy);
          }
        });
      } else if (measurement.measurementType === 'area') {
        newSegments.forEach(seg => {
          if (seg.length >= 3) {
            let area = 0;
            const n = seg.length;
            for (let i = 0; i < n; i++) {
              const j = (i + 1) % n;
              area += seg[i].x * seg[j].y;
              area -= seg[j].x * seg[i].y;
            }
            newValue += Math.abs(area) / 2;
          }
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

      const updates = {
        segments: newSegments,
        points: newSegments[0] || [],
        value: newValue,
        materials: updatedMaterials,
        subtractions: updatedSubtractions,
      };

      set((state) => ({
        measurements: state.measurements.map((m) =>
          m.id === measurementId ? { ...m, ...updates } : m
        ),
        selectedSegmentIndex: null,
      }));

      db.updateMeasurement(measurementId, updates).catch(console.error);
    },

    setSelectedMeasurement: (id) => set({ selectedMeasurementId: id, selectedSegmentIndex: null }),

    setSelectedSegment: (measurementId, segmentIndex) => set({
      selectedMeasurementId: measurementId,
      selectedSegmentIndex: segmentIndex,
    }),

    getMeasurementsForPage: (projectId, pageNumber) => {
      const state = get();
      return state.measurements.filter(
        (m) => m.projectId === projectId && m.pageNumber === pageNumber
      );
    },

    getMeasurementsForProject: (projectId) => {
      const state = get();
      return state.measurements.filter((m) => m.projectId === projectId);
    },

    setPendingMeasurement: (measurement) => set({ pendingMeasurement: measurement }),

    // Material actions on measurements
    addMaterialToMeasurement: (measurementId, material) => {
      const state = get();
      const measurement = state.measurements.find(m => m.id === measurementId);
      if (!measurement) return;

      const newMaterials = [...measurement.materials, material];
      set((state) => ({
        measurements: state.measurements.map((m) =>
          m.id === measurementId
            ? { ...m, materials: newMaterials }
            : m
        ),
      }));
      db.updateMeasurement(measurementId, { materials: newMaterials }).catch(console.error);
    },

    updateMeasurementMaterial: (measurementId, materialId, updates) => {
      const state = get();
      const measurement = state.measurements.find(m => m.id === measurementId);
      if (!measurement) return;

      const newMaterials = measurement.materials.map((mat) =>
        mat.id === materialId ? { ...mat, ...updates } : mat
      );
      set((state) => ({
        measurements: state.measurements.map((m) =>
          m.id === measurementId
            ? { ...m, materials: newMaterials }
            : m
        ),
      }));
      db.updateMeasurement(measurementId, { materials: newMaterials }).catch(console.error);
    },

    removeMaterialFromMeasurement: (measurementId, materialId) => {
      const state = get();
      const measurement = state.measurements.find(m => m.id === measurementId);
      if (!measurement) return;

      const newMaterials = measurement.materials.filter((mat) => mat.id !== materialId);
      set((state) => ({
        measurements: state.measurements.map((m) =>
          m.id === measurementId
            ? { ...m, materials: newMaterials }
            : m
        ),
      }));
      db.updateMeasurement(measurementId, { materials: newMaterials }).catch(console.error);
    },

    // Plan note actions (local only for now)
    addPlanNote: (note) => set((state) => ({
      planNotes: [...state.planNotes, note],
    })),

    updatePlanNote: (id, updates) => set((state) => ({
      planNotes: state.planNotes.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      ),
    })),

    deletePlanNote: (id) => set((state) => ({
      planNotes: state.planNotes.filter((n) => n.id !== id),
      selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
    })),

    setSelectedNote: (id) => set({ selectedNoteId: id }),

    setPendingNotePosition: (position) => set({ pendingNotePosition: position }),

    getNotesForPage: (projectId, pageNumber) => {
      const state = get();
      return state.planNotes.filter(
        (n) => n.projectId === projectId && n.pageNumber === pageNumber
      );
    },

    // Quick measurement actions (local only)
    addQuickMeasurement: (measurement) => set((state) => ({
      quickMeasurements: [...state.quickMeasurements, measurement],
    })),

    updateQuickMeasurement: (id, updates) => set((state) => ({
      quickMeasurements: state.quickMeasurements.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    })),

    deleteQuickMeasurement: (id) => set((state) => ({
      quickMeasurements: state.quickMeasurements.filter((q) => q.id !== id),
      selectedQuickMeasurementId: state.selectedQuickMeasurementId === id ? null : state.selectedQuickMeasurementId,
    })),

    setSelectedQuickMeasurement: (id) => set({ selectedQuickMeasurementId: id }),

    getQuickMeasurementsForPage: (projectId, pageNumber) => {
      const state = get();
      return state.quickMeasurements.filter(
        (q) => q.projectId === projectId && q.pageNumber === pageNumber
      );
    },

    // Reference line actions (local only)
    addReferenceLine: (line) => set((state) => ({
      referenceLines: [...state.referenceLines, line],
    })),

    updateReferenceLine: (id, updates) => set((state) => ({
      referenceLines: state.referenceLines.map((l) =>
        l.id === id ? { ...l, ...updates } : l
      ),
    })),

    deleteReferenceLine: (id) => set((state) => ({
      referenceLines: state.referenceLines.filter((l) => l.id !== id),
      selectedReferenceLineId: state.selectedReferenceLineId === id ? null : state.selectedReferenceLineId,
    })),

    setSelectedReferenceLine: (id) => set({ selectedReferenceLineId: id }),

    // Calibration actions
    setIsCalibrating: (isCalibrating) => set({ isCalibrating }),

    addCalibrationPoint: (point) => set((state) => ({
      calibrationPoints: [...state.calibrationPoints, point],
    })),

    clearCalibrationPoints: () => set({ calibrationPoints: [] }),

    // Subtraction actions
    setSubtractMode: (enabled) => set({
      isSubtractMode: enabled,
      // Clear drawing state when toggling subtract mode
      isDrawing: false,
      currentPoints: [],
    }),

    setSubtractingFromSegment: (info) => set({
      subtractingFromSegment: info,
      isSubtractMode: info !== null,
      isDrawing: false,
      currentPoints: [],
    }),

    addSubtraction: (measurementId, subtraction) => {
      const state = get();
      const measurement = state.measurements.find(m => m.id === measurementId);
      if (!measurement) return;

      const newSubtractions = [...(measurement.subtractions || []), subtraction];
      set((state) => ({
        measurements: state.measurements.map((m) =>
          m.id === measurementId
            ? { ...m, subtractions: newSubtractions }
            : m
        ),
      }));
      db.updateMeasurement(measurementId, { subtractions: newSubtractions }).catch(console.error);
    },

    deleteSubtraction: (measurementId, subtractionId) => {
      const state = get();
      const measurement = state.measurements.find(m => m.id === measurementId);
      if (!measurement) return;

      const newSubtractions = (measurement.subtractions || []).filter((s) => s.id !== subtractionId);
      set((state) => ({
        measurements: state.measurements.map((m) =>
          m.id === measurementId
            ? { ...m, subtractions: newSubtractions }
            : m
        ),
      }));
      db.updateMeasurement(measurementId, { subtractions: newSubtractions }).catch(console.error);
    },

    // Drawing actions
    setIsDrawing: (isDrawing) => set({ isDrawing }),

    addCurrentPoint: (point) => set((state) => ({
      currentPoints: [...state.currentPoints, point],
    })),

    clearCurrentPoints: () => set({ currentPoints: [] }),

    setSnapToAngle: (snap) => set({ snapToAngle: snap }),

    setRectangleStartPoint: (point) => set({ rectangleStartPoint: point }),

    setQuickDrawMode: (mode) => set({
      quickDrawMode: mode,
      // Clear drawing state when changing mode
      isDrawing: false,
      currentPoints: [],
      rectangleStartPoint: null,
    }),

    toggleQuickDrawMode: (mode) => set((state) => ({
      quickDrawMode: state.quickDrawMode === mode ? 'default' : mode,
      // Clear drawing state when toggling mode
      isDrawing: false,
      currentPoints: [],
      rectangleStartPoint: null,
    })),

    // Viewport actions
    setViewportScale: (scale) => set({ viewportScale: scale }),

    setViewportOffset: (offset) => set({ viewportOffset: offset }),

    // Load project data
    loadProjectData: (projectId) => {
      // This will load measurements and scales from the store for the given project
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      if (project) {
        set({ currentProject: project });
      }
    },
  }))
);
