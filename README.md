# BAS IoT Web Test

Source giao diện web test độc lập, tách từ `esp32-NBIoT/windows/bas_receive_test` ngày 02/10/2026. Bản gốc được giữ nguyên; từ nay có thể sửa giao diện trong thư mục này.

## Các file chính

- `index.html`: trang khởi đầu.
- `styles.css`, `receiver-ui.css`: giao diện và bố cục.
- `src/`: logic giao diện và xử lý dữ liệu.
- `receiver.mjs`, `mqtt_core.mjs`: nhận và xử lý MQTT.
- Các file `*.test.mjs`, `tests/`: kiểm thử.

## Xem thử trên máy

```sh
cd /Users/shini/Documents/project/BAS-IoT-Web-Test
python3 -m http.server 18094 --bind 127.0.0.1
```

Mở http://127.0.0.1:18094/. Dừng bằng Ctrl+C.

Đây là giao diện nhận MQTT, không phải monitor USB Serial tại cổng 8090. Kết nối dữ liệu còn phụ thuộc broker/topic và đường nhận được cấu hình.

## Triển khai public

Sửa file tại đây không tự cập nhật https://server.aitrg.io.vn/iot-test/. Cần triển khai riêng sau khi kiểm tra. Server hiện có relay MQTT → SSE và route `/iot-test/events`; phải giữ tích hợp đó khi cập nhật. Bản sao này là source giao diện gốc, không phải bản xuất đầy đủ cấu hình runtime của server. File receiver dùng relay và cấu hình nginx tham khảo ở thư mục firmware `BAS-ESP32-NB-IoT-WiFi-source-20261002/server-test/`.

Không cần nạp lại ESP32 nếu chỉ sửa giao diện.
# Web-test-Iot
