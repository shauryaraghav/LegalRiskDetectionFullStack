output "public_ip" {
  value       = aws_eip.app.public_ip
  description = "Put this in the EC2_HOST GitHub secret."
}
output "domain" {
  value       = local.domain
  description = "Put this in the DOMAIN GitHub variable. Site URL is https://<domain>."
}
output "ssh" { value = "ssh ec2-user@${aws_eip.app.public_ip}" }
output "grafana_tunnel" {
  value = "ssh -L 3000:localhost:3000 ec2-user@${aws_eip.app.public_ip}  # then open http://localhost:3000"
}
output "backup_bucket" { value = aws_s3_bucket.backups.bucket }
