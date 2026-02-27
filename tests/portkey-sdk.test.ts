import PortkeySDK from '../src/portkey-sdk';
import nock from 'nock';

const BASE_URL = 'http://localhost';

describe('PortkeySDK', () => {
  let sdk: PortkeySDK;

  beforeEach(() => {
    sdk = new PortkeySDK(BASE_URL);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should respect the timeout parameter', async () => {
    nock(BASE_URL)
      .get('/test')
      .delay(6000)
      .reply(200, { success: true });

    await expect(sdk.request('test', 5000)).rejects.toThrow('Request timed out');
  });

  it('should not timeout if response is within the limit', async () => {
    nock(BASE_URL)
      .get('/test')
      .delay(3000)
      .reply(200, { success: true });

    const response = await sdk.request('test', 5000);
    expect(response).toEqual({ success: true });
  });
});