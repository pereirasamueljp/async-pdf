import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { PageSizes, PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { PDFCreateOptions } from './interfaces/createOptions';
import { PDFLineOptions } from './interfaces/lineOptions';
import { PDFPageFraming } from './interfaces/pageFraming';
import { PDFPageLimits } from './interfaces/pageLimits';
import { PDFPageSpacing } from './interfaces/pageSpacing';
import { PDFPositions } from './interfaces/positions';
import { RGBA } from './interfaces/rgb';
import { PDFTextOptions } from './interfaces/textOptions';
import { PageOrientationTypes } from './types/pageOrientationTypes';
import { PDFTextAligns } from './types/textAlignment';
import { PDFUnitTypes } from './types/unitTypes';
import { getPageSizeByUnit } from './utils/getPageSizeByUnit';
import { unitNormalizerFromPT, unitNormalizerToPT } from './utils/unitNormalizer';
import { verticalAlignmentFormatter } from './utils/verticalAlignmentFormatter';
import { join } from 'path';
import { PDFText } from './interfaces/text';
import { FontTypes } from './types/fontTypes';



export class PDF {
    readonly document: PDFDocument;
    readonly file: string;
    readonly unit: PDFUnitTypes;
    private pageSize: [number, number];
    private page: PDFPage;
    private pageFraming: PDFPageFraming;
    private pageSpacing: PDFPageSpacing;
    private font: PDFFont;
    private mergeFiles: string[] = [];
    private pagesControl: number = 1;
    private limits: PDFPageLimits = { startColumn: 0, startLine: 0, endColumn: 0, endLine: 0 };

    /**
    * Create a new [[PDF]].
    * @returns Resolves with the newly created document.
    */
    static async create(options?: PDFCreateOptions) {
        const document = await PDFDocument.create();
        const font = await document.embedFont(options?.font || StandardFonts.Helvetica)
        return new PDF(document, font, options)
    }


    private constructor(document: PDFDocument, font: PDFFont, options?: PDFCreateOptions) {
        this.file = `${join(__dirname, '../tmp')}/${randomBytes(5).toString('hex')}.pdf`;
        this.document = document
        this.unit = options?.unit || 'pt';
        this.pageSize = getPageSizeByUnit(options?.unit, options?.pageSize) || PageSizes.A4;
        this.setOrientation(options?.orientation);
        this.page = this.document.addPage(this.pageSize)
        this.pageFraming = { lineStartPosition: 0, lineEndPosition: this.page.getWidth(), columnStartPosition: 0, columnEndPosition: this.page.getHeight() }
        this.pageSpacing = this.normalizePageSpacing(options?.pageSpacing);
        this.setPageLimits();
        this.font = font;
        this.page.setFont(this.font)
    }

    /**
    * Set page spacing.
    * 
    */
    public setPageSpacing(pageSpacing: PDFPageSpacing) {
        this.pageSpacing = this.normalizePageSpacing(pageSpacing);
        this.setPageLimits()
    }

    /**
    * Set the page font.
    * That doesn't chage the general font.  
    */
    public setPageFont(font: PDFFont) {
        this.page.setFont(font)
    }

    /**
    * Select page.
    */
    public async selectPage(pageNumber: number) {
        //verificar se precisa de um retorno com New Promise
        let pageFile = this.getPageFile(pageNumber);
        this.saveTheLastPage();
        this.document.removePage(0);
        let document = await fs.readFile(pageFile)
        let pdfDocument = await PDFDocument.load(document);
        let pages = await pdfDocument.copyPages(pdfDocument, [0]);
        this.page = this.document.addPage(pages[0])
    }

    /**
    * Clear the page. 
    */
    public async clearPage() {
        await this.saveTheLastPage();
        this.document.removePage(0);
        this.page = this.document.addPage(this.pageSize);
    }

    /**
    * Remove the page by page number.
    * Example:
    * ```js
    * PDF.removePage(1)   // Remove the first page of the document
    * PDF.removePage(2)   // Remove the second page of the document
    * PDF.removePage(200) // Remove the 200th page of the document
    * ```
    */
    public async removePage(pageNumber: number) {
        let pageFile = this.getPageFile(pageNumber);
        if (pageFile) {
            this.deletePageFile(this.mergeFiles[pageNumber - 1])
            this.document.removePage(pageNumber - 1)
            this.pagesControl--;
        };
    }

    /**
    * Add page to the document.
    * Example:
    * ```js
    *let pageOptions = {
    *    unit: 'mm', 
    *    orientation: 'landscape', 
    *    pageSize: { line: 297, column: 210 }, 
    *    pageSpacing: { top: 10, bottom: 10, left: 10, right: 10 }, 
    *    font: 'Helvetica-Bold',
    *}
    * PDF.addPage(pageOptions) // The document will have two pages. The second page will have the new options
    * PDF.addPage() // The document will have two pages. The second page will have the same first page options
    * ```
    */
    public async addPage(pageOptions?: PDFCreateOptions) {
        await this.savePage();
        let font: any;
        if (pageOptions?.font) font = await this.document.embedFont(pageOptions?.font)
        this.setOrientation(pageOptions?.orientation);
        this.page = this.document.addPage(getPageSizeByUnit(pageOptions?.unit, pageOptions?.pageSize) || this.pageSize)
        this.pagesControl++;
        this.pageFraming = { lineStartPosition: 0, lineEndPosition: this.page.getWidth(), columnStartPosition: 0, columnEndPosition: this.page.getHeight() }
        this.pageSpacing = pageOptions?.pageSpacing || this.pageSpacing
        this.page.setFont(font as PDFFont || this.font)
        this.document.removePage(0);
    }

    /**
    * Write a text on the page.
    * Example:
    * ```js
    * // It will write a text aligned by right direction
    * PDF.writeText(`Hello world`, {
    *   align: 'right',
    *   size: 20,
    *   position: {
    *       linePosition: 210,
    *       columnPosition: 200,
    *   }
    * }) 
    * ```
    */
    public writeText(text: string, options: PDFTextOptions) {
        this.isNegative('size', options.size);
        let font = options.font || this.font
        let pdfText: PDFText = {
            align: options.align,
            positions: options.position,
            textHeight: this.font.heightAtSize(options.size),
            textWidth: this.font.widthOfTextAtSize(text, options.size),
            value: text
        }
        pdfText = this.normalizeText(pdfText);
        this.page.drawText(pdfText.value, {
            x: pdfText.positions.linePosition,
            y: pdfText.positions.columnPosition,
            font: font,
            size: options.size,
            color: this.getColorRGBFromRGBA(options?.color),
            opacity: this.getAlfaFromRGBA(options.color)
        })
    }

    /**
    * Get a text size.
    * Example:
    * @returns Resolve with a text height.
    * ```js
    * PDF.getHeighAtSize(20,'Helvetica-Bold')
    * ```
    */
    public async getHeighAtSize(size: number, font: FontTypes | PDFFont) {
        if (font = 'Helvetica-Bold')
            return (await this.document.embedFont(font)).heightAtSize(size);
    }

    /**
    * Get a text size.
    * Example:
    * @returns Resolve with a text width.
    * ```js
    * PDF.getWidthOfTextAtSize('test',20,'Helvetica-Bold')
    * ```
    */
    public async getWidthOfTextAtSize(text: string, size: number, font: FontTypes | PDFFont) {
        if (typeof (font) == 'string') {
            return (await this.document.embedFont(font)).widthOfTextAtSize(text, size);
        } else {
            return font.widthOfTextAtSize(text, size)
        }
    }

    /**
    * Get a text size.
    * Example:
    * @returns Resolve with a PDFFont.
    * ```js
    * let font = await PDF.getCustomFont("../fonts/HouschkaHead-BoldItalic.otf")
    * 
    * PDF.writeText(`Hello world`, {
    *   font: font,
    *   align: 'right',
    *   size: 20,
    *   position: {
    *       linePosition: 210,
    *       columnPosition: 200,
    *   }
    * }) 
    *```
    */
    public async getCustomFont(fontPath: string) {
        let fontBytes = await fs.readFile(fontPath);
        let customFont = await this.document.embedFont(fontBytes);
        return customFont;
    }

    /**
    * Get a text size.
    * Example:
    * ```js
    *   PDF.setCustomFont("../fonts/HouschkaHead-BoldItalic.otf")
    * ```
    */
    public async setCustomFont(fontPath: string) {
        let fontBytes = await fs.readFile(fontPath);
        this.font = await this.document.embedFont(fontBytes);
        this.page.setFont(this.font);
    }

    /**
    * Write a line on the page.
    * Example:
    * ```js
    * // It will write a vertical red line at midle of the page with 50% of opacity
    * PDF.writeLine({
    *     start: {
    *         linePosition: 100,
    *         columnPosition: 0,
    *     },
    *     end: {
    *         linePosition: 100,
    *         columnPosition: 297,
    *     },
    *     color: { r: 1, g: 0, b: 0, a: 0.5 },
    *     thickness: 1
    * })
    * ```
    */
    public writeLine(options: PDFLineOptions) {
        let startPosition = this.normalizeLine(options.start);
        let endPosition = this.normalizeLine(options.end)
        this.page.drawLine({
            start: { x: startPosition.linePosition, y: startPosition.columnPosition },
            end: { x: endPosition.linePosition, y: endPosition.columnPosition },
            thickness: options.thickness,
            color: this.getColorRGBFromRGBA(options.color),
        })
    }

    /**
    * Save the document at the file path
    * For example: 
    * ```js
    * PDF.save("/out/pdf/test.pdf")
    * ```
    */
    public async save(filePath: string) {
        await this.saveTheLastPage()
        this.mergeGroupOfPDF(filePath);
    }

    /**
    * Load an external pdf
    * For example: 
    * ```js
    * // test.pdf has 5 pages
    * PDF.getNumberOfPages() // returns 1
    * PDF.loadPDF("/out/pdf/test.pdf")
    * PDF.addPage(); 
    * PDF.getNumberOfPages() // returns 7
    * ```
    */
    public async loadPDF(pdfFilePath: string){
        if(!existsSync(pdfFilePath)) this.filePathDoesNotExist(pdfFilePath);
        let document = await fs.readFile(pdfFilePath);
        let pdf = await PDFDocument.load(document);
        let pages = await this.document.copyPages(pdf, pdf.getPageIndices());
        for(let page of pages ){
            this.document.addPage(page)
        }
    }

    /**
    * Get the number of pages.
    * Example:
    * @returns - Number of pages.
    * ```js
    * PDF.addPage()
    * PDF.getNumberOfPages() // 2
    * ```
    */
    public async getNumberOfPages(){
        return this.pagesControl;
    }
    private getColorRGBFromRGBA(color?: RGBA) {
        return rgb(color?.r || 0, color?.g || 0, color?.b || 0)
    }
    private getAlfaFromRGBA(color?: RGBA) {
        return color?.a || 1
    }

    private normalizeText(text: PDFText): PDFText {
        text.positions = this.normalizePositions(text.positions, text.textWidth, text.textHeight, text.align);
        text.positions.columnPosition = this.columnNormalize(text.positions.columnPosition);
        return text;
    }

    private normalizeLine(positions: PDFPositions) {
        let normalizedPositions: PDFPositions = {
            linePosition: unitNormalizerToPT(this.unit, positions.linePosition),
            columnPosition: unitNormalizerToPT(this.unit, positions.columnPosition)
        }
        this.verifyPositionsByLimit(normalizedPositions);
        positions.columnPosition = this.columnNormalize(positions.columnPosition);
        return normalizedPositions;
    }

    private normalizePositions(positions: PDFPositions, width: number, height: number, align?: PDFTextAligns,) {
        let normalizedPositions: PDFPositions = {
            linePosition: unitNormalizerToPT(this.unit, positions.linePosition),
            columnPosition: unitNormalizerToPT(this.unit, positions.columnPosition)
        }
        normalizedPositions.linePosition = verticalAlignmentFormatter(align || 'left', normalizedPositions.linePosition, width);
        let textWidthByAlign = align == 'center' ? width / 2 : width;
        this.verifyPositionsByLimit(normalizedPositions, textWidthByAlign, height);
        return normalizedPositions;
    }

    private normalizePageSpacing(pageSpacing?: PDFPageSpacing) {
        let pageSpacingNormalized: PDFPageSpacing = {
            top: unitNormalizerToPT(this.unit, pageSpacing?.top),
            bottom: unitNormalizerToPT(this.unit, pageSpacing?.bottom),
            left: unitNormalizerToPT(this.unit, pageSpacing?.left),
            right: unitNormalizerToPT(this.unit, pageSpacing?.right)
        }
        return pageSpacingNormalized;
    }

    private columnNormalize(columnPosition: number) {
        let newPosition = this.limits.startColumn - columnPosition;
        return newPosition
    }

    private verifyPositionsByLimit(positions: PDFPositions, width?: number, height?: number) {
        this.verifyColumnByLimit(positions.columnPosition, height || 0);
        this.verifyLineByLimit(positions.linePosition, width || 0);
    }

    private verifyColumnByLimit(columnPosition: number, height: number) {
        if (columnPosition < this.pageFraming.columnStartPosition + this.pageSpacing.top) this.columnIsOutRange(columnPosition, this.pageFraming.columnStartPosition + this.pageSpacing.top)
        if (this.limits.startColumn - columnPosition + height < this.pageFraming.columnStartPosition + this.pageSpacing.top) this.columnWithHeightIsOutRange(this.limits.startColumn - columnPosition + height, this.pageFraming.columnStartPosition + this.pageSpacing.top);
        if (columnPosition + height > this.limits.startColumn) this.columnWithHeightIsOutRange(columnPosition + height, this.limits.startColumn);
        if (this.limits.startColumn - columnPosition + height > this.limits.startColumn) this.columnWithHeightIsOutRange(this.limits.startColumn - (this.limits.startColumn - columnPosition + height), this.limits.startColumn);
        if (columnPosition < this.limits.endColumn) this.columnIsOutRange(columnPosition, this.limits.endColumn);
    }

    private verifyLineByLimit(linePosition: number, width: number) {
        if (linePosition < this.limits.startLine) this.lineIsOutRange(linePosition, this.limits.startLine);
        if (linePosition + width < this.limits.startLine) this.lineWithWidthIsOutRange(linePosition + width, this.limits.startLine);
        if (linePosition + width > this.limits.endLine) this.lineWithWidthIsOutRange(linePosition + width, this.limits.endLine);
    }

    private setPageLimits() {
        this.limits.startLine = this.pageFraming.lineStartPosition + this.pageSpacing?.left;
        this.limits.endLine = this.pageFraming.lineEndPosition - this.pageSpacing.right;
        this.limits.startColumn = this.pageFraming.columnEndPosition - this.pageSpacing.top;
        this.limits.endColumn = this.pageFraming.columnStartPosition + this.pageSpacing.bottom;
    }

    private wasLastPageSaved() {
        return existsSync(this.mergeFiles[this.mergeFiles.length - 1])
    }
    private async saveTheLastPage() {
        if (!this.wasLastPageSaved()) await fs.writeFile(this.file + `part${this.pagesControl}`, await this.document.save(), { flag: 'w' })

    }
    private async savePage() {
        await fs.writeFile(this.file + `part${this.pagesControl}`, await this.document.save(), { flag: 'w' })
        this.mergeFiles.push(this.file + `part${this.pagesControl}`)
    }
    private async deletePageFile(file: string) {
        await fs.unlink(file)
        this.mergeFiles = this.mergeFiles.filter(mergeFile => mergeFile != file);
    }
    private getPageFile(pageNumber: number) {
        let filePage = this.mergeFiles[pageNumber - 1];
        if (filePage) this.pageDoesNotExist(pageNumber);
        return filePage;
    }
    private async mergeGroupOfPDF(filePath: string) {
        if (!this.mergeFiles[0] && !this.pagesControl) this.pagesForMergeDoesNotExist();
        if (!this.mergeFiles[0] && this.pagesControl) { await fs.writeFile(filePath, await this.document.save(), { flag: 'w' }); return }
        if (this.pagesControl)
            for (let file of this.mergeFiles) {
                let document = await fs.readFile(file);
                let pdf = await PDFDocument.load(document);
                let paginas = await this.document.copyPages(pdf, pdf.getPageIndices());
                this.document.addPage(paginas[0])
            }
        let pdfPrincipalBytes = await this.document.save()
        await fs.writeFile(filePath, pdfPrincipalBytes, { flag: 'w' });
        for (let file of this.mergeFiles) {
            if (existsSync(file)) await fs.unlink(file)
        }
        this.mergeFiles = [];
    }
    private setOrientation(orientation?: PageOrientationTypes) {
        orientation == 'landscape' ? this.pageSize = [this.pageSize[1], this.pageSize[0]] : this.pageSize = [this.pageSize[0], this.pageSize[1]];
    }
    private isNegative(attribute: string, value: number) {
        if (value < 0) {
            this.negativeNumber(attribute, value)
        }
    }

    //errors
    private pageDoesNotExist(pageNumber: number) {
        throw Error(`Page ${pageNumber} does not exist`)
    }
    private pagesForMergeDoesNotExist() {
        throw Error('There is no page to save')
    }
    private columnIsOutRange(column: number, range: number) {
        throw Error(`Column ${unitNormalizerFromPT(this.unit, column)} is out of range. Range: ${unitNormalizerFromPT(this.unit, range)}`)
    }
    private columnWithHeightIsOutRange(column: number, range: number) {
        throw Error(`Column with height ${unitNormalizerFromPT(this.unit, column)} is out of range. Range: ${unitNormalizerFromPT(this.unit, range)}`)
    }
    private lineIsOutRange(line: number, range: number) {
        throw Error(`Line ${unitNormalizerFromPT(this.unit, line)} is out of range. Range: ${unitNormalizerFromPT(this.unit, range)}`)
    }
    private lineWithWidthIsOutRange(line: number, range: number) {
        throw Error(`Line with width ${unitNormalizerFromPT(this.unit, line)} is out of range. Range: ${unitNormalizerFromPT(this.unit, range)}`)
    }
    private negativeNumber(attribute: string, value: number) {
        throw Error(`${attribute} can't be set by negative value: ${value}`)
    }
    private filePathDoesNotExist(filePath: string){
        throw Error(`File path ${this.file} does not exist`)
    }
}