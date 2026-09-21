import os
import cv2
import numpy as np
import math
import json
import random

VENV_PYTHON = "/Users/osmansanjar/.gemini/antigravity/brain/8d6c113a-e1a8-45c2-bdb5-551f94f56ae0/scratch/venv/bin/python3"

def rgb_to_lab(r, g, b):
    rN = (r/255.0 + 0.055)/1.055**2.4 if r/255.0 > 0.04045 else (r/255.0)/12.92
    gN = (g/255.0 + 0.055)/1.055**2.4 if g/255.0 > 0.04045 else (g/255.0)/12.92
    bN = (b/255.0 + 0.055)/1.055**2.4 if b/255.0 > 0.04045 else (b/255.0)/12.92
    x = (rN * 0.4124 + gN * 0.3576 + bN * 0.1805) / 0.95047
    y = (rN * 0.2126 + gN * 0.7152 + bN * 0.0722) / 1.00000
    z = (rN * 0.0193 + gN * 0.1192 + bN * 0.9505) / 1.08883
    fx = x**(1/3) if x > 0.008856 else (7.787 * x) + 16/116
    fy = y**(1/3) if y > 0.008856 else (7.787 * y) + 16/116
    fz = z**(1/3) if z > 0.008856 else (7.787 * z) + 16/116
    L = 116 * fy - 16
    a = 500 * (fx - fy)
    bColor = 200 * (fy - fz)
    return L, a, bColor

def calculate_delta_e(lab1, lab2):
    return math.sqrt((lab1[0]-lab2[0])**2 + (lab1[1]-lab2[1])**2 + (lab1[2]-lab2[2])**2)

def calculate_kubelka_munk(r_inf):
    r = min(0.98, max(0.02, r_inf))
    return ((1 - r)**2) / (2 * r)

VIDEO_MAPPING = {
    'videos/shade1.mp4': 0.0,   # Shade 1 (Lightest Fresh Patch: 0.0 ppm*h)
    'videos/shade3.mp4': 75.0,  # Shade 3 (Olive Sage Green: 75.0 ppm*h)
    'videos/shade4.mp4': 135.0, # Shade 4 (Brownish Grey: 135.0 ppm*h)
    'videos/shade5.mp4': 210.0  # Shade 5 (Dark Charcoal / Black: 210.0 ppm*h)
}

def extract_features_from_frame(frame):
    h, w, _ = frame.shape
    # Convert BGR to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Locate white label sticker plate (light, color-balanced paper)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Search for white sticker plate region
    white_mask = (rgb_frame[:,:,0] > 140) & (rgb_frame[:,:,1] > 135) & (rgb_frame[:,:,2] > 125) & \
                 (np.abs(rgb_frame[:,:,0].astype(int) - rgb_frame[:,:,1].astype(int)) < 30)
                 
    y_indices, x_indices = np.where(white_mask)
    if len(x_indices) < 100:
        return None, None
        
    min_x, max_x = np.min(x_indices), np.max(x_indices)
    min_y, max_y = np.min(y_indices), np.max(y_indices)
    box_w = max_x - min_x
    box_h = max_y - min_y
    
    if box_w < 30 or box_h < 20:
        return None, None
        
    # Chemical patch region: 30% to 58% of label width
    patch_startX = min_x + int(box_w * 0.30)
    patch_endX = min_x + int(box_w * 0.58)
    patch_startY = min_y + int(box_h * 0.18)
    patch_endY = min_y + int(box_h * 0.82)
    
    patch_crop = rgb_frame[patch_startY:patch_endY, patch_startX:patch_endX]
    if patch_crop.size == 0:
        return None, None
        
    # Sample white reference paper on left side (5% to 25% of label width)
    white_startX = min_x + int(box_w * 0.05)
    white_endX = min_x + int(box_w * 0.25)
    white_startY = min_y + int(box_h * 0.05)
    white_endY = min_y + int(box_h * 0.45)
    
    white_crop = rgb_frame[white_startY:white_endY, white_startX:white_endX]
    if white_crop.size == 0:
        return None, None
        
    avg_white_r = np.mean(white_crop[:,:,0])
    avg_white_g = np.mean(white_crop[:,:,1])
    avg_white_b = np.mean(white_crop[:,:,2])
    
    gain_r = 245.0 / max(60, avg_white_r)
    gain_g = 240.0 / max(60, avg_white_g)
    gain_b = 228.0 / max(60, avg_white_b)
    
    # Filter out dark outline ink & yellow silicone from patch
    patch_r = patch_crop[:,:,0].astype(float) * gain_r
    patch_g = patch_crop[:,:,1].astype(float) * gain_g
    patch_b = patch_crop[:,:,2].astype(float) * gain_b
    
    valid_mask = (patch_crop[:,:,0] > 30) & (patch_crop[:,:,1] > 30) & (patch_crop[:,:,2] > 30)
    if np.sum(valid_mask) < 20:
        return None, None
        
    avg_r = np.clip(np.mean(patch_r[valid_mask]), 0, 255)
    avg_g = np.clip(np.mean(patch_g[valid_mask]), 0, 255)
    avg_b = np.clip(np.mean(patch_b[valid_mask]), 0, 255)
    
    return (avg_r, avg_g, avg_b), (avg_white_r, avg_white_g, avg_white_b)

def main():
    print("=== Processing Video Dataset for H2S-Track XGBoost ML Retraining ===")
    
    samples = []
    
    for video_path, dose in VIDEO_MAPPING.items():
        if not os.path.exists(video_path):
            print(f"Warning: {video_path} not found.")
            continue
            
        cap = cv2.VideoCapture(video_path)
        frame_count = 0
        extracted_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            if frame_count % 3 != 0: # Sample every 3rd frame
                continue
                
            patch_rgb, white_rgb = extract_features_from_frame(frame)
            if patch_rgb is not None:
                samples.append({
                    'dose': dose,
                    'patch_rgb': patch_rgb,
                    'white_rgb': white_rgb,
                    'source': video_path
                })
                extracted_count += 1
                
        cap.release()
        print(f"Processed {video_path}: {extracted_count} physical frames extracted for dose {dose} ppm*h.")
        
    print(f"\nTotal physical training dataset samples extracted: {len(samples)}")
    
    # Synthesize Shade 2 (35.0 ppm*h) by interpolating physical Shade 1 (0.0) and Shade 3 (75.0)
    shade1_samples = [s for s in samples if s['dose'] == 0.0]
    shade3_samples = [s for s in samples if s['dose'] == 75.0]
    
    if shade1_samples and shade3_samples:
        for i in range(min(len(shade1_samples), len(shade3_samples))):
            s1 = shade1_samples[i]['patch_rgb']
            s3 = shade3_samples[i]['patch_rgb']
            s2_r = s1[0] * 0.55 + s3[0] * 0.45
            s2_g = s1[1] * 0.55 + s3[1] * 0.45
            s2_b = s1[2] * 0.55 + s3[2] * 0.45
            samples.append({
                'dose': 35.0,
                'patch_rgb': (s2_r, s2_g, s2_b),
                'white_rgb': shade1_samples[i]['white_rgb'],
                'source': 'synthesized_shade2'
            })
        print(f"Synthesized Shade 2 (35.0 ppm*h): {min(len(shade1_samples), len(shade3_samples))} samples added.")
        
    # Save dataset to JSON
    with open('videos/processed_dataset.json', 'w') as f:
        json.dump(samples, f, indent=2)
        
    print("\nDataset successfully compiled to videos/processed_dataset.json")

if __name__ == '__main__':
    main()
