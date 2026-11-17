param([string]$SdkRoot=$env:ANDROID_HOME,[string]$GradleExe='gradle')
$ErrorActionPreference='Stop'
if (!$SdkRoot -or !(Test-Path -LiteralPath (Join-Path $SdkRoot 'platforms\android-35\android.jar')) -or !(Test-Path -LiteralPath (Join-Path $SdkRoot 'build-tools\35.0.0\apksigner.bat')) -or !(Test-Path -LiteralPath (Join-Path $SdkRoot 'licenses\android-sdk-license'))) {
    throw 'Android SDK 35 / Build Tools 35.0.0 / user-accepted license missing. No license was accepted and no SDK was installed. Review official Android SDK terms and install first.'
}
Push-Location $PSScriptRoot
try {
    $env:ANDROID_HOME=$SdkRoot
    & $GradleExe --no-daemon assembleDebug lintDebug
    if($LASTEXITCODE -ne 0){throw 'Android build/check failed'}
    $apk=Join-Path $PSScriptRoot 'app\build\outputs\apk\debug\app-debug.apk'
    & (Join-Path $SdkRoot 'build-tools\35.0.0\apksigner.bat') verify --verbose --print-certs $apk
    if($LASTEXITCODE -ne 0){throw 'APK signature verification failed'}
    Get-FileHash -LiteralPath $apk -Algorithm SHA256
} finally {Pop-Location}
