#!/bin/bash

npm i @simplifyd/next-deployer
rm -rf .github/workflows
mkdir -p .github/workflows
cp node_modules/@simplifyd/next-deployer/resources/deploy_dev.yml .github/workflows/
cp node_modules/@simplifyd/next-deployer/resources/deploy_prod.yml .github/workflows/
