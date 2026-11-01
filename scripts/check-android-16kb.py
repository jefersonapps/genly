#!/usr/bin/env python3
"""Check 64-bit ELF LOAD segments and uncompressed JNI entries in a final APK.

Usage: python3 scripts/check-android-16kb.py path/to/app.apk
See https://developer.android.com/guide/practices/page-sizes
"""

import argparse
from pathlib import Path
import struct
import sys
import zipfile

PAGE_SIZE = 16384
ABIS = {"arm64-v8a", "x86_64"}


def elf_errors(data):
    if len(data) < 64 or data[:5] != b"\x7fELF\x02" or data[5] not in (1, 2):
        return ["invalid ELF64 header"]
    endian = "<" if data[5] == 1 else ">"
    offset = struct.unpack_from(endian + "Q", data, 32)[0]
    entry_size, count = struct.unpack_from(endian + "HH", data, 54)
    if entry_size < 56 or not count or offset + entry_size * count > len(data):
        return ["invalid ELF program header table"]
    errors = []
    loads = 0
    for index in range(count):
        header = struct.unpack_from(endian + "IIQQQQQQ", data, offset + index * entry_size)
        kind, _, file_offset, address, _, _, _, alignment = header
        if kind != 1:  # PT_LOAD
            continue
        loads += 1
        if alignment < PAGE_SIZE or alignment & (alignment - 1):
            errors.append(f"LOAD[{index}] alignment is {alignment:#x}; requires >= 0x4000")
        if (address - file_offset) % PAGE_SIZE:
            errors.append(f"LOAD[{index}] virtual address/file offset mismatch at 16 KB")
    if not loads:
        errors.append("ELF has no LOAD segments")
    return errors


def check_apk(path):
    checked = 0
    failed = 0
    with zipfile.ZipFile(path) as archive, open(path, "rb") as apk:
        for entry in archive.infolist():
            parts = entry.filename.split("/")
            if len(parts) != 3 or parts[0] != "lib" or parts[1] not in ABIS or not parts[2].endswith(".so"):
                continue
            checked += 1
            errors = elf_errors(archive.read(entry))
            if entry.compress_type == zipfile.ZIP_STORED:
                apk.seek(entry.header_offset)
                header = apk.read(30)
                name_size, extra_size = struct.unpack_from("<HH", header, 26)
                data_offset = entry.header_offset + 30 + name_size + extra_size
                if data_offset % PAGE_SIZE:
                    errors.append(f"uncompressed ZIP entry starts at {data_offset:#x}; not 16 KB aligned")
            if errors:
                failed += 1
                print(f"FAIL {entry.filename}: {'; '.join(errors)}")
            else:
                print(f"OK   {entry.filename}")
    if not checked:
        raise ValueError("No arm64-v8a/x86_64 native libraries found; check a final 64-bit APK.")
    print(f"\n{checked} native libraries checked; {failed} failed.")
    return failed == 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    args = parser.parse_args()
    try:
        return 0 if check_apk(args.apk) else 1
    except (OSError, ValueError, struct.error, zipfile.BadZipFile) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
