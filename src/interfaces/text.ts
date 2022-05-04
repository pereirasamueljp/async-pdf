import { PDFTextAligns } from "../types/textAlignment";
import { PDFPositions } from "./positions";

export interface PDFText {
    value: string,
    align: PDFTextAligns, 
    positions: PDFPositions, 
    textWidth: number,
    textHeight: number
}