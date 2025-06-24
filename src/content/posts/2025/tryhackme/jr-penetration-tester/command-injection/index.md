---
title: 'Command Injection'
published: 2025-06-21
description: 'Tìm hiểu về Command Injection và cách chúng cho phép thực thi lệnh thông qua web'
image: ''
tags: [command-injection, web, easy]
category: 'TryHackMe'
draft: false 
lang: ''
---

:::note[THÔNG TIN]
Bài viết này ghi chú lại quá trình mình học từ [Room: Command Injection](https://tryhackme.com/room/oscommandinjection) trên **TryHackMe**.
:::

## Tóm tắt

Giả sử một web server được xây dựng để phục vụ người dùng thông qua website, nhưng **bằng cách nào đó attacker lại có thể thực thi các lệnh hệ điều hành**, như thể họ đang sử dụng chính chiếc máy chủ đó – chứ không chỉ là một người dùng thông thường.  
Đó chính là lỗ hổng **Command Injection**.

Ví dụ, nếu web server đang chạy dưới tài khoản hệ điều hành tên là `quangthai`, thì khi tồn tại lỗ hổng Command Injection, attacker có thể thực thi lệnh hệ thống **với toàn bộ quyền hạn của user `quangthai`**.

Command Injection thường được gọi là **RCE (Remote Code Execution)** – hiểu nôm na là “điều khiển máy từ xa”. Bởi vì mục tiêu sau cùng thường là **chiếm quyền điều khiển toàn bộ hệ thống**, chứ không chỉ là thực thi vài dòng lệnh nhỏ lẻ.

Trong phần này, mình sẽ tìm hiểu về cách thức hoạt động của **Command Injection**, cách khai thác nó, và một số **payload cơ bản dành cho từng hệ điều hành khác nhau**.

## Sơ lược về Command Injection

Giả sử mình có đoạn PHP sau:

```php
<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $domain = $_POST['domain'];
    $output = shell_exec("nslookup " . $domain);
    echo "<pre>$output</pre>";
} else {
    echo '<form method="POST">
            <label>Domain Lookup: <input name="domain" /></label>
            <button type="submit">Go</button>
          </form>';
}
?>

Đây là một đoạn mã PHP thực thi trên website, cho phép người dùng nhập một domain và dùng lệnh nslookup để kiểm tra DNS của domain đó.

Ở dòng 3, $_POST['domain'] sẽ lấy dữ liệu nhập vào từ người dùng và gán vào biến $domain. Khi người dùng nhấn nút Go, một HTTP POST request sẽ được gửi đi, và nội dung trong input sẽ được xử lý bởi dòng lệnh:

```php
$output = shell_exec("nslookup " . $domain);
```

Dòng này sẽ thực thi lệnh hệ điều hành dưới dạng:

```bash
nslookup <domain>
```

Ví dụ: nếu người dùng nhập `example.com`, lệnh sẽ là `nslookup example.com`, và kết quả sẽ được lưu vào biến `$output`.

Vấn đề nằm ở đây: Biến `$domain` không được kiểm tra hay lọc đầu vào, mà truyền thẳng vào câu lệnh hệ điều hành. Điều này mở ra khả năng cho attacker chèn thêm các lệnh khác.

Ví dụ, attacker có thể nhập:

```bash
example.com; pwd
```

Lệnh được thực thi sẽ là:

```bash
nslookup example.com; pwd
```

Kết quả là cả hai lệnh `nslookup` và `pwd` sẽ được chạy. Lệnh `pwd` sẽ in ra đường dẫn thư mục hiện tại trên server – một hành vi không mong muốn.

Tệ hơn nữa, attacker có thể sử dụng các payload phức tạp hơn để thực thi RCE (Remote Code Execution), leo thang đặc quyền (Privilege escalation), hoặc chiếm quyền kiểm soát hệ thống nếu ứng dụng không được bảo vệ đúng cách.

## Khai thác lỗ hổng Command Injection

Lỗ hổng Command Injection có thể được phát hiện thông qua **hai phương pháp chính**:

| Phương pháp | Mô tả |
|------------|-------|
| **Blind** | Phương pháp này **không trả về kết quả trực tiếp**, nên ta cần dựa vào **hành vi của ứng dụng** để xác định xem payload có được thực thi hay không. |
| **Verbose** | Phương pháp này **trả về kết quả rõ ràng**, ví dụ như khi nhập `;pwd`, nếu lệnh được thực thi thành công thì sẽ thấy đường dẫn thư mục như `/var/www/html` được hiển thị ra. |

### Làm thế nào để phát hiện Blind Command Injection?

Vì phương pháp này không trả kết quả trực tiếp, nên ta cần dùng **các payload có hành vi rõ ràng** để quan sát độ trễ.

> Một ví dụ điển hình là dùng các lệnh như:
>
> - `sleep 5` (trên Linux)
> - `ping -n 6 127.0.0.1` (trên Windows)

Nếu ứng dụng **phản hồi chậm hơn bình thường**, rất có thể payload đã được thực thi.

### Làm thế nào để phát hiện Verbose Command Injection?

Với phương pháp này, việc phát hiện khá rõ ràng:

- Dữ liệu trả về sẽ **phản ánh kết quả thực thi** của lệnh.
- Ví dụ: payload `; whoami` nếu được thực thi thành công sẽ hiển thị user hiện tại của hệ điều hành.

> Đây là cách dễ khai thác nhất, đặc biệt nếu ứng dụng **in ra trực tiếp nội dung trả về từ lệnh hệ điều hành**.

:::tip[MẸO]
Khi kiểm tra các input nghi ngờ (như `?host=` hoặc `?ip=`), hãy thử nối thêm các payload nhỏ như `;sleep 5`, `&whoami`, `|ls`,... rồi quan sát phản hồi từ server.
:::

## Phòng tránh lỗ hổng Command Injection

**Command Injection** có thể phòng tránh hiệu quả bằng công thức **3 bước kinh điển**, và công thức này cũng được áp dụng cho hầu hết các loại **injection** khác (như SQL Injection, XSS,...).

### Kiểm tra đầu vào (Input Validation)

Luôn **kiểm tra dữ liệu từ người dùng**, ở cả **phía frontend** và đặc biệt là **phía backend**:

- Xác định rõ **kiểu dữ liệu hợp lệ** (ví dụ: chỉ cho phép IP, domain,...)
- Sử dụng **whitelist** thay vì blacklist
- Hạn chế **độ dài** và **kí tự đặc biệt** trong input
- Không bao giờ **tin tưởng input** đến từ người dùng, kể cả các field bị ẩn

> **Frontend chỉ để hỗ trợ người dùng. Phòng thủ thực sự luôn nằm ở backend.**

### Tham số hóa câu lệnh (Command Parameterization)

Không được **nối chuỗi trực tiếp** giữa logic và dữ liệu. Luôn xử lý input **riêng biệt** trước khi truyền vào câu lệnh hệ thống.

Ví dụ **không an toàn**:

```php
shell_exec("nslookup " . $_POST['domain']);
```

Ví dụ an toàn hơn:

```php
$domain = escapeshellarg($_POST['domain']);
shell_exec("nslookup $domain");
```

> Sử dụng escapeshellarg() giúp escape các ký tự đặc biệt và tự động bao input bằng dấu ' → giảm thiểu nguy cơ injection.

### Mã hóa đầu ra (Output Encoding)

Khi bạn hiển thị dữ liệu người dùng (hoặc từ hệ thống) lên trang web, hãy đảm bảo nó là **text thuần túy**, không phải **code** có thể bị thực thi.

- Encode các ký tự HTML như <, >, ", '
- Tùy vào ngữ cảnh (HTML, JS, URL...), hãy chọn cách encode phù hợp
- Dùng thư viện hoặc framework đã có sẵn tính năng encode

> Mục tiêu là: ngăn code chạy, chỉ hiển thị nội dung.

---

**🔎 Xem thêm:** [Các bài viết về Command Injection](/archive/?tag=command-injection)