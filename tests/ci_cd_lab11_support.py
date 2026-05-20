"""
Вспомогательные функции для лабораторной 11 (CI/CD): модель пайплайна и политики веток.
Соответствуют терминам из CI_CD_LAB11.md / 11 CI_CD.pdf.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class StageResult:
    name: str
    exit_code: int


def run_ci_pipeline(stages: list[tuple[str, Callable[[], int]]]) -> list[StageResult]:
    """
    Непрерывная интеграция: этапы выполняются по порядку.
    При ненулевом коде возврата следующие этапы не запускаются (fail-fast).
    """
    results: list[StageResult] = []
    for name, fn in stages:
        code = int(fn())
        results.append(StageResult(name=name, exit_code=code))
        if code != 0:
            break
    return results


def merge_allowed(source_branch: str, target_branch: str) -> bool:
    """
    Упрощённая политика из методички:
    - fix -> dev разрешено;
    - dev -> main разрешено;
    - прямой merge в main с произвольных веток — запрещён;
    - dev -> fix и main -> * — запрещены.
    """
    s = source_branch.strip().lower()
    t = target_branch.strip().lower()

    if t == "main":
        return s == "dev"
    if t == "dev":
        return s == "fix" or s.startswith("fix/")
    return False


def cd_publish_allowed(release_branch: str) -> bool:
    """CD в продакшен/публичный стенд — только с ветки main (как в типичном сценарии лабы)."""
    return release_branch.strip().lower() == "main"
