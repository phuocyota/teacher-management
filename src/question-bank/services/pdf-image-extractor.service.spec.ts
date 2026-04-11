import { PDF_PARSER_CONFIG } from '../constants/pdf-parser.constant';
import { PdfImageExtractorService } from './pdf-image-extractor.service';

describe('PdfImageExtractorService', () => {
  let service: PdfImageExtractorService;

  beforeEach(() => {
    service = new PdfImageExtractorService();
  });

  it('skips image objects that never resolve from pdf.js', async () => {
    const page = {
      getOperatorList: jest.fn().mockResolvedValue({
        fnArray: [4],
        argsArray: [['img_missing']],
      }),
      objs: {
        get: jest.fn(),
      },
    };
    const pdfjsLib = {
      OPS: {
        save: 0,
        restore: 1,
        transform: 2,
        paintImageXObject: 4,
        paintJpegXObject: 5,
        paintImageMaskXObject: 6,
        paintInlineImageXObject: 7,
      },
      Util: {
        transform: jest.fn().mockReturnValue([1, 0, 0, 1, 10, 20]),
      },
    };

    const fragments = await service.extractPageImages(
      page as any,
      2,
      pdfjsLib as any,
      { transform: [1, 0, 0, 1, 0, 0] },
    );

    expect(fragments).toEqual([]);
    expect(page.objs.get).toHaveBeenCalledWith(
      'img_missing',
      expect.any(Function),
    );
  });

  it('uses inline image objects directly without reading page.objs', async () => {
    const inlineImage = {
      data: Buffer.from([0xff, 0x00, 0x00]),
      width: 1,
      height: 1,
    };
    const page = {
      getOperatorList: jest.fn().mockResolvedValue({
        fnArray: [7],
        argsArray: [[inlineImage]],
      }),
      objs: {
        get: jest.fn(),
      },
    };
    const pdfjsLib = {
      OPS: {
        save: 0,
        restore: 1,
        transform: 2,
        paintImageXObject: 4,
        paintJpegXObject: 5,
        paintImageMaskXObject: 6,
        paintInlineImageXObject: 7,
      },
      Util: {
        transform: jest.fn().mockReturnValue([1, 0, 0, 1, 10, 20]),
      },
    };

    const fragments = await service.extractPageImages(
      page as any,
      1,
      pdfjsLib as any,
      { transform: [1, 0, 0, 1, 0, 0] },
    );

    expect(fragments).toHaveLength(1);
    expect(fragments[0]).toMatchObject({
      kind: 'image',
      x: 10,
      y: 20,
      width: 1,
      height: 1,
      pageNumber: 1,
      order: PDF_PARSER_CONFIG.IMAGE_ORDER_START,
    });
    expect(page.objs.get).not.toHaveBeenCalled();
  });
});
