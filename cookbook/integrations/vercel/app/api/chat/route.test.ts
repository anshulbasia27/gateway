import { POST } from './route';

describe('POST /api/chat', () => {
  it('should return 403 for invalid payload', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should return a valid response for correct payload', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
