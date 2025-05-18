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
export MAIL_FROM_DOMAIN
export MAIL_FROM_DISPLAY_NAME
export CLIENT_EMAIL
export THROTTLING_RATE_LIMIT
export THROTTLING_WINDOW

PROJECT_NAME=$(cat package.json | jq -r .name)
OUTPUT_DIR="/tmp/cdk/${PROJECT_NAME}"
mkdir -p "${OUTPUT_DIR}"
npx cdk deploy \
  --app "npx tsx node_modules/@simplifyd/next-deployer/src/index.ts" \
  --all \
  --profile "${2}" \
  --output "${OUTPUT_DIR}" \
  --outputs-file "${OUTPUT_DIR}/cdk.out.json"