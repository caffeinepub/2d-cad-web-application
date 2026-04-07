import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FlipHorizontal, FlipVertical, Copy } from 'lucide-react';
import type { UnitType } from '../hooks/useUnits';

interface SelectedObjectData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  fillColor?: string;
}

interface PropertiesPanelProps {
  selectedObjectData: SelectedObjectData | null;
  onUpdateProperties: (objectId: string, updates: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    color?: string;
    fillColor?: string;
  }) => void;
  onCommitChanges: () => void;
  onMirror: (axis: 'horizontal' | 'vertical') => void;
  onMultiCopy: (count: number, offsetX: number, offsetY: number) => void;
  unit: UnitType;
  convertFromPixels: (value: number, toUnit?: UnitType) => number;
}

const COLOR_OPTIONS = [
  { value: '#ff0000', label: 'Red' },
  { value: '#0000ff', label: 'Blue' },
  { value: '#ffff00', label: 'Yellow' },
  { value: '#00ff00', label: 'Green' },
  { value: '#ffffff', label: 'White' },
  { value: 'none', label: 'None' },
];

// Conversion constants
const PIXELS_PER_INCH = 96;
const CM_PER_INCH = 2.54;

// Convert from current unit to pixels
const convertToPixels = (value: number, fromUnit: UnitType): number => {
  switch (fromUnit) {
    case 'pixels':
      return value;
    case 'inches':
      return value * PIXELS_PER_INCH;
    case 'cm':
      return (value / CM_PER_INCH) * PIXELS_PER_INCH;
    default:
      return value;
  }
};

export default function PropertiesPanel({
  selectedObjectData,
  onUpdateProperties,
  onCommitChanges,
  onMirror,
  onMultiCopy,
  unit,
  convertFromPixels,
}: PropertiesPanelProps) {
  const [x, setX] = useState('0');
  const [y, setY] = useState('0');
  const [width, setWidth] = useState('0');
  const [height, setHeight] = useState('0');
  const [rotation, setRotation] = useState('0');
  const [color, setColor] = useState('#ffffff');
  const [fillColor, setFillColor] = useState('none');
  
  const [showMultiCopyDialog, setShowMultiCopyDialog] = useState(false);
  const [copyCount, setCopyCount] = useState('3');
  const [offsetX, setOffsetX] = useState('50');
  const [offsetY, setOffsetY] = useState('50');

  // Check if selected object is a closed shape that supports fill
  const isClosedShape = selectedObjectData && 
    ['rectangle', 'circle', 'ellipse', 'octagon'].includes(selectedObjectData.type);

  // Update displayed values when selected object or unit changes
  useEffect(() => {
    if (selectedObjectData) {
      setX(convertFromPixels(selectedObjectData.x).toFixed(2));
      setY(convertFromPixels(selectedObjectData.y).toFixed(2));
      setWidth(convertFromPixels(selectedObjectData.width).toFixed(2));
      setHeight(convertFromPixels(selectedObjectData.height).toFixed(2));
      setRotation(selectedObjectData.rotation.toFixed(2));
      setColor(selectedObjectData.color);
      setFillColor(selectedObjectData.fillColor || 'none');
    }
  }, [selectedObjectData, unit, convertFromPixels]);

  const handleUpdate = (field: string, value: string) => {
    if (!selectedObjectData) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    // Convert from current unit to pixels for internal storage
    const pixelValue = field === 'rotation' ? numValue : convertToPixels(numValue, unit);
    
    const updates: any = {};
    updates[field] = pixelValue;
    onUpdateProperties(selectedObjectData.id, updates);
  };

  const handleColorChange = (newColor: string) => {
    if (!selectedObjectData) return;
    setColor(newColor);
    onUpdateProperties(selectedObjectData.id, { color: newColor });
    onCommitChanges();
  };

  const handleFillColorChange = (newFillColor: string) => {
    if (!selectedObjectData) return;
    setFillColor(newFillColor);
    onUpdateProperties(selectedObjectData.id, { fillColor: newFillColor });
    onCommitChanges();
  };

  const handleMultiCopy = () => {
    const count = parseInt(copyCount);
    const dx = parseFloat(offsetX);
    const dy = parseFloat(offsetY);

    if (isNaN(count) || isNaN(dx) || isNaN(dy) || count < 1) {
      return;
    }

    // Convert offsets from current unit to pixels
    const dxPixels = convertToPixels(dx, unit);
    const dyPixels = convertToPixels(dy, unit);

    onMultiCopy(count, dxPixels, dyPixels);
    setShowMultiCopyDialog(false);
  };

  const getUnitLabel = () => {
    switch (unit) {
      case 'pixels': return 'px';
      case 'inches': return 'in';
      case 'cm': return 'cm';
      default: return '';
    }
  };

  if (!selectedObjectData) {
    return (
      <div className="w-64 border-l border-border/40 bg-card/50 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border/40 p-3">
          <h3 className="text-sm font-semibold">Properties</h3>
        </div>
        <div className="flex items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Select an object to view and edit its properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-l border-border/40 bg-card/50 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/40 p-3">
        <h3 className="text-sm font-semibold">Properties</h3>
        <span className="text-xs text-muted-foreground">{getUnitLabel()}</span>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-4 space-y-4">
          {/* Object Type */}
          <div>
            <Label className="text-xs text-muted-foreground">Type</Label>
            <p className="text-sm font-medium capitalize">{selectedObjectData.type}</p>
          </div>

          <Separator />

          {/* Position */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Position ({getUnitLabel()})</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="prop-x" className="text-xs">X</Label>
                <Input
                  id="prop-x"
                  type="number"
                  step="0.01"
                  value={x}
                  onChange={(e) => {
                    setX(e.target.value);
                    handleUpdate('x', e.target.value);
                  }}
                  onBlur={onCommitChanges}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="prop-y" className="text-xs">Y</Label>
                <Input
                  id="prop-y"
                  type="number"
                  step="0.01"
                  value={y}
                  onChange={(e) => {
                    setY(e.target.value);
                    handleUpdate('y', e.target.value);
                  }}
                  onBlur={onCommitChanges}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Size ({getUnitLabel()})</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="prop-width" className="text-xs">Width</Label>
                <Input
                  id="prop-width"
                  type="number"
                  step="0.01"
                  value={width}
                  onChange={(e) => {
                    setWidth(e.target.value);
                    handleUpdate('width', e.target.value);
                  }}
                  onBlur={onCommitChanges}
                  className="h-8 text-xs"
                  disabled={selectedObjectData.type === 'polyline'}
                />
              </div>
              <div>
                <Label htmlFor="prop-height" className="text-xs">Height</Label>
                <Input
                  id="prop-height"
                  type="number"
                  step="0.01"
                  value={height}
                  onChange={(e) => {
                    setHeight(e.target.value);
                    handleUpdate('height', e.target.value);
                  }}
                  onBlur={onCommitChanges}
                  className="h-8 text-xs"
                  disabled={selectedObjectData.type === 'polyline'}
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <Label htmlFor="prop-rotation" className="text-xs font-semibold">Rotation (degrees)</Label>
            <Input
              id="prop-rotation"
              type="number"
              step="0.1"
              value={rotation}
              onChange={(e) => {
                setRotation(e.target.value);
                handleUpdate('rotation', e.target.value);
              }}
              onBlur={onCommitChanges}
              className="h-8 text-xs"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="prop-color" className="text-xs font-semibold">Stroke Color</Label>
            <Select value={color} onValueChange={handleColorChange}>
              <SelectTrigger id="prop-color" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.filter(opt => opt.value !== 'none').map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded border border-border"
                        style={{ backgroundColor: option.value }}
                      />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fill Color - only for closed shapes */}
          {isClosedShape && (
            <div className="space-y-2">
              <Label htmlFor="prop-fill-color" className="text-xs font-semibold">Fill Color</Label>
              <Select value={fillColor} onValueChange={handleFillColorChange}>
                <SelectTrigger id="prop-fill-color" className="h-8 text-xs">
                  <SelectValue placeholder="Select fill color" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.value !== 'none' ? (
                          <div
                            className="h-3 w-3 rounded border border-border"
                            style={{ backgroundColor: option.value }}
                          />
                        ) : (
                          <div className="h-3 w-3 rounded border border-border bg-transparent" />
                        )}
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Transform Tools */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Transform</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => onMirror('horizontal')}
              >
                <FlipHorizontal className="mr-1 h-3 w-3" />
                Mirror H
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => onMirror('vertical')}
              >
                <FlipVertical className="mr-1 h-3 w-3" />
                Mirror V
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={() => setShowMultiCopyDialog(true)}
            >
              <Copy className="mr-1 h-3 w-3" />
              Multi-Copy
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Multi-Copy Dialog */}
      <Dialog open={showMultiCopyDialog} onOpenChange={setShowMultiCopyDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Multi-Copy</DialogTitle>
            <DialogDescription>
              Create multiple copies of the selected object with specified offsets ({getUnitLabel()}).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="copy-count">Number of Copies</Label>
              <Input
                id="copy-count"
                type="number"
                min="1"
                value={copyCount}
                onChange={(e) => setCopyCount(e.target.value)}
                placeholder="3"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="offset-x">Offset X ({getUnitLabel()})</Label>
                <Input
                  id="offset-x"
                  type="number"
                  step="0.1"
                  value={offsetX}
                  onChange={(e) => setOffsetX(e.target.value)}
                  placeholder="50"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offset-y">Offset Y ({getUnitLabel()})</Label>
                <Input
                  id="offset-y"
                  type="number"
                  step="0.1"
                  value={offsetY}
                  onChange={(e) => setOffsetY(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMultiCopyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMultiCopy}>
              Create Copies
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
