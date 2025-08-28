#!/bin/bash
# 05-setup-monitoring.sh
# 配置监控、日志和告警

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 配置监控和日志系统...${NC}"

# 检查集群连接
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ 无法连接到 K8s 集群${NC}"
    exit 1
fi

# 1. 安装 Prometheus Operator
echo -e "\n${YELLOW}📈 安装 Prometheus 监控...${NC}"

# 添加 Prometheus 社区 Helm repo
if ! helm repo list | grep prometheus-community &>/dev/null; then
    echo "添加 Prometheus Helm repository..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
fi

helm repo update

# 创建监控命名空间
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# 安装 kube-prometheus-stack
if ! helm list -n monitoring | grep kube-prometheus-stack &>/dev/null; then
    echo "安装 kube-prometheus-stack..."
    
    # 创建 values 配置
    cat > prometheus-values.yaml <<EOF
grafana:
  enabled: true
  adminPassword: "kortix-admin-2024"
  service:
    type: LoadBalancer
  persistence:
    enabled: true
    size: 10Gi
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
      - name: 'default'
        orgId: 1
        folder: ''
        type: file
        disableDeletion: false
        editable: true
        options:
          path: /var/lib/grafana/dashboards/default

prometheus:
  prometheusSpec:
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 20Gi
    retention: 7d
    resources:
      requests:
        memory: "2Gi"
        cpu: "500m"
      limits:
        memory: "4Gi" 
        cpu: "1000m"

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi

nodeExporter:
  enabled: true

kubeStateMetrics:
  enabled: true
EOF
    
    helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --values prometheus-values.yaml \
        --wait
        
    rm -f prometheus-values.yaml
else
    echo "kube-prometheus-stack 已安装"
fi

# 2. 配置应用指标收集
echo -e "\n${YELLOW}🔍 配置应用监控...${NC}"

# 创建 ServiceMonitor 来收集应用指标
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-api-metrics
  namespace: monitoring
  labels:
    app: backend-api
spec:
  selector:
    matchLabels:
      app: backend-api
  namespaceSelector:
    matchNames:
    - kortix-backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor  
metadata:
  name: redis-metrics
  namespace: monitoring
  labels:
    app: redis
spec:
  selector:
    matchLabels:
      app: redis
  namespaceSelector:
    matchNames:
    - kortix-backend
  endpoints:
  - port: redis
    interval: 30s
EOF

# 3. 安装日志收集 (Loki + Promtail)
echo -e "\n${YELLOW}📋 安装日志收集系统...${NC}"

# 添加 Grafana Helm repo
if ! helm repo list | grep grafana &>/dev/null; then
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
fi

# 安装 Loki
if ! helm list -n monitoring | grep loki &>/dev/null; then
    echo "安装 Loki..."
    helm install loki grafana/loki-stack \
        --namespace monitoring \
        --set loki.persistence.enabled=true \
        --set loki.persistence.size=20Gi \
        --set loki.persistence.storageClassName=gp3 \
        --wait
else
    echo "Loki 已安装"
fi

# 4. 创建自定义 Dashboard
echo -e "\n${YELLOW}📊 创建 Kortix Dashboard...${NC}"

# 创建 ConfigMap 包含 Dashboard JSON
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: kortix-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  kortix-dashboard.json: |
    {
      "dashboard": {
        "id": null,
        "title": "Kortix Application Monitoring",
        "tags": ["kortix", "api", "backend"],
        "timezone": "browser",
        "panels": [
          {
            "id": 1,
            "title": "API Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(http_requests_total{job=\"backend-api\"}[5m]))",
                "legendFormat": "Requests/sec"
              }
            ],
            "yAxes": [{"label": "req/sec"}],
            "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
          },
          {
            "id": 2,
            "title": "API Response Time",
            "type": "graph", 
            "targets": [
              {
                "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"backend-api\"}[5m])) by (le))",
                "legendFormat": "95th percentile"
              }
            ],
            "yAxes": [{"label": "seconds"}],
            "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
          },
          {
            "id": 3,
            "title": "Pod CPU Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(container_cpu_usage_seconds_total{namespace=\"kortix-backend\"}[5m])) by (pod)",
                "legendFormat": "{{pod}}"
              }
            ],
            "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
          },
          {
            "id": 4,
            "title": "Pod Memory Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(container_memory_usage_bytes{namespace=\"kortix-backend\"}) by (pod)",
                "legendFormat": "{{pod}}"
              }
            ],
            "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
          }
        ],
        "time": {"from": "now-1h", "to": "now"},
        "refresh": "5s"
      }
    }
EOF

# 5. 配置告警规则
echo -e "\n${YELLOW}🚨 配置告警规则...${NC}"

kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kortix-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
    release: kube-prometheus-stack
spec:
  groups:
  - name: kortix.rules
    rules:
    - alert: KortixAPIDown
      expr: up{job="backend-api"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Kortix API is down"
        description: "Backend API has been down for more than 1 minute"
        
    - alert: KortixHighLatency
      expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="backend-api"}[5m])) by (le)) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Kortix API high latency"
        description: "API 95th percentile latency is above 1 second"
        
    - alert: KortixHighCPU
      expr: sum(rate(container_cpu_usage_seconds_total{namespace="kortix-backend"}[5m])) by (pod) > 0.8
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Kortix pod high CPU usage"
        description: "Pod {{$labels.pod}} CPU usage is above 80%"
        
    - alert: KortixHighMemory
      expr: sum(container_memory_usage_bytes{namespace="kortix-backend"}) by (pod) / sum(container_spec_memory_limit_bytes{namespace="kortix-backend"}) by (pod) > 0.9
      for: 10m
      labels:
        severity: critical
      annotations:
        summary: "Kortix pod high memory usage"
        description: "Pod {{$labels.pod}} memory usage is above 90%"
        
    - alert: KortixRedisDown
      expr: up{job="redis"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Redis is down"
        description: "Redis has been down for more than 1 minute"
EOF

# 6. 等待服务启动并获取访问信息
echo -e "\n${YELLOW}⏳ 等待监控服务启动...${NC}"

kubectl wait --for=condition=ready --timeout=300s pod -l app.kubernetes.io/name=grafana -n monitoring

# 获取 Grafana 访问信息
GRAFANA_LB=$(kubectl get service kube-prometheus-stack-grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo -e "\n${GREEN}🎉 监控系统配置完成！${NC}"
echo "=================================="
echo "Grafana 访问信息："
if [ ! -z "$GRAFANA_LB" ]; then
    echo "URL: http://$GRAFANA_LB"
    echo "用户名: admin"
    echo "密码: kortix-admin-2024"
else
    echo "Grafana LoadBalancer 正在创建中..."
    echo "请稍等几分钟后运行："
    echo "kubectl get service kube-prometheus-stack-grafana -n monitoring"
fi

echo -e "\n其他监控组件："
echo "Prometheus: http://$GRAFANA_LB:9090"
echo "AlertManager: http://$GRAFANA_LB:9093"

# 保存监控信息
cat > monitoring-info.txt <<EOF
Kortix 监控系统访问信息
=======================

Grafana Dashboard:
URL: http://$GRAFANA_LB
Username: admin
Password: kortix-admin-2024

预置 Dashboard：
- Kubernetes Cluster Monitoring
- Node Exporter
- Kortix Application Monitoring (自定义)

有用的 Prometheus 查询：
# API 请求率
sum(rate(http_requests_total{job="backend-api"}[5m]))

# API 延迟 P95
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="backend-api"}[5m])) by (le))

# Pod CPU 使用率
sum(rate(container_cpu_usage_seconds_total{namespace="kortix-backend"}[5m])) by (pod)

# Pod 内存使用量
sum(container_memory_usage_bytes{namespace="kortix-backend"}) by (pod)

管理命令：
# 查看监控 Pod
kubectl get pods -n monitoring

# 重启 Grafana
kubectl rollout restart deployment/kube-prometheus-stack-grafana -n monitoring

# 查看告警规则
kubectl get prometheusrules -n monitoring

# 查看 ServiceMonitor
kubectl get servicemonitors -n monitoring
EOF

echo -e "\n${GREEN}📄 监控信息已保存到 monitoring-info.txt${NC}"

# 验证告警规则
echo -e "\n${BLUE}🔍 验证配置...${NC}"
echo "=== PrometheusRules ==="
kubectl get prometheusrules -n monitoring

echo -e "\n=== ServiceMonitors ==="
kubectl get servicemonitors -n monitoring

echo -e "\n=== Monitoring Pods ==="
kubectl get pods -n monitoring

echo -e "\n${GREEN}✅ 监控系统配置完成！${NC}"
echo "现在可以通过 Grafana 查看应用监控数据"