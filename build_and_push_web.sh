#!/bin/bash
# $1 prod aoxam-dev
# $2 tag
set -e
build_env=$1
tag=$2

# Define default tag if $1 is not specified
if [ -z "$2" ]; then
  default_tag="aoxam/web:$(date +'%Y-%m-%d')-$1"
  read -rp "Tag not specified. Do you want to use the default tag ($default_tag)? (y/n): " use_default_tag
  if [ "$use_default_tag" != "y" ]; then
    echo "Exiting without building Docker image."
    exit 1
  fi
  tag="$default_tag"
else
  tag="$2"
fi

platform=linux/amd64,linux/arm64
platform=linux/amd64

cp "../secret/web.env.$build_env" "./.env.local"
npm install
npm run build

docker buildx build --push \
  --platform $platform \
  --build-arg="ENV=$1" \
  --tag "$tag" \
  -f ./Dockerfile \
  .

