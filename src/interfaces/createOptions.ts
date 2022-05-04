import { FontTypes } from "../types/fontTypes";
import { PageOrientationTypes } from "../types/pageOrientationTypes";
import { PDFUnitTypes } from "../types/unitTypes";
import { PDFPageSize } from "./pageSize";
import { PDFPageSpacing } from "./pageSpacing";

export interface PDFCreateOptions {
    unit: PDFUnitTypes,
    orientation: PageOrientationTypes;
    pageSize: PDFPageSize;
    pageSpacing: PDFPageSpacing;
    font: FontTypes | string;
}