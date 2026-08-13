export const Extract = () => {
  const handler = {
    on: () => handler,
  };
  return handler;
};

export const Open = {
  buffer: jest.fn(),
};

export default { Extract, Open };
