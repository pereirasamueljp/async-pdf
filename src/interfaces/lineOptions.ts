import { PDFPositions } from "./positions";
import { RGBA } from "./rgb";

export interface PDFLineOptions {
    start: PDFPositions,
    end: PDFPositions,
    thickness: number,
    color?: RGBA,
}