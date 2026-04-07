import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff, Plus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Layer {
  id: number;
  name: string;
  color: string;
  visible: boolean;
}

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: number;
  onActiveLayerChange: (layerId: number) => void;
  onAddLayer: (name: string, color: string) => void;
  onUpdateLayer: (layerId: number, updates: Partial<Layer>) => void;
  onDeleteLayer: (layerId: number) => void;
  onToggleVisibility: (layerId: number) => void;
}

export default function LayerPanel({
  layers,
  activeLayerId,
  onActiveLayerChange,
  onAddLayer,
  onUpdateLayer,
  onDeleteLayer,
  onToggleVisibility,
}: LayerPanelProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState('#ffffff');

  const handleAddLayer = () => {
    if (newLayerName.trim()) {
      onAddLayer(newLayerName.trim(), newLayerColor);
      setNewLayerName('');
      setNewLayerColor('#ffffff');
      setShowAddDialog(false);
    }
  };

  const handleEditLayer = () => {
    if (editingLayer && newLayerName.trim()) {
      onUpdateLayer(editingLayer.id, {
        name: newLayerName.trim(),
        color: newLayerColor,
      });
      setShowEditDialog(false);
      setEditingLayer(null);
      setNewLayerName('');
      setNewLayerColor('#ffffff');
    }
  };

  const openEditDialog = (layer: Layer) => {
    setEditingLayer(layer);
    setNewLayerName(layer.name);
    setNewLayerColor(layer.color);
    setShowEditDialog(true);
  };

  return (
    <div className="w-64 border-l border-border/40 bg-card/50 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/40 p-3">
        <h3 className="text-sm font-semibold">Layers</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-2 space-y-1">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className={cn(
                'group flex items-center gap-2 rounded-md border p-2 transition-colors cursor-pointer',
                activeLayerId === layer.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border/40 hover:bg-accent/50'
              )}
              onClick={() => onActiveLayerChange(layer.id)}
            >
              <button
                className="flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
              >
                {layer.visible ? (
                  <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                )}
              </button>

              <div
                className="h-4 w-4 flex-shrink-0 rounded border border-border"
                style={{ backgroundColor: layer.color }}
              />

              <span className="flex-1 truncate text-sm">{layer.name}</span>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(layer);
                  }}
                >
                  <Edit2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
                {layers.length > 1 && (
                  <button
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete layer "${layer.name}"?`)) {
                        onDeleteLayer(layer.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive hover:text-destructive/80" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Add Layer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add New Layer</DialogTitle>
            <DialogDescription>
              Create a new layer for organizing your drawing objects.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="layer-name">Layer Name</Label>
              <Input
                id="layer-name"
                placeholder="Layer 2"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLayer()}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="layer-color">Layer Color</Label>
              <div className="flex gap-2">
                <Input
                  id="layer-color"
                  type="color"
                  value={newLayerColor}
                  onChange={(e) => setNewLayerColor(e.target.value)}
                  className="h-10 w-20"
                />
                <Input
                  type="text"
                  value={newLayerColor}
                  onChange={(e) => setNewLayerColor(e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLayer} disabled={!newLayerName.trim()}>
              Add Layer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Layer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Layer</DialogTitle>
            <DialogDescription>
              Update the layer name and color.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-layer-name">Layer Name</Label>
              <Input
                id="edit-layer-name"
                placeholder="Layer name"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditLayer()}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-layer-color">Layer Color</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-layer-color"
                  type="color"
                  value={newLayerColor}
                  onChange={(e) => setNewLayerColor(e.target.value)}
                  className="h-10 w-20"
                />
                <Input
                  type="text"
                  value={newLayerColor}
                  onChange={(e) => setNewLayerColor(e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditLayer} disabled={!newLayerName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
