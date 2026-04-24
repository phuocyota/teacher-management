import { PDF_PARSER_CONFIG } from '../constants/pdf-parser.constant';
import { PdfImageExtractorService } from './pdf-image-extractor.service';

describe('PdfImageExtractorService', () => {
  let service: PdfImageExtractorService;

  beforeEach(() => {
    service = new PdfImageExtractorService();
  });

  it('extracts image fragments from pdf.js recorded image coordinates', async () => {
    const renderedPage = Buffer.from('rendered-page');
    const croppedImage = Buffer.from('cropped-image');
    jest.spyOn(service as any, 'renderPageToBitmap').mockResolvedValue({
      buffer: renderedPage,
      width: 200,
      height: 100,
      imageCoordinates: [0.1, 0.2, 0.1, 0.6, 0.5, 0.2],
    });
    jest
      .spyOn(service as any, 'cropRenderedImage')
      .mockResolvedValue(croppedImage);

    const fragments = await service.extractPageImages(
      {} as any,
      2,
      {} as any,
      { scale: 1 } as any,
    );

    expect(fragments).toHaveLength(1);
    expect(fragments[0]).toMatchObject({
      kind: 'image',
      content: croppedImage,
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      pageNumber: 2,
      order: PDF_PARSER_CONFIG.IMAGE_ORDER_START,
    });
    expect((service as any).cropRenderedImage).toHaveBeenCalledWith(
      renderedPage,
      { left: 20, top: 20, width: 80, height: 40 },
    );
  });

  it('ignores tiny recorded image regions before cropping', async () => {
    const cropSpy = jest.spyOn(service as any, 'cropRenderedImage');
    jest.spyOn(service as any, 'renderPageToBitmap').mockResolvedValue({
      buffer: Buffer.from('rendered-page'),
      width: 100,
      height: 100,
      imageCoordinates: [0.1, 0.1, 0.1, 0.14, 0.14, 0.1],
    });

    const fragments = await service.extractPageImages(
      {} as any,
      1,
      {} as any,
      { scale: 1 } as any,
    );

    expect(fragments).toEqual([]);
    expect(cropSpy).not.toHaveBeenCalled();
  });

  it('ignores thin separator-like image regions before cropping', async () => {
    const cropSpy = jest.spyOn(service as any, 'cropRenderedImage');
    jest.spyOn(service as any, 'renderPageToBitmap').mockResolvedValue({
      buffer: Buffer.from('rendered-page'),
      width: 1000,
      height: 100,
      imageCoordinates: [0.05, 0.2, 0.05, 0.25, 0.95, 0.2],
    });

    const fragments = await service.extractPageImages(
      {} as any,
      1,
      {} as any,
      { scale: 1 } as any,
    );

    expect(fragments).toEqual([]);
    expect(cropSpy).not.toHaveBeenCalled();
  });

  it('renders with recordImages enabled and returns captured coordinates', async () => {
    const canvas = {
      width: 40,
      height: 50,
      getContext: jest.fn().mockReturnValue({}),
      toBuffer: jest.fn().mockReturnValue(Buffer.from('png')),
    };
    jest.spyOn(service as any, 'createCanvas').mockReturnValue(canvas);
    const page = {
      imageCoordinates: [0.1, 0.2, 0.1, 0.6, 0.5, 0.2],
      getViewport: jest.fn().mockReturnValue({ width: 40, height: 50 }),
      render: jest.fn().mockReturnValue({ promise: Promise.resolve() }),
    };

    const result = await (service as any).renderPageToBitmap(page, {
      scale: 1,
    });

    expect(result).toEqual({
      buffer: Buffer.from('png'),
      width: 40,
      height: 50,
      imageCoordinates: [0.1, 0.2, 0.1, 0.6, 0.5, 0.2],
    });
    expect(page.getViewport).toHaveBeenCalledWith({
      scale: PDF_PARSER_CONFIG.IMAGE_RENDER_SCALE,
    });
    expect(page.render).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas,
        canvasContext: {},
        viewport: { width: 40, height: 50 },
        recordImages: true,
      }),
    );
  });
});
