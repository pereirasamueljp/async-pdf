import { PDFPageSize } from "../interfaces/pageSize";
import { PDFUnitTypes } from "../types/unitTypes";
import { unitNormalizerToPT } from "./unitNormalizer";

export function getPageSizeByUnit(unit?: PDFUnitTypes, pageSize?: PDFPageSize): [number, number] | undefined {
    if (!unit || !pageSize) return undefined;
    return [unitNormalizerToPT(unit, pageSize.line), unitNormalizerToPT(unit, pageSize.column)]
}