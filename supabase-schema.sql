-- TakeoffPro User Management Database Schema
-- Run this in your Supabase SQL Editor

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT,
  address TEXT,
  notes TEXT,
  plan_file_id TEXT,
  plan_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Measurements table
CREATE TABLE measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  measurement_type TEXT NOT NULL,
  points JSONB NOT NULL,
  segments JSONB,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  color TEXT NOT NULL,
  line_weight INTEGER DEFAULT 2,
  materials JSONB DEFAULT '[]',
  subtractions JSONB DEFAULT '[]',
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page scales table
CREATE TABLE page_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  pixels_per_unit NUMERIC NOT NULL,
  calibration_data JSONB,
  UNIQUE(project_id, page_number)
);

-- Saved materials (user templates)
CREATE TABLE saved_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  has_coverage BOOLEAN DEFAULT FALSE,
  coverage_amount NUMERIC,
  coverage_unit TEXT,
  waste_factor NUMERIC,
  is_stud BOOLEAN DEFAULT FALSE,
  stud_spacing NUMERIC,
  stud_extra INTEGER,
  is_plate BOOLEAN DEFAULT FALSE,
  plate_length NUMERIC,
  plate_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool presets
CREATE TABLE tool_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  measurement_type TEXT NOT NULL,
  color TEXT NOT NULL,
  materials JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_presets ENABLE ROW LEVEL SECURITY;

-- RLS policies (user can only access own data)
CREATE POLICY "Users can CRUD own projects" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own measurements" ON measurements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own page_scales" ON page_scales FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own saved_materials" ON saved_materials FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own tool_presets" ON tool_presets FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_measurements_user_id ON measurements(user_id);
CREATE INDEX idx_measurements_project_id ON measurements(project_id);
CREATE INDEX idx_page_scales_user_id ON page_scales(user_id);
CREATE INDEX idx_page_scales_project_id ON page_scales(project_id);
CREATE INDEX idx_saved_materials_user_id ON saved_materials(user_id);
CREATE INDEX idx_tool_presets_user_id ON tool_presets(user_id);
