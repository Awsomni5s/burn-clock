#!/usr/bin/env python3
"""Validate and package the supplied contours; this does not generate contours.

Usage: python3 scripts/prepare_contours.py /path/to/burnclock_contours_2026-11-14.tar.gz
Original bytes are retained in ../public/data/contours by default. Only deterministic
gzip GeoJSON and plain JSON metadata/catalog are written into the app public folder.
The supplier's named pipeline/contours/make_contours.py was not supplied in the
pipeline archive; no replacement generator or false reproducibility claim is made.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile


def prepare(archive: Path, raw_root: Path, serving_root: Path):
    contents = {}
    with tarfile.open(archive, "r:gz") as source:
        for member in source.getmembers():
            name = PurePosixPath(member.name)
            if (name.is_absolute() or ".." in name.parts or not name.parts
                    or name.parts[0] != "contours" or not (member.isfile() or member.isdir())):
                raise ValueError(f"Unsafe or unexpected archive member: {member.name}")
            if member.isfile():
                if len(name.parts) != 2 or name.suffix not in (".json", ".geojson"):
                    raise ValueError(f"Unexpected contour asset: {member.name}")
                contents[name.name] = source.extractfile(member).read()
    meta = json.loads(contents["contours_meta.json"])
    expected = {f"world_{y}.geojson": "world" for y in meta["world"]["years"]}
    expected.update({f"punjab_viirs_{y}.geojson": "punjab_viirs" for y in meta["punjab_viirs"]["years"]})
    expected.update({f"punjab_gk2a_{y}_{h}.geojson": "punjab_gk2a"
                     for y in meta["punjab_gk2a"]["years"] for h in meta["punjab_gk2a"]["hours_ist"]})
    if set(contents) != set(expected) | {"contours_meta.json"}:
        raise ValueError("Archive contents differ from the declared year/hour grid")
    entries = []
    # Validate everything before writing any asset.
    for filename, series in expected.items():
        data = json.loads(contents[filename])
        if data.get("type") != "FeatureCollection":
            raise ValueError(f"Invalid GeoJSON: {filename}")
        for feature in data["features"]:
            props = feature["properties"]
            band = props["band"]
            levels = meta[series]["levels"]
            if not isinstance(band, int) or not 0 <= band < len(levels):
                raise ValueError(f"Invalid band in {filename}")
            hi = levels[band + 1] if band + 1 < len(levels) else None
            if (props["color"] != meta["palette"][band]
                    or props["lo"] != levels[band] or props["hi"] != hi):
                raise ValueError(f"Colour or bound differs from metadata: {filename}")
    for filename, content in sorted(contents.items()):
        original = raw_root / "contours" / filename
        original.parent.mkdir(parents=True, exist_ok=True)
        original.write_bytes(content)
        served = serving_root / "contours" / filename
        served.parent.mkdir(parents=True, exist_ok=True)
        data = json.loads(content)
        if filename.endswith(".geojson"):
            served = served.with_suffix(".geojson.gz")
            served.write_bytes(gzip.compress(content, compresslevel=9, mtime=0))
        else:
            served.write_bytes(content)
        entries.append({"file": filename, "bytes": len(content), "served_bytes": served.stat().st_size,
                        "sha256": hashlib.sha256(content).hexdigest(),
                        "features": len(data["features"]) if "features" in data else None})
    catalog = {"source_archive": archive.name, "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
               "geojson_files": len(expected), "files": entries,
               "notes": ["Original GeoJSON copied byte-for-byte to sibling public/data/contours.",
                         "Serving GeoJSON uses deterministic gzip; metadata is plain JSON.",
                         "All feature colors and band bounds match supplied metadata exactly.",
                         "This packaging script does not regenerate the contours; the supplier's named contour generator was absent from the supplied pipeline archive."]}
    (serving_root / "contours" / "asset_catalog.json").write_text(json.dumps(catalog, indent=2) + "\n")
    return {"files": len(entries), "geojson": len(expected),
            "raw_bytes": sum(e["bytes"] for e in entries), "served_bytes": sum(e["served_bytes"] for e in entries)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--raw-root", type=Path, default=Path("../public/data"))
    parser.add_argument("--serving-root", type=Path, default=Path("public/data"))
    args = parser.parse_args()
    print(json.dumps(prepare(args.archive, args.raw_root, args.serving_root), indent=2))
