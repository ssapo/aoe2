# ENG-25: runs a bash command line in Git Bash detached, with E5_EXE set. usage: -Exe census_X.exe -Cmd "runs/U15_launch.sh J25on"
param([string]$Exe='census_base.exe',[string]$Cmd)
$env:E5_EXE=$Exe
Set-Location "$env:USERPROFILE\genie-replays"
Start-Process "D:\Program Files\Git\bin\bash.exe" -ArgumentList '-c',"`"$Cmd`"" -WindowStyle Hidden
