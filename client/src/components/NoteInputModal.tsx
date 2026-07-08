import { useState, useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import type { PlanNote } from '../types';

interface NoteInputModalProps {
  onClose: () => void;
  editingNote?: PlanNote | null;
}

const NOTE_COLORS = [
  '#fbbf24', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#22c55e', // green
];

export default function NoteInputModal({ onClose, editingNote }: NoteInputModalProps) {
  const {
    currentProject,
    currentPage,
    pendingNotePosition,
    setPendingNotePosition,
    addPlanNote,
    updatePlanNote,
    setActiveTool,
  } = useProjectStore();

  const [text, setText] = useState(editingNote?.text || '');
  const [color, setColor] = useState(editingNote?.color || NOTE_COLORS[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      onClose();
      return;
    }

    if (editingNote) {
      // Update existing note
      updatePlanNote(editingNote.id, {
        text: text.trim(),
        color,
      });
    } else if (currentProject && pendingNotePosition) {
      // Create new note
      const newNote: PlanNote = {
        id: crypto.randomUUID(),
        projectId: currentProject.id,
        pageNumber: currentPage,
        position: pendingNotePosition,
        text: text.trim(),
        color,
        createdAt: new Date().toISOString(),
      };
      addPlanNote(newNote);
    }

    setPendingNotePosition(null);
    setActiveTool('select');
    onClose();
  };

  const handleCancel = () => {
    setPendingNotePosition(null);
    setActiveTool('select');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                {editingNote ? 'Edit Note' : 'Add Note'}
              </h2>
              <p className="text-sm text-slate-500">
                Leave a note on the plan
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="input-label">Note Text</label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your note..."
              className="input-field min-h-[100px] resize-y"
              rows={4}
            />
          </div>

          <div>
            <label className="input-label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={handleCancel} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {editingNote ? 'Update Note' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
