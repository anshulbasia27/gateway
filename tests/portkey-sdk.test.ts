import { PortkeySDK } from '../src/portkey-sdk';
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

  it('should fail the request if it exceeds the timeout', async () => {
    nock(BASE_URL)
      .get('/timeout-test')
      .delay(6000) // Delay response to simulate timeout
      .reply(200, { success: true });

    await expect(sdk.request('timeout-test')).rejects.toThrow('timeout of 5000ms exceeded');
  });

  it('should succeed if the request is within the timeout', async () => {
    nock(BASE_URL)
      .get('/success-test')
      .reply(200, { success: true });

    const response = await sdk.request('success-test');
    expect(response).toEqual({ success: true });
  });
});
