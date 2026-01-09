import { POST } from './route';

describe('POST /api/chat', () => {
  it('should process requests without hanging', async () => {
    const request = new Request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('should return 500 on error', async () => {
    const request = new Request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: null }), // Invalid input to trigger error
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
