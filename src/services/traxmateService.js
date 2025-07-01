const axios = require('axios');
const winston = require('winston');

class TraxmateService {
  constructor() {
    this.baseUrl = process.env.TRAXMATE_INGESTION_URL || 'https://api.traxmate.io/v1/data/ingest';
    this.apiKey = process.env.TRAXMATE_API_KEY;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'traxmate' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 seconds
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('Sending request to Traxmate:', {
          url: config.url,
          method: config.method,
          dataSize: config.data ? JSON.stringify(config.data).length : 0
        });
        return config;
      },
      (error) => {
        this.logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('Received response from Traxmate:', {
          status: response.status,
          statusText: response.statusText
        });
        return response;
      },
      (error) => {
        this.logger.error('Response error from Traxmate:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async sendData(data, retryCount = 0) {
    try {
      const response = await this.client.post('', data);
      
      this.logger.info('Successfully sent data to Traxmate:', {
        deviceId: data.identifier,
        timestamp: data.timestamp,
        status: response.status
      });

      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      this.logger.error('Failed to send data to Traxmate:', {
        deviceId: data.identifier,
        error: error.message,
        retryCount
      });

      // Retry logic with exponential backoff
      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        
        this.logger.info(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        await this.sleep(delay);
        return this.sendData(data, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        retryCount
      };
    }
  }

  shouldRetry(error) {
    // Retry on network errors or 5xx server errors
    const status = error.response?.status;
    return !status || (status >= 500 && status < 600);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendBatchData(dataArray) {
    const results = [];
    
    for (const data of dataArray) {
      const result = await this.sendData(data);
      results.push(result);
      
      // Add small delay between requests to avoid rate limiting
      await this.sleep(100);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    this.logger.info('Batch send completed:', {
      total: results.length,
      success: successCount,
      failures: failureCount
    });

    return results;
  }

  validateApiKey() {
    if (!this.apiKey) {
      throw new Error('TRAXMATE_API_KEY environment variable is required');
    }
    return true;
  }

  getServiceStatus() {
    return {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    };
  }
}

module.exports = TraxmateService; 