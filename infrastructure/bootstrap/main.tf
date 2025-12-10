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
    key    = "bootstrap.tfstate"
  }
}

provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = {
      repo  = "gh:hreeder/adult-gymnastics-events"
      stack = "bootstrap"
    }
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  url             = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      variable = "token.actions.githubusercontent.com:sub"
      test     = "StringEquals"
      values   = ["repo:hreeder/adult-gymnastics-events:ref:refs/heads/main"]
    }

    condition {
      variable = "token.actions.githubusercontent.com:aud"
      test     = "StringEquals"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "gha-adult-gymnastics-events"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}
