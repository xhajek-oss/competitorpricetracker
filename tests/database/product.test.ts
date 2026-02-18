import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsDueForCheck,
} from '../../server/database/models/product';

describe('Product model', () => {
  describe('createProduct', () => {
    it('creates and returns product with correct fields', () => {
      const product = createProduct({
        url: 'https://example.com/product-1',
        name: 'Test Product',
        shop_type: 'amazon',
        check_interval: 12,
      });

      expect(product).toBeDefined();
      expect(product.id).toBeTypeOf('number');
      expect(product.url).toBe('https://example.com/product-1');
      expect(product.name).toBe('Test Product');
      expect(product.shop_type).toBe('amazon');
      expect(product.check_interval).toBe(12);
      expect(product.is_active).toBe(true);
      expect(product.current_price).toBeNull();
      expect(product.last_checked_at).toBeNull();
      expect(product.currency).toBe('EUR');
      expect(product.created_at).toBeTypeOf('string');
      expect(product.updated_at).toBeTypeOf('string');
    });

    it('applies defaults when name is null and check_interval is omitted', () => {
      const product = createProduct({
        url: 'https://example.com/product-defaults',
        shop_type: 'generic',
      });

      expect(product.name).toBe('');
      expect(product.check_interval).toBe(24);
    });
  });

  describe('getAllProducts', () => {
    it('returns all products', () => {
      createProduct({ url: 'https://example.com/p1', shop_type: 'amazon' });
      createProduct({ url: 'https://example.com/p2', shop_type: 'ebay' });

      const products = getAllProducts();
      expect(products).toHaveLength(2);
    });
  });

  describe('getProductById', () => {
    it('returns the correct product', () => {
      const created = createProduct({
        url: 'https://example.com/p-find',
        name: 'Find Me',
        shop_type: 'shopify',
      });

      const found = getProductById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Find Me');
      expect(found!.shop_type).toBe('shopify');
    });

    it('returns undefined for non-existent id', () => {
      const result = getProductById(9999);
      expect(result).toBeUndefined();
    });
  });

  describe('updateProduct', () => {
    it('updates name', () => {
      const product = createProduct({
        url: 'https://example.com/p-update',
        name: 'Old Name',
        shop_type: 'generic',
      });

      const updated = updateProduct(product.id, { name: 'New Name' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('New Name');
    });

    it('updates is_active with boolean to integer conversion', () => {
      const product = createProduct({
        url: 'https://example.com/p-active',
        shop_type: 'generic',
      });
      expect(product.is_active).toBe(true);

      const deactivated = updateProduct(product.id, { is_active: false });
      expect(deactivated).toBeDefined();
      expect(deactivated!.is_active).toBe(false);

      const reactivated = updateProduct(product.id, { is_active: true });
      expect(reactivated).toBeDefined();
      expect(reactivated!.is_active).toBe(true);
    });

    it('returns undefined for non-existent id', () => {
      const result = updateProduct(9999, { name: 'Ghost' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteProduct', () => {
    it('removes product and returns true', () => {
      const product = createProduct({
        url: 'https://example.com/p-delete',
        shop_type: 'generic',
      });

      const deleted = deleteProduct(product.id);
      expect(deleted).toBe(true);

      const found = getProductById(product.id);
      expect(found).toBeUndefined();
    });

    it('returns false for non-existent id', () => {
      const result = deleteProduct(9999);
      expect(result).toBe(false);
    });
  });

  describe('getProductsDueForCheck', () => {
    it('returns products where last_checked_at is null or old enough', () => {
      // Product with null last_checked_at (never checked) should be due
      createProduct({
        url: 'https://example.com/p-never-checked',
        shop_type: 'generic',
        check_interval: 6,
      });

      // Product checked very recently should NOT be due
      const recentProduct = createProduct({
        url: 'https://example.com/p-recent',
        shop_type: 'generic',
        check_interval: 24,
      });
      updateProduct(recentProduct.id, { last_checked_at: new Date().toISOString() });

      // Product checked long ago should be due
      const oldProduct = createProduct({
        url: 'https://example.com/p-old',
        shop_type: 'generic',
        check_interval: 6,
      });
      updateProduct(oldProduct.id, { last_checked_at: '2020-01-01T00:00:00.000Z' });

      // Inactive product should NOT be returned even if due
      const inactiveProduct = createProduct({
        url: 'https://example.com/p-inactive',
        shop_type: 'generic',
      });
      updateProduct(inactiveProduct.id, { is_active: false });

      const due = getProductsDueForCheck();
      const dueIds = due.map((p) => p.id);

      // Never-checked and old-checked products should be due
      expect(dueIds).toContain(1);
      expect(dueIds).toContain(oldProduct.id);

      // Recently checked should not be due
      expect(dueIds).not.toContain(recentProduct.id);

      // Inactive should not be due
      expect(dueIds).not.toContain(inactiveProduct.id);
    });
  });
});
