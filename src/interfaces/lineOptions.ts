import { PDFPositions } from "./positions";
import { PDFRGBA } from "./rgb";

export interface PDFLineOptions {
    start: PDFPositions,
    end: PDFPositions,
    thickness: number,
    color?: PDFRGBA,
}