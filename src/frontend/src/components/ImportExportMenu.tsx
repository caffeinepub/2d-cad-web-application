import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileText,
  FileType,
  Image,
  Loader2,
  Upload,
} from "lucide-react";
import { useState } from "react";

export type ImportType = "dxf" | "dwg" | "svg" | "pdf";
export type ExportType = "dxf" | "dwg" | "svg" | "pdf";

interface ImportExportMenuProps {
  onImport: (type: ImportType) => Promise<void> | void;
  onExport: (type: ExportType) => Promise<void> | void;
  hasObjects: boolean;
}

export default function ImportExportMenu({
  onImport,
  onExport,
  hasObjects,
}: ImportExportMenuProps) {
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleImport = async (type: ImportType) => {
    setImportLoading(true);
    try {
      await onImport(type);
    } finally {
      setImportLoading(false);
    }
  };

  const handleExport = async (type: ExportType) => {
    setExportLoading(true);
    try {
      await onExport(type);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Import dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={importLoading}
            data-ocid="import-menu-trigger"
          >
            {importLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Import File</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => handleImport("dxf")}
            data-ocid="import-dxf"
          >
            <FileType className="mr-2 h-4 w-4 text-blue-400" />
            <div>
              <div className="text-sm font-medium">DXF File</div>
              <div className="text-xs text-muted-foreground">
                AutoCAD drawing exchange
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleImport("dwg")}
            data-ocid="import-dwg"
          >
            <FileType className="mr-2 h-4 w-4 text-orange-400" />
            <div>
              <div className="text-sm font-medium">DWG File</div>
              <div className="text-xs text-muted-foreground">
                AutoCAD drawing (layers preserved)
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleImport("svg")}
            data-ocid="import-svg"
          >
            <Image className="mr-2 h-4 w-4 text-green-400" />
            <div>
              <div className="text-sm font-medium">SVG File</div>
              <div className="text-xs text-muted-foreground">
                Scalable vector graphics
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleImport("pdf")}
            data-ocid="import-pdf"
          >
            <FileText className="mr-2 h-4 w-4 text-red-400" />
            <div>
              <div className="text-sm font-medium">PDF File</div>
              <div className="text-xs text-muted-foreground">
                As traceable background
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Export dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasObjects || exportLoading}
            data-ocid="export-menu-trigger"
          >
            {exportLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Export File</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => handleExport("dxf")}
            data-ocid="export-dxf"
          >
            <FileType className="mr-2 h-4 w-4 text-blue-400" />
            <div>
              <div className="text-sm font-medium">Export as DXF</div>
              <div className="text-xs text-muted-foreground">
                AutoCAD drawing exchange
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleExport("dwg")}
            data-ocid="export-dwg"
          >
            <FileType className="mr-2 h-4 w-4 text-orange-400" />
            <div>
              <div className="text-sm font-medium">Export as DWG</div>
              <div className="text-xs text-muted-foreground">
                AutoCAD format (colors preserved)
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleExport("svg")}
            data-ocid="export-svg"
          >
            <Image className="mr-2 h-4 w-4 text-green-400" />
            <div>
              <div className="text-sm font-medium">Export as SVG</div>
              <div className="text-xs text-muted-foreground">
                Scalable vector graphics
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleExport("pdf")}
            data-ocid="export-pdf"
          >
            <FileText className="mr-2 h-4 w-4 text-red-400" />
            <div>
              <div className="text-sm font-medium">Export as PDF</div>
              <div className="text-xs text-muted-foreground">
                Portable document format
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
