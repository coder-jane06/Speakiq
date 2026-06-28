import pyttsx3
import os

engine = pyttsx3.init()
engine.save_to_file("Hello, this is a test session to ensure the spoken pipeline works correctly. The pipeline should easily process these words and generate a valid coaching report.", "spoken.wav")
engine.runAndWait()
print("Generated spoken.wav")
