#!/bin/bash
# verify-permissions.sh
# 验证权限是否添加成功

echo "🔍 验证 AWS 权限..."

echo "当前用户："
aws sts get-caller-identity

echo -e "\n当前用户权限："
aws iam list-attached-user-policies --user-name GQ

echo -e "\n测试 EKS 权限："
aws eks describe-cluster-versions --region us-west-2 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ EKS 权限正常"
else
    echo "❌ EKS 权限不足"
fi

echo -e "\n测试 EC2 权限："
aws ec2 describe-regions --region us-west-2 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ EC2 权限正常"
else
    echo "❌ EC2 权限不足"
fi

echo -e "\n如果都显示 ✅，则可以继续创建 EKS 集群"