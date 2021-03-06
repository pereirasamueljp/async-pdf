import { PDFTextAligns } from "../types/textAlignment"


export function PDFVerticalAlignmentFormatter(align: PDFTextAligns, position: number, size: number) {
    switch (align) {
        case 'center': position = position - (size / 2); break;
        case 'left': break;
        case 'right': position = position - size; break;
        default: break;
    }
    return position
}