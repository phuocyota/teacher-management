import { Injectable, Logger } from '@nestjs/common';
import { PdfParsingError } from '../exceptions/pdf-parsing.exception';
import { LayoutFragment } from '../types/question-bank-import.types';
import { PDF_PARSER_CONFIG } from '../constants/pdf-parser.constant';
import { PdfJsLib, PdfPage } from '../types/pdf-types';

/**
 * Service for extracting and processing images from PDF pages
 * Handles PDF operator parsing, image encoding, and channel detection
 */
@Injectable()
export class PdfImageExtractorService {
  private readonly logger = new Logger(PdfImageExtractorService.name);

  /**
   * Extract all images from a PDF page
   * Scans PDF operators to find image paint operations
   */
  async extractPageImages(
    page: PdfPage,
    pageNumber: number,
    pdfjsLib: PdfJsLib,
    viewport: any,
  ): Promise<LayoutFragment[]> {
    try {
      const operatorList = await page.getOperatorList();
      const fragments: LayoutFragment[] = [];
      const transformStack: number[][] = [];
      let currentTransform = [1, 0, 0, 1, 0, 0];
      let order = PDF_PARSER_CONFIG.IMAGE_ORDER_START;
      let imageCount = 0;

      for (let index = 0; index < operatorList.fnArray.length; index++) {
        const fn = operatorList.fnArray[index];
        const args = operatorList.argsArray[index] ?? [];

        if (fn === pdfjsLib.OPS.save) {
          transformStack.push([...currentTransform]);
          continue;
        }

        if (fn === pdfjsLib.OPS.restore) {
          currentTransform = transformStack.pop() ?? [1, 0, 0, 1, 0, 0];
          continue;
        }

        if (
          fn === pdfjsLib.OPS.transform &&
          Array.isArray(args) &&
          args.length === 6
        ) {
          currentTransform = this.multiplyMatrices(currentTransform, args);
          continue;
        }

        const isImagePaintOperation =
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintJpegXObject ||
          fn === pdfjsLib.OPS.paintImageMaskXObject ||
          fn === pdfjsLib.OPS.paintInlineImageXObject;

        if (!isImagePaintOperation) {
          continue;
        }

        imageCount++;
        try {
          const imageObject = await this.resolveImageObject(
            page,
            args[0],
            pageNumber,
          );

          if (!imageObject) {
            continue;
          }

          const positionMatrix = pdfjsLib.Util.transform(
            viewport.transform,
            currentTransform,
          );

          fragments.push({
            kind: 'image',
            content: imageObject,
            x: positionMatrix[4],
            y: positionMatrix[5],
            width: this.getMatrixScale(currentTransform, true),
            height: this.getMatrixScale(currentTransform, false),
            pageNumber,
            order: order++,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to process image #${imageCount} on page ${pageNumber}: ${error}`,
          );
          continue;
        }
      }

      return fragments;
    } catch (error) {
      throw new PdfParsingError(
        `Failed to extract images from page: ${error}`,
        pageNumber,
      );
    }
  }

  /**
   * Resolve image object from PDF page by name
   */
  private async resolveImageObject(
    page: PdfPage,
    imageName: any,
    pageNumber: number,
  ): Promise<any> {
    if (imageName && typeof imageName === 'object') {
      return imageName;
    }

    if (typeof imageName !== 'string') {
      return null;
    }

    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn(
          `Timed out (${PDF_PARSER_CONFIG.IMAGE_OBJECT_TIMEOUT_MS}ms) resolving image "${imageName}" on page ${pageNumber}`,
        );
        resolve(null);
      }, PDF_PARSER_CONFIG.IMAGE_OBJECT_TIMEOUT_MS);

      try {
        page.objs.get(imageName, (image: any) => {
          clearTimeout(timeout);
          resolve(image);
        });
      } catch (err) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  }

  /**
   * Multiply two transformation matrices
   * Used for calculating image position/scale
   */
  private multiplyMatrices(left: number[], right: number[]): number[] {
    return [
      left[0] * right[0] + left[2] * right[1],
      left[1] * right[0] + left[3] * right[1],
      left[0] * right[2] + left[2] * right[3],
      left[1] * right[2] + left[3] * right[3],
      left[0] * right[4] + left[2] * right[5] + left[4],
      left[1] * right[4] + left[3] * right[5] + left[5],
    ];
  }

  /**
   * Calculate scale (width or height) from transformation matrix
   */
  private getMatrixScale(matrix: number[], horizontal: boolean): number {
    const [a, b, c, d] = matrix;
    return horizontal ? Math.hypot(a, b) : Math.hypot(c, d);
  }
}
