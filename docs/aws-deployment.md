# AWS Deployment Guide

This guide covers deploying the Traxmate Bridge middleware server to AWS using different approaches.

## 🎯 Recommended Approach: AWS Elastic Beanstalk

Elastic Beanstalk is the recommended deployment option for this application because:
- **WebSocket Support**: Handles persistent WebSocket connections out of the box
- **Auto-scaling**: Automatically scales based on load
- **Health Monitoring**: Built-in health checks and monitoring
- **Easy Deployment**: Simple deployment process with rollback capabilities
- **Cost Effective**: Pay only for the resources you use

## 📋 Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Install and configure AWS CLI
3. **EB CLI**: Install Elastic Beanstalk CLI
4. **Node.js**: Version 18+ for local development
5. **API Keys**: Cisco Spaces and Traxmate API credentials

### Install Required Tools

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install EB CLI
pip install awsebcli

# Configure AWS credentials
aws configure
```

## 🚀 Quick Deployment

### Option 1: Automated Script (Recommended)

1. **Set environment variables:**
   ```bash
   export CISCO_SPACES_ACCESS_TOKEN="your_cisco_token"
   export TRAXMATE_API_KEY="your_traxmate_key"
   ```

2. **Run deployment script:**
   ```bash
   ./scripts/deploy-aws.sh production
   ```

### Option 2: Manual Deployment

1. **Initialize EB application:**
   ```bash
   eb init traxmate-bridge --platform node.js --region us-east-1
   ```

2. **Create environment:**
   ```bash
   eb create traxmate-bridge-prod --instance-type t3.small --elb-type application
   ```

3. **Set environment variables:**
   ```bash
   eb setenv NODE_ENV=production
   eb setenv CISCO_SPACES_ACCESS_TOKEN=your_cisco_token
   eb setenv TRAXMATE_API_KEY=your_traxmate_key
   ```

4. **Deploy:**
   ```bash
   eb deploy
   ```

## 🏗️ Architecture Overview

```
Internet → Application Load Balancer → EC2 Instance(s) → Node.js Application
                                    ↓
                              Auto Scaling Group
                                    ↓
                              CloudWatch Monitoring
```

### Components

- **Application Load Balancer**: Routes traffic and handles WebSocket upgrades
- **EC2 Instances**: Run the Node.js application (t3.small recommended)
- **Auto Scaling Group**: Scales instances based on CPU/memory usage
- **CloudWatch**: Monitors application health and logs

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment | No | `production` |
| `PORT` | Application port | No | `8080` |
| `CISCO_SPACES_ACCESS_TOKEN` | Cisco API token | Yes | - |
| `TRAXMATE_API_KEY` | Traxmate API key | Yes | - |
| `CISCO_SPACES_FIREHOSE_URL` | Cisco Firehose URL | No | `https://api.cisco.com/spaces/firehose` |
| `TRAXMATE_INGESTION_URL` | Traxmate ingestion URL | No | `https://api.traxmate.io/v1/data/ingest` |
| `LOG_LEVEL` | Logging level | No | `info` |

### Instance Configuration

- **Instance Type**: t3.small (1 vCPU, 2 GB RAM)
- **Auto Scaling**: 1-3 instances
- **Health Check**: Enhanced monitoring enabled
- **Load Balancer**: Application Load Balancer with WebSocket support

## 🔧 Advanced Configuration

### Custom Domain Setup

1. **Register domain in Route 53** (or use existing domain)
2. **Create SSL certificate** in AWS Certificate Manager
3. **Update EB environment:**
   ```bash
   eb config
   # Add custom domain and SSL certificate configuration
   ```

### Database Integration (if needed)

For persistent storage, consider adding:
- **RDS**: For relational data
- **DynamoDB**: For NoSQL data
- **ElastiCache**: For caching

### Monitoring and Alerting

1. **CloudWatch Alarms:**
   - CPU utilization > 80%
   - Memory utilization > 80%
   - Health check failures

2. **SNS Notifications:**
   - Send alerts to email/SMS when alarms trigger

## 🔄 Alternative Deployment Options

### Option 1: AWS ECS with Fargate

For containerized deployment:

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t traxmate-bridge .
docker tag traxmate-bridge:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/traxmate-bridge:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/traxmate-bridge:latest
```

### Option 2: AWS Lambda (Not Recommended)

**Why not Lambda?**
- 15-minute timeout limit
- WebSocket connections need to stay alive indefinitely
- Cold start delays

### Option 3: EC2 with Auto Scaling

For full control over the infrastructure:

1. **Launch EC2 instances** with user data script
2. **Set up Application Load Balancer**
3. **Configure Auto Scaling Group**
4. **Set up CloudWatch monitoring**

## 📊 Monitoring and Logging

### CloudWatch Logs

Logs are automatically forwarded to CloudWatch:
- **Application logs**: `/aws/elasticbeanstalk/traxmate-bridge/var/log/nodejs/nodejs.log`
- **Nginx logs**: `/aws/elasticbeanstalk/traxmate-bridge/var/log/nginx/`

### Health Monitoring

- **Health Check Endpoint**: `GET /health`
- **Status Endpoint**: `GET /status`
- **Auto-scaling triggers**: CPU > 80% for 5 minutes

### Performance Metrics

Monitor these key metrics:
- **Response Time**: Average response time for health checks
- **Error Rate**: Percentage of failed requests
- **Connection Count**: Number of active WebSocket connections
- **Data Throughput**: Messages processed per minute

## 🔒 Security Considerations

### Network Security

- **Security Groups**: Restrict access to necessary ports only
- **VPC**: Deploy in private subnets with NAT gateway
- **WAF**: Web Application Firewall for additional protection

### Application Security

- **Environment Variables**: Store secrets securely
- **HTTPS**: Force HTTPS for all communications
- **Input Validation**: Validate all incoming data
- **Rate Limiting**: Implement rate limiting for API endpoints

### IAM Roles

Use least-privilege IAM roles:
- **EC2 Role**: Minimal permissions for application
- **EB Service Role**: Permissions for EB operations

## 💰 Cost Optimization

### Instance Sizing

- **Development**: t3.micro (free tier eligible)
- **Production**: t3.small (recommended)
- **High Load**: t3.medium or larger

### Auto Scaling

- **Scale Up**: CPU > 80% for 5 minutes
- **Scale Down**: CPU < 30% for 10 minutes
- **Cooldown**: 300 seconds between scaling actions

### Reserved Instances

For predictable workloads, consider Reserved Instances for cost savings.

## 🚨 Troubleshooting

### Common Issues

1. **WebSocket Connection Drops**
   - Check security group rules
   - Verify load balancer configuration
   - Review application logs

2. **High CPU Usage**
   - Check for memory leaks
   - Optimize data processing
   - Consider scaling up

3. **API Rate Limiting**
   - Implement exponential backoff
   - Add request queuing
   - Monitor API quotas

### Debug Commands

```bash
# View application logs
eb logs

# SSH into instance
eb ssh

# Check environment status
eb status

# View configuration
eb config
```

## 📈 Scaling Considerations

### Horizontal Scaling

- **Load Balancer**: Distributes traffic across instances
- **Session Management**: Stateless application design
- **Data Consistency**: Ensure data consistency across instances

### Vertical Scaling

- **Instance Types**: Upgrade to larger instance types
- **Memory Optimization**: Optimize Node.js memory usage
- **Database Scaling**: Scale database resources as needed

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to EB
        run: |
          pip install awsebcli
          eb deploy production
```

### AWS CodePipeline

1. **Source**: Connect to GitHub repository
2. **Build**: Build and test application
3. **Deploy**: Deploy to Elastic Beanstalk

## 📚 Additional Resources

- [AWS Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [Node.js on AWS Best Practices](https://aws.amazon.com/blogs/developer/node-js-best-practices/)
- [WebSocket Support in ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#target-type-instance) 