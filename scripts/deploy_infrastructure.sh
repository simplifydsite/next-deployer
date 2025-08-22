#!/bin/bash

set -e

if [ "$#" -ne 1 ]
then
  echo -e "${RED}ERROR${ENDCOLOR}: Provide env"
  echo
  echo "Example: next-deploy <env>"
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
export AWS_PROFILE
export DOMAIN_NAME
export AWS_REGION
export MAIL_FROM
export MAIL_FROM_DISPLAY_NAME
export MAIL_TO
export MAIL_CC
export MAIL_BCC
export THROTTLING_RATE_LIMIT
export THROTTLING_WINDOW
export MAIL_TEMPLATE_MJML
export GMAIL_SECRET_ARN

if [[ -z "$AWS_PROFILE" ]]; then
  echo "ERROR: The AWS_PROFILE variable is absent or empty."
  exit 1
fi

if identityOutput=$(aws sts get-caller-identity --profile "${AWS_PROFILE}" 2>&1); then
  echo "- Token is valid ✅"
else
  echo "$identityOutput"
  echo "- Token is invalid ⚠️"
  echo "  -> Refreshing..."
  aws sso login --profile "${AWS_PROFILE}"
  echo "- Token is successfully refreshed ✅"
fi


if [[ -n "${MAIL_TEMPLATE_MJML}" && -f "${MAIL_TEMPLATE_MJML}" ]]; then
  echo "* MAIL_TEMPLATE found."
  export MAIL_TEMPLATE_KEY=contact.html
  mkdir -p /tmp/cdk
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
OUTPUT_DIR="/tmp/cdk/${PROJECT_NAME}/${1}"
CDK_OUT_FILE="${OUTPUT_DIR}/cdk.out.json"
mkdir -p "${OUTPUT_DIR}"
npm i --no-save \
  tsx@latest \
  aws-cdk@latest
npx cdk@latest deploy \
  --app "npx tsx@latest node_modules/@simplifyd/next-deployer/src/index.ts" \
  --all \
  --profile "${AWS_PROFILE}" \
  --output "${OUTPUT_DIR}" \
  --outputs-file "${OUTPUT_DIR}/cdk.out.json"

if [ -n "${MAIL_TEMPLATE_MJML}" ]; then
  echo "* Uploading mail template"
  aws s3 cp \
    "${MAIL_TEMPLATE_FILE}" \
    "s3://$(cat "${CDK_OUT_FILE}" | jq -r .${STACK_NAME}.ContactBackendMailTemplateBucketName)/" \
    --profile "${AWS_PROFILE}"
fi

echo "Deployment done"