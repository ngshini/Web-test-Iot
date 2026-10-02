# Kích hoạt CI/CD

Deploy chỉ chạy khi repository variable `CD_ENABLED=true`. Chỉ bật sau khi đã thu hồi credential Tailscale từng lộ trong chat, thay Secrets mới và hoàn tất script/SSH key trên server. Khi chưa bật, CI vẫn chạy, job deploy được skip.

Workflow chạy test trên pull request và push; chỉ main được deploy. Không chạy mã pull request trên Ubuntu. GitHub runner đi qua Tailscale, dùng SSH key riêng với forced command. Repo public nên không đặt runner trên server BAS.

## 1. Tailscale (cần chủ tài khoản)

Trong Access controls, thêm tag `tag:iot-web-ci` vào tagOwners và quyền từ tag đó đến `100.70.65.27:22`. Giữ nguyên các quyền đang có. Tạo OAuth client scope `auth_keys`, cho phép tag này. Thêm Secrets repo GitHub:

- `TS_OAUTH_CLIENT_ID`
- `TS_OAUTH_SECRET`

Không gửi secret vào chat, không commit vào Git. Tài liệu: https://tailscale.com/docs/integrations/github/github-action

## 2. Cài script và SSH key riêng (một lần)

Script `server-deploy.sh` chỉ nhận archive các file static cho `/iot-test/`; không sửa nginx, relay, DB hay backend. Server đã kiểm tra dùng container `bas-frontend-1`. Nếu đổi tên container cần cập nhật script đã cài trên server.

Tạo key riêng trên máy quản trị bằng `ssh-keygen -t ed25519 -f <đường-dẫn-key-riêng>`, không tái sử dụng SSH key cá nhân. Cài script đã review vào `/home/croz/bin/iot-web-deploy`, quyền 700. Thêm PUBLIC key vào authorized_keys của croz với tiền tố:

```text
restrict,command="/home/croz/bin/iot-web-deploy" ssh-ed25519 PUBLIC_KEY...
```

Thêm PRIVATE key vào GitHub Secret `DEPLOY_SSH_KEY`; thêm dòng known_hosts được xác minh trực tiếp từ server vào `DEPLOY_KNOWN_HOSTS`. Không dùng StrictHostKeyChecking=no. Forced command không cho key chạy shell tùy ý, nhưng tài khoản croz có quyền Docker: script cài trên server phải được quản trị và không tự cập nhật từ repo.

Tạo GitHub Environment `production`, giới hạn deployment branch `main`; không bật yêu cầu duyệt nếu muốn tự động sau push. Bảo vệ main để thay đổi workflow cần review.

## 3. Chạy và kiểm tra

Push main hoặc chọn Actions → Test and deploy IoT web → Run workflow. Test phải xanh trước deploy. Thiếu secret sẽ dừng trước khi kết nối server. Khi chưa cài script/key thì CI có thể chạy nhưng CD chưa hoạt động.

Server giữ release/backup dưới `/home/croz/apps/bas-beta/iot-web-release.*`; lỗi kiểm tra trong script sẽ khôi phục bản container cũ. Bản backup có thể phục hồi thủ công bằng docker cp. Chưa có tự rollback từ kết quả kiểm tra URL public trong workflow; kiểm tra public lỗi cần quản trị xem và phục hồi. Không tự xóa backup; cần quản lý dung lượng định kỳ.

Triển khai giữ bản source trong `frontend/public/iot-test/` cho lần rebuild sau; image Docker hiện chạy chưa được rebuild bởi workflow. Khi rebuild BAS phải tiếp tục giữ cấu hình nginx `/iot-test/events`.

## Phạm vi kiểm thử

Các test firmware phụ thuộc đường dẫn bên ngoài/config riêng đã loại khỏi repo web: chúng vẫn thuộc repo firmware gốc. Test web và kiểm tra workflow chạy độc lập. Chưa xác nhận deploy end-to-end khi chưa có Secrets và script/key trên server.
