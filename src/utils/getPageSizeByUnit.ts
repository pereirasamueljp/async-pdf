import { PDFPageSize } from "../interfaces/pageSize";
import { PDFUnitTypes } from "../types/unitTypes";
import { PDFUnitNormalizerToPT } from "./unitNormalizer";

export function PDFGetPageSizeByUnit(unit?: PDFUnitTypes, pageSize?: PDFPageSize): [number, number] | undefined {
    if (!unit || !pageSize) return undefined;
    return [PDFUnitNormalizerToPT(unit, pageSize.line), PDFUnitNormalizerToPT(unit, pageSize.column)]
}