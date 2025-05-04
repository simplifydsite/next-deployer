#!/bin/bash

set -e

if [ -z "${1}" ];
then
  echo "ERROR: No env passed. Please use next-deploy <env>"
  exit 1
fi

if [ -z "${2}" ];
then
  echo "Using credentials from environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
else
  echo "Using AWS_PROFILE ${2}"
  export AWS_PROFILE="${2}"
  export PROFILE_STRING="--profile"
fi

echo "Using env file .env.${1}"
source ".env.${1}"
export S3_BUCKET
export STACK_NAME
export AWS_ACCOUNT
export CNAME
export DOMAIN_NAME
export AWS_REGION

echo "Using s3 bucket ${S3_BUCKET}"
echo "Using stack name ${STACK_NAME}"
npm run build
echo "sync"
aws s3 sync "${PROFILE_STRING}" "${AWS_PROFILE}" --delete out/ "s3://${S3_BUCKET}/"
aws cloudfront create-invalidation \
		--distribution-id "$(aws cloudfront list-distributions "${PROFILE_STRING}" "${AWS_PROFILE}" | jq --arg stack_name "${STACK_NAME}" -r '.DistributionList.Items[] | select(.Comment==$stack_name) | .Id')" \
		"${PROFILE_STRING}" "${AWS_PROFILE}" \
		--paths "/*"