"""Jarvis için yerel Chatterbox ses sunucusu.

Jarvis ana süreci bu betiği kullanıcının ~/.jarvis-tts ortamındaki Python ile başlatır:
    python chatterbox_server.py <port>
Model yüklenince stdout'a READY yazar. İstekler:
    GET  /health          -> 200
    POST /tts  {"text": "...", "exaggeration": 0.85, "cfg": 0.35}  -> audio/wav (16 bit PCM)
Ana süreç kapanınca (stdin kapanır) sunucu da kendini kapatır; arkada sahipsiz süreç kalmaz.
"""

import io
import json
import os
import sys
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import perth
import torch

# Filigran eklentisi Windows'ta yüklenemiyor; ses üretimi için gerekmez
if perth.PerthImplicitWatermarker is None:
    perth.PerthImplicitWatermarker = perth.DummyWatermarker

from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: E402

MAX_TEXT = 1000
PORT = int(sys.argv[1])

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = ChatterboxMultilingualTTS.from_pretrained(device=device)
# Aynı anda tek cümle üretilir (ekran kartı belleği ve sıra korunur)
lock = threading.Lock()


def to_wav(samples) -> bytes:
    pcm = (samples.squeeze().clamp(-1, 1) * 32767).to(torch.int16).cpu().numpy().tobytes()
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(model.sr)
        out.writeframes(pcm)
    return buffer.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # sessiz çalış
        pass

    def do_GET(self):
        self.send_response(200 if self.path == '/health' else 404)
        self.end_headers()

    def do_POST(self):
        if self.path != '/tts':
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            body = json.loads(self.rfile.read(length) or b'{}')
            text = str(body.get('text', '')).strip()[:MAX_TEXT]
            if not text:
                raise ValueError('boş metin')
            exaggeration = float(body.get('exaggeration', 0.85))
            cfg = float(body.get('cfg', 0.35))
            with lock, torch.inference_mode():
                samples = model.generate(
                    text, language_id='tr', exaggeration=exaggeration, cfg_weight=cfg
                )
            data = to_wav(samples)
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as error:  # noqa: BLE001
            message = str(error).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Length', str(len(message)))
            self.end_headers()
            self.wfile.write(message)


def watch_parent():
    # Jarvis kapanınca stdin kapanır; sunucu da çıkar
    try:
        sys.stdin.read()
    finally:
        os._exit(0)


threading.Thread(target=watch_parent, daemon=True).start()
server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
print('READY', flush=True)
server.serve_forever()
