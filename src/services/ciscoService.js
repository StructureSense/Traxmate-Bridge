const WebSocket = require('ws');
const axios = require('axios');
const winston = require('winston');

class CiscoSpacesService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'cisco-spaces' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async initialize() {
    try {
      // First, get the WebSocket URL from Cisco Spaces
      const firehoseUrl = await this.getFirehoseUrl();
      this.connect(firehoseUrl);
    } catch (error) {
      this.logger.error('Failed to initialize Cisco Spaces service:', error);
      throw error;
    }
  }

  async getFirehoseUrl() {
    try {
      const response = await axios.get(process.env.CISCO_SPACES_FIREHOSE_URL, {
        headers: {
          'Authorization': `Bearer ${process.env.CISCO_SPACES_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.websocketUrl) {
        this.logger.info('Retrieved WebSocket URL from Cisco Spaces');
        return response.data.websocketUrl;
      } else {
        throw new Error('Invalid response from Cisco Spaces API');
      }
    } catch (error) {
      this.logger.error('Failed to get Firehose URL:', error);
      throw error;
    }
  }

  connect(websocketUrl) {
    try {
      this.ws = new WebSocket(websocketUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.CISCO_SPACES_ACCESS_TOKEN}`
        }
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('Connected to Cisco Spaces WebSocket');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (error) {
          this.logger.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.logger.warn(`WebSocket connection closed: ${code} - ${reason}`);
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.isConnected = false;
      });

    } catch (error) {
      this.logger.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  handleMessage(message) {
    try {
      // Only process BLE_DEVICES events
      if (message.eventType === 'BLE_DEVICES') {
        this.logger.info('Received BLE device data:', {
          deviceId: message.deviceId,
          lastSeen: message.lastSeen,
          rssi: message.rssi
        });

        // Emit event for data processing
        this.emit('bleData', message);
      } else {
        this.logger.debug('Received non-BLE event:', message.eventType);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      this.logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(async () => {
        try {
          const firehoseUrl = await this.getFirehoseUrl();
          this.connect(firehoseUrl);
        } catch (error) {
          this.logger.error('Reconnect failed:', error);
          this.scheduleReconnect();
        }
      }, delay);
    } else {
      this.logger.error('Max reconnect attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.logger.info('Disconnected from Cisco Spaces WebSocket');
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

module.exports = CiscoSpacesService; 