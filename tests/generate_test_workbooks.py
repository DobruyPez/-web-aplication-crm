#!/usr/bin/env python3
"""
Генерация Excel-матриц ручного и автоматического тестирования (таблица 4.1).
Запуск из корня: python tests/generate_test_workbooks.py
"""

from pathlib import Path

from manual_testing_matrix import AUTO_HEADERS, MANUAL_HEADERS, MANUAL_TEST_ROWS

TESTS_DIR = Path(__file__).resolve().parent


def _write_csv(path: Path, headers: list[str], rows: list[tuple]) -> None:
    import csv

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)


def _write_xlsx(path: Path, sheet_name: str, headers: list[str], rows: list[list]) -> bool:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError:
        return False

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append(row)
    for col in ws.columns:
        max_len = max(len(str(c.value or "")) for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 60)
    wb.save(path)
    return True


def main() -> None:
    manual_rows = []
    auto_rows = []
    for no, title, action, expected, pytest_node in MANUAL_TEST_ROWS:
        manual_rows.append([no, title, action, expected, "Успешно.", "", ""])
        file_name = pytest_node.split("::")[0] if "::" in pytest_node else pytest_node
        auto_rows.append([no, title, pytest_node, file_name, "pytest"])

    manual_csv = TESTS_DIR / "CRM_manual_testing_table_4_1.csv"
    auto_csv = TESTS_DIR / "CRM_automated_testing_table_4_1.csv"
    _write_csv(manual_csv, MANUAL_HEADERS, manual_rows)
    _write_csv(auto_csv, AUTO_HEADERS, auto_rows)
    print(f"Wrote {manual_csv}")
    print(f"Wrote {auto_csv}")

    manual_xlsx = TESTS_DIR / "CRM_manual_testing_table_4_1.xlsx"
    auto_xlsx = TESTS_DIR / "CRM_automated_testing_table_4_1.xlsx"
    ok1 = _write_xlsx(manual_xlsx, "Ручное 4.1", MANUAL_HEADERS, manual_rows)
    ok2 = _write_xlsx(auto_xlsx, "Авто 4.1", AUTO_HEADERS, auto_rows)
    if ok1 and ok2:
        print(f"Wrote {manual_xlsx}")
        print(f"Wrote {auto_xlsx}")
    else:
        print("openpyxl not installed; only CSV created. Run: pip install openpyxl")


if __name__ == "__main__":
    main()
