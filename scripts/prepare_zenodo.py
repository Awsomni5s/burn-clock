#!/usr/bin/env python3
"""Prepare a local Zenodo handoff; never upload, reserve a DOI, or fetch data.

Reassemble the existing release parts and verify their declared SHA-256 hashes.
The package holds each original supplied archive once, plus attribution,
provenance and reproduction notes. No raw scientific inputs are invented.

Usage: python3 scripts/prepare_zenodo.py
Default output: ../output/zenodo (outside the application source repository).
Use --prepared-at with the same ISO UTC value for byte-repeatable metadata.
"""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import tempfile

APP = Path(__file__).resolve().parents[1]
RELEASE_NAME = "burn-clock-release-2026-11-14"
DOCUMENTS = (
    "DATA_CONTRACT.md", "DATA_PROVENANCE.md", "SOURCE_AUDIT.md",
    "PRODUCT_EVIDENCE_AUDIT.md", "VALIDATION_REPORT.md",
)


def digest_file(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def checked_path(root, relative):
    name = PurePosixPath(relative)
    if name.is_absolute() or ".." in name.parts or not name.parts:
        raise ValueError(f"Unsafe path: {relative}")
    result = root / relative
    if result.is_symlink() or not result.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes its root: {relative}")
    return result


def inspect_archive(path):
    count = 0
    generators = []
    with tarfile.open(path, "r:gz") as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            if (name.is_absolute() or ".." in name.parts
                    or not (member.isfile() or member.isdir())):
                raise ValueError(f"Unsafe original archive member: {member.name}")
            if member.isfile():
                count += 1
            if name.as_posix().endswith("contours/make_contours.py"):
                generators.append(member.name)
    return {"regular_files": count, "safe_member_paths": True,
            "original_contour_generator_files": generators}


def metadata(version):
    return {
        "title": f"Burn Clock: historical fire activity data, contour maps and supplied pipeline (v{version})",
        "upload_type": "dataset",
        "publication_date": "2026-11-14", "access_right": "open",
        "license": "cc-by-4.0",
        "creators": [{"name": "Burn Clock contributors"}],
        "description": (
            "<p>Preserved original public-data, contour and pipeline archives supplied "
            "for the 14 November 2026 Burn Clock build, with checksums, data contract, "
            "source audit and reproduction limits. Historical fire-activity observations "
            "end in December 2025. The current web application source is not included "
            "in this data-and-pipeline package.</p>"
            "<p>The derived compilation is CC BY 4.0; Burn Clock code is MIT licensed. "
            "Upstream NASA FIRMS and Hiren Jethva GK2-AMI dataset rights and attribution "
            "are preserved in DATA_LICENSE.md. The listed creator is a provisional "
            "collective name, not a claim of individual authorship.</p>"
            "<p>The full scientific pipeline was not rerun during the app build. Raw "
            "FIRMS archives, processed Parquet inputs and the original contour generator "
            "are absent. Selected source spot checks and checks of supplied outputs are "
            "documented separately. Counts and pixel-hours are not burned area, "
            "emissions or ground truth. No real-person usability results are asserted.</p>"
        ),
        "keywords": ["active fire", "satellite observation timing", "MODIS", "VIIRS", "GK2A", "Punjab"],
        "related_identifiers": [
            {"identifier": "10.5281/zenodo.20084790", "scheme": "doi", "relation": "isDerivedFrom"},
            {"identifier": "https://firms.modaps.eosdis.nasa.gov/", "scheme": "url", "relation": "isDerivedFrom"},
        ],
        "references": [
            "Jethva, H. (2026). Timing the Flames: Geostationary Satellite Detection of Diurnally Shifting Stubble Burning in Northwestern India. Remote Sensing 18(10), 1506. https://doi.org/10.3390/rs18101506"
        ],
    }


REPRODUCTION = """# Reproduction scope

This package preserves three supplied releases byte-for-byte. It supports
inspection of their outputs and source, not a claim that all scientific results
have been independently regenerated. `MANIFEST.json` records the actual hashes.

## Inspect the supplied releases

Extract the outer package, then work inside its `burn-clock-release-2026-11-14`
directory. `sha256sum -c SHA256SUMS` checks every payload; on macOS use
`shasum -a 256 -c SHA256SUMS` instead. Inside a new empty working directory:

```sh
mkdir work
tar -xzf original-releases/burnclock_public_data_2026-11-14_1.tar.gz -C work
tar -xzf original-releases/burnclock_pipeline_code_2026-11-14_2.tar.gz -C work
tar -xzf original-releases/burnclock_contours_2026-11-14.tar.gz -C work/public/data
```

The public-data archive expands to `public/data/`; the source archive expands
to `pipeline/`; the contour archive expands to `contours/`. Leave enough disk
space: uncompressed historical data exceed one gigabyte. Original archive paths
were checked for traversal and non-file/non-directory members before packaging.

Read `docs/DATA_CONTRACT.md`, the supplied `public/data/README.md`, and pipeline
reports before interpreting arrays. The final harmonized arrays take precedence
over stale earlier pipeline notes claiming those arrays were empty. The historical
archive ends in December 2025; no NOAA-21 historical series is present.

## Available and unavailable reproduction

- The original three archive SHA-256 values and every release-part hash were
  independently checked while preparing this package. This establishes byte
  preservation, not correctness of the scientific inference.
- The source manifest records 48 FIRMS archives, 548,501,203 input rows and
  9,751,298,609 downloaded bytes. These raw yearly ZIP files are not included.
  They were not all downloaded again during the application build. One MODIS
  2000 ZIP was independently downloaded, hashed and counted; see SOURCE_AUDIT.
- Processed cell-day tables, `q25_month.parquet`, `c1_year_month.parquet` and
  other intermediate scientific inputs are missing. Source code alone does not
  make the full ingest, model fit and validation rerun complete.
- Selected raw Punjab GK2-AMI files for 2019, 2021 and 2025 were downloaded in
  memory and checked against upstream MD5 hashes and hourly counts. Those raw
  source files are not included. See PRODUCT_EVIDENCE_AUDIT for the actual scope;
  it updates the older broad statement in DATA_PROVENANCE that no GK2A raw files
  had been reprocessed. This was a spot check, not a complete scientific rerun.
- The supplied maps are precomputed. `pipeline/contours/make_contours.py` was
  not supplied. Packaging and palette checks cannot regenerate the contours.
- The current web application source, node dependencies, deployment, dynamic
  live feed and application browser are not contained in this data-and-pipeline
  deposit. Obtain the final app source separately; this package does not claim
  that a recorded source-repository commit contains its uncommitted metadata.
- Automated app checks do not substitute for real-person studies. Human study
  results remain pending unless separately collected and reported.

The original pipeline can guide a future rerun after obtaining the inputs and
environment it requires. Preserve the original supplied outputs and record new
results separately. Do not present the packaged validation metrics as a new run.
"""

UPLOAD_NOTES = """# Zenodo handoff — prepared locally, not uploaded

Upload the `.tar.gz` package and its outer `SHA256SUMS` together with this handoff
metadata. `.zenodo.json` is a draft using Zenodo's documented deposit-metadata
fields; it does not create a record. The publication date refers to the supplied
14 November 2026 release, not an asserted Zenodo publication event.

The creator is the provisional collective **Burn Clock contributors**. The team
may replace it with verified contributor names before depositing. No person,
institution, grant, ORCID, repository URL or Burn Clock DOI was invented. The
existing DOI in the source references belongs to Hiren Jethva's upstream data.

Set the record license to CC BY 4.0 for the derived data compilation and retain
the explicit MIT-code/source-rights exceptions in its description and files.
The application itself remains separately hosted; this package contains the
supplied scientific pipeline, not a frozen snapshot of the current app source.

Once a teammate has actually published the record, record its real URL and DOI
in the project citation and Methods page. Do not label the release as deposited
or DOI-backed before that happens. No authentication or upload is performed by
`scripts/prepare_zenodo.py`.

Metadata format: https://developers.zenodo.org/#deposit-metadata
Citation format: https://citation-file-format.github.io/
Source rights: see DATA_LICENSE.md and LICENSE.
Reproduction limits: see REPRODUCING.md.
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=APP.parent / "output/zenodo")
    parser.add_argument("--prepared-at", help="ISO timestamp, for reproducible metadata")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(APP):
        raise ValueError("Keep the upload package outside the app repository")
    output.mkdir(parents=True, exist_ok=True)
    prepared_at = args.prepared_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    datetime.fromisoformat(prepared_at.replace("Z", "+00:00"))
    releases = json.loads((APP / "public/data/releases.json").read_text())
    if {r["id"] for r in releases["releases"]} != {"archive", "contours", "pipeline"}:
        raise ValueError("Expected the three supplied original releases")
    version = json.loads((APP / "package.json").read_text())["version"]
    for name in ("CITATION.cff", "DATA_LICENSE.md"):
        if (APP / name).read_bytes() != (APP / "public/docs" / name).read_bytes():
            raise ValueError(f"Published document differs: {name}")
    with tempfile.TemporaryDirectory(prefix=".prepare-", dir=output) as temp:
        staging = Path(temp)
        payloads = {}
        original_records = []
        for release in releases["releases"]:
            filename = release["filename"]
            if PurePosixPath(filename).name != filename:
                raise ValueError("Release filename must be a basename")
            destination = staging / filename
            with destination.open("wb") as target:
                for part in release["parts"]:
                    part_path = part["path"]
                    if not part_path.startswith("/releases/parts/"):
                        raise ValueError(f"Unexpected release part: {part_path}")
                    path = checked_path(APP / "public", part_path.lstrip("/"))
                    if path.stat().st_size != part["bytes"] or digest_file(path) != part["sha256"]:
                        raise ValueError(f"Part verification failed: {part_path}")
                    with path.open("rb") as source:
                        shutil.copyfileobj(source, target)
            if destination.stat().st_size != release["bytes"] or digest_file(destination) != release["sha256"]:
                raise ValueError(f"Release verification failed: {filename}")
            inspection = inspect_archive(destination)
            payloads[f"original-releases/{filename}"] = destination
            original_records.append({k: release[k] for k in ("id", "filename", "bytes", "sha256")} | inspection)

        for name in ("CITATION.cff", "LICENSE", "DATA_LICENSE.md"):
            payloads[name] = (APP / name).read_bytes()
        for name in DOCUMENTS:
            payloads[f"docs/{name}"] = (APP / "public/docs" / name).read_bytes()
        payloads["releases.json"] = (APP / "public/data/releases.json").read_bytes()
        payloads[".zenodo.json"] = json_bytes(metadata(version))
        payloads["REPRODUCING.md"] = REPRODUCTION.encode()
        payloads["UPLOAD_NOTES.md"] = UPLOAD_NOTES.encode()
        payloads["prepare_zenodo.py"] = Path(__file__).read_bytes()
        inventory = []
        for name, content in sorted(payloads.items()):
            inventory.append({"path": name,
                              "bytes": content.stat().st_size if isinstance(content, Path) else len(content),
                              "sha256": digest_file(content) if isinstance(content, Path) else hashlib.sha256(content).hexdigest()})
        manifest = {"schema_version": 1, "prepared_at": prepared_at, "uploaded": False,
                    "burn_clock_doi": None, "version": version,
                    "source_repository_head_at_preparation": subprocess.check_output(
                        ["git", "rev-parse", "HEAD"], cwd=APP, text=True).strip(),
                    "repository_note": "Context only; this is not an app source snapshot or a claim of a clean working tree.",
                    "original_releases": original_records, "files": inventory}
        payloads["MANIFEST.json"] = json_bytes(manifest)
        payloads["SHA256SUMS"] = ("".join(f"{item['sha256']}  {item['path']}\n" for item in inventory)
                                   + f"{hashlib.sha256(payloads['MANIFEST.json']).hexdigest()}  MANIFEST.json\n").encode()
        archive_path = staging / f"{RELEASE_NAME}.tar.gz"
        with archive_path.open("wb") as target, gzip.GzipFile(filename="", fileobj=target, mode="wb", mtime=0, compresslevel=6) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as archive:
                for name, content in sorted(payloads.items()):
                    info = tarfile.TarInfo(f"{RELEASE_NAME}/{name}")
                    info.size = content.stat().st_size if isinstance(content, Path) else len(content)
                    info.mode = 0o644
                    with content.open("rb") if isinstance(content, Path) else io.BytesIO(content) as source:
                        archive.addfile(info, source)
        with tarfile.open(archive_path, "r:gz") as archive:
            if len(archive.getmembers()) != len(payloads):
                raise ValueError("Package member count changed")
            for member in archive:
                name = str(PurePosixPath(member.name).relative_to(RELEASE_NAME))
                expected = payloads[name]
                expected_hash = digest_file(expected) if isinstance(expected, Path) else hashlib.sha256(expected).hexdigest()
                if hashlib.file_digest(archive.extractfile(member), "sha256").hexdigest() != expected_hash:
                    raise ValueError(f"Packaged content differs: {name}")
        final = output / archive_path.name
        archive_path.replace(final)
        sidecars = ("CITATION.cff", "LICENSE", "DATA_LICENSE.md", ".zenodo.json", "MANIFEST.json", "REPRODUCING.md", "UPLOAD_NOTES.md")
        for name in sidecars:
            (output / name).write_bytes(payloads[name])
        verification = {"prepared_at": prepared_at, "uploaded": False, "burn_clock_doi": None,
                        "package": final.name, "bytes": final.stat().st_size, "sha256": digest_file(final),
                        "verified_package_members": len(payloads), "verified_original_releases": len(original_records),
                        "verified_release_parts": sum(len(r["parts"]) for r in releases["releases"]),
                        "all_original_bytes_preserved": True, "full_scientific_rerun": False,
                        "original_contour_generator_included": any(r["original_contour_generator_files"] for r in original_records)}
        (output / "verification.json").write_bytes(json_bytes(verification))
        files = sorted([final] + [output / name for name in sidecars] + [output / "verification.json"])
        (output / "SHA256SUMS").write_text("".join(f"{digest_file(path)}  {path.name}\n" for path in files))
        print(json.dumps(verification, indent=2))


if __name__ == "__main__":
    main()
