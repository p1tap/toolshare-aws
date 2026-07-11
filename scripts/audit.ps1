<#
.SYNOPSIS
  Lists every commonly-billable resource in ToolShare's ap-southeast-1
  region, plus yesterday's Cost Explorer total.

.DESCRIPTION
  Cost-discipline check to run at the end of any working session:
  confirms nothing hourly-billed (EC2, Fargate, ElastiCache, NAT
  Gateway, unattached EBS/EIP) is quietly running.

.PARAMETER Profile
  AWS CLI profile for the account that hosts ToolShare.
#>

param(
    [string]$Profile = 'toolshare2'
)

$env:AWS_PROFILE = $Profile
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $true
}

$Regions = @('ap-southeast-1')

foreach ($Region in $Regions) {
    Write-Host "=== $Region ===" -ForegroundColor Cyan

    Write-Host "-- EC2 instances (running/pending) --"
    aws ec2 describe-instances --region $Region `
        --filters "Name=instance-state-name,Values=running,pending" `
        --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name]' `
        --output table

    Write-Host "-- EBS volumes --"
    aws ec2 describe-volumes --region $Region `
        --query 'Volumes[].[VolumeId,Size,State]' `
        --output table

    Write-Host "-- Elastic IPs --"
    aws ec2 describe-addresses --region $Region `
        --query 'Addresses[].[PublicIp,AssociationId]' `
        --output table

    Write-Host "-- NAT Gateways --"
    aws ec2 describe-nat-gateways --region $Region `
        --filter "Name=state,Values=available,pending" `
        --query 'NatGateways[].[NatGatewayId,State]' `
        --output table

    Write-Host "-- ECS/Fargate services --"
    $clusters = aws ecs list-clusters --region $Region --query 'clusterArns' --output text
    if ($clusters) {
        foreach ($cluster in $clusters -split '\s+') {
            aws ecs list-tasks --region $Region --cluster $cluster --query 'taskArns' --output table
        }
    } else {
        Write-Host "  (no clusters)"
    }

    Write-Host "-- ElastiCache clusters --"
    aws elasticache describe-cache-clusters --region $Region `
        --query 'CacheClusters[].[CacheClusterId,CacheClusterStatus,CacheNodeType]' `
        --output table

    Write-Host ""
}

Write-Host "=== Cost Explorer: yesterday's total ===" -ForegroundColor Cyan
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$today = (Get-Date).ToString('yyyy-MM-dd')
aws ce get-cost-and-usage `
    --time-period "Start=$yesterday,End=$today" `
    --granularity DAILY `
    --metrics UnblendedCost `
    --query 'ResultsByTime[0].Total.UnblendedCost' `
    --output table
