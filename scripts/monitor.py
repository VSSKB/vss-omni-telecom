#!/usr/bin/env python3
"""
VSS System Monitoring and Diagnostics
Version: 2.1.0
"""

import asyncio
import logging
import time
import json
import psutil
import requests
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class ServiceStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class ServiceHealth:
    name: str
    status: ServiceStatus
    response_time: float
    last_check: datetime
    error: Optional[str] = None

class VSSMonitor:
    """Comprehensive system monitoring and diagnostics"""
    
    def __init__(self, config_path: str = "/etc/vss/monitor.json"):
        self.config = self._load_config(config_path)
        self.setup_logging()
        self.health_history: Dict[str, List[ServiceHealth]] = {}
        
    def _load_config(self, config_path: str) -> Dict:
        """Load monitoring configuration"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Failed to load config: {e}")
            return {
                "services": {
                    "api": "http://localhost:3000/health",
                    "ottb": "http://localhost:8083/health",
                    "dci": "http://localhost:8082/health",
                    "workspace": "http://localhost:3000/health"
                },
                "intervals": {
                    "health_check": 30,
                    "metrics_collection": 15,
                    "alert_check": 60
                },
                "thresholds": {
                    "response_time": 2.0,
                    "cpu_usage": 80.0,
                    "memory_usage": 85.0,
                    "disk_usage": 90.0
                }
            }
    
    def setup_logging(self):
        """Setup structured logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('/var/log/vss/monitor.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger('vss-monitor')
    
    async def check_service_health(self, service_name: str, endpoint: str) -> ServiceHealth:
        """Check health of a single service"""
        start_time = time.time()
        
        try:
            response = requests.get(
                endpoint,
                timeout=10,
                headers={'User-Agent': 'VSS-Monitor/2.1.0'}
            )
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                status = ServiceStatus.HEALTHY
                if data.get('status') != 'healthy':
                    status = ServiceStatus.DEGRADED
            else:
                status = ServiceStatus.UNHEALTHY
            
            return ServiceHealth(
                name=service_name,
                status=status,
                response_time=response_time,
                last_check=datetime.now()
            )
            
        except requests.exceptions.RequestException as e:
            self.logger.warning(f"Health check failed for {service_name}: {e}")
            return ServiceHealth(
                name=service_name,
                status=ServiceStatus.UNHEALTHY,
                response_time=0.0,
                last_check=datetime.now(),
                error=str(e)
            )
    
    async def collect_system_metrics(self):
        """Collect system-level metrics"""
        try:
            metrics = {
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_percent': psutil.virtual_memory().percent,
                'memory_available': psutil.virtual_memory().available / (1024 ** 3),
                'disk_percent': psutil.disk_usage('/').percent,
                'disk_free': psutil.disk_usage('/').free / (1024 ** 3),
                'load_avg': psutil.getloadavg(),
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"System metrics: {json.dumps(metrics)}")
            return metrics
            
        except Exception as e:
            self.logger.error(f"Failed to collect system metrics: {e}")
            return {}
    
    async def check_thresholds(self):
        """Check metric thresholds and generate alerts"""
        alerts = []
        
        # Check CPU usage
        cpu_percent = psutil.cpu_percent()
        if cpu_percent > self.config['thresholds']['cpu_usage']:
            alerts.append({
                'severity': 'WARNING',
                'metric': 'cpu_usage',
                'value': cpu_percent,
                'threshold': self.config['thresholds']['cpu_usage'],
                'message': f'High CPU usage: {cpu_percent}%'
            })
        
        # Check memory usage
        memory_percent = psutil.virtual_memory().percent
        if memory_percent > self.config['thresholds']['memory_usage']:
            alerts.append({
                'severity': 'WARNING',
                'metric': 'memory_usage',
                'value': memory_percent,
                'threshold': self.config['thresholds']['memory_usage'],
                'message': f'High memory usage: {memory_percent}%'
            })
        
        # Process alerts
        for alert in alerts:
            self.logger.warning(f"Alert: {alert['message']}")
        
        return alerts
    
    async def run_health_checks(self):
        """Run health checks for all services"""
        tasks = []
        
        for service_name, endpoint in self.config['services'].items():
            task = asyncio.create_task(
                self.check_service_health(service_name, endpoint)
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        # Store in history
        for health in results:
            if health.name not in self.health_history:
                self.health_history[health.name] = []
            self.health_history[health.name].append(health)
            
            # Keep only last 100 checks
            if len(self.health_history[health.name]) > 100:
                self.health_history[health.name] = self.health_history[health.name][-100:]
        
        return results
    
    async def start_monitoring(self):
        """Main monitoring loop"""
        self.logger.info("Starting VSS monitoring system")
        
        while True:
            try:
                # Run all monitoring tasks concurrently
                await asyncio.gather(
                    self.run_health_checks(),
                    self.collect_system_metrics(),
                    self.check_thresholds(),
                    return_exceptions=True
                )
                
                # Wait for next interval
                await asyncio.sleep(self.config['intervals']['health_check'])
                
            except Exception as e:
                self.logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(10)  # Brief pause before retry
    
    def generate_report(self) -> Dict:
        """Generate monitoring report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'services': {},
            'system': {},
            'alerts': []
        }
        
        # Service health summary
        for service_name, checks in self.health_history.items():
            if checks:
                latest = checks[-1]
                report['services'][service_name] = {
                    'status': latest.status.value,
                    'response_time': latest.response_time,
                    'last_check': latest.last_check.isoformat()
                }
        
        # System metrics
        try:
            report['system'] = {
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent,
                'load_average': psutil.getloadavg()
            }
        except Exception as e:
            self.logger.error(f"Failed to get system metrics: {e}")
        
        return report

async def main():
    """Main entry point"""
    monitor = VSSMonitor()
    
    try:
        # Start monitoring in background
        monitor_task = asyncio.create_task(monitor.start_monitoring())
        
        # Keep running
        await monitor_task
        
    except KeyboardInterrupt:
        monitor.logger.info("Monitoring stopped by user")
    except Exception as e:
        monitor.logger.error(f"Monitoring failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())

