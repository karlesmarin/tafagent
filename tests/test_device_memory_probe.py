import json
from pathlib import Path
import sys
import tempfile
import time
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cli.device_memory_probe import device_memory_probe


class ProbeTests(unittest.TestCase):
    def test_samples_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'reading.json'
            values = iter([400, 450])
            def query(_): return 'GPU-test', next(values), 1000
            with device_memory_probe(path, interval_ms=60000, _query=query):
                pass
            data = json.loads(path.read_text())
            self.assertEqual(data['peak'], {'value':450,'unit':'MiB','metric':'device'})
            self.assertEqual(data['sampling']['baseline_MiB'],400)
            self.assertEqual(data['sampling']['count'],2)
            self.assertIsNone(data['model'])
            self.assertIsNone(data['runtime']['engine'])
            with self.assertRaises(FileExistsError):
                with device_memory_probe(path, _query=query): pass

    def test_failed_workload_and_sample_leave_no_report(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'reading.json'
            with self.assertRaises(RuntimeError):
                with device_memory_probe(path, _query=lambda _:('GPU-test',10,100)):
                    raise RuntimeError('workload failed')
            self.assertFalse(path.exists())
            calls = [0]
            def broken(_):
                calls[0] += 1
                if calls[0] > 1: raise RuntimeError('missing sample')
                return 'GPU-test',10,100
            with self.assertRaises(RuntimeError):
                with device_memory_probe(path, interval_ms=100, _query=broken): time.sleep(.2)
            self.assertFalse(path.exists())


if __name__ == '__main__': unittest.main()
