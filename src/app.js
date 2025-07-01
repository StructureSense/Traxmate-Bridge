const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');
const EventEmitter = require('events');
require('dotenv').config();

// Import services
const CiscoSpacesService = require('./services/ciscoService');
const TraxmateService = require('./services/traxmateService');
const DataTransformer = require('./transformers/dataTransformer');

const app = express();
const PORT = process.env.PORT || 8080;

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'traxmate-bridge' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize services
const ciscoService = new CiscoSpacesService();
const traxmateService = new TraxmateService();
const dataTransformer = new DataTransformer();

// Event emitter for service communication
const eventEmitter = new EventEmitter();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint for AWS monitoring
app.get('/health', (req, res) => {
  const ciscoStatus = ciscoService.getConnectionStatus();
  const traxmateStatus = traxmateService.getServiceStatus();
  
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      cisco: ciscoStatus,
      traxmate: traxmateStatus
    }
  });
});

// Status endpoint for detailed service information
app.get('/status', (req, res) => {
  res.json({
    cisco: ciscoService.getConnectionStatus(),
    traxmate: traxmateService.getServiceStatus(),
    floorMappings: dataTransformer.getFloorMappings()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Cisco Spaces to Traxmate Middleware Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      status: '/status'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize the data pipeline
async function initializePipeline() {
  try {
    // Validate environment variables
    if (!process.env.CISCO_SPACES_ACCESS_TOKEN) {
      throw new Error('CISCO_SPACES_ACCESS_TOKEN environment variable is required');
    }
    
    if (!process.env.TRAXMATE_API_KEY) {
      throw new Error('TRAXMATE_API_KEY environment variable is required');
    }

    // Initialize Cisco Spaces service
    await ciscoService.initialize();
    
    // Set up event listeners for data processing
    ciscoService.on('bleData', async (ciscoData) => {
      try {
        // Transform the data
        const traxmateData = dataTransformer.transformCiscoToTraxmate(ciscoData);
        
        if (traxmateData && dataTransformer.validateTraxmateData(traxmateData)) {
          // Send to Traxmate
          const result = await traxmateService.sendData(traxmateData);
          
          if (!result.success) {
            logger.error('Failed to send data to Traxmate:', result);
          }
        } else {
          logger.warn('Transformed data validation failed:', traxmateData);
        }
      } catch (error) {
        logger.error('Error processing BLE data:', error);
      }
    });

    logger.info('Data pipeline initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize data pipeline:', error);
    process.exit(1);
  }
}

// Start server
app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize the data pipeline after server starts
  await initializePipeline();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  ciscoService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  ciscoService.disconnect();
  process.exit(0);
});

module.exports = app; 