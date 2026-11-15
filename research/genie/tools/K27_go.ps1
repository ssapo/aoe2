# ENG-27: runs a bash command line in Git Bash outside the remote shell's job (WMI Create), with E5_EXE set
# usage: -Exe census_X.exe -Cmd "bash runs/U15_launch.sh K27on"
param([string]$Exe='census_base.exe',[string]$Cmd)
$c = 'cmd /c "set E5_EXE=' + $Exe + '&& cd /d ' + "$env:USERPROFILE\genie-replays" + '&& "D:\Program Files\Git\bin\bash.exe" -c "' + $Cmd + '""'
(Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$c}).ReturnValue
