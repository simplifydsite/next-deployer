#!/bin/bash

npm i @d4ndel1on/next-deployer
mkdir -p .github/workflows
cp node_modules/@d4ndel1on/next-deployer/resources/build.yml .github/workflows/
