import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('memory_probe',Path(__file__).resolve().parents[1]/'cli/memory_probe.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Cuda:
    def __init__(self):self.events=[]
    def is_available(self):return True
    def current_device(self):return 2
    def synchronize(self,device):self.events.append(('sync',device))
    def reset_peak_memory_stats(self,device):self.events.append(('reset',device))
    def max_memory_allocated(self,device):self.events.append(('allocated',device));return 22*1024**3
    def max_memory_reserved(self,device):self.events.append(('reserved',device));return 23*1024**3
class Torch:
    __version__='fake-for-unit-test'
    def __init__(self):self.cuda=Cuda()
class ProbeTests(unittest.TestCase):
    def test_boundaries_and_units(self):
        t=Torch()
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'peak.json'
            with m.memory_probe(p,phase='decode',_torch=t) as record:
                t.cuda.events.append(('operation',2));record['tokens']=128
            result=json.loads(p.read_text(encoding='utf-8'))
            self.assertEqual(t.cuda.events,[('sync',2),('reset',2),('operation',2),('sync',2),('allocated',2)])
            self.assertEqual(result['peak'],{'value':22528,'unit':'MiB','metric':'allocated'})
            self.assertIsNone(result['model']);self.assertIsNone(result['phase_isolated']);self.assertEqual(result['tokens'],128)
    def test_reserved_and_device(self):
        with tempfile.TemporaryDirectory() as d:
            t=Torch();p=Path(d)/'peak.json'
            with m.memory_probe(p,device=1,metric='reserved',_torch=t):pass
            self.assertEqual(t.cuda.events[-1],('reserved',1));self.assertEqual(json.loads(p.read_text())['peak']['value'],23552)
    def test_failure_never_writes_or_suppresses(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'peak.json'
            with self.assertRaisesRegex(RuntimeError,'OOM'):
                with m.memory_probe(p,_torch=Torch()):raise RuntimeError('OOM')
            self.assertFalse(p.exists())
    def test_existing_file_not_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'peak.json';p.write_text('keep');t=Torch()
            with self.assertRaises(FileExistsError):
                with m.memory_probe(p,_torch=t):self.fail('should not enter')
            self.assertEqual(p.read_text(),'keep');self.assertEqual(t.cuda.events,[])
    def test_bad_metadata_and_no_cuda(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'peak.json'
            with self.assertRaises(ValueError):
                with m.memory_probe(p,tokens=True,_torch=Torch()):pass
            t=Torch();t.cuda.is_available=lambda:False
            with self.assertRaisesRegex(RuntimeError,'CUDA'):
                with m.memory_probe(p,_torch=t):pass
            self.assertFalse(p.exists())
if __name__=='__main__':unittest.main()
