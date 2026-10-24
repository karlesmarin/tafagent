"""Real CPU forwards on tiny random-weight models. No network or pretrained claims."""
import json
import os
import subprocess
import sys
from pathlib import Path
import numpy as np
import pytest
import torch
from transformers import GPT2Config, GPT2LMHeadModel, LlamaConfig, LlamaForCausalLM, PreTrainedTokenizerFast
from tokenizers import Tokenizer
from tokenizers.models import WordLevel

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT / 'cli'))
from attention_entropy import measure_model_entropy


@pytest.mark.parametrize('kind', ['gpt2','llama'])
def test_real_cpu_attention(kind):
    torch.manual_seed(42)
    torch.set_num_threads(1)
    if kind == 'gpt2':
        cfg = GPT2Config(vocab_size=32,n_positions=32,n_embd=16,n_layer=1,n_head=2)
        cfg._attn_implementation='eager'
        model=GPT2LMHeadModel(cfg)
    else:
        cfg=LlamaConfig(vocab_size=32,hidden_size=16,intermediate_size=32,num_hidden_layers=1,num_attention_heads=2,num_key_value_heads=2,max_position_embeddings=32)
        cfg._attn_implementation='eager'
        model=LlamaForCausalLM(cfg)
    model.train()
    result=measure_model_entropy(model,length=16,samples=2)
    assert model.training  # Restore the caller's mode.
    assert result['status']=='measured' and result['protocol']['training_performed'] is False
    assert 0 <= result['mean_entropy_bits'] <= 4+1e-6
    assert len(result['rows'])==2 and result['protocol']['length']==16
    assert result['gamma_correction']['applied'] is False
    repeated=measure_model_entropy(model,length=16,samples=2)
    assert repeated['mean_entropy_bits']==pytest.approx(result['mean_entropy_bits'])
    with pytest.raises(ValueError):
        measure_model_entropy(model,length=16,samples=1,head=99)
    assert model.training
    # Audit against an independently calculated final-query entropy.
    ids=np.random.default_rng(42).integers(0,32,size=(1,16))
    model.eval()
    with torch.no_grad():
        a=model(torch.tensor(ids),output_attentions=True,use_cache=False).attentions[0][0,0,-1].double()
    q=a/a.sum()
    truth=float(-(q[q>0]*torch.log2(q[q>0])).sum())
    assert result['rows'][0]['entropy_bits']==pytest.approx(truth,abs=1e-7)


def test_cli_entropy_only_on_local_model(tmp_path):
    cfg=GPT2Config(vocab_size=8,n_positions=32,n_embd=16,n_layer=1,n_head=2)
    cfg._attn_implementation='eager'
    model=GPT2LMHeadModel(cfg)
    local=tmp_path/'model'
    model.save_pretrained(local)
    tok=Tokenizer(WordLevel({'[UNK]':0,**{f't{i}':i for i in range(1,8)}},unk_token='[UNK]'))
    PreTrainedTokenizerFast(tokenizer_object=tok,unk_token='[UNK]').save_pretrained(local)
    env={**os.environ,'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1'}
    run=subprocess.run([sys.executable,str(ROOT/'cli/diagnose_model.py'),'--model','fixture/tiny',
        '--local',str(local),'--cpu','--entropy-only','--entropy-tokens','16','--entropy-samples','2'],
        cwd=tmp_path,env=env,capture_output=True,text=True,encoding='utf-8',timeout=120)
    assert run.returncode==0,run.stdout+run.stderr
    result=json.loads((tmp_path/'diagnose_results/fixture--tiny.entropy.json').read_text(encoding='utf-8'))
    assert result['attention_entropy']['status']=='measured'
    assert 'gamma' not in result and 'gamma_corrected' not in result
    assert 'Measuring attention decay' not in run.stdout
