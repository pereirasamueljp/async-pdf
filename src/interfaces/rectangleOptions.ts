import { PDFBlendMode } from "../types/blendMode";
import { PDFLineCapType } from "../types/lineCapTypes";
import { PDFArea } from "./area";
import { PDFPositions } from "./positions";
import { PDFRGBA } from "./rgb";


export interface PDFRectangleOptions {
    start: PDFPositions,
    area: PDFArea,
    areaColor: PDFRGBA,
    borderColor?: PDFRGBA,
    borderWidth?: number,
    blendMode?: PDFBlendMode,
    borderDashArray?: number[]
    borderDashPhase?: number,
    borderOpacity?: number,
    borderLineCap: PDFLineCapType,
}