import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Upload, Download, FileText, Image, FileType } from 'lucide-react';

interface ImportExportMenuProps {
  onImport: (type: 'dxf' | 'svg') => void;
  onExport: (type: 'dxf' | 'svg' | 'pdf') => void;
  hasObjects: boolean;
}

export default function ImportExportMenu({ onImport, onExport, hasObjects }: ImportExportMenuProps) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Import File</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onImport('dxf')}>
            <FileType className="mr-2 h-4 w-4" />
            DXF File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onImport('svg')}>
            <Image className="mr-2 h-4 w-4" />
            SVG File
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={!hasObjects}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Export File</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onExport('dxf')}>
            <FileType className="mr-2 h-4 w-4" />
            Export as DXF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('svg')}>
            <Image className="mr-2 h-4 w-4" />
            Export as SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('pdf')}>
            <FileText className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
