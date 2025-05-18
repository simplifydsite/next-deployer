#!/bin/bash

npm i @simplifyd/next-deployer
mkdir -p .github/workflows
cp node_modules/@simplifyd/next-deployer/resources/build.yml .github/workflows/
