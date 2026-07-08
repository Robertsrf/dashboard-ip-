"""Cifra el payload (datos+informes) con AES-256-GCM. La clave maestra se
envuelve con una clave derivada por PBKDF2-SHA256 de cada codigo de 6 digitos.
Compatible con WebCrypto del navegador."""
import os, json, base64, hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
b64 = lambda b: base64.b64encode(b).decode()

def encrypt(payload_str, secrets):
    iters = int(secrets.get("iterations", 200000))
    mk = os.urandom(32)
    iv = os.urandom(12)
    ct = AESGCM(mk).encrypt(iv, payload_str.encode("utf-8"), None)
    users = []
    for u in secrets["users"]:
        salt = os.urandom(16)
        uk = hashlib.pbkdf2_hmac("sha256", u["pin"].encode(), salt, iters, 32)
        ivu = os.urandom(12)
        wrapped = AESGCM(uk).encrypt(ivu, mk, None)
        users.append({"name": u["name"], "role": u["role"], "greet": u.get("greet", u["name"]),
                      "salt": b64(salt), "ivu": b64(ivu), "wrapped": b64(wrapped)})
    return {"iter": iters, "iv": b64(iv), "ct": b64(ct), "users": users}
