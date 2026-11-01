"""Regression checks for the APK validator, using small synthetic ELF/ZIP files."""

import contextlib
import importlib.util
import io
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("alignment", Path(__file__).with_name("check-android-16kb.py"))
alignment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alignment)


def elf(align=16384, address=0):
    data = bytearray(120)
    data[:6] = b"\x7fELF\x02\x01"
    struct.pack_into("<Q", data, 32, 64)
    struct.pack_into("<HH", data, 54, 56, 1)
    struct.pack_into("<IIQQQQQQ", data, 64, 1, 5, 0, address, 0, 120, 120, align)
    return data


class AlignmentTests(unittest.TestCase):
    def test_aligned_elf(self):
        self.assertEqual(alignment.elf_errors(elf()), [])

    def test_four_kilobyte_library(self):
        self.assertTrue(alignment.elf_errors(elf(4096)))

    def test_inconsistent_segment_offset(self):
        self.assertTrue(alignment.elf_errors(elf(address=4096)))

    def test_invalid_elf_is_rejected(self):
        self.assertTrue(alignment.elf_errors(b"invalid"))
        self.assertTrue(alignment.elf_errors(elf()[:80]))

    def test_zip_alignment_and_compression(self):
        for compressed, padded, expected in [(False, False, False), (False, True, True), (True, False, True)]:
            with self.subTest(compressed=compressed, padded=padded), tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "app.apk"
                entry = zipfile.ZipInfo("lib/arm64-v8a/libtest.so")
                entry.compress_type = zipfile.ZIP_DEFLATED if compressed else zipfile.ZIP_STORED
                if padded:
                    size = 16384 - 30 - len(entry.filename.encode())
                    entry.extra = struct.pack("<HH", 0xCAFE, size - 4) + bytes(size - 4)
                with zipfile.ZipFile(path, "w") as archive:
                    archive.writestr(entry, elf())
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(alignment.check_apk(path), expected)

    def test_apk_without_64_bit_libraries_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "empty.apk"
            with zipfile.ZipFile(path, "w"):
                pass
            with self.assertRaises(ValueError):
                alignment.check_apk(path)


if __name__ == "__main__":
    unittest.main()
