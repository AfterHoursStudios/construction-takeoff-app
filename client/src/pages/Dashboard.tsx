import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Calendar,
  MapPin,
  User,
  Trash2,
  FileText,
  LogOut,
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import headerLogo from '../assets/headerlogo.png';
import type { Project } from '../types';
import CreateProjectModal from '../components/CreateProjectModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, deleteProject, loadUserData, isDataLoaded, isSyncing, clearUserData } = useProjectStore();
  const { user, signOut } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load user data when component mounts
  useEffect(() => {
    if (user && !isDataLoaded) {
      loadUserData(user.id);
    }
  }, [user, isDataLoaded, loadUserData]);

  const handleSignOut = async () => {
    await signOut();
    clearUserData();
    navigate('/');
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      deleteProject(projectId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Show loading state while data is loading
  if (isSyncing && !isDataLoaded) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center hover:opacity-80 transition-opacity"
            >
              <img src={headerLogo} alt="TakeoffPro" className="h-20 w-auto" />
            </button>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                {user?.email}
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Project
              </button>
              <button
                onClick={handleSignOut}
                className="btn btn-secondary flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search projects by name, client, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field max-w-md"
          />
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="card text-center py-16">
            <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">
              {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
            </h2>
            <p className="text-slate-500 mb-6">
              {projects.length === 0
                ? 'Create your first project to get started with takeoffs.'
                : 'Try a different search term.'}
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
                onDelete={(e) => handleDeleteProject(e, project.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDate: (date: string) => string;
}

function ProjectCard({ project, onClick, onDelete, formatDate }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="card hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">
              {project.name}
            </h3>
            {project.planFileName && (
              <p className="text-xs text-slate-400">{project.planFileName}</p>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <User className="w-4 h-4 text-slate-400" />
          <span>{project.clientName || 'No client specified'}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>{project.address || 'No address specified'}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{formatDate(project.createdAt)}</span>
        </div>
      </div>

      {project.notes && (
        <p className="mt-4 text-sm text-slate-500 line-clamp-2">{project.notes}</p>
      )}
    </div>
  );
}
