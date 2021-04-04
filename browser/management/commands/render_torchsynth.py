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
from browser.models import Synth, SynthPatch, UmapMFCC, SpectralFeatures, UmapSpectral


class Command(BaseCommand):
    help = 'Load drum samples into database'

    def add_arguments(self, parser):
        parser.add_argument('start_batch', nargs=1, type=int)
        parser.add_argument('num_batches', nargs=1, type=int)
        parser.add_argument('audio_folder', nargs=1, type=str)

    def extract_spectral_features(self, audio, sample_rate):
        rms = librosa.feature.rms(audio)
        stft = np.abs(librosa.stft(audio))

        centroid = librosa.feature.spectral_centroid(S=stft, sr=sample_rate)
        bandwidth = librosa.feature.spectral_bandwidth(S=stft, sr=sample_rate)
        flatness = librosa.feature.spectral_flatness(S=stft)
        rolloff = librosa.feature.spectral_rolloff(S=stft, sr=sample_rate)
        zcr = librosa.feature.zero_crossing_rate(audio)

        return np.array([
            rms.mean(),
            centroid.mean(),
            bandwidth.mean(),
            flatness.mean(),
            rolloff.mean(),
            zcr.mean()
        ])

    def handle(self, *args, **options):

        device = "cuda" if torch.cuda.is_available() else "cpu"
        synthglobals = SynthGlobals(batch_size=T(64))
        sample_rate = synthglobals.sample_rate.item()
        voice = Voice(synthglobals).to(device)

        batch_idx = options['start_batch'][0]
        num_batches = options['num_batches'][0]

        # Features
        mfccs = []
        spectral = []

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
                mfccs.append(librosa.feature.mfcc(sample, sr=sample_rate))
                spectral_features = self.extract_spectral_features(sample, sample_rate)
                spectral.append(spectral_features)

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
        features = np.array(mfccs)
        features = np.concatenate([features.mean(axis=2), features.std(axis=2)], axis=1)
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        spectral_scaled = scaler.fit_transform(spectral)

        # Min/Max scale all the spectral features
        spectral = np.array(spectral)
        spectral = (spectral - spectral.min(axis=0)) / (spectral.max(axis=0) - spectral.min(axis=0))

        print("Reducing MFCC dimensionality")
        reducer = umap.UMAP()
        reduced = reducer.fit_transform(features_scaled)

        scaler = MinMaxScaler()
        reduced_scaled = scaler.fit_transform(reduced)

        print("Reducing Spectral dimensionality")
        reduced = reducer.fit_transform(spectral_scaled)
        reduced_spectral = scaler.fit_transform(reduced)

        print("Saving Objects")
        for i, patch in enumerate(patches):
            # Save the spectral features
            try:
                spectral_features = SpectralFeatures.objects.get(patch=patch)
            except SpectralFeatures.DoesNotExist:
                spectral_features = SpectralFeatures(patch=patch)

            spectral_features.rms = spectral[i][0]
            spectral_features.spectral_centroid = spectral[i][1]
            spectral_features.spectral_bandwidth = spectral[i][2]
            spectral_features.spectral_flatness = spectral[i][3]
            spectral_features.spectral_rolloff = spectral[i][4]
            spectral_features.zcr = spectral[i][5]
            spectral_features.save()

            # Save spectral UMAP
            try:
                spectral_umap = UmapSpectral.objects.get(patch=patch)
            except UmapSpectral.DoesNotExist:
                spectral_umap = UmapSpectral(patch=patch)

            spectral_umap.dim_1 = reduced_spectral[i][0]
            spectral_umap.dim_2 = reduced_spectral[i][1]

            # Save the UMAP MFCCs
            try:
                reduced_features = UmapMFCC.objects.get(patch=patch)
            except UmapMFCC.DoesNotExist:
                reduced_features = UmapMFCC(patch=patch)

            reduced_features.dim_1 = reduced_scaled[i][0]
            reduced_features.dim_2 = reduced_scaled[i][1]
            reduced_features.save()
