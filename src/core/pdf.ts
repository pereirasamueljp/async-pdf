import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { PageSizes, PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { join, sep } from 'path';
import { PDFFontTypes, PDFPageOrientationTypes, PDFTextAligns, PDFUnitTypes } from '../types';
import { PDFArea, PDFCreateOptions, PDFLineOptions, PDFPageFraming, PDFPageLimits, PDFPageSpacing, PDFPositions, PDFRectangleOptions, PDFRGBA, PDFText, PDFTextOptions } from '../interfaces';
import { PDFGetPageSizeByUnit, PDFUnitNormalizerFromPT, PDFUnitNormalizerToPT, PDFVerticalAlignmentFormatter } from '../utils';
import { tmpdir } from 'os'
import { mkdirPromise, readFilePromise, unlinkPromise, writeFilePromise } from '../utils/fsPromises';

export class PDF {
    private document: PDFDocument;
    private file: string;
    private unit: PDFUnitTypes;
    private fontSize: number;
    private tmpDir: string;
    private orientation: PDFPageOrientationTypes;
    private pageSize: [number, number];
    private page: PDFPage;
    private pageFraming: PDFPageFraming;
    private pageSpacing: PDFPageSpacing;
    private fontName: string;
    private font: PDFFont;
    private fontColor: PDFRGBA;
    private mergeFiles: string[] = [];
    private pagesControl: number = 1;
    private limits: PDFPageLimits = { startColumn: 0, startLine: 0, endColumn: 0, endLine: 0 };
    private pageSelected: number;
    private externalFontPath: string = '';

    /**
    * Create a new [[PDF]].
    * @returns Resolves with the newly created document.
    */
    static async create(options?: PDFCreateOptions) {
        let document = await PDFDocument.create();
        let font = await document.embedFont(options?.font || StandardFonts.Helvetica)
        let tmpDir = tmpdir() + sep + `.async-pdf`;
        if (!existsSync(join(tmpDir))) await mkdirPromise(join(tmpDir))
        return new PDF(document, font, tmpDir, options)
    }


    private constructor(document: PDFDocument, font: PDFFont, tmpDir: string, options?: PDFCreateOptions) {
        this.tmpDir = tmpDir;
        this.file = `${join(this.tmpDir)}/${randomBytes(5).toString('hex')}.pdf`;
        this.document = document
        this.unit = options?.unit || 'mm';
        this.fontSize = options?.fontSize || 7.5;
        this.pageSize = PDFGetPageSizeByUnit(options?.unit, options?.pageSize) || PageSizes.A4;
        this.fontColor = options?.fontColor || { r: 0, g: 0, b: 0, a: 1 }
        this.orientation = options?.orientation || 'portrait';
        this.setOrientation(this.orientation);
        this.page = this.document.addPage(this.pageSize)
        this.pageSelected = 1;
        this.pageFraming = { lineStartPosition: 0, lineEndPosition: this.page.getWidth(), columnStartPosition: 0, columnEndPosition: this.page.getHeight() }
        this.pageSpacing = this.normalizePageSpacing(options?.pageSpacing);
        this.setPageLimits();
        this.font = font;
        this.fontName = options?.font || StandardFonts.Helvetica;
        this.page.setFont(this.font)
        this.page.setFontSize(options?.fontSize || this.fontSize)
        this.page.setFontColor(this.getColorRGBFromRGBA(options?.fontColor))


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
    public async selectPage(pageNumber: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                if (pageNumber != this.pageSelected) {
                    let pageFile = this.getPageFile(pageNumber);
                    await this.saveTheLastPage();
                    await this.savePage(this.pageSelected)
                    await this.createDocument();
                    let document = await readFilePromise(pageFile)
                    let pdfDocument = await PDFDocument.load(document);
                    let pages = await this.document.copyPages(pdfDocument, [0]);
                    this.page = this.document.addPage(pages[0])
                    this.pageSelected = pageNumber;
                }
                resolve()
            })
        })

    }

    /**
    * Clear the page. 
    */
    public async clearPage(): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                await this.saveTheLastPage();
                this.document.removePage(0);
                this.page = this.document.addPage(this.pageSize);
                resolve()
            })
        })
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
    public async removePage(pageNumber: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                let pageFile = this.getPageFile(pageNumber);
                if (pageFile) {
                    await this.deletePageFile(this.mergeFiles[pageNumber - 1])
                    this.document.removePage(pageNumber - 1)
                    this.pagesControl--;
                };
                resolve()
            })
        })
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
    public async addPage(pageOptions?: PDFCreateOptions): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                await this.savePage();
                await this.createDocument();
                await this.createPage(pageOptions);
                this.pagesControl++;
                this.pageSelected++;
                resolve()
            })
        })
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
    public async writeText(text: string, options: PDFTextOptions) {
        this.isNegative('size', options?.size || this.fontSize);
        let font: PDFFont;
        font = options.font || this.font
        this.document
        let pdfText: PDFText = {
            align: options.align,
            positions: options.position,
            textHeight: options?.font?.heightAtSize(options?.size || this.fontSize) || this.font.heightAtSize(options?.size || this.fontSize),
            textWidth: options?.font?.widthOfTextAtSize(text, options?.size || this.fontSize) || this.font.widthOfTextAtSize(text, options?.size || this.fontSize),
            value: text
        }
        pdfText = this.normalizeText(pdfText);
        this.page.drawText(pdfText.value, {
            x: pdfText.positions.linePosition,
            y: pdfText.positions.columnPosition,
            font: font,
            size: options.size || this.fontSize,
            color: this.getColorRGBFromRGBA(options?.color),
            opacity: this.getAlfaFromRGBA(options?.color)
        })
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
    * Write a rectangular on the page.
    * Example:
    * ```js
    * // It will write a rectangular starting at line 10 and column 50 with size of 100 width, 50 height and gray background color
    *  let options: PDFRectangleOptions = {
            start: { linePosition: 10, columnPosition: 50 },
            area: { width: 100, height: 500 },
            areaColor: { r: 0.95, g: 0.95, b: 0.95, a: 1 },
        }
    * PDF.writeRectangle(options)
    * ```
    */
    public writeRectangle(options: PDFRectangleOptions) {
        let startPosition = this.normalizeLine(options.start);
        this.normalizeLine({ linePosition: options.start.linePosition + options.area.width, columnPosition: options.start.columnPosition + options.area.height });
        let areaNormalized: PDFArea = {
            width: PDFUnitNormalizerToPT('mm', options.area.width),
            height: PDFUnitNormalizerToPT('mm', options.area.height)
        }
        startPosition.columnPosition = startPosition.columnPosition - areaNormalized.height;
        this.page.drawRectangle({
            x: startPosition.linePosition,
            y: startPosition.columnPosition,
            width: areaNormalized.width,
            height: areaNormalized.height,
            color: options.areaColor.a == 0 ? undefined : this.getColorRGBFromRGBA(options.areaColor),
            opacity: options.areaColor.a == 0 ? undefined : this.getAlfaFromRGBA(options.areaColor),
            borderColor: this.getColorRGBFromRGBA(options.borderColor),
            borderOpacity: this.getAlfaFromRGBA(options.borderColor),
            borderWidth: PDFUnitNormalizerToPT(this.unit, options.borderWidth) || undefined,
            borderLineCap: options.borderLineCap,
            borderDashArray: options.borderDashArray,
            borderDashPhase: options.borderDashPhase,
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
    public async getHeighAtSize(size: number, font: PDFFontTypes | PDFFont): Promise<number> {
        return new Promise(resolve => {
            setTimeout(async () => {
                if (typeof font == 'string') {
                    resolve(PDFUnitNormalizerFromPT('mm', (await this.document.embedFont(font)).heightAtSize(size)));
                } else if (typeof font == 'object') {
                    resolve(PDFUnitNormalizerFromPT('mm', font?.heightAtSize(size)));
                } else {
                    resolve(PDFUnitNormalizerFromPT('mm', this.font.heightAtSize(size)));
                }
            })
        })
    }

    /**
    * Get a text size.
    * Example:
    * @returns Resolve with a text width.
    * ```js
    * PDF.getWidthOfTextAtSize('test',20,'Helvetica-Bold')
    * ```
    */
    public async getWidthOfTextAtSize(text: string, size: number, font?: PDFFontTypes | PDFFont): Promise<number> {
        return new Promise(resolve => {
            setTimeout(async () => {
                if (typeof font == 'string') {
                    resolve(PDFUnitNormalizerFromPT('mm', (await this.document.embedFont(font)).widthOfTextAtSize(text, size)));
                } else if (typeof font == 'object') {
                    resolve(PDFUnitNormalizerFromPT('mm', font?.widthOfTextAtSize(text, size)))
                } else {
                    resolve(PDFUnitNormalizerFromPT('mm', this.font.widthOfTextAtSize(text, size)))
                }
            })
        })
    }

    public getWidthOfTextAtSizeByPageFont(text: string, size: number) {
        return PDFUnitNormalizerFromPT('mm', this.font.widthOfTextAtSize(text, size))
    }

    /**
    * Get a [[PDFFont]] by external font.
    * Example:
    * @returns Resolve with a PDFFont.
    * ```js
    * let font = await PDF.getCustomFont("../fonts/HouschkaHead-BoldItalic.otf")
    * }) 
    *```
    */
    private async getCustomFont(fontPath: string) {
        let fontBytes = await readFilePromise(fontPath);
        return this.document.embedFont(fontBytes);;
    }

    /**
    * Get a [[PDFFont]] by name.
    * Example:
    * @returns Resolve with a PDFFont.
    * ```js
    * let font = await PDF.getCustomFont("Helvetica")
    * }) 
    *```
    */
    public async getFontByName(fontTypes: PDFFontTypes) {
        return this.document.embedFont(fontTypes);;
    }

    /**
    * Get a text size.
    * Example:
    * ```js
    *   PDF.setCustomFont("../fonts/HouschkaHead-BoldItalic.otf")
    * ```
    */
    public async setCustomFont(fontPath: string): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                this.externalFontPath = fontPath;
                let fontBytes = await readFilePromise(fontPath);
                this.font = await this.document.embedFont(fontBytes);
                this.page.setFont(this.font);
                resolve()
            })
        })
    }

    private async getFont(font?: string): Promise<PDFFont> {
        return new Promise(resolve => {
            setTimeout(async () => {
                if (font && existsSync(font)) resolve(await this.getCustomFont(String(font)))
                if (font) resolve(await this.document.embedFont(font));
                if (this.externalFontPath) {
                    let fontBytes = await readFilePromise(this.externalFontPath);
                    resolve(await this.document.embedFont(fontBytes));
                }
                resolve(await this.document.embedFont(this.fontName));
            })
        })
    }

    /**
    * Save the document at the file path
    * For example: 
    * ```js
    * PDF.save("/out/pdf/test.pdf")
    * ```
    */
    public async save(filePath: string): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                await this.saveTheLastPage()
                await this.mergeGroupOfPDF(filePath);
                resolve()
            })
        })
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
    public async loadPDF(pdfFilePath: string): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                if (!existsSync(pdfFilePath)) this.filePathDoesNotExist(pdfFilePath);
                await this.savePage();
                await this.createDocument();
                let document = await readFilePromise(pdfFilePath);
                let pdf = await PDFDocument.load(document);
                let pages = await this.document.copyPages(pdf, pdf.getPageIndices());
                for (let page of pages) {
                    this.document.addPage(page)
                    this.pagesControl++
                    await this.savePage();
                }
                resolve()
            })
        })
    }

    /**
    * Merge multiples pdf file to the document
    * For example: 
    * ```js
    *   // test.pdf has 3 pages and test2.pdf has 2 pages.
    *   PDF.getNumberOfPages() // returns 1
    *   PDF.removePage(1);
    *   PDF.getNumberOfPages() // returns 0;
    *   let pdfFilesPath = ["/out/pdf/test.pdf","/out/pdf/test2.pdf"]
    *   PDF.mergePDF(pdfFilesPath)
    *   PDF.getNumberOfPages() // returns 5
    * ```
    */
    public async mergePDF(pdfFilesPath: string[]): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                if (!pdfFilesPath?.length) this.pdfFilesPathEmpty()
                await this.savePage();
                for (let file of pdfFilesPath) {
                    if (!existsSync(file)) this.filePathDoesNotExist(file)
                    await this.createDocument();
                    let document = await readFilePromise(file);
                    let pdf = await PDFDocument.load(document);
                    let pages = await this.document.copyPages(pdf, pdf.getPageIndices());
                    for (let page of pages) {
                        this.document.addPage(page)
                        this.pagesControl++
                        await this.savePage();
                    }
                }
                resolve()
            })
        })
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
    public getNumberOfPages() {
        return this.pagesControl;
    }

    /**
    * Get page width.
    * Example:
    * @returns - Returns page width.
    * ```js
    * let pageOptions = {
    *    unit: 'mm', 
    *    orientation: 'portrait', 
    *    pageSize: { line: 210, column: 297 }, 
    *    pageSpacing: { top: 10, bottom: 10, left: 10, right: 10 }, 
    *    font: 'Helvetica-Bold',
    *}
    * PDF.addPage(pageOptions)
    * PDF.getPageWidth() // 210
    * ```
    */
    public getPageWidth() {
        return PDFUnitNormalizerFromPT(this.unit, this.page.getWidth());
    }

    /**
    * Get page height.
    * Example:
    * @returns - Returns page height.
    * ```js
    *    let pageOptions = {
    *    unit: 'mm', 
    *    orientation: 'portrait', 
    *    pageSize: { line: 210, column: 297 }, 
    *    pageSpacing: { top: 10, bottom: 10, left: 10, right: 10 }, 
    *    font: 'Helvetica-Bold',
    *}
    * PDF.getPageHeight() // 297
    * ```
    */
    public getPageHeight() {
        return PDFUnitNormalizerFromPT(this.unit, this.page.getHeight());
    }

    /**
    * Get the document font.
    * Example:
    * @returns - Returns a [[PDFFont]].
    * ```js
    * PDF.getDocumentFont()
    * ```
    */
    public getDocumentFont() {
        return this.font
    }


    private async createDocument() {
        this.document = await PDFDocument.create();
    }

    private async createPage(pageOptions?: PDFCreateOptions) {
        await this.createDocument();
        this.fontName = pageOptions?.font || this.fontName;
        this.font = await this.getFont(pageOptions?.font || this.externalFontPath || this.fontName);
        this.unit = pageOptions?.unit || this.unit;
        this.fontSize = pageOptions?.fontSize || this.fontSize;
        this.pageSize = PDFGetPageSizeByUnit(pageOptions?.unit, pageOptions?.pageSize) || PageSizes.A4;
        this.setOrientation(pageOptions?.orientation || this.orientation);
        this.page = this.document.addPage(this.pageSize);
        this.pageFraming = { lineStartPosition: 0, lineEndPosition: this.page.getWidth(), columnStartPosition: 0, columnEndPosition: this.page.getHeight() }
        this.pageSpacing = this.normalizePageSpacing(pageOptions?.pageSpacing);
        this.setPageLimits();
        this.page.setFont(this.font)
        this.page.setFontSize(pageOptions?.fontSize || this.fontSize)
        this.page.setFontColor(this.getColorRGBFromRGBA(pageOptions?.fontColor || this.fontColor))
    }

    private getColorRGBFromRGBA(color?: PDFRGBA) {
        return rgb(color?.r || 0, color?.g || 0, color?.b || 0)
    }
    private getAlfaFromRGBA(color?: PDFRGBA) {
        return color?.a || 1
    }

    private normalizeText(text: PDFText): PDFText {
        text.positions = this.normalizePositions(text.positions, text.textWidth, text.textHeight, text.align);
        text.positions.columnPosition = this.columnNormalize(text.positions.columnPosition);
        return text;
    }

    private normalizeLine(positions: PDFPositions) {
        let normalizedPositions: PDFPositions = {
            linePosition: PDFUnitNormalizerToPT(this.unit, positions.linePosition),
            columnPosition: PDFUnitNormalizerToPT(this.unit, positions.columnPosition)
        }
        this.verifyPositionsByLimit(normalizedPositions);
        normalizedPositions.columnPosition = this.columnNormalize(normalizedPositions.columnPosition);
        return normalizedPositions;
    }

    private normalizePositions(positions: PDFPositions, width: number, height: number, align?: PDFTextAligns,) {
        let normalizedPositions: PDFPositions = {
            linePosition: PDFUnitNormalizerToPT(this.unit, positions.linePosition),
            columnPosition: PDFUnitNormalizerToPT(this.unit, positions.columnPosition)
        }
        normalizedPositions.linePosition = PDFVerticalAlignmentFormatter(align || 'left', normalizedPositions.linePosition, width);
        let textWidthByAlign = align == 'center' ? width / 2 : width;
        this.verifyPositionsByLimit(normalizedPositions, textWidthByAlign, height);
        return normalizedPositions;
    }

    private normalizePageSpacing(pageSpacing?: PDFPageSpacing) {
        let pageSpacingNormalized: PDFPageSpacing = {
            top: PDFUnitNormalizerToPT(this.unit, pageSpacing?.top),
            bottom: PDFUnitNormalizerToPT(this.unit, pageSpacing?.bottom),
            left: PDFUnitNormalizerToPT(this.unit, pageSpacing?.left),
            right: PDFUnitNormalizerToPT(this.unit, pageSpacing?.right)
        }
        return pageSpacingNormalized;
    }

    private columnNormalize(columnPosition: number) {
        let newPosition = this.limits.startColumn + this.pageSpacing.top - columnPosition;
        return newPosition
    }

    private verifyPositionsByLimit(positions: PDFPositions, width?: number, height?: number) {
        this.verifyColumnByLimit(positions.columnPosition, height || 0);
        this.verifyLineByLimit(positions.linePosition, width || 0);
    }

    private verifyColumnByLimit(columnPosition: number, height: number) {
        if (columnPosition < this.pageFraming.columnStartPosition + this.pageSpacing.top) this.columnIsOutRange(columnPosition, this.pageFraming.columnStartPosition + this.pageSpacing.top);
        if (columnPosition > this.pageFraming.columnEndPosition - this.pageSpacing.bottom) this.columnIsOutRange(columnPosition, this.pageFraming.columnEndPosition - this.pageSpacing.bottom);
        if (columnPosition - height < this.pageFraming.columnStartPosition + this.pageSpacing.top) this.columnWithHeightIsOutRange(columnPosition - height, this.pageFraming.columnStartPosition + this.pageSpacing.top);
    }

    private verifyLineByLimit(linePosition: number, width: number) {
        if (linePosition < this.limits.startLine) this.lineIsOutRange(linePosition, this.limits.startLine);
        if (linePosition > this.limits.endLine) this.lineIsOutRange(linePosition, this.limits.endLine);
        if (linePosition + width > this.limits.endLine) this.lineWithWidthIsOutRange(linePosition + width, this.limits.endLine);
    }

    private setPageLimits() {
        this.limits.startLine = this.pageFraming.lineStartPosition + this.pageSpacing?.left;
        this.limits.endLine = this.pageFraming.lineEndPosition - this.pageSpacing.right;
        this.limits.startColumn = this.pageFraming.columnEndPosition - this.pageSpacing.top;
        this.limits.endColumn = this.pageFraming.columnStartPosition + this.pageSpacing.bottom;
    }

    private wasLastPageSaved() {
        return existsSync(this.mergeFiles[this.pagesControl - 1])
    }
    private async saveTheLastPage(): Promise<void> {
        return new Promise(resolve => {
            setTimeout(async () => {
                if (!this.wasLastPageSaved()) await writeFilePromise(this.file + `part${this.pagesControl}`, await this.document.save(), { flag: 'w' })
                resolve();
            })
        })

    }
    private async savePage(pageNumber?: number) {
        await writeFilePromise(this.file + `part${pageNumber || this.pagesControl}`, await this.document.save(), { flag: 'w' })
        if (!this.mergeFiles.filter(file => file == this.file + `part${pageNumber || this.pagesControl}`)[0]) {
            this.mergeFiles.push(this.file + `part${pageNumber || this.pagesControl}`)
        }

    }
    private async deletePageFile(file: string) {
        await unlinkPromise(file)
        this.mergeFiles = this.mergeFiles.filter(mergeFile => mergeFile != file);
    }
    private getPageFile(pageNumber: number) {
        let filePage = this.mergeFiles[pageNumber - 1];
        if (!filePage) this.pageDoesNotExist(pageNumber);
        return filePage;
    }
    private async mergeGroupOfPDF(filePath: string) {
        if (!this.mergeFiles[0] && !this.pagesControl) this.pagesForMergeDoesNotExist();
        if (!this.mergeFiles[0] && this.pagesControl) { await writeFilePromise(filePath, await this.document.save(), { flag: 'w' }); return };
        await this.saveTheLastPage();
        await writeFilePromise(this.file + `part${this.pagesControl}`, await this.document.save(), { flag: 'w' })
        if (!this.mergeFiles.filter(filePath => filePath == this.file + `part${this.pagesControl}`)[0]) this.mergeFiles.push(this.file + `part${this.pagesControl}`)
        this.document = await PDFDocument.create()
        for (let file of this.mergeFiles) {
            let document = await readFilePromise(file);
            let pdf = await PDFDocument.load(document);
            let pages = await this.document.copyPages(pdf, pdf.getPageIndices());
            this.document.addPage(pages[0])
        }
        let pdfPrincipalBytes = await this.document.save()
        await writeFilePromise(filePath, pdfPrincipalBytes, { flag: 'w' });
        for (let file of this.mergeFiles) {
            if (existsSync(file)) await unlinkPromise(file)
        }
        this.mergeFiles = [];
    }
    private setOrientation(orientation?: PDFPageOrientationTypes) {
        orientation == 'landscape' ? this.pageSize = [this.pageSize[1], this.pageSize[0]] : this.pageSize = [this.pageSize[0], this.pageSize[1]];
    }
    private isNegative(attribute: string, value: number) {
        if (value < 0) {
            this.negativeNumber(attribute, value)
        }
    }

    //errors
    private pageDoesNotExist(pageNumber: number) {
        throw new Error(`Page ${pageNumber} does not exist`)
    }
    private pagesForMergeDoesNotExist() {
        throw new Error('There is no page to save')
    }
    private columnIsOutRange(column: number, range: number) {
        throw new Error(`Column ${PDFUnitNormalizerFromPT(this.unit, column)} is out of range. Range: ${PDFUnitNormalizerFromPT(this.unit, range)}`)
    }
    private columnWithHeightIsOutRange(column: number, range: number) {
        throw new Error(`Column with height ${PDFUnitNormalizerFromPT(this.unit, column)} is out of range. Range: ${PDFUnitNormalizerFromPT(this.unit, range)}`)
    }
    private lineIsOutRange(line: number, range: number) {
        throw new Error(`Line ${PDFUnitNormalizerFromPT(this.unit, line)} is out of range. Range: ${PDFUnitNormalizerFromPT(this.unit, range)}`)
    }
    private lineWithWidthIsOutRange(line: number, range: number) {
        throw new Error(`Line with width ${PDFUnitNormalizerFromPT(this.unit, line)} is out of range. Range: ${PDFUnitNormalizerFromPT(this.unit, range)}`)
    }
    private negativeNumber(attribute: string, value: number) {
        throw new Error(`${attribute} can't be set by negative value: ${value}`)
    }
    private filePathDoesNotExist(filePath: string) {
        throw new Error(`File path ${this.file} does not exist`)
    }
    private pdfFilesPathEmpty() {
        throw new Error(`Pdf files path is empty`)
    }
}