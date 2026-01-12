import { logRequest } from '../logging';

jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

describe('logRequest', () => {
  it('should send a POST request to the logging service', async () => {
    const request = new Request('https://example.com', { method: 'GET' });
    await logRequest(request);
    expect(fetch).toHaveBeenCalledWith('https://logging-service.example.com/log', expect.any(Object));
  });

  it('should handle errors gracefully', async () => {
    fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
    const request = new Request('https://example.com', { method: 'GET' });
    await expect(logRequest(request)).resolves.toBeUndefined();
  });
});
