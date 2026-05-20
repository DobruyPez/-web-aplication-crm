"""
Лабораторная 11 (CI/CD): тесты, отражающие теорию из 11 CI_CD.pdf и CI_CD_LAB11.md.

Покрываемые положения:
- последовательный пайплайн CI с остановкой при ошибке на этапе;
- политика веток fix/dev/main и merge через PR (модель допустимых пар веток);
- CD только с main;
- наличие и базовая структура GitHub Actions workflow (ci.yml, push, pytest).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from ci_cd_lab11_support import (
    cd_publish_allowed,
    merge_allowed,
    run_ci_pipeline,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
CI_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "ci.yml"


class TestContinuousIntegrationPipeline:
    """CI: этапы по порядку, при падении одного — остальные не выполняются."""

    def test_all_green_runs_every_stage(self):
        stages = [
            ("lint", lambda: 0),
            ("unit_tests", lambda: 0),
            ("build", lambda: 0),
        ]
        results = run_ci_pipeline(stages)
        assert [r.name for r in results] == ["lint", "unit_tests", "build"]
        assert all(r.exit_code == 0 for r in results)

    def test_failure_stops_pipeline(self):
        stages = [
            ("lint", lambda: 0),
            ("unit_tests", lambda: 1),
            ("build", lambda: 0),
        ]
        results = run_ci_pipeline(stages)
        assert [r.name for r in results] == ["lint", "unit_tests"]
        assert results[-1].exit_code == 1


class TestBranchingPolicyForPullRequests:
    """Ветки main / dev / fix и допустимые направления слияний (как в методичке)."""

    @pytest.mark.parametrize(
        "src,dst,expected",
        [
            ("fix", "dev", True),
            ("fix/TICKET-1", "dev", True),
            ("dev", "main", True),
            ("fix", "main", False),
            ("dev", "fix", False),
            ("main", "dev", False),
            ("feature/x", "dev", False),
        ],
    )
    def test_merge_matrix(self, src: str, dst: str, expected: bool):
        assert merge_allowed(src, dst) is expected


class TestContinuousDeliveryGuard:
    """CD: публикация стабильной версии только с ветки main."""

    def test_cd_from_main_allowed(self):
        assert cd_publish_allowed("main") is True

    @pytest.mark.parametrize("branch", ["dev", "fix", "fix/bug", "feature/x"])
    def test_cd_from_non_main_forbidden(self, branch: str):
        assert cd_publish_allowed(branch) is False


class TestGithubActionsWorkflow:
    """Проверка артефакта GitHub Actions: файл ci.yml, триггер push, запуск pytest."""

    def test_ci_workflow_file_exists(self):
        assert CI_WORKFLOW.is_file(), (
            f"Ожидается workflow по пути {CI_WORKFLOW} "
            "(см. лабораторную: .github/workflows/ci.yml)."
        )

    def test_ci_workflow_contains_push_and_jobs(self):
        text = CI_WORKFLOW.read_text(encoding="utf-8")
        assert re.search(r"^\s*on:\s*$", text, re.MULTILINE), "Должен быть ключ `on:`"
        assert "push:" in text, "Триггер `push` обязателен по заданию"
        assert re.search(r"^\s*jobs:\s*$", text, re.MULTILINE), "Должен быть блок `jobs:`"
        assert "pytest" in text.casefold(), "В workflow должен вызываться pytest"
        assert "tests/" in text, "Должен быть прогон тестов из каталога tests/"
