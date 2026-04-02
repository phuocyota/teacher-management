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

        try {
          const imageObject = await this.resolveImageObject(page, args[0]);
          const encodedImage = await this.encodeImageObject(imageObject);

          if (!encodedImage) {
            continue;
          }

          const positionMatrix = pdfjsLib.Util.transform(
            viewport.transform,
            currentTransform,
          );

          fragments.push({
            kind: 'image',
            content: encodedImage.toString('base64'),
            x: positionMatrix[4],
            y: positionMatrix[5],
            width: this.getMatrixScale(currentTransform, true),
            height: this.getMatrixScale(currentTransform, false),
            pageNumber,
            order: order++,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to process image on page ${pageNumber}: ${error}`,
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
  ): Promise<any> {
    if (typeof imageName !== 'string') {
      return null;
    }

    return await new Promise((resolve) => {
      try {
        page.objs.get(imageName, (image: any) => resolve(image));
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Encode image object to PNG buffer
   * Handles raw image data and converts to PNG format
   */
  private async encodeImageObject(imageObject: any): Promise<Buffer | null> {
    if (!imageObject) {
      return null;
    }

    if (Buffer.isBuffer(imageObject)) {
      return imageObject;
    }

    if (Buffer.isBuffer(imageObject.data)) {
      return imageObject.data;
    }

    const rawData = imageObject.data;

    if (
      !rawData ||
      typeof imageObject.width !== 'number' ||
      typeof imageObject.height !== 'number' ||
      typeof rawData.length !== 'number'
    ) {
      return null;
    }

    const channels = this.detectChannelCount(
      rawData.length,
      imageObject.width,
      imageObject.height,
    );

    if (!channels) {
      return Buffer.from(rawData);
    }

    try {
      const sharp = require('sharp');
      return await sharp(Buffer.from(rawData), {
        raw: {
          width: imageObject.width,
          height: imageObject.height,
          channels,
        },
      })
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.warn(
        `Failed to encode image with sharp: ${error}, returning raw data`,
      );
      return Buffer.from(rawData);
    }
  }

  /**
   * Detect number of color channels from data length
   * Returns 4 (RGBA), 3 (RGB), 1 (Grayscale), or null if cannot determine
   */
  private detectChannelCount(
    dataLength: number,
    width: number,
    height: number,
  ): number | null {
    const pixelCount = width * height;

    if (pixelCount <= 0) {
      return null;
    }

    if (dataLength === pixelCount * 4) {
      return 4; // RGBA
    }

    if (dataLength === pixelCount * 3) {
      return 3; // RGB
    }

    if (dataLength === pixelCount) {
      return 1; // Grayscale
    }

    return null;
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
