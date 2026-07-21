import { supabase } from './supabase';
import type {
  Project,
  Measurement,
  PageScale,
  SavedMaterial,
  ToolPreset,
  MeasurementMaterial,
  MeasurementSubtraction,
  Point,
} from '../types';

// ============== PROJECTS ==============

export async function fetchProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }

  return (data || []).map(mapProjectFromDb);
}

export async function createProject(userId: string, project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: project.name,
      client_name: project.clientName,
      address: project.address,
      notes: project.notes,
      plan_file_id: project.planFileId,
      plan_file_name: project.planFileName,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw error;
  }

  return mapProjectFromDb(data);
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
  if (updates.address !== undefined) dbUpdates.address = updates.address;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.planFileId !== undefined) dbUpdates.plan_file_id = updates.planFileId;
  if (updates.planFileName !== undefined) dbUpdates.plan_file_name = updates.planFileName;

  const { error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', projectId);

  if (error) {
    console.error('Error updating project:', error);
    throw error;
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}

function mapProjectFromDb(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    clientName: (row.client_name as string) || '',
    address: (row.address as string) || '',
    notes: (row.notes as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    planFileId: row.plan_file_id as string | undefined,
    planFileName: row.plan_file_name as string | undefined,
  };
}

// ============== MEASUREMENTS ==============

export async function fetchMeasurements(userId: string): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('measurements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching measurements:', error);
    throw error;
  }

  return (data || []).map(mapMeasurementFromDb);
}

export async function createMeasurement(userId: string, measurement: Measurement): Promise<void> {
  const { error } = await supabase
    .from('measurements')
    .insert({
      id: measurement.id,
      user_id: userId,
      project_id: measurement.projectId,
      page_number: measurement.pageNumber,
      name: measurement.name,
      measurement_type: measurement.measurementType,
      points: measurement.points,
      segments: measurement.segments,
      value: measurement.value,
      unit: measurement.unit,
      color: measurement.color,
      line_weight: measurement.lineWeight || 2,
      materials: measurement.materials,
      subtractions: measurement.subtractions || [],
      is_visible: measurement.isVisible,
    });

  if (error) {
    console.error('Error creating measurement:', error);
    throw error;
  }
}

export async function updateMeasurement(measurementId: string, updates: Partial<Measurement>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.points !== undefined) dbUpdates.points = updates.points;
  if (updates.segments !== undefined) dbUpdates.segments = updates.segments;
  if (updates.value !== undefined) dbUpdates.value = updates.value;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.lineWeight !== undefined) dbUpdates.line_weight = updates.lineWeight;
  if (updates.materials !== undefined) dbUpdates.materials = updates.materials;
  if (updates.subtractions !== undefined) dbUpdates.subtractions = updates.subtractions;
  if (updates.isVisible !== undefined) dbUpdates.is_visible = updates.isVisible;

  const { error } = await supabase
    .from('measurements')
    .update(dbUpdates)
    .eq('id', measurementId);

  if (error) {
    console.error('Error updating measurement:', error);
    throw error;
  }
}

export async function deleteMeasurement(measurementId: string): Promise<void> {
  const { error } = await supabase
    .from('measurements')
    .delete()
    .eq('id', measurementId);

  if (error) {
    console.error('Error deleting measurement:', error);
    throw error;
  }
}

function mapMeasurementFromDb(row: Record<string, unknown>): Measurement {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    pageNumber: row.page_number as number,
    name: row.name as string,
    measurementType: row.measurement_type as Measurement['measurementType'],
    points: row.points as Point[],
    segments: (row.segments as Point[][]) || [],
    value: Number(row.value),
    unit: row.unit as Measurement['unit'],
    color: row.color as string,
    lineWeight: row.line_weight as number,
    materials: (row.materials as MeasurementMaterial[]) || [],
    subtractions: (row.subtractions as MeasurementSubtraction[]) || [],
    isVisible: row.is_visible as boolean,
    createdAt: row.created_at as string,
  };
}

// ============== PAGE SCALES ==============

export async function fetchPageScales(userId: string): Promise<Record<string, PageScale>> {
  const { data, error } = await supabase
    .from('page_scales')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching page scales:', error);
    throw error;
  }

  const scales: Record<string, PageScale> = {};
  for (const row of data || []) {
    const key = `${row.project_id}-${row.page_number}`;
    scales[key] = mapPageScaleFromDb(row);
  }
  return scales;
}

export async function upsertPageScale(userId: string, projectId: string, pageNumber: number, scale: PageScale): Promise<void> {
  const { error } = await supabase
    .from('page_scales')
    .upsert({
      user_id: userId,
      project_id: projectId,
      page_number: pageNumber,
      pixels_per_unit: scale.pixelsPerUnit,
      calibration_data: scale.calibrationPoints,
    }, {
      onConflict: 'project_id,page_number',
    });

  if (error) {
    console.error('Error upserting page scale:', error);
    throw error;
  }
}

function mapPageScaleFromDb(row: Record<string, unknown>): PageScale {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    pageNumber: row.page_number as number,
    pixelsPerUnit: Number(row.pixels_per_unit),
    calibrationPoints: row.calibration_data as PageScale['calibrationPoints'],
  };
}

// ============== SAVED MATERIALS ==============

export async function fetchSavedMaterials(userId: string): Promise<SavedMaterial[]> {
  const { data, error } = await supabase
    .from('saved_materials')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching saved materials:', error);
    throw error;
  }

  return (data || []).map(mapSavedMaterialFromDb);
}

export async function createSavedMaterial(userId: string, material: SavedMaterial): Promise<void> {
  const { error } = await supabase
    .from('saved_materials')
    .insert({
      id: material.id,
      user_id: userId,
      name: material.name,
      has_coverage: material.hasCoverage,
      coverage_amount: material.coverageAmount,
      coverage_unit: material.coverageUnit,
      waste_factor: material.wasteFactor,
      is_stud: material.isStud,
      stud_spacing: material.studSpacing,
      stud_extra: material.studExtra,
      is_plate: material.isPlate,
      plate_length: material.plateLength,
      plate_count: material.plateCount,
    });

  if (error) {
    console.error('Error creating saved material:', error);
    throw error;
  }
}

export async function updateSavedMaterial(materialId: string, updates: Partial<SavedMaterial>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.hasCoverage !== undefined) dbUpdates.has_coverage = updates.hasCoverage;
  if (updates.coverageAmount !== undefined) dbUpdates.coverage_amount = updates.coverageAmount;
  if (updates.coverageUnit !== undefined) dbUpdates.coverage_unit = updates.coverageUnit;
  if (updates.wasteFactor !== undefined) dbUpdates.waste_factor = updates.wasteFactor;
  if (updates.isStud !== undefined) dbUpdates.is_stud = updates.isStud;
  if (updates.studSpacing !== undefined) dbUpdates.stud_spacing = updates.studSpacing;
  if (updates.studExtra !== undefined) dbUpdates.stud_extra = updates.studExtra;
  if (updates.isPlate !== undefined) dbUpdates.is_plate = updates.isPlate;
  if (updates.plateLength !== undefined) dbUpdates.plate_length = updates.plateLength;
  if (updates.plateCount !== undefined) dbUpdates.plate_count = updates.plateCount;

  const { error } = await supabase
    .from('saved_materials')
    .update(dbUpdates)
    .eq('id', materialId);

  if (error) {
    console.error('Error updating saved material:', error);
    throw error;
  }
}

export async function deleteSavedMaterial(materialId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_materials')
    .delete()
    .eq('id', materialId);

  if (error) {
    console.error('Error deleting saved material:', error);
    throw error;
  }
}

function mapSavedMaterialFromDb(row: Record<string, unknown>): SavedMaterial {
  return {
    id: row.id as string,
    name: row.name as string,
    hasCoverage: row.has_coverage as boolean,
    coverageAmount: row.coverage_amount as number | undefined,
    coverageUnit: row.coverage_unit as string | undefined,
    wasteFactor: row.waste_factor as number | undefined,
    isStud: row.is_stud as boolean | undefined,
    studSpacing: row.stud_spacing as number | undefined,
    studExtra: row.stud_extra as number | undefined,
    isPlate: row.is_plate as boolean | undefined,
    plateLength: row.plate_length as number | undefined,
    plateCount: row.plate_count as number | undefined,
  };
}

// ============== TOOL PRESETS ==============

export async function fetchToolPresets(userId: string): Promise<ToolPreset[]> {
  const { data, error } = await supabase
    .from('tool_presets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching tool presets:', error);
    throw error;
  }

  return (data || []).map(mapToolPresetFromDb);
}

export async function createToolPreset(userId: string, preset: ToolPreset): Promise<void> {
  const { error } = await supabase
    .from('tool_presets')
    .insert({
      id: preset.id,
      user_id: userId,
      name: preset.name,
      measurement_type: preset.measurementType,
      color: preset.color,
      materials: preset.materials,
    });

  if (error) {
    console.error('Error creating tool preset:', error);
    throw error;
  }
}

export async function updateToolPreset(presetId: string, updates: Partial<ToolPreset>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.measurementType !== undefined) dbUpdates.measurement_type = updates.measurementType;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.materials !== undefined) dbUpdates.materials = updates.materials;

  const { error } = await supabase
    .from('tool_presets')
    .update(dbUpdates)
    .eq('id', presetId);

  if (error) {
    console.error('Error updating tool preset:', error);
    throw error;
  }
}

export async function deleteToolPreset(presetId: string): Promise<void> {
  const { error } = await supabase
    .from('tool_presets')
    .delete()
    .eq('id', presetId);

  if (error) {
    console.error('Error deleting tool preset:', error);
    throw error;
  }
}

function mapToolPresetFromDb(row: Record<string, unknown>): ToolPreset {
  return {
    id: row.id as string,
    name: row.name as string,
    measurementType: row.measurement_type as ToolPreset['measurementType'],
    color: row.color as string,
    materials: (row.materials as SavedMaterial[]) || [],
    createdAt: row.created_at as string,
  };
}

// ============== BULK DATA LOADING ==============

export async function loadAllUserData(userId: string) {
  const [projects, measurements, pageScales, savedMaterials, toolPresets] = await Promise.all([
    fetchProjects(userId),
    fetchMeasurements(userId),
    fetchPageScales(userId),
    fetchSavedMaterials(userId),
    fetchToolPresets(userId),
  ]);

  return {
    projects,
    measurements,
    pageScales,
    savedMaterials,
    toolPresets,
  };
}

// ============== DELETE USER DATA (for cleanup when deleting measurements by project) ==============

export async function deleteMeasurementsByProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('measurements')
    .delete()
    .eq('project_id', projectId);

  if (error) {
    console.error('Error deleting measurements by project:', error);
    throw error;
  }
}

export async function deletePageScalesByProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('page_scales')
    .delete()
    .eq('project_id', projectId);

  if (error) {
    console.error('Error deleting page scales by project:', error);
    throw error;
  }
}
