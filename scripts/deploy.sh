#!/bin/bash

set -e

if [ -z "${1}" ];
then
  echo "ERROR: No env passed. Please use next-deploy <env>"
  exit 1
fi

echo "Using env file .env.${1}"
source ".env.${1}"
export S3_BUCKET
export STACK_NAME
export AWS_ACCOUNT
if [ -z "$GITHUB_ACTIONS" ]; then
  export AWS_PROFILE
fi
export CNAME
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

if [ -z "${AWS_PROFILE}" ];
then
  echo "Using credentials from environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
  unset AWS_PROFILE
  unset AWS_DEFAULT_PROFILE
else
  echo "Using AWS_PROFILE ${AWS_PROFILE}"
  export AWS_DEFAULT_PROFILE="${AWS_PROFILE}"

  if identityOutput=$(aws sts get-caller-identity --profile "${AWS_PROFILE}" 2>&1); then
    echo "- Token is valid ✅"
  else
    echo "$identityOutput"
    echo "- Token is invalid ⚠️"
    echo "  -> Refreshing..."
    aws sso login --profile "${AWS_PROFILE}"
    echo "- Token is successfully refreshed ✅"
  fi
fi

echo "Using s3 bucket ${S3_BUCKET}"
echo "Using stack name ${STACK_NAME}"
cp ".env.${1}" .env
npm run build
rm .env
aws s3 sync --delete out/ "s3://${S3_BUCKET}/"
aws cloudfront create-invalidation \
		--distribution-id "$(aws cloudfront list-distributions | jq --arg stack_name "${STACK_NAME}" -r '.DistributionList.Items[] | select(.Comment==$stack_name) | .Id')" \
		--paths "/*"