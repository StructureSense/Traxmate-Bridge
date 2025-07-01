const winston = require('winston');

class DataTransformer {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'data-transformer' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Floor coordinate mappings - these need to be configured per deployment
    this.floorMappings = {
      'USA>Texas>Austin>Building1>Floor2': {
        originLat: 30.2672,
        originLng: -97.7431,
        scaleFactor: 0.00001 // Adjust based on your coordinate system
      }
      // Add more floor mappings as needed
    };
  }

  transformCiscoToTraxmate(ciscoData) {
    try {
      // Validate input data
      if (!this.validateCiscoData(ciscoData)) {
        throw new Error('Invalid Cisco data format');
      }

      // Transform the data
      const traxmateData = {
        identifier: ciscoData.deviceId,
        timestamp: this.convertTimestamp(ciscoData.lastSeen),
        latitude: this.convertLatitude(ciscoData),
        longitude: this.convertLongitude(ciscoData),
        source: 'Cisco Spaces Middleware',
        properties: {
          rssi: ciscoData.rssi,
          locationHierarchy: ciscoData.locationHierarchy,
          unit: ciscoData.locationCoordinate?.unit || 'FEET'
        }
      };

      this.logger.debug('Transformed data:', {
        original: ciscoData,
        transformed: traxmateData
      });

      return traxmateData;

    } catch (error) {
      this.logger.error('Data transformation failed:', {
        error: error.message,
        inputData: ciscoData
      });
      throw error;
    }
  }

  validateCiscoData(data) {
    const requiredFields = ['eventType', 'deviceId', 'lastSeen'];
    const hasRequiredFields = requiredFields.every(field => data[field]);
    
    if (!hasRequiredFields) {
      this.logger.warn('Missing required fields in Cisco data:', {
        required: requiredFields,
        received: Object.keys(data)
      });
      return false;
    }

    if (data.eventType !== 'BLE_DEVICES') {
      this.logger.warn('Unexpected event type:', data.eventType);
      return false;
    }

    return true;
  }

  convertTimestamp(isoString) {
    try {
      const date = new Date(isoString);
      const timestamp = Math.floor(date.getTime() / 1000); // Convert to Unix timestamp in seconds
      
      if (isNaN(timestamp)) {
        throw new Error('Invalid timestamp format');
      }

      return timestamp;
    } catch (error) {
      this.logger.error('Timestamp conversion failed:', {
        input: isoString,
        error: error.message
      });
      throw error;
    }
  }

  convertLatitude(ciscoData) {
    return this.convertCoordinate(ciscoData, 'latitude');
  }

  convertLongitude(ciscoData) {
    return this.convertCoordinate(ciscoData, 'longitude');
  }

  convertCoordinate(ciscoData, coordinateType) {
    try {
      const locationCoord = ciscoData.locationCoordinate;
      const locationHierarchy = ciscoData.locationHierarchy;

      if (!locationCoord || !locationHierarchy) {
        this.logger.warn('Missing coordinate data:', {
          hasLocationCoord: !!locationCoord,
          hasLocationHierarchy: !!locationHierarchy
        });
        return null;
      }

      // Get floor mapping
      const floorMapping = this.floorMappings[locationHierarchy];
      if (!floorMapping) {
        this.logger.warn('No floor mapping found for:', locationHierarchy);
        return null;
      }

      // Convert X/Y coordinates to lat/lng
      let coordinate;
      if (coordinateType === 'latitude') {
        coordinate = floorMapping.originLat + (locationCoord.y * floorMapping.scaleFactor);
      } else {
        coordinate = floorMapping.originLng + (locationCoord.x * floorMapping.scaleFactor);
      }

      // Validate coordinate
      if (isNaN(coordinate)) {
        throw new Error(`Invalid ${coordinateType} calculation`);
      }

      return coordinate;

    } catch (error) {
      this.logger.error(`${coordinateType} conversion failed:`, {
        error: error.message,
        inputData: ciscoData
      });
      return null;
    }
  }

  addFloorMapping(locationHierarchy, originLat, originLng, scaleFactor = 0.00001) {
    this.floorMappings[locationHierarchy] = {
      originLat,
      originLng,
      scaleFactor
    };

    this.logger.info('Added floor mapping:', {
      locationHierarchy,
      originLat,
      originLng,
      scaleFactor
    });
  }

  getFloorMappings() {
    return this.floorMappings;
  }

  validateTraxmateData(data) {
    const requiredFields = ['identifier', 'timestamp', 'latitude', 'longitude', 'source'];
    const hasRequiredFields = requiredFields.every(field => data[field]);
    
    if (!hasRequiredFields) {
      this.logger.warn('Missing required fields in Traxmate data:', {
        required: requiredFields,
        received: Object.keys(data)
      });
      return false;
    }

    // Validate timestamp
    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      this.logger.warn('Invalid timestamp:', data.timestamp);
      return false;
    }

    // Validate coordinates
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      this.logger.warn('Invalid coordinates:', {
        latitude: data.latitude,
        longitude: data.longitude
      });
      return false;
    }

    return true;
  }

  transformBatch(ciscoDataArray) {
    const results = [];
    const errors = [];

    for (const ciscoData of ciscoDataArray) {
      try {
        const traxmateData = this.transformCiscoToTraxmate(ciscoData);
        if (this.validateTraxmateData(traxmateData)) {
          results.push(traxmateData);
        } else {
          errors.push({
            type: 'validation_error',
            data: ciscoData,
            message: 'Transformed data failed validation'
          });
        }
      } catch (error) {
        errors.push({
          type: 'transformation_error',
          data: ciscoData,
          message: error.message
        });
      }
    }

    this.logger.info('Batch transformation completed:', {
      total: ciscoDataArray.length,
      successful: results.length,
      errors: errors.length
    });

    return {
      results,
      errors
    };
  }
}

module.exports = DataTransformer; 