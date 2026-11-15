"""Split the three supplied release files for static hosting; never extract them.

Parts stay outside app/public until the release maintainer stages them in batches.
Each part and reconstructed stream is checked against the original supplied file.
"""
from pathlib import Path
import hashlib
import json
from datetime import datetime, timezone

APP = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
STAGING = APP.parent / "output" / "release-staging"
PART_BYTES = 16 * 1024 * 1024
SOURCES = [
    ("archive", "Historical public data", "burnclock_public_data_2026-11-14_1.tar.gz"),
    ("contours", "Precomputed contour maps", "burnclock_contours_2026-11-14.tar.gz"),
    ("pipeline", "Supplied pipeline source", "burnclock_pipeline_code_2026-11-14_2.tar.gz"),
]


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main():
    (STAGING / "parts").mkdir(parents=True, exist_ok=True)
    releases = []
    for release_id, label, name in SOURCES:
        source = DOWNLOADS / name
        size = source.stat().st_size
        parts = []
        with source.open("rb") as stream:
            index = 1
            while chunk := stream.read(PART_BYTES):
                part_name = f"{name}.part{index:03d}"
                part_path = STAGING / "parts" / part_name
                part_path.write_bytes(chunk)
                expected = hashlib.sha256(chunk).hexdigest()
                assert digest(part_path) == expected
                parts.append({"path": f"/releases/parts/{part_name}", "bytes": len(chunk), "sha256": expected})
                index += 1
        reconstructed = hashlib.sha256()
        with source.open("rb") as original:
            for part in parts:
                with (STAGING / "parts" / Path(part["path"]).name).open("rb") as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b""):
                        assert block == original.read(len(block)), f"Byte mismatch: {name}"
                        reconstructed.update(block)
            assert original.read(1) == b"", f"Incomplete reconstruction: {name}"
        expected = digest(source)
        assert reconstructed.hexdigest() == expected
        assert sum(p["bytes"] for p in parts) == size
        releases.append({"id": release_id, "label": label, "filename": name, "bytes": size, "sha256": expected,
                         "origin": "Original archive supplied by the user; bytes preserved without extraction or repacking.", "parts": parts})
    manifest = {"schema_version": 1, "prepared_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "part_size_bytes": PART_BYTES, "releases": releases,
                "note": "Parts concatenate in listed order to the original supplied archive. Each part and the complete archive have a SHA-256 checksum. The browser verifies both before saving."}
    content = json.dumps(manifest, indent=2) + "\n"
    (STAGING / "releases.json").write_text(content)
    (APP / "public" / "data" / "releases.json").write_text(content)
    (STAGING / "verification.json").write_text(json.dumps({"checked_at": manifest["prepared_at"], "byte_equal": True,
                                                           "archives": len(releases), "parts": sum(len(r["parts"]) for r in releases),
                                                           "bytes": sum(r["bytes"] for r in releases)}, indent=2) + "\n")
    print(json.dumps({"staging": str(STAGING), "releases": [{"id": r["id"], "bytes": r["bytes"], "parts": len(r["parts"]), "sha256": r["sha256"]} for r in releases]}, indent=2))


if __name__ == "__main__":
    main()
