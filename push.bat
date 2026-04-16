@echo off
git init
git remote add origin https://github.com/lilu49329-cloud/FaceID
git add .
git commit -m "Update labels and fix header user info inconsistency"
git branch -M main
git push -u origin main
