import os
import json
from base64 import urlsafe_b64encode

# Simple VAPID key generator
def generate_vapid_keys():
    import ecdsa
    sk = ecdsa.SigningKey.generate(curve=ecdsa.NIST256p)
    vk = sk.get_verifying_key()
    
    private_key_bytes = sk.to_string()
    public_key_bytes = b"\x04" + vk.to_string()
    
    private_key_b64 = urlsafe_b64encode(private_key_bytes).decode('utf-8').rstrip('=')
    public_key_b64 = urlsafe_b64encode(public_key_bytes).decode('utf-8').rstrip('=')
    
    return public_key_b64, private_key_b64

try:
    pub, priv = generate_vapid_keys()
    env_path = 'backend/.env'
    
    with open(env_path, 'a') as f:
        f.write("\nRESEND_API_KEY=your-resend-api-key-here\n")
        f.write(f"VAPID_PUBLIC_KEY={pub}\n")
        f.write(f"VAPID_PRIVATE_KEY={priv}\n")
        f.write("VAPID_SUBJECT=mailto:admin@fluently.app\n")
        
    print(f"Keys generated and appended to {env_path}")
    print(f"Public Key: {pub}")
except Exception as e:
    print(f"Error: {e}")
