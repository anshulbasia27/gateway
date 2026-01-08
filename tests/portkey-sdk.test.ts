import PortkeySDK from '../src/portkey-sdk';
import nock from 'nock';

describe('PortkeySDK', () => {
  const endpoint = 'http://localhost/api';
  const data = { key: 'value' };

  afterEach(() => {
    nock.cleanAll();
  });

  it('should respect the timeout parameter', async () => {
    nock(endpoint)
      .post('/')
      .delay(6000)
      .reply(200, { success: true });

    const sdk = new PortkeySDK({ timeout: 5000 });

    await expect(sdk.request(endpoint, data)).rejects.toThrow('Request timed out');
  });

  it('should succeed if response is within timeout', async () => {
    nock(endpoint)
      .post('/')
      .delay(1000)
      .reply(200, { success: true });

    const sdk = new PortkeySDK({ timeout: 5000 });

    const response = await sdk.request(endpoint, data);
    expect(response).toEqual({ success: true });
  });
});
