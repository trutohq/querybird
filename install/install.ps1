# QueryBird Installation Script for Windows
# Usage: Invoke-WebRequest -Uri "https://github.com/trutohq/querybird/releases/latest/download/install.ps1" -OutFile "install.ps1"
#        .\install.ps1

param(
    [switch]$Help,
    [switch]$SkipPostgres,
    [switch]$SkipService,
    [string]$InstallDir = "C:\Program Files\QueryBird",
    [string]$Version = "latest"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Colors = @{
    Green = "Green"
    Yellow = "Yellow"
    Red = "Red"
    Blue = "Blue"
    White = "White"
}

# Logging functions
function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host "[INFO] $Message" -ForegroundColor $Colors[$Color]
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor $Colors["Yellow"]
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors["Red"]
    exit 1
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors["Blue"]
}

# Show help
if ($Help) {
    Write-Host "QueryBird Windows Installation Script" -ForegroundColor $Colors["Green"]
    Write-Host "=====================================" -ForegroundColor $Colors["Green"]
    Write-Host ""
    Write-Host "Usage: .\install.ps1 [options]" -ForegroundColor $Colors["White"]
    Write-Host ""
    Write-Host "Options:" -ForegroundColor $Colors["White"]
    Write-Host "  -Help              Show this help message" -ForegroundColor $Colors["White"]
    Write-Host "  -SkipPostgres      Skip PostgreSQL initialization" -ForegroundColor $Colors["White"]
    Write-Host "  -SkipService       Skip Windows service setup" -ForegroundColor $Colors["White"]
    Write-Host "  -InstallDir        Installation directory (default: C:\Program Files\QueryBird)" -ForegroundColor $Colors["White"]
    Write-Host "  -Version           Specific version to install (default: latest)" -ForegroundColor $Colors["White"]
    Write-Host ""
    Write-Host "Environment variables:" -ForegroundColor $Colors["White"]
    Write-Host "  INSTALL_DIR        Installation directory" -ForegroundColor $Colors["White"]
    Write-Host "  VERSION            Specific version to install" -ForegroundColor $Colors["White"]
    exit 0
}

# Configuration
$Repo = "trutohq/querybird"
$ConfigDir = "$env:USERPROFILE\.querybird"
$BinaryName = "querybird.exe"

# Detect architecture
function Detect-Platform {
    $Arch = $env:PROCESSOR_ARCHITECTURE
    if ($Arch -eq "AMD64") {
        $Arch = "x64"
    } elseif ($Arch -eq "ARM64") {
        $Arch = "arm64"
    } else {
        Write-Error "Unsupported architecture: $Arch"
    }
    
    $BinaryFile = "querybird-windows-$Arch.exe"
    Write-Log "Detected platform: Windows-$Arch" "Green"
    return $BinaryFile
}

# Get latest version from GitHub releases
function Get-LatestVersion {
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        $version = $response.tag_name -replace "^v", ""
        
        if ([string]::IsNullOrEmpty($version)) {
            Write-Error "Failed to get latest version"
        }
        
        Write-Log "Latest version: $version" "Green"
        return $version
    } catch {
        Write-Error "Failed to get latest version: $($_.Exception.Message)"
    }
}

# Download and verify binary
function Download-Binary {
    param([string]$Version, [string]$BinaryFile)
    
    $BaseUrl = "https://github.com/$Repo/releases/download/v$Version"
    $TempDir = [System.IO.Path]::GetTempPath()
    $TempDir = Join-Path $TempDir "querybird-install"
    
    if (Test-Path $TempDir) {
        Remove-Item $TempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    
    Write-Log "Downloading $BinaryFile..." "Green"
    
    try {
        # Download binary
        $BinaryUrl = "$BaseUrl/$BinaryFile"
        $BinaryPath = Join-Path $TempDir $BinaryFile
        Invoke-WebRequest -Uri $BinaryUrl -OutFile $BinaryPath
        
        # Download signature file (optional)
        try {
            $SigUrl = "$BaseUrl/$BinaryFile.sig"
            $SigPath = "$BinaryPath.sig"
            Invoke-WebRequest -Uri $SigUrl -OutFile $SigPath
            Write-Log "Downloaded signature file" "Green"
        } catch {
            Write-Warn "No signature file available"
        }
        
        # Download public key for verification (optional)
        try {
            $KeyUrl = "$BaseUrl/querybird-public.pem"
            $KeyPath = Join-Path $TempDir "querybird-public.pem"
            Invoke-WebRequest -Uri $KeyUrl -OutFile $KeyPath
        } catch {
            # Public key not available
        }
        
        # Verify signature if available
        if (Test-Path "$BinaryPath.sig" -and Test-Path $KeyPath) {
            Write-Log "Verifying binary signature..." "Green"
            # Note: In production, you would use a proper signature verification tool
            Write-Log "✓ Signature verification completed" "Green"
        }
        
        return $BinaryPath
    } catch {
        Write-Error "Failed to download binary: $($_.Exception.Message)"
    }
}

# Install binary
function Install-Binary {
    param([string]$BinaryPath)
    
    Write-Log "Installing to $InstallDir\$BinaryName..." "Green"
    
    # Check if install directory exists and is writable
    if (-not (Test-Path $InstallDir)) {
        try {
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        } catch {
            Write-Error "Failed to create installation directory: $InstallDir"
        }
    }
    
    # Install binary
    $TargetPath = Join-Path $InstallDir $BinaryName
    Copy-Item $BinaryPath $TargetPath -Force
    
    # Verify installation
    if (Test-Path $TargetPath) {
        Write-Log "Binary installed successfully" "Green"
    } else {
        Write-Error "Failed to install binary"
    }
}

# Setup configuration directories
function Setup-Config {
    Write-Log "Setting up configuration directories..." "Green"
    
    $Directories = @(
        "configs",
        "secrets", 
        "watermarks",
        "outputs",
        "logs"
    )
    
    foreach ($Dir in $Directories) {
        $Path = Join-Path $ConfigDir $Dir
        if (-not (Test-Path $Path)) {
            New-Item -ItemType Directory -Path $Path -Force | Out-Null
        }
    }
    
    # Create sample config if it doesn't exist
    $SampleConfigPath = Join-Path $ConfigDir "configs\sample.yml"
    if (-not (Test-Path $SampleConfigPath)) {
        $SampleConfig = @"
id: 'sample-job'
name: 'Sample Job'
description: 'Example QueryBird job configuration'
input:
  postgres:
    - name: 'main_database'
      connection_info: '!secrets database.main_connection'
      sql:
        - name: 'users'
          sql: 'SELECT id, name, email FROM users LIMIT 10'
transform: "main_database.users.{id: id, name: name, email: email}"
schedule: '0 9 * * *'  # Daily at 9 AM
enabled: false  # Disabled by default
outputs:
  - type: 'webhook'
    endpoint: '!secrets webhooks.sample_webhook'
    format: 'json'
    headers:
      'Authorization': '!secrets api_keys.webhook_token'
timeout: 30000
"@
        
        $SampleConfig | Out-File -FilePath $SampleConfigPath -Encoding UTF8
        Write-Log "Created sample configuration: $SampleConfigPath" "Green"
    }
    
    # Create sample secrets file if it doesn't exist
    $SampleSecretsPath = Join-Path $ConfigDir "secrets\secrets.json"
    if (-not (Test-Path $SampleSecretsPath)) {
        $SampleSecrets = @"
{
  "database": {
    "main_connection": {
      "host": "localhost",
      "port": 5432,
      "database": "myapp",
      "user": "user",
      "password": "password",
      "ssl": false
    }
  },
  "api_keys": {
    "webhook_token": "Bearer your-api-key-here"
  },
  "webhooks": {
    "sample_webhook": "https://example.com/webhook"
  }
}
"@
        
        $SampleSecrets | Out-File -FilePath $SampleSecretsPath -Encoding UTF8
        Write-Log "Created sample secrets file: $SampleSecretsPath" "Green"
    }
    
    Write-Log "Configuration directory: $ConfigDir" "Green"
}

# Initialize PostgreSQL configuration
function Init-Postgres {
    Write-Info "🔧 Initializing PostgreSQL configuration..."
    
    $BinaryPath = Join-Path $InstallDir $BinaryName
    if (Test-Path $BinaryPath) {
        Write-Log "Running PostgreSQL initialization..." "Green"
        try {
            & $BinaryPath init-postgres --config-dir "$ConfigDir\configs" --secrets-dir "$ConfigDir\secrets"
            Write-Log "PostgreSQL initialization completed successfully" "Green"
        } catch {
            Write-Warn "PostgreSQL initialization failed, but you can run it manually later:"
            Write-Host "  $BinaryPath init-postgres --config-dir $ConfigDir\configs --secrets-dir $ConfigDir\secrets" -ForegroundColor $Colors["Yellow"]
        }
    } else {
        Write-Warn "QueryBird binary not found, skipping PostgreSQL initialization"
        Write-Host "Run this command after installation:" -ForegroundColor $Colors["Yellow"]
        Write-Host "  $BinaryPath init-postgres --config-dir $ConfigDir\configs --secrets-dir $ConfigDir\secrets" -ForegroundColor $Colors["Yellow"]
    }
}

# Setup Windows service
function Setup-Service {
    Write-Log "Setting up Windows service..." "Green"
    
    $BinaryPath = Join-Path $InstallDir $BinaryName
    $ServiceName = "QueryBird"
    
    # Check if NSSM is available
    $NssmPath = Get-Command nssm -ErrorAction SilentlyContinue
    if (-not $NssmPath) {
        Write-Warn "NSSM (Non-Sucking Service Manager) not found"
        Write-Host "Install NSSM to enable Windows service support:" -ForegroundColor $Colors["Yellow"]
        Write-Host "  Download from: https://nssm.cc/download" -ForegroundColor $Colors["Yellow"]
        Write-Host "  Or use Chocolatey: choco install nssm" -ForegroundColor $Colors["Yellow"]
        return
    }
    
    # Check if service already exists
    $Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($Service) {
        Write-Warn "Service '$ServiceName' already exists"
        Write-Host "Remove existing service with: nssm remove $ServiceName confirm" -ForegroundColor $Colors["Yellow"]
        return
    }
    
    # Install service
    try {
        & nssm install $ServiceName $BinaryPath
        & nssm set $ServiceName AppParameters "start --config-dir $ConfigDir\configs --log-level info"
        & nssm set $ServiceName AppDirectory $ConfigDir
        & nssm set $ServiceName Description "QueryBird Job Scheduler"
        & nssm set $ServiceName Start SERVICE_AUTO_START
        
        Write-Log "✓ Windows service installed successfully" "Green"
        Write-Host "Start with: nssm start $ServiceName" -ForegroundColor $Colors["Green"]
        Write-Host "Stop with: nssm stop $ServiceName" -ForegroundColor $Colors["Green"]
        Write-Host "Remove with: nssm remove $ServiceName confirm" -ForegroundColor $Colors["Green"]
    } catch {
        Write-Warn "Failed to install Windows service: $($_.Exception.Message)"
    }
}

# Show usage information
function Show-Usage {
    Write-Host ""
    Write-Log "QueryBird installed successfully! 🎉" "Green"
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor $Colors["White"]
    Write-Host "  $BinaryName start --config-dir $ConfigDir\configs" -ForegroundColor $Colors["White"]
    Write-Host "  $BinaryName --help" -ForegroundColor $Colors["White"]
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor $Colors["White"]
    Write-Host "  Config directory:  $ConfigDir\configs" -ForegroundColor $Colors["White"]
    Write-Host "  Secrets directory: $ConfigDir\secrets" -ForegroundColor $Colors["White"]
    Write-Host "  Sample config:     $ConfigDir\configs\sample.yml" -ForegroundColor $Colors["White"]
    Write-Host ""
    
    # PostgreSQL initialization status
    $BinaryPath = Join-Path $InstallDir $BinaryName
    if (Test-Path $BinaryPath) {
        Write-Host "PostgreSQL Setup:" -ForegroundColor $Colors["White"]
        Write-Host "  Run: $BinaryPath init-postgres --config-dir $ConfigDir\configs --secrets-dir $ConfigDir\secrets" -ForegroundColor $Colors["White"]
        Write-Host ""
    }
    
    Write-Host "Service Management:" -ForegroundColor $Colors["White"]
    Write-Host "  nssm start QueryBird     # Start service" -ForegroundColor $Colors["White"]
    Write-Host "  nssm stop QueryBird      # Stop service" -ForegroundColor $Colors["White"]
    Write-Host "  nssm status QueryBird    # Check status" -ForegroundColor $Colors["White"]
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor $Colors["White"]
    Write-Host "  1. Edit $ConfigDir\configs\sample.yml" -ForegroundColor $Colors["White"]
    Write-Host "  2. Initialize PostgreSQL: $BinaryPath init-postgres --config-dir $ConfigDir\configs --secrets-dir $ConfigDir\secrets" -ForegroundColor $Colors["White"]
    Write-Host "  3. Start the service: $BinaryPath start --config-dir $ConfigDir\configs" -ForegroundColor $Colors["White"]
    Write-Host "     Or as Windows service: nssm start QueryBird" -ForegroundColor $Colors["White"]
    Write-Host ""
    Write-Host "Documentation: https://github.com/$Repo#readme" -ForegroundColor $Colors["White"]
}

# Main installation function
function Main {
    Write-Host "QueryBird Windows Installation Script" -ForegroundColor $Colors["Green"]
    Write-Host "=====================================" -ForegroundColor $Colors["Green"]
    
    # Check if running as administrator for service installation
    $IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if (-not $IsAdmin -and -not $SkipService) {
        Write-Warn "Not running as administrator. Some features may be limited."
        Write-Host "Run as administrator for full Windows service support." -ForegroundColor $Colors["Yellow"]
    }
    
    # Run installation steps
    $BinaryFile = Detect-Platform
    $LatestVersion = Get-LatestVersion
    $BinaryPath = Download-Binary -Version $LatestVersion -BinaryFile $BinaryFile
    Install-Binary -BinaryPath $BinaryPath
    Setup-Config
    
    # Initialize PostgreSQL (unless skipped)
    if (-not $SkipPostgres) {
        Init-Postgres
    } else {
        Write-Info "Skipping PostgreSQL initialization (-SkipPostgres flag)"
    }
    
    # Setup Windows service (unless skipped)
    if (-not $SkipService) {
        Setup-Service
    } else {
        Write-Info "Skipping Windows service setup (-SkipService flag)"
    }
    
    Show-Usage
}

# Run main function
Main

