from huggingface_hub import get_space_runtime
import sys
space_id = "Shaurya0606/speakiq-backend"
try:
    runtime = get_space_runtime(space_id)
    # The get_space_runtime doesn't directly expose logs.
    print(runtime)
except Exception as e:
    print(f"Error: {e}")
