export const mockReplace = jest.fn();
export const mockFetchAll = jest.fn();
export const mockCreate = jest.fn();
export const mockRead = jest.fn();
export const mockDelete = jest.fn();

export const mockQuery = jest
  .fn()
  .mockImplementation(() => ({ fetchAll: mockFetchAll }));
export const mockItem = jest.fn().mockImplementation(() => ({
  delete: mockDelete,
  read: mockRead,
  replace: mockReplace
}));
export const mockContainer = {
  item: mockItem,
  items: {
    create: mockCreate,
    query: mockQuery
  }
};
