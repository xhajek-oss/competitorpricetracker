import { validateUrlSafety } from '../../server/scraper/index';

describe('validateUrlSafety', () => {
  it('blocks localhost', async () => {
    const result = await validateUrlSafety('http://localhost/secret');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks 127.0.0.1 (loopback)', async () => {
    const result = await validateUrlSafety('http://127.0.0.1/admin');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks 10.x.x.x private range', async () => {
    const result = await validateUrlSafety('http://10.0.0.1/internal');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks 192.168.x.x private range', async () => {
    const result = await validateUrlSafety('http://192.168.1.1/router');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks 172.16.x.x private range', async () => {
    const result = await validateUrlSafety('http://172.16.0.1/service');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks 0.0.0.0', async () => {
    const result = await validateUrlSafety('http://0.0.0.0:8080/api');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks IPv6 loopback [::1]', async () => {
    const result = await validateUrlSafety('http://[::1]/secret');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks 169.254.x.x link-local range', async () => {
    const result = await validateUrlSafety('http://169.254.169.254/latest/meta-data');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('allows a valid public URL (https://example.com)', async () => {
    const result = await validateUrlSafety('https://example.com/product/1');
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows a valid Amazon URL', async () => {
    const result = await validateUrlSafety('https://www.amazon.de/dp/B09V3KXJPB');
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
