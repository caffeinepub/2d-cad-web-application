import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileText, Calendar } from 'lucide-react';
import { useProjectQueries } from '../hooks/useQueries';
import { format } from 'date-fns';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'save' | 'load';
  onSave: (projectName: string) => void;
  onLoad: (projectId: string) => void;
}

export default function ProjectDialog({
  open,
  onOpenChange,
  mode,
  onSave,
  onLoad,
}: ProjectDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { listProjectsQuery, deleteProjectMutation } = useProjectQueries();

  useEffect(() => {
    if (open && mode === 'load') {
      listProjectsQuery.refetch();
    }
  }, [open, mode]);

  const handleSave = () => {
    if (projectName.trim()) {
      onSave(projectName.trim());
      setProjectName('');
    }
  };

  const handleLoad = () => {
    if (selectedProjectId) {
      onLoad(selectedProjectId);
      setSelectedProjectId(null);
    }
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProjectMutation.mutateAsync(projectId);
      listProjectsQuery.refetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === 'save' ? 'Save Project' : 'Load Project'}</DialogTitle>
          <DialogDescription>
            {mode === 'save'
              ? 'Enter a name for your project'
              : 'Select a project to load'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'save' ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="My CAD Project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
          </div>
        ) : (
          <div className="py-4">
            {listProjectsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : listProjectsQuery.data && listProjectsQuery.data.length > 0 ? (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2">
                  {listProjectsQuery.data.map((project) => (
                    <button
                      key={project.id}
                      className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                        selectedProjectId === project.id
                          ? 'border-primary bg-accent'
                          : 'border-border'
                      }`}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{project.name}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(Number(project.modified) / 1000000), 'MMM d, yyyy')}
                            </span>
                            <span>{project.objects.length} objects</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(project.id, e)}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          ×
                        </Button>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="mb-2 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No saved projects yet</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === 'save' ? (
            <Button onClick={handleSave} disabled={!projectName.trim()}>
              Save Project
            </Button>
          ) : (
            <Button onClick={handleLoad} disabled={!selectedProjectId}>
              Load Project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
