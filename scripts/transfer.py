#!/usr/bin/env python3
"""Import or export one self-contained skill bundle (Python 3.9+)."""

import argparse
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = (
    "legal", "development", "operations", "investigation",
    "research", "publishing", "design",
)


def check_bundle(folder):
    if not (folder / "SKILL.md").is_file():
        raise ValueError(f"No SKILL.md at the bundle root: {folder}")
    for item in [folder, *folder.rglob("*")]:
        if item.is_symlink() or not (item.is_dir() or item.is_file()):
            raise ValueError(f"Bundles must contain ordinary files/directories: {item}")


def unpack(archive, destination):
    with zipfile.ZipFile(archive) as bundle:
        seen = set()
        for entry in bundle.infolist():
            path = PurePosixPath(entry.filename)
            if (not path.parts or path.is_absolute() or ".." in path.parts
                    or "\\" in entry.filename or ":" in path.parts[0]):
                raise ValueError(f"Unsafe ZIP path: {entry.filename}")
            if stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError(f"ZIP symlinks are unsupported: {entry.filename}")
            normalized = str(path)
            if normalized in seen:
                raise ValueError(f"Duplicate ZIP path: {entry.filename}")
            seen.add(normalized)
        bundle.extractall(destination)

    if (destination / "SKILL.md").is_file():
        return destination
    children = list(destination.iterdir())
    if len(children) == 1 and children[0].is_dir():
        check_bundle(children[0])
        return children[0]
    raise ValueError("ZIP must contain SKILL.md at its root or inside one enclosing folder.")


def read_source(source, temporary):
    if source.is_symlink():
        raise ValueError(f"Source must not be a symlink: {source}")
    if source.is_dir():
        check_bundle(source)
        return source, False
    if not source.is_file():
        raise ValueError(f"Source does not exist: {source}")
    if source.name == "SKILL.md":
        return source, True
    if source.suffix.lower() == ".zip":
        folder = unpack(source, temporary)
        check_bundle(folder)
        return folder, False
    raise ValueError("Source must be a skill directory, a ZIP, or a file named SKILL.md.")


def install(bundle, single_file, category, slug, replace):
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError("Slug must use lowercase letters, digits, and single hyphens.")
    parent = ROOT / "skills" / category
    if (ROOT / "skills").is_symlink() or parent.is_symlink():
        raise ValueError("The repository's skills/category directories must not be symlinks.")
    target = parent / slug
    if target.is_symlink() or (target.exists() and not target.is_dir()):
        raise ValueError(f"Target is not an ordinary directory: {target}")
    if target.exists() and not replace:
        raise ValueError(f"Target already exists; use --replace to update it: {target}")
    if not single_file and target.resolve().is_relative_to(bundle.resolve()):
        raise ValueError("The destination must be outside the source directory.")
    parent.mkdir(parents=True, exist_ok=True)

    # Prepare the complete result before moving the existing bundle.
    with tempfile.TemporaryDirectory(prefix=".transfer-", dir=parent) as temporary:
        staging = Path(temporary)
        incoming, previous = staging / "incoming", staging / "previous"
        if single_file:
            if target.exists():
                check_bundle(target)
                shutil.copytree(target, incoming)
            else:
                incoming.mkdir()
            shutil.copy2(bundle, incoming / "SKILL.md")
        else:
            shutil.copytree(bundle, incoming)
        if target.exists():
            target.rename(previous)
        try:
            incoming.rename(target)
        except OSError:
            if previous.exists():
                previous.rename(target)
            raise
    return target


def import_skill(args):
    with tempfile.TemporaryDirectory(prefix="skill-import-") as temporary:
        bundle, single_file = read_source(args.source, Path(temporary))
        target = install(bundle, single_file, args.category, args.slug, args.replace)
    print(f"Imported: {target.relative_to(ROOT)}")
    print("Update the corresponding row in README.md and README.en.md.")


def export_skill(args):
    source = args.source
    check_bundle(source)
    source = source.resolve()
    output = args.output or ROOT / "dist" / f"{source.name}.zip"
    if output.resolve().is_relative_to(source.resolve()):
        raise ValueError("Write the ZIP outside the source skill directory.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=".transfer-", suffix=".zip",
                                     dir=output.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as archive:
            for item in sorted(source.rglob("*")):
                relative = item.relative_to(source)
                archive.write(item, (Path(source.name) / relative).as_posix())
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Exported: {output}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    incoming = commands.add_parser("import", help="Import a directory, ZIP, or SKILL.md")
    incoming.add_argument("source", type=Path)
    incoming.add_argument("--category", required=True, choices=CATEGORIES)
    incoming.add_argument("--slug", required=True, help="Destination folder name")
    incoming.add_argument(
        "--replace", action="store_true",
        help="Replace a bundle; for a single SKILL.md, retain existing auxiliary files",
    )
    incoming.set_defaults(run=import_skill)
    outgoing = commands.add_parser("export", help="Export one skill directory to ZIP")
    outgoing.add_argument("source", type=Path)
    outgoing.add_argument("--output", "-o", type=Path, help="Default: dist/<slug>.zip")
    outgoing.set_defaults(run=export_skill)
    args = parser.parse_args()
    try:
        args.run(args)
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()
