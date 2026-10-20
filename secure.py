"""Cifra el paquete de datos con AES-256-GCM. La clave maestra se envuelve con
una clave derivada por PBKDF2-SHA256 de cada PIN de 6 digitos. Compatible con
WebCrypto del navegador (ver desbloquear() en app/core.js)."""
import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def b64(b):
    return base64.b64encode(b).decode()


def encrypt_bytes(data, users, iters=200000):
    """data: bytes (el paquete gzip). users: [{name, role, greet, pin}].
    Cada llamada usa una clave maestra nueva: el paquete normal y el de
    reunion no comparten clave, asi que un PIN no abre el paquete del otro."""
    mk = os.urandom(32)
    iv = os.urandom(12)
    ct = AESGCM(mk).encrypt(iv, data, None)
    out = []
    for u in users:
        salt = os.urandom(16)
        uk = hashlib.pbkdf2_hmac("sha256", u["pin"].encode(), salt, iters, 32)
        ivu = os.urandom(12)
        out.append({"name": u["name"], "role": u["role"], "greet": u.get("greet", u["name"]),
                    "salt": b64(salt), "ivu": b64(ivu), "wrapped": b64(AESGCM(uk).encrypt(ivu, mk, None))})
    return {"iter": iters, "iv": b64(iv), "ct": b64(ct), "users": out}


def encrypt(payload_str, secrets):
    """Compatibilidad: cifra un texto para los usuarios de secrets.json."""
    return encrypt_bytes(payload_str.encode("utf-8"), secrets["users"],
                         int(secrets.get("iterations", 200000)))


def reunion_users(secrets):
    """El usuario del modo reunion, si secrets.json trae su PIN."""
    r = secrets.get("reunion")
    if not r or not r.get("pin"):
        return []
    return [{"name": "Reunión", "role": "reunion", "greet": r.get("greet", "equipo"), "pin": r["pin"]}]
