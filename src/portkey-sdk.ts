import axios, { AxiosRequestConfig } from 'axios';

export class PortkeySDK {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public async request(endpoint: string, options: AxiosRequestConfig = {}): Promise<any> {
    const config: AxiosRequestConfig = {
      ...options,
      timeout: 5000, // Set timeout to 5 seconds
    };

    try {
      const response = await axios.get(`${this.baseUrl}/${endpoint}`, config);
      return response.data;
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }
}
