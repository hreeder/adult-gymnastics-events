terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket = "tfstate-268434236731"
    region = "eu-west-1"
    key    = "main.tfstate"
  }
}

provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = {
      repo  = "gh:hreeder/adult-gymnastics-events"
      stack = "main"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name   = "adult-gymnastics-events"
  domain = "adultgymnasticsevents.reeder.dev"

  events_data_key = "data/events.json"
}

resource "aws_s3_bucket" "this" {
  bucket = local.domain
}

resource "aws_dynamodb_table" "this" {
  name         = local.name
  billing_mode = "PAY_PER_REQUEST"

  stream_enabled = true
  # We're not truly parsing the stream. If we needed more advanced than we're
  # currently doing, we'd just build a proper API around the records here in DDB
  stream_view_type = "KEYS_ONLY"

  hash_key  = "pk"
  range_key = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }
}

output "bucket_name" {
  value = aws_s3_bucket.this.bucket
}
