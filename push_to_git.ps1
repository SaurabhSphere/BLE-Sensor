# BLE Sensor Git Push Automation Script
# Remote repository: https://github.com/SaurabhSphere/BLE-Sensor.git

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   BLE Sense Ecosystem Git Automation & Push Script       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$RemoteUri = "https://github.com/SaurabhSphere/BLE-Sensor.git"

# Check if git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed or not in your PATH. Please install Git and try again."
    Exit
}

# 1. Initialize Git Repo if not exists
if (!(Test-Path .git)) {
    Write-Host "[1/6] Initializing local Git repository..." -ForegroundColor Yellow
    git init
} else {
    Write-Host "[1/6] Git repository already initialized." -ForegroundColor Green
}

# 2. Configure Remote URL
Write-Host "[2/6] Configuring remote origin to $RemoteUri ..." -ForegroundColor Yellow
$ExistingRemote = git remote get-url origin 2>$null
if ($ExistingRemote) {
    git remote set-url origin $RemoteUri
} else {
    git remote add origin $RemoteUri
}
Write-Host "Remote origin set successfully." -ForegroundColor Green

# 3. Commit files to main branch
Write-Host "[3/6] Staging files for commit..." -ForegroundColor Yellow
git add .

Write-Host "Creating initial commit on branch 'main'..." -ForegroundColor Yellow
git commit -m "feat: initial commit of the full BLE Sense Ecosystem" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Commit created successfully." -ForegroundColor Green
} else {
    Write-Host "No new changes to commit or commit already exists." -ForegroundColor Gray
}

# 4. Push Main Branch
Write-Host "[4/6] Pushing code to 'main' branch on GitHub..." -ForegroundColor Yellow
git checkout -b main 2>$null
git push -u origin main --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push main branch. Please ensure your remote repository is empty and you have write permissions." -ForegroundColor Red
    Exit
}
Write-Host "✓ Main branch pushed successfully!" -ForegroundColor Green

# 5. Push Mobile Subtree
Write-Host "[5/6] Splitting and pushing 'Mobile' subdirectory to 'mobile' branch..." -ForegroundColor Yellow
git subtree push --prefix=Mobile origin mobile
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Mobile branch pushed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to push mobile subtree branch. Retrying with alternative force-push method..." -ForegroundColor Yellow
    # Alternative split method if subtree push fails:
    git branch -D temp-mobile 2>$null
    git subtree split --prefix=Mobile -b temp-mobile
    git push origin temp-mobile:mobile --force
    git branch -D temp-mobile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Mobile branch force-pushed successfully using split method!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to push mobile branch." -ForegroundColor Red
    }
}

# 6. Push Backend Subtree
Write-Host "[6/6] Splitting and pushing 'backend' subdirectory to 'backend' branch..." -ForegroundColor Yellow
git subtree push --prefix=backend origin backend
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend branch pushed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to push backend subtree branch. Retrying with alternative force-push method..." -ForegroundColor Yellow
    git branch -D temp-backend 2>$null
    git subtree split --prefix=backend -b temp-backend
    git push origin temp-backend:backend --force
    git branch -D temp-backend
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backend branch force-pushed successfully using split method!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to push backend branch." -ForegroundColor Red
    }
}

# 7. Push Dashboard Subtree
Write-Host "[7/6] Splitting and pushing 'web-dashboard' subdirectory to 'dashboard' branch..." -ForegroundColor Yellow
git subtree push --prefix=web-dashboard origin dashboard
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dashboard branch pushed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to push dashboard subtree branch. Retrying with alternative force-push method..." -ForegroundColor Yellow
    git branch -D temp-dashboard 2>$null
    git subtree split --prefix=web-dashboard -b temp-dashboard
    git push origin temp-dashboard:dashboard --force
    git branch -D temp-dashboard
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dashboard branch force-pushed successfully using split method!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to push dashboard branch." -ForegroundColor Red
    }
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Git Push Operations Completed! Check GitHub.          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
