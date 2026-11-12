# Commits research/genie on the research branch with runs\M6_commitmsg.txt and pushes it.
$d="$env:USERPROFILE\genie-replays"; Set-Location "$d\aoe2-push"
$o="$d\runs\M6_commit.out"
Remove-Item "$d\runs\M6_commit.done" -ErrorAction SilentlyContinue
cmd /c "git branch --show-current > `"$o`" 2>&1"
cmd /c "git add research/genie >> `"$o`" 2>&1"
cmd /c "git status --short >> `"$o`" 2>&1"
cmd /c "git -c user.name=Claude -c user.email=noreply@anthropic.com commit -F `"$d\runs\M6_commitmsg.txt`" >> `"$o`" 2>&1"
cmd /c "git push origin research/genie-188329 >> `"$o`" 2>&1"
cmd /c "git log --oneline -1 >> `"$o`" 2>&1"
cmd /c "git status -sb >> `"$o`" 2>&1"
"done" | Out-File "$d\runs\M6_commit.done" -Encoding ascii
