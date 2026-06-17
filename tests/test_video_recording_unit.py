"""
Автотесты записи видеозвонка (без live-сервера и без WebRTC в браузере).

Запуск:
  pytest tests/test_video_recording_unit.py -q

Проверяет compositor 50|50 (оба слота в итоговом кадре) через Vitest + happy-dom.
API/WebRTC — отдельно: pytest tests/test_video_sessions_api.py (нужен запущенный backend).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = REPO_ROOT / "frontend"


class TestVideoRecordingUnit:
    def test_dom_region_recorder_vitest_passes(self):
        """Vitest: mergeDualSlotCanvases рисует левый и правый слот (не пустой remote)."""
        if not (FRONTEND_DIR / "package.json").is_file():
            pytest.skip("frontend/package.json not found")

        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        result = subprocess.run(
            [npm, "test", "--", "--run", "src/lib/domRegionRecorder.test.js"],
            cwd=FRONTEND_DIR,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        assert result.returncode == 0, (
            "Frontend recording unit tests failed.\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )

    def test_recording_contract_documented_in_ci(self):
        ci = REPO_ROOT / ".github" / "workflows" / "ci.yml"
        text = ci.read_text(encoding="utf-8")
        assert "test_video_sessions_api.py" in text
        assert "test_video_upload_recording.py" in text

    def test_frontend_exports_recording_helpers(self):
        source = (FRONTEND_DIR / "src" / "lib" / "domRegionRecorder.js").read_text(encoding="utf-8")
        for symbol in (
            "mergeDualSlotCanvases",
            "pickRemotePainterType",
            "isSlotCanvasEmpty",
            "getRecordSlotVideos",
        ):
            assert f"export const {symbol}" in source or f"export function {symbol}" in source
