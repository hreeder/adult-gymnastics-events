# data "aws_ecr_image" "manager" {
#   repository_name = "event-manager"
#   image_tag       = "v1"
# }

# module "manager" {
#   source  = "terraform-aws-modules/lambda/aws"
#   version = "8.1.2"

#   function_name = "${local.name}-manager"

#   image_uri      = data.aws_ecr_image.manager.image_uri
#   create_package = false
#   architectures  = ["arm64"]
#   package_type   = "Image"

#   create_lambda_function_url = true

#   cloudwatch_logs_retention_in_days = 30

#   attach_policy_statements = true
#   policy_statements = {
#     ssm = {
#       effect = "Allow"
#       actions = [
#         "ssm:GetParameter",
#         "ssm:GetParameters",
#         "ssm:GetParametersByPath",
#       ]
#       resources = [
#         provider::aws::arn_build(
#           "aws", "ssm", "eu-west-1",
#           data.aws_caller_identity.current.account_id,
#           "parameter/${local.name}/manager/"
#         ),
#         provider::aws::arn_build(
#           "aws", "ssm", "eu-west-1",
#           data.aws_caller_identity.current.account_id,
#           "parameter/${local.name}/manager/*"
#         ),
#       ]
#     }
#   }
# }

# locals {
#   manager_config = {
#     "secrets/auth/client_id" = {
#     }
#     "secrets/auth/client_secret" = {
#       type = "SecureString"
#     }
#     "secrets/auth/redirect_uri" = {
#     }
#     "secrets/auth/cookie_secret" = {
#       type = "SecureString"
#     }
#     "secrets/auth/server_metadata_url" = {
#       value = "https://accounts.google.com/.well-known/openid-configuration"
#     }
#   }
# }

# resource "aws_ssm_parameter" "secrets" {
#   for_each = local.manager_config

#   name = "/${local.name}/manager/${each.key}"
#   type = try(each.value.type, "String")

#   value_wo         = try(each.value.value, "DEFAULT_VALUE")
#   value_wo_version = try(each.value.value_ver, 1)
# }

# # todo: redirect url based on dns?
# # todo: google auth credential generation?
