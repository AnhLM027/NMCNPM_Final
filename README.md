# NMCNPM Final Diagrams

Thư mục này gom lời giải sơ đồ lớp cho các đề thi môn **Nhập môn Công nghệ phần mềm**.

Ý nghĩa các file:

- `Class_Diagram.mmd`: sơ đồ lớp thực thể của chủ đề lớn.
- `Debai.txt`: đề bài của module.
- `c2.mmd`: câu 2, sơ đồ lớp thực thể pha phân tích của module.
- `c3.mmd`: câu 3, sơ đồ lớp MVC chi tiết của module.

## Danh Sách Chủ Đề Lớn

Có **13 chủ đề lớn** trong bộ 66 đề này, nếu tính theo miền nghiệp vụ/hệ thống như “cửa hàng truyện” là một chủ đề, “giải đấu cờ vua” là một chủ đề.

| Chủ đề | Các đề |
|---|---|
| Quản lí thư viện / mượn trả sách | Đề 01-04 |
| Quản lí đào tạo / lớp học phần / sinh viên | Đề 05-10 |
| Quản lí tour du lịch | Đề 11-14 |
| Quản lí nhà hàng / gọi món / đặt bàn | Đề 15-21 |
| Quản lí kho vật tư | Đề 22-25 |
| Quản lí giải đấu cờ vua | Đề 26-29 |
| Quản lí giải đua F1 | Đề 30-33 |
| Quản lí cửa hàng cho thuê truyện | Đề 34-38 |
| Quản lí nhân viên parttime Lotteria | Đề 39-44 |
| Quản lí chuỗi rạp chiếu phim | Đề 45-49 |
| Quản lí cho thuê sân bóng mini | Đề 50-55 |
| Quản lí vay trả góp Saison | Đề 56-61 |
| Quản lí cho thuê trang phục | Đề 62-66 |

Quy ước chính:

- C2 chỉ gồm các lớp thực thể liên quan trực tiếp đến module.
- C2 chỉ ghi tên thuộc tính, không ghi kiểu dữ liệu, không ghi phương thức.
- C3 có View, Controller, DAO, Entity và có kiểu dữ liệu/phương thức.
- Quan hệ thành phần dùng `*--`, ví dụ `HoaDon *-- ChiTietHoaDon`.
- Quan hệ tham chiếu dùng `--`.

## Cấu Trúc

Mỗi chủ đề lớn được gom vào một thư mục riêng:

```text
ChuDe_01_QuanLyThuVien/
    Class_Diagram.mmd
    De_01_QuanLiMuonSach/
        Debai.txt
        c2.mmd
        c3.mmd
    ...
```

## Xuất Ảnh Từ File `.mmd`

Tool xuất ảnh nằm ở gốc project:

```powershell
.\export_mermaid_images.ps1

Xuất riêng một đề:

```powershell
.\export_mermaid_images.ps1 -Root .\ChuDe_01_QuanLyThuVien\De_01_QuanLiMuonSach
```

Xuất cả `Class_Diagram.mmd` của các chủ đề:

```powershell
.\export_mermaid_images.ps1 -IncludeClassDiagram
```