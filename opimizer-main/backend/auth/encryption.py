from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from base64 import urlsafe_b64encode
import os

class EncryptionManager:
    def __init__(self):
        self.master_key = os.getenv('ENCRYPTION_MASTER_KEY', 'change-me-in-production-32chars!')
        if len(self.master_key) < 32:
            self.master_key = self.master_key.ljust(32, '0')
    
    def _derive_key(self, salt: bytes = b'portfolio_optimizer') -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = kdf.derive(self.master_key.encode())
        return urlsafe_b64encode(key)
    
    def encrypt(self, data: str) -> str:
        if not data:
            return ''
        key = self._derive_key()
        f = Fernet(key)
        encrypted = f.encrypt(data.encode())
        return encrypted.decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        if not encrypted_data:
            return ''
        key = self._derive_key()
        f = Fernet(key)
        decrypted = f.decrypt(encrypted_data.encode())
        return decrypted.decode()
    
    def get_masked_display(self, encrypted_data: str, visible_chars: int = 4) -> str:
        try:
            decrypted = self.decrypt(encrypted_data)
            if len(decrypted) <= visible_chars:
                return '*' * len(decrypted)
            return '*' * (len(decrypted) - visible_chars) + decrypted[-visible_chars:]
        except:
            return '***'

encryption_manager = EncryptionManager()
