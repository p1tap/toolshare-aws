<#
.SYNOPSIS
  Deletes ToolShare CloudFormation stacks in ap-southeast-1.

.DESCRIPTION
  Everything here is CloudFormation-managed, so teardown is just stack
  deletion — nothing was hand-created in the console. Run with -WhatIf
  to preview what would be deleted without touching anything.

.PARAMETER Stacks
  Which stacks to tear down. Defaults to staging + prod only, since the
  pipeline and artifact buckets are meant to stay up
  ($0 idle) between demo sessions. Pass -Stacks All to remove everything.

.PARAMETER Profile
  AWS CLI profile for the account that hosts ToolShare.

.PARAMETER WhatIf
  Preview only; makes no changes.
#>

param(
  [ValidateSet('AppOnly', 'All')]
  [string]$Stacks = 'AppOnly',

  [string]$Profile = 'toolshare2',

  [switch]$WhatIf
)

$Region = 'ap-southeast-1'
$env:AWS_PROFILE = $Profile

$appStacks = @('toolshare-staging', 'toolshare-prod')
$infraStacks = @('toolshare-pipeline')

$targets = if ($Stacks -eq 'All') { $appStacks + $infraStacks } else { $appStacks }

Write-Host "Region: $Region"
Write-Host "Stacks to delete: $($targets -join ', ')"

foreach ($stack in $targets) {
    $exists = aws cloudformation describe-stacks --stack-name $stack --region $Region 2>$null
    if (-not $exists) {
        Write-Host "  $stack -- not found, skipping"
        continue
    }

    if ($WhatIf) {
        Write-Host "  $stack -- WOULD DELETE (dry run)"
        continue
    }

    Write-Host "  $stack -- deleting..."
    aws cloudformation delete-stack --stack-name $stack --region $Region
    aws cloudformation wait stack-delete-complete --stack-name $stack --region $Region
    Write-Host "  $stack -- deleted"
}

if ($Stacks -eq 'AppOnly') {
    Write-Host ""
    Write-Host "Note: the pipeline and artifact buckets were left running (idle, `$0 cost)."
    Write-Host "Pass -Stacks All to remove those too."
}

Write-Host ""
Write-Host "Run scripts/audit.ps1 afterward to confirm nothing billable is left running."
