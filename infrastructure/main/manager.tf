data "aws_iam_policy_document" "manager" {
  statement {
    actions = [
      "dynamodb:Scan",
      "dynamodb:PutItem",
    ]
    resources = [aws_dynamodb_table.this.arn]
  }

  statement {
    actions = [
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.this.arn}/event-images/*",
    ]
  }
}

resource "aws_iam_user" "manager" {
  name = "${local.name}-manager"
}

resource "aws_iam_user_policy" "manager" {
  user   = aws_iam_user.manager.name
  policy = data.aws_iam_policy_document.manager.json
}
