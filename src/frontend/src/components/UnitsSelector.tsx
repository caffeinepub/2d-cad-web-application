import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UnitType } from "../hooks/useUnits";

interface UnitsSelectorProps {
  unit: UnitType;
  onUnitChange: (unit: UnitType) => void;
}

export default function UnitsSelector({
  unit,
  onUnitChange,
}: UnitsSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="units-select"
        className="text-sm font-medium whitespace-nowrap"
      >
        Units:
      </Label>
      <Select
        value={unit}
        onValueChange={(value) => onUnitChange(value as UnitType)}
      >
        <SelectTrigger id="units-select" className="h-8 w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pixels">Pixels</SelectItem>
          <SelectItem value="inches">Inches</SelectItem>
          <SelectItem value="cm">Centimeters</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
