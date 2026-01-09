import axios, { AxiosRequestConfig } from 'axios';

class PortkeySDK {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint: string, timeout: number = 5000): Promise<any> {
    const config: AxiosRequestConfig = {
      url: `${this.baseUrl}/${endpoint}`,
      method: 'GET',
      timeout: timeout
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