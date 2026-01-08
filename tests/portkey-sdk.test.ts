import PortkeySDK from '../src/portkey-sdk';
import nock from 'nock';

const sdk = new PortkeySDK();

describe('PortkeySDK Timeout', () => {
  it('should respect the timeout parameter', async () => {
    nock('http://example.com')
      .get('/timeout')
      .delay(6000)
      .reply(200, { success: true });

    await expect(sdk.request('http://example.com/timeout', { timeout: 5000 }))
      .rejects
      .toThrow('Request timed out');
  });

  it('should not timeout if response is within the limit', async () => {
    nock('http://example.com')
      .get('/quick')
      .delay(1000)
      .reply(200, { success: true });

    const response = await sdk.request('http://example.com/quick', { timeout: 5000 });
    expect(response).toEqual({ success: true });
  });
});
