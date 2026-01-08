import axios, { AxiosRequestConfig } from 'axios';

interface PortkeyRequestOptions {
  timeout?: number;
  // other options...
}

class PortkeySDK {
  private defaultTimeout: number = 5000;

  async request(url: string, options: PortkeyRequestOptions = {}): Promise<any> {
    const timeout = options.timeout || this.defaultTimeout;
    const config: AxiosRequestConfig = {
      url,
      timeout,
      // other axios configurations...
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }
}

export default PortkeySDK;
