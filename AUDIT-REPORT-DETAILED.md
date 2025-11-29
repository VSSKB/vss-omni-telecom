# VSS DEMIURGE Comprehensive System Audit Report

Generated: 2025-11-28T00:33:46.136Z

## Summary

- **Total Tests**: 10
- **Passed**: 2
- **Failed**: 8
- **Errors**: 0
- **Success Rate**: 20.0%

## Test Results

### 1. Admin Backend Health

**Status**: FAIL  
**Duration**: 38ms  
**Description**: Verify admin backend service is running and healthy on port 8181

**Message**: Admin backend returned status 404

---

### 2. Main Backend API

**Status**: FAIL  
**Duration**: 5ms  
**Description**: Verify main backend service is running and responding on port 3001

**Message**: Main backend not accessible: 

---

### 3. Workspace Service Health

**Status**: FAIL  
**Duration**: 2ms  
**Description**: Verify workspace microservice is running and healthy on port 3000

**Message**: Workspace service not accessible: 

---

### 4. DCI Service Health

**Status**: FAIL  
**Duration**: 4ms  
**Description**: Verify DCI (Device Control Interface) service is running on port 3002

**Message**: DCI service not accessible: 

---

### 5. OTTB Service Health

**Status**: FAIL  
**Duration**: 3ms  
**Description**: Verify OTTB (Over-The-Top Broadband) service is running on port 3003

**Message**: OTTB service not accessible: 

---

### 6. Database Connectivity

**Status**: FAIL  
**Duration**: 1ms  
**Description**: Verify PostgreSQL database connectivity through backend API

**Message**: Database connectivity test failed: 

---

### 7. RabbitMQ Connectivity

**Status**: FAIL  
**Duration**: 8ms  
**Description**: Verify RabbitMQ message broker is accessible and responding

**Message**: RabbitMQ not accessible: socket hang up

---

### 8. Authentication System

**Status**: PASS  
**Duration**: 39ms  
**Description**: Verify authentication database and user management system is functional

**Message**: Authentication database is initialized and accessible

---

### 9. Docker Services Status

**Status**: FAIL  
**Duration**: 332ms  
**Description**: Verify all required Docker containers (PostgreSQL, Redis, RabbitMQ) are running

**Message**: Missing Docker services: redis

**Details**:
```json
{
  "runningContainers": 25,
  "services": [
    "k8s_storage-provisioner_storage-provisioner_kube-system_729d3d7e-a6a0-454c-8e67-fd9dd4e43e2c_12                     Up 6 minutes                    ",
    "k8s_coredns_coredns-66bc5c9577-tpxhn_kube-system_9e74b3f0-9bb9-4497-b176-c3c496dddba8_6                             Up 7 minutes                    ",
    "k8s_coredns_coredns-66bc5c9577-476r2_kube-system_b78bc37b-6df2-414d-808a-b5863acf48f1_6                             Up 7 minutes                    ",
    "k8s_vpnkit-controller_vpnkit-controller_kube-system_b8be33d2-1fb1-484f-aba6-0c3b0d641668_6                          Up 7 minutes                    ",
    "k8s_kube-proxy_kube-proxy-zjj7j_kube-system_7422a759-108b-413a-ac2e-3bf11f47ebbe_6                                  Up 7 minutes                    ",
    "k8s_POD_coredns-66bc5c9577-tpxhn_kube-system_9e74b3f0-9bb9-4497-b176-c3c496dddba8_6                                 Up 7 minutes                    ",
    "k8s_POD_vpnkit-controller_kube-system_b8be33d2-1fb1-484f-aba6-0c3b0d641668_6                                        Up 7 minutes                    ",
    "k8s_POD_storage-provisioner_kube-system_729d3d7e-a6a0-454c-8e67-fd9dd4e43e2c_6                                      Up 7 minutes                    ",
    "k8s_POD_coredns-66bc5c9577-476r2_kube-system_b78bc37b-6df2-414d-808a-b5863acf48f1_6                                 Up 7 minutes                    ",
    "k8s_POD_kube-proxy-zjj7j_kube-system_7422a759-108b-413a-ac2e-3bf11f47ebbe_6                                         Up 7 minutes                    ",
    "k8s_kube-scheduler_kube-scheduler-docker-desktop_kube-system_b44739859c757a4712b786569a89a1f3_6                     Up 7 minutes                    ",
    "k8s_kube-apiserver_kube-apiserver-docker-desktop_kube-system_647244f1c75810d936baf4253b7903ef_6                     Up 7 minutes                    ",
    "k8s_POD_kube-scheduler-docker-desktop_kube-system_b44739859c757a4712b786569a89a1f3_6                                Up 7 minutes                    ",
    "k8s_kube-controller-manager_kube-controller-manager-docker-desktop_kube-system_10b0d524eef4b9a12d5827ba17a36f4f_9   Up 7 minutes                    ",
    "k8s_POD_kube-apiserver-docker-desktop_kube-system_647244f1c75810d936baf4253b7903ef_6                                Up 7 minutes                    ",
    "k8s_etcd_etcd-docker-desktop_kube-system_0b753cb7812d40a401f3a8f63b18f779_6                                         Up 7 minutes                    ",
    "k8s_POD_kube-controller-manager-docker-desktop_kube-system_10b0d524eef4b9a12d5827ba17a36f4f_6                       Up 7 minutes                    ",
    "k8s_POD_etcd-docker-desktop_kube-system_0b753cb7812d40a401f3a8f63b18f779_6                                          Up 7 minutes                    ",
    "vss-dci                                                                                                             Up 8 minutes (healthy)          0.0.0.0:8082->8082/tcp, [::]:8082->8082/tcp",
    "vss-ottb                                                                                                            Up 8 minutes (healthy)          0.0.0.0:8083->8083/tcp, [::]:8083->8083/tcp",
    "vss-point                                                                                                           Up 8 minutes (healthy)          0.0.0.0:8081->8081/tcp, [::]:8081->8081/tcp",
    "vss-guacamole                                                                                                       Restarting (1) 10 seconds ago   ",
    "vss-rabbitmq                                                                                                        Up 44 seconds (healthy)         0.0.0.0:5672->5672/tcp, [::]:5672->5672/tcp, 0.0.0.0:15672->15672/tcp, [::]:15672->15672/tcp",
    "vss-postgres                                                                                                        Up 8 minutes (healthy)          0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp",
    "vss-guacd                                                                                                           Up 8 minutes (healthy)          4822/tcp"
  ],
  "missing": [
    "redis"
  ]
}
```

---

### 10. Configuration Files Integrity

**Status**: PASS  
**Duration**: 3ms  
**Description**: Verify all configuration files exist and have valid syntax

**Message**: All configuration files are present and valid

**Details**:
```json
{
  "checkedFiles": 6
}
```

---

