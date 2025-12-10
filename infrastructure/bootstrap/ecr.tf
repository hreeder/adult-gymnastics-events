resource "aws_ecr_repository" "event_manager" {
  name = "event-manager"
}

data "aws_ecr_lifecycle_policy_document" "expire_old" {
  rule {
    priority    = 1
    description = "Expire untagged images after 1 day"

    selection {
      tag_status   = "untagged"
      count_type   = "sinceImagePushed"
      count_number = 1
      count_unit   = "days"
    }

    action {
      type = "expire"
    }
  }

  rule {
    priority    = 2
    description = "Keep only the last 2 images"

    selection {
      tag_status   = "any"
      count_type   = "imageCountMoreThan"
      count_number = 2
    }

    action {
      type = "expire"
    }
  }
}

resource "aws_ecr_lifecycle_policy" "event_manager" {
  repository = aws_ecr_repository.event_manager.name
  policy     = data.aws_ecr_lifecycle_policy_document.expire_old.json
}
