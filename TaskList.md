### Project: Cisco Spaces to Traxmate Middleware Server

This document outlines the strategy, architecture, and steps required to build a middleware application that receives Bluetooth telemetry data from the Cisco Spaces Firehose API and forwards it to the Traxmate platform for visualization.

### 1\. Conceptual Overview

The fundamental goal is to create a data pipeline. The flow of data will look like this:

\[Cisco Spaces Firehose API\] \==\> \[Your Middleware Server\] \==\> \[Traxmate Ingestion API\]

The role of your middleware server is to:

1. **Receive:** Establish a persistent connection to the Cisco Spaces Firehose to receive a real-time stream of telemetry data.  
2. **Transform:** Parse the incoming Cisco data, extract the necessary fields, and re-format it into the structure that the Traxmate API expects.  
3. **Forward:** Send the transformed data to the appropriate Traxmate API endpoint.

### Phase 1: Investigation & Planning (Completed)

This phase involved researching the specific API requirements for both Cisco Spaces and Traxmate. The findings are summarized below.

#### A. Cisco Spaces Firehose API Details

* **Authentication:** Uses a **Partner API Access Token**. This token must be sent in the request header as Authorization: Bearer \<YOUR\_ACCESS\_TOKEN\>.  
* **Connection Method:** A persistent **WebSocket** connection. The specific WebSocket URL is obtained by first making an authenticated HTTP GET request to a Firehose setup endpoint provided by Cisco.  
* **Data Structure:** The API streams JSON objects. A key event type is BLE\_DEVICES, which has the following structure:  
  {  
    "eventType": "BLE\_DEVICES",  
    "deviceId": "aa:bb:cc:dd:ee:ff",  
    "lastSeen": "2023-10-27T18:30:00.123Z",  
    "locationCoordinate": {  
      "x": 55.1,  
      "y": 120.4,  
      "unit": "FEET"  
    },  
    "locationHierarchy": "USA\>Texas\>Austin\>Building1\>Floor2",  
    "rssi": \-75  
  }

#### B. Traxmate API Details

* **Ingestion Endpoint:** Data should be sent via an HTTP POST request to https://api.traxmate.io/v1/data/ingest.  
* **Authentication:** Uses an **API Key**. The key must be sent in the request header as X-API-Key: \<YOUR\_TRAXMATE\_API\_KEY\>.  
* **Data Structure:** Traxmate expects a JSON object with a specific format.  
  {  
    "identifier": "aa:bb:cc:dd:ee:ff",  
    "timestamp": 1698431400,  
    "latitude": 30.2672,  
    "longitude": \-97.7431,  
    "source": "Cisco Spaces Middleware",  
    "properties": {  
      "rssi": \-75  
    }  
  }

#### C. Data Mapping & Transformation Plan

This is the core logic for the middleware.

| Cisco Spaces Field | Traxmate Field | Transformation Logic |
| :---- | :---- | :---- |
| deviceId | identifier | Direct mapping. |
| lastSeen | timestamp | **Format Conversion Required.** The Cisco ISO 8601 string ("2023-10-27T18:30:00.123Z") must be parsed and converted into a Unix epoch timestamp in seconds (e.g., 1698431400). |
| locationCoordinate.x, locationCoordinate.y, locationHierarchy | longitude, latitude | **Coordinate System Conversion Required.** This is the most complex step. A function must be created to convert the floor-relative X/Y coordinates from Cisco into real-world Latitude and Longitude. This requires a predefined mapping of each floor's geographic origin point. |
| rssi | properties.rssi | Map the rssi value directly into the nested properties object. |
| (Static Value) | source | Set a static string, such as "Cisco Spaces Middleware", for every request sent to Traxmate to identify the data origin. |

#### D. Choose Your Technology Stack

* **Language/Framework:** **Node.js with Express** is recommended due to its excellent support for real-time I/O and WebSocket handling.  
* **Hosting:** A **Platform-as-a-Service (PaaS) like Heroku or AWS Elastic Beanstalk** is recommended for ease of deployment and management for a long-running server process.

### Phase 2: Development

Here are the logical steps for building the application.

1. **Setup Project:** Initialize your Node.js project (npm init), and install necessary libraries (axios for HTTP calls, ws for WebSockets, express for a simple web server).  
2. **Connect to Cisco Firehose:**  
   * Write a module that establishes and maintains a WebSocket connection.  
   * Implement logic to handle authentication and auto-reconnect if the connection drops.  
3. **Process Incoming Messages:**  
   * On message receipt, parse the JSON.  
   * Call transformation functions to convert the timestamp and coordinates.  
   * Construct the new JSON object in the format Traxmate expects.  
4. **Send Data to Traxmate:**  
   * Use axios to make a POST request to the Traxmate ingestion API.  
   * Set the Content-Type and X-API-Key headers correctly.  
   * Send the transformed JSON object as the request body.  
5. **Implement Robust Error Handling & Logging:**  
   * Log all major events: connection status, messages processed, and errors.  
   * Implement a retry mechanism with exponential backoff for failed requests to Traxmate.

### Phase 3: Deployment & Monitoring

1. **Use Environment Variables:** **Do not hardcode API keys**. Use environment variables (process.env in Node.js) to store secrets.  
2. **Deploy:** Deploy your application to your chosen hosting platform.  
3. **Process Management:** Use a process manager like **PM2** to keep your application running continuously.  
4. **Monitoring:** Create a simple health check endpoint (e.g., /health) that returns a 200 OK status so an external service can monitor if your server is alive.