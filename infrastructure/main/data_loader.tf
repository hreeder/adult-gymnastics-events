# Export data from DynamoDB to a key in S3
module "data_loader" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.1.2"

  function_name = "${local.name}-data-loader"
  description   = "Populates the data JSON in S3 with data from DynamoDB"
  handler       = "export_to_s3.handler"
  runtime       = "python3.13"
  source_path   = "${path.module}/../../export_to_s3.py"

  cloudwatch_logs_retention_in_days = 30

  environment_variables = {
    DDB_TABLE  = aws_dynamodb_table.this.name
    S3_BUCKET  = aws_s3_bucket.this.bucket
    EVENTS_KEY = local.events_data_key

    LOG_ITEMS = "true"
  }

  event_source_mapping = {
    dynamodb = {
      event_source_arn  = aws_dynamodb_table.this.stream_arn
      starting_position = "LATEST"

      # Debounce - allow an event manager to save/update events a few times
      # before triggering this lambda
      maximum_batching_window_in_seconds = 60
      batch_size                         = 1000

      maximum_retry_attempts = 0
    }
  }

  allowed_triggers = {
    dynamodb = {
      principal  = "dynamodb.amazonaws.com"
      source_arn = aws_dynamodb_table.this.stream_arn
    }
  }
  create_current_version_allowed_triggers = false

  attach_policy_statements = true
  policy_statements = {
    dynamodb = {
      effect    = "Allow"
      actions   = ["dynamodb:Scan"]
      resources = [aws_dynamodb_table.this.arn]
    }
    s3 = {
      effect    = "Allow"
      actions   = ["s3:PutObject"]
      resources = ["${aws_s3_bucket.this.arn}/${local.events_data_key}"]
    }
  }

  attach_policies    = true
  number_of_policies = 1
  policies = [
    "arn:aws:iam::aws:policy/service-role/AWSLambdaDynamoDBExecutionRole",
  ]
}
