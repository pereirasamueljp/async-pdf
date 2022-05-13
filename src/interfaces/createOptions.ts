import { PDFRGBA } from "../interfaces/rgb";
import { PDFFontTypes } from "../types/fontTypes";
import { PDFPageOrientationTypes } from "../types/pageOrientationTypes";
import { PDFUnitTypes } from "../types/unitTypes";
import { PDFPageSize } from "./pageSize";
import { PDFPageSpacing } from "./pageSpacing";

export interface PDFCreateOptions {
    unit: PDFUnitTypes,
    orientation?: PDFPageOrientationTypes;
    pageSize?: PDFPageSize;
    pageSpacing?: PDFPageSpacing;
    font?: PDFFontTypes;
    fontSize?: number;
    fontColor?: PDFRGBA
}