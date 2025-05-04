#!/bin/bash

set -e

if [ "$#" -ne 2 ]
then
  echo -e "${RED}ERROR${ENDCOLOR}: Provide env and AWS profile"
  echo
  echo "Example: next-deploy <env> <aws-profile>"
  echo
  exit 1
fi

echo "###########"
echo "## next-deploy-infrastructure"

echo "Using env file .env.${1}"
source ".env.${1}"
export S3_BUCKET
export STACK_NAME
export AWS_ACCOUNT
export CNAME
export DOMAIN_NAME
export AWS_REGION

npx cdk@latest deploy \
  --app "npx tsx node_modules/@d4ndel1on/next-deployer/src/index.ts" \
  --all \
  --profile "${2}" \
  --output cdk.out.json