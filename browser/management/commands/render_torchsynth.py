"""
Script for loading samples contained in a folder
structure SamplePack/kit_xx/kick/sample.wav
into the database model
"""
import os

import torch
import torch.tensor as T
from torchsynth.globals import SynthGlobals
from torchsynth.synth import Voice
from tqdm import tqdm
import librosa
import soundfile as sf

import numpy as np
from sklearn.preprocessing import StandardScaler, MinMaxScaler

import umap

from django.core.management.base import BaseCommand
from django.templatetags.static import static
from browser.models import Synth, SynthPatch, UmapMFCC


class Command(BaseCommand):
    help = 'Load drum samples into database'

    def add_arguments(self, parser):
        parser.add_argument('start_batch', nargs=1, type=int)
        parser.add_argument('num_batches', nargs=1, type=int)
        parser.add_argument('audio_folder', nargs=1, type=str)

    def handle(self, *args, **options):

        device = "cuda" if torch.cuda.is_available() else "cpu"
        synthglobals = SynthGlobals(batch_size=T(64))
        voice = Voice(synthglobals).to(device)

        batch_idx = options['start_batch'][0]
        num_batches = options['num_batches'][0]
        features = []
        patches = []
        audio_root = os.path.abspath(options['audio_folder'][0])

        # Check for Synth1B1 - make it if it doesn't exist
        try:
            synth = Synth.objects.get(name="synth1B1")
        except Synth.DoesNotExist:
            synth = Synth(name="synth1B1")
            synth.save()

        for i in tqdm(range(batch_idx, batch_idx + num_batches)):
            output = voice(i).detach().cpu().numpy()
            for j, sample in enumerate(output):
                features.append(librosa.feature.mfcc(sample, sr=voice.sample_rate.item()))

                # Create a synth patch
                name = f"synth1B1-{i}-{j}"
                try:
                    new_patch = SynthPatch.objects.get(name=name, synth=synth)
                except SynthPatch.DoesNotExist:
                    new_patch = SynthPatch(name=name, synth=synth)

                # Save patch audio
                path = os.path.join(audio_root, f"{name}.ogg")
                sf.write(path, sample, voice.sample_rate.item())

                new_patch.path = os.path.join(static("browser/audio"), f"{name}.ogg")
                new_patch.save()
                patches.append(new_patch)

        print("Preprocessing features")
        features = np.array(features)
        features = np.concatenate([features.mean(axis=2), features.std(axis=2)], axis=1)
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)

        print("Reducing dimensionality")
        reducer = umap.UMAP()
        reduced = reducer.fit_transform(features_scaled)

        scaler = MinMaxScaler()
        reduced_scaled = scaler.fit_transform(reduced)

        for i, patch in enumerate(patches):
            try:
                reduced_features = UmapMFCC.objects.get(patch=patch)
            except UmapMFCC.DoesNotExist:
                reduced_features = UmapMFCC(patch=patch)

            reduced_features.dim_1 = reduced_scaled[i][0]
            reduced_features.dim_2 = reduced_scaled[i][1]
            reduced_features.save()
