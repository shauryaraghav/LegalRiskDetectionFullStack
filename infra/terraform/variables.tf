variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "name" {
  type    = string
  default = "legalrisk"
}
variable "instance_type" {
  type    = string
  default = "t3.small" # 2 GB RAM: backend loads scikit-learn models; t3.micro is too tight with monitoring
}
variable "disk_gb" {
  type    = number
  default = 20
}
variable "ssh_cidr" {
  type        = string
  description = "CIDR allowed to SSH in, e.g. your public IP as 203.0.113.7/32. Do not use 0.0.0.0/0."
}
variable "ssh_public_key" {
  type        = string
  description = "Contents of the public key whose private half is the EC2_SSH_KEY GitHub secret."
}
variable "domain" {
  type        = string
  default     = ""
  description = "Optional custom DNS name pointing at the Elastic IP. Empty = use <ip-with-dashes>.sslip.io (free, no signup)."
}
variable "registry_image" {
  type        = string
  description = "Lowercase image prefix, e.g. ghcr.io/shauryaraghav/legalriskdetectionfullstack"
}
variable "admin_email" {
  type    = string
  default = ""
}
variable "existing_instance_profile" {
  type        = string
  default     = ""
  description = "Use an existing instance profile instead of creating IAM resources. AWS Academy Learner Lab: set to LabInstanceProfile (IAM creation is blocked there)."
}
variable "existing_backup_bucket" {
  type        = string
  default     = ""
  description = "Use an S3 bucket you created yourself instead of letting Terraform create one. AWS Academy Learner Lab: required."
}
