import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { PdfParsingError } from '../exceptions/pdf-parsing.exception';
import { LayoutFragment } from '../types/question-bank-import.types';
import { PDF_PARSER_CONFIG } from '../constants/pdf-parser.constant';
import { PdfCanvas, PdfJsLib, PdfPage, PdfViewport } from '../types/pdf-types';

interface ImageRegion {
  cropBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable()
export class PdfImageExtractorService {
  private readonly logger = new Logger(PdfImageExtractorService.name);

  async extractPageImages(
    page: PdfPage,
    pageNumber: number,
    _pdfjsLib: PdfJsLib,
    viewport: PdfViewport,
  ): Promise<LayoutFragment[]> {
    try {
      const renderResult = await this.renderPageToBitmap(
        page,
        viewport,
      );
      const imageRegions = this.collectImageRegions(
        renderResult.imageCoordinates,
        renderResult.width,
        renderResult.height,
        pageNumber,
      );

      if (imageRegions.length === 0) {
        return [];
      }

      const fragments: LayoutFragment[] = [];
      let order = PDF_PARSER_CONFIG.IMAGE_ORDER_START;

      for (const region of imageRegions) {
        try {
          const croppedBuffer = await this.cropRenderedImage(
            renderResult.buffer,
            region.cropBox,
          );

          if (!croppedBuffer) {
            continue;
          }

          fragments.push({
            kind: 'image',
            content: croppedBuffer,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            pageNumber,
            order: order++,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to crop rendered image on page ${pageNumber}: ${error}`,
          );
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

  private collectImageRegions(
    imageCoordinates: ArrayLike<number> | null | undefined,
    canvasWidth: number,
    canvasHeight: number,
    pageNumber: number,
  ): ImageRegion[] {
    const regions: ImageRegion[] = [];
    const scale = PDF_PARSER_CONFIG.IMAGE_RENDER_SCALE;

    if (!imageCoordinates || imageCoordinates.length < 6) {
      return regions;
    }

    for (let index = 0; index <= imageCoordinates.length - 6; index += 6) {
      const points = [
        {
          x: imageCoordinates[index] * canvasWidth,
          y: imageCoordinates[index + 1] * canvasHeight,
        },
        {
          x: imageCoordinates[index + 2] * canvasWidth,
          y: imageCoordinates[index + 3] * canvasHeight,
        },
        {
          x: imageCoordinates[index + 4] * canvasWidth,
          y: imageCoordinates[index + 5] * canvasHeight,
        },
      ];
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = maxX - minX;
      const height = maxY - minY;

      if (
        width < PDF_PARSER_CONFIG.MIN_IMAGE_CROP_SIZE_PX ||
        height < PDF_PARSER_CONFIG.MIN_IMAGE_CROP_SIZE_PX
      ) {
        this.logger.debug(
          `Ignored tiny image region on page ${pageNumber}: ${width}x${height}`,
        );
        continue;
      }

      if (
        width >= PDF_PARSER_CONFIG.MIN_IMAGE_CROP_SIZE_PX &&
        height >= PDF_PARSER_CONFIG.MIN_IMAGE_CROP_SIZE_PX &&
        (width < PDF_PARSER_CONFIG.MIN_IMAGE_THICKNESS_PX ||
          height < PDF_PARSER_CONFIG.MIN_IMAGE_THICKNESS_PX)
      ) {
        this.logger.debug(
          `Ignored thin image region on page ${pageNumber}: ${width}x${height}`,
        );
        continue;
      }

      regions.push({
        cropBox: {
          left: Math.max(0, Math.floor(minX)),
          top: Math.max(0, Math.floor(minY)),
          width: Math.max(1, Math.ceil(width)),
          height: Math.max(1, Math.ceil(height)),
        },
        x: minX / scale,
        y: minY / scale,
        width: width / scale,
        height: height / scale,
      });
    }

    return regions;
  }

  private async renderPageToBitmap(
    page: PdfPage,
    viewport: PdfViewport,
  ): Promise<{
    buffer: Buffer;
    width: number;
    height: number;
    imageCoordinates: ArrayLike<number> | null;
  }> {
    const renderScale = PDF_PARSER_CONFIG.IMAGE_RENDER_SCALE;
    const baseScale = viewport.scale || 1;
    const renderViewport = page.getViewport({ scale: baseScale * renderScale });
    const canvas = this.createCanvas(
      Math.ceil(renderViewport.width),
      Math.ceil(renderViewport.height),
    );
    const context = canvas.getContext('2d');

    const renderTask = page.render({
      canvasContext: context,
      canvas,
      viewport: renderViewport,
      recordImages: true,
    });
    const renderTaskWithPromise = renderTask as
      | Promise<void>
      | { promise: Promise<void> };

    if (
      renderTaskWithPromise &&
      typeof renderTaskWithPromise === 'object' &&
      'promise' in renderTaskWithPromise
    ) {
      await renderTaskWithPromise.promise;
    } else {
      await Promise.resolve(renderTaskWithPromise);
    }

    return {
      buffer: canvas.toBuffer('image/png'),
      width: canvas.width,
      height: canvas.height,
      imageCoordinates: page.imageCoordinates ?? null,
    };
  }

  private async cropRenderedImage(
    renderedPage: Buffer,
    cropBox: ImageRegion['cropBox'],
  ): Promise<Buffer | null> {
    const metadata = await sharp(renderedPage).metadata();
    const pageWidth = metadata.width ?? 0;
    const pageHeight = metadata.height ?? 0;

    if (pageWidth <= 0 || pageHeight <= 0) {
      return null;
    }

    const left = Math.max(0, cropBox.left);
    const top = Math.max(0, cropBox.top);
    const right = Math.min(pageWidth, left + cropBox.width);
    const bottom = Math.min(pageHeight, top + cropBox.height);
    const width = right - left;
    const height = bottom - top;

    if (
      width < PDF_PARSER_CONFIG.MIN_IMAGE_CROP_SIZE_PX ||
      height < PDF_PARSER_CONFIG.MIN_IMAGE_CROP_SIZE_PX
    ) {
      return null;
    }

    return sharp(renderedPage)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
  }

  private createCanvas(width: number, height: number): PdfCanvas {
    try {
      // pdfjs-dist ships the Node canvas implementation as a nested dependency.
      // Loading through that path avoids depending on package-manager hoisting.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const canvasModule = require('pdfjs-dist/node_modules/@napi-rs/canvas');
      return canvasModule.createCanvas(width, height) as PdfCanvas;
    } catch (error) {
      throw new Error(`Cannot create Node canvas for PDF rendering: ${error}`);
    }
  }

}
