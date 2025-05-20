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
export MAIL_TO
export MAIL_CC
export MAIL_BCC
export THROTTLING_RATE_LIMIT
export THROTTLING_WINDOW
export MAIL_TEMPLATE_MJML

if [[ -n "${MAIL_TEMPLATE_MJML}" && -f "${MAIL_TEMPLATE_MJML}" ]]; then
  echo "* MAIL_TEMPLATE found."
  export MAIL_TEMPLATE_KEY=contact.html
  MAIL_TEMPLATE_FILE="/tmp/cdk/${MAIL_TEMPLATE_KEY}"
  if [[ ! -d node_modules/mjml ]]; then
    echo "mjml is not installed to compile mail template. installing..."
    npm i mjml --no-save
  fi
  npx mjml "${MAIL_TEMPLATE_MJML}" -o "${MAIL_TEMPLATE_FILE}" --config.minify
else
  echo "* No MAIL_TEMPLATE found. Using default."
fi

PROJECT_NAME=$(cat package.json | jq -r .name)
OUTPUT_DIR="/tmp/cdk/${PROJECT_NAME}"
CDK_OUT_FILE="${OUTPUT_DIR}/cdk.out.json"
mkdir -p "${OUTPUT_DIR}"
npx cdk deploy \
  --app "npx tsx node_modules/@simplifyd/next-deployer/src/index.ts" \
  --all \
  --profile "${2}" \
  --output "${OUTPUT_DIR}" \
  --outputs-file "${OUTPUT_DIR}/cdk.out.json"

if [ -n "${MAIL_TEMPLATE_MJML}" ]; then
  echo "* Uploading mail template"
  aws s3 cp \
    "${MAIL_TEMPLATE_FILE}" \
    "s3://$(cat "${CDK_OUT_FILE}" | jq -r .${STACK_NAME}.ContactBackendMailTemplateBucketName)/" \
    --profile "${2}"
fi

echo "Deployment done"