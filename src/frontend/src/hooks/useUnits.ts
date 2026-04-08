import { useState } from "react";

export type UnitType = "pixels" | "inches" | "cm";

const PIXELS_PER_INCH = 96;
const CM_PER_INCH = 2.54;

export function useUnits() {
  const [unit, setUnit] = useState<UnitType>("pixels");

  const convertToPixels = (
    value: number,
    fromUnit: UnitType = unit,
  ): number => {
    switch (fromUnit) {
      case "pixels":
        return value;
      case "inches":
        return value * PIXELS_PER_INCH;
      case "cm":
        return (value / CM_PER_INCH) * PIXELS_PER_INCH;
      default:
        return value;
    }
  };

  const convertFromPixels = (
    value: number,
    toUnit: UnitType = unit,
  ): number => {
    switch (toUnit) {
      case "pixels":
        return value;
      case "inches":
        return value / PIXELS_PER_INCH;
      case "cm":
        return (value / PIXELS_PER_INCH) * CM_PER_INCH;
      default:
        return value;
    }
  };

  const formatValue = (value: number, toUnit: UnitType = unit): string => {
    const converted = convertFromPixels(value, toUnit);
    return converted.toFixed(2);
  };

  const getUnitLabel = (toUnit: UnitType = unit): string => {
    switch (toUnit) {
      case "pixels":
        return "px";
      case "inches":
        return "in";
      case "cm":
        return "cm";
      default:
        return "";
    }
  };

  return {
    unit,
    setUnit,
    convertToPixels,
    convertFromPixels,
    formatValue,
    getUnitLabel,
  };
}
