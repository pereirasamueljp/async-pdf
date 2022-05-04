import { PDFFont } from "pdf-lib";
import { PDFTextAligns } from "../types/textAlignment";
import { PDFPositions } from "./positions";
import { RGBA } from "./rgb";

export interface PDFTextOptions {
    position: PDFPositions,
    align: PDFTextAligns,
    size: number,
    color?: RGBA,
    font?: PDFFont,
}