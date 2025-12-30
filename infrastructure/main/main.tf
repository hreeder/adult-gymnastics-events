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
  domain = "adultgymnastics.events"

  events_data_key = "data/events.json"
}

resource "aws_s3_bucket" "this" {
  bucket = local.domain
  # In place for migration to dedicated domain
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "this" {
  bucket = aws_s3_bucket.this.bucket
  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.bucket

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

data "aws_iam_policy_document" "s3_allow_public" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.this.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.bucket
  policy = data.aws_iam_policy_document.s3_allow_public.json
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
