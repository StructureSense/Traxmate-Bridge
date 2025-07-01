# Traxmate Bridge - Cisco Spaces to Traxmate Middleware

A Node.js middleware server that receives Bluetooth telemetry data from Cisco Spaces Firehose API and forwards it to the Traxmate platform for visualization.

## 🏗️ Architecture

```
[Cisco Spaces Firehose API] ==> [Traxmate Bridge] ==> [Traxmate Ingestion API]
```

The middleware server:
1. **Receives** real-time telemetry data via WebSocket from Cisco Spaces
2. **Transforms** the data format to match Traxmate's requirements
3. **Forwards** the transformed data to Traxmate's ingestion API

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- AWS account (for deployment)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd Traxmate-Bridge
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your actual API keys and configuration
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Test the health endpoint:**
   ```bash
   curl http://localhost:8080/health
   ```

## 🏢 AWS Deployment

### Option 1: AWS Elastic Beanstalk (Recommended)

1. **Install AWS CLI and EB CLI:**
   ```bash
   pip install awscli awsebcli
   ```

2. **Initialize Elastic Beanstalk application:**
   ```bash
   eb init traxmate-bridge --platform node.js --region us-east-1
   ```

3. **Create environment:**
   ```bash
   eb create traxmate-bridge-prod --instance-type t3.small
   ```

4. **Set environment variables:**
   ```bash
   eb setenv CISCO_SPACES_ACCESS_TOKEN=your_token
   eb setenv TRAXMATE_API_KEY=your_key
   eb setenv NODE_ENV=production
   ```

5. **Deploy:**
   ```bash
   eb deploy
   ```

### Option 2: AWS ECS with Fargate

For containerized deployment, use the provided Dockerfile:

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t traxmate-bridge .
docker tag traxmate-bridge:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/traxmate-bridge:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/traxmate-bridge:latest
```

## 📁 Project Structure

```
Traxmate-Bridge/
├── src/
│   ├── app.js                 # Main application entry point
│   ├── services/
│   │   ├── ciscoService.js    # Cisco Spaces WebSocket client
│   │   └── traxmateService.js # Traxmate API client
│   ├── transformers/
│   │   └── dataTransformer.js # Data format conversion logic
│   └── utils/
│       ├── logger.js          # Logging configuration
│       └── coordinateMapper.js # Coordinate system conversion
├── docs/                      # Project documentation
├── .ebextensions/             # AWS Elastic Beanstalk configuration
├── package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CISCO_SPACES_ACCESS_TOKEN` | Cisco Spaces API access token | Yes |
| `TRAXMATE_API_KEY` | Traxmate API key | Yes |
| `NODE_ENV` | Environment (development/production) | No |
| `PORT` | Server port (default: 8080) | No |
| `LOG_LEVEL` | Logging level (default: info) | No |

### AWS Configuration

The application is configured for AWS Elastic Beanstalk with:
- **Instance Type:** t3.small (1 vCPU, 2 GB RAM)
- **Auto Scaling:** 1-3 instances
- **Health Checks:** Enhanced monitoring enabled
- **WebSocket Support:** Nginx proxy configuration included

## 📊 Monitoring

### Health Check Endpoint
```
GET /health
```
Returns application status, uptime, and environment information.

### Logging
- **File Logs:** `error.log` and `combined.log`
- **Console Logs:** Structured JSON format
- **AWS CloudWatch:** Automatic log forwarding in production

## 🔒 Security

- **Helmet.js:** Security headers
- **CORS:** Cross-origin request handling
- **Environment Variables:** No hardcoded secrets
- **Input Validation:** Server-side validation of all inputs

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Run with coverage
npm run test:coverage
```

## 📈 Performance

- **WebSocket Connection:** Persistent connection to Cisco Spaces
- **HTTP Keep-Alive:** Maintained connections to Traxmate API
- **Auto-Retry:** Exponential backoff for failed requests
- **Connection Pooling:** Efficient resource utilization

## 🚨 Troubleshooting

### Common Issues

1. **WebSocket Connection Drops**
   - Check Cisco Spaces API token validity
   - Verify network connectivity
   - Review application logs

2. **Traxmate API Errors**
   - Validate API key and permissions
   - Check data format compliance
   - Review rate limiting

3. **AWS Deployment Issues**
   - Verify environment variables are set
   - Check instance health status
   - Review CloudWatch logs

## 📚 Documentation

- [docs/architecture.md](docs/architecture.md) - System architecture
- [docs/technical.md](docs/technical.md) - Technical specifications
- [docs/tasks.md](docs/tasks.md) - Development tasks
- [docs/status.md](docs/status.md) - Project status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details 