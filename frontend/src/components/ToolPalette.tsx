import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type Tool =
  | 'select'
  | 'line'
  | 'circle'
  | 'ellipse'
  | 'rectangle'
  | 'octagon'
  | 'polyline'
  | 'filledRectangle'
  | 'filledCircle'
  | 'move'
  | 'copy'
  | 'rotate'
  | 'scale'
  | 'mirror'
  | 'multicopy'
  | 'measure'
  | 'pan'
  | 'arcedit'
  | 'explode';

interface ToolPaletteProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
}

const tools: Array<{ id: Tool; name: string; icon: string; description: string }> = [
  { id: 'select', name: 'Select', icon: '/assets/generated/select-tool-icon.dim_32x32.png', description: 'Select objects (draw rectangle to select multiple)' },
  { id: 'pan', name: 'Pan', icon: '/assets/generated/pan-tool-icon.dim_32x32.png', description: 'Pan the canvas (drag or use arrow keys/WASD)' },
  { id: 'line', name: 'Line', icon: '/assets/generated/line-tool-icon.dim_32x32.png', description: 'Draw lines' },
  { id: 'rectangle', name: 'Rectangle', icon: '/assets/generated/rectangle-tool-icon.dim_32x32.png', description: 'Draw rectangles' },
  { id: 'circle', name: 'Circle', icon: '/assets/generated/circle-tool-icon.dim_32x32.png', description: 'Draw circles' },
  { id: 'ellipse', name: 'Ellipse', icon: '/assets/generated/ellipse-tool-icon.dim_32x32.png', description: 'Draw ellipses' },
  { id: 'octagon', name: 'Octagon', icon: '/assets/generated/octagon-tool-icon.dim_32x32.png', description: 'Draw octagons' },
  { id: 'polyline', name: 'Polyline', icon: '/assets/generated/polyline-tool-icon.dim_32x32.png', description: 'Draw polylines' },
  { id: 'filledRectangle', name: 'Filled Rectangle', icon: '/assets/generated/filled-rectangle-tool-icon.dim_32x32.png', description: 'Draw rectangles filled with green' },
  { id: 'filledCircle', name: 'Filled Circle', icon: '/assets/generated/filled-circle-tool-icon.dim_32x32.png', description: 'Draw circles filled with green' },
  { id: 'arcedit', name: 'Arc Edit', icon: '/assets/generated/arc-edit-tool-icon.dim_32x32.png', description: 'Convert edges to arcs' },
  { id: 'move', name: 'Move', icon: '/assets/generated/move-tool-icon.dim_32x32.png', description: 'Move objects (use arrow keys)' },
  { id: 'copy', name: 'Copy', icon: '/assets/generated/copy-tool-icon.dim_32x32.png', description: 'Copy objects' },
  { id: 'multicopy', name: 'Multi-Copy', icon: '/assets/generated/multi-copy-tool-icon.dim_32x32.png', description: 'Create multiple copies' },
  { id: 'mirror', name: 'Mirror', icon: '/assets/generated/mirror-tool-icon.dim_32x32.png', description: 'Mirror objects' },
  { id: 'rotate', name: 'Rotate', icon: '/assets/generated/rotate-tool-icon.dim_32x32.png', description: 'Rotate objects' },
  { id: 'scale', name: 'Scale', icon: '/assets/generated/scale-tool-icon.dim_32x32.png', description: 'Scale objects' },
  { id: 'explode', name: 'Explode', icon: '/assets/generated/explode-tool-icon.dim_32x32.png', description: 'Split objects at intersections' },
  { id: 'measure', name: 'Measure', icon: '/assets/generated/measure-tool-icon.dim_32x32.png', description: 'Measure distances and angles' },
];

export default function ToolPalette({ currentTool, onToolChange }: ToolPaletteProps) {
  return (
    <div className="w-36 sm:w-40 border-r border-border/40 bg-card/50 backdrop-blur">
      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-2 gap-2 p-2">
          {tools.map((tool) => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={currentTool === tool.id ? 'default' : 'ghost'}
                  size="icon"
                  className={cn(
                    'h-14 w-14 rounded-lg transition-all',
                    currentTool === tool.id && 'shadow-md'
                  )}
                  onClick={() => onToolChange(tool.id)}
                >
                  <img
                    src={tool.icon}
                    alt={tool.name}
                    className={cn(
                      'h-8 w-8',
                      currentTool === tool.id ? 'opacity-100' : 'opacity-70'
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{tool.name}</p>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
