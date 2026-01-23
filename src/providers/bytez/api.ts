import { ProviderAPIConfig } from '../types';
import { version } from '../../../package.json';

const BytezInferenceAPI: ProviderAPIConfig = {
  getBaseURL: () => 'https://api.bytez.com',
  headers: async ({ providerOptions }) => {
    const { apiKey } = providerOptions;

    const headers: Record<string, string> = {};

    headers['Authorization'] = `Key ${apiKey}`;
    headers['user-agent'] = `portkey/${version}`;

    return headers;
  },
  getEndpoint: ({ gatewayRequestBodyJSON }) => {
    const { model, version = 2 } = gatewayRequestBodyJSON as {
      model: string;
      version?: number;
    };
    return `/models/v${version}/${model}`;
  },
};

export default BytezInferenceAPI;
