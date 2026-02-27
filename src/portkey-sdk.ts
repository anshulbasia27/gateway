import axios from 'axios';

interface PortkeyOptions {
  timeout: number;
}

class PortkeySDK {
  private options: PortkeyOptions;

  constructor(options: PortkeyOptions) {
    this.options = options;
  }

  public async request(endpoint: string, data: any): Promise<any> {
    try {
      const response = await axios.post(endpoint, data, {
        timeout: this.options.timeout
      });
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
