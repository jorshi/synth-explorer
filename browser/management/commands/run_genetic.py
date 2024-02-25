"""
Script for running genetic algorithm optimizatation on synthesis parameters
"""
import os
from pathlib import Path

import evotorch
from evotorch.logging import StdOutLogger
from evotorch.algorithms import GeneticAlgorithm
from evotorch.operators import TwoPointCrossOver, PolynomialMutation
# import torch
# from torch import tensor as T
# from torchsynth.synth import Voice
# from tqdm import tqdm
# import librosa
import numpy as np
from scipy.io import wavfile

# import numpy as np
# from sklearn.preprocessing import StandardScaler, MinMaxScaler

# import umap

from django.core.management.base import BaseCommand
from django.templatetags.static import static

from ohc.vst import VSTHost
from ohc.fitness.fitness import FitnessFunction
from ohc.fitness.clap import CLAPSimilarity


SAMPLE_RATE = 48000
BLOCK_SIZE = 512

from browser.models import Synth, SynthPatch, UmapMFCC, SpectralFeatures, UmapSpectral, TextFeatures


class Command(BaseCommand):
    help = 'Load drum samples into database'

    def add_arguments(self, parser):
        parser.add_argument('vst', nargs=1, type=str)
        #parser.add_argument('prompts', nargs="+", type=str)

    # def extract_spectral_features(self, audio, sample_rate):
    #     rms = librosa.feature.rms(audio)
    #     stft = np.abs(librosa.stft(audio))

    #     centroid = librosa.feature.spectral_centroid(S=stft, sr=sample_rate)
    #     bandwidth = librosa.feature.spectral_bandwidth(S=stft, sr=sample_rate)
    #     flatness = librosa.feature.spectral_flatness(S=stft)
    #     rolloff = librosa.feature.spectral_rolloff(S=stft, sr=sample_rate)
    #     zcr = librosa.feature.zero_crossing_rate(audio)

    #     return np.array([
    #         rms.mean(),
    #         np.average(centroid, weights=rms),
    #         np.average(bandwidth, weights=rms),
    #         np.average(flatness, weights=rms),
    #         np.average(rolloff, weights=rms),
    #         np.average(zcr, weights=rms),
    #     ])

    def handle(self, *args, **options):

        print("Running genetic algorithm")

        vst = VSTHost(options["vst"][0], "fixed", SAMPLE_RATE, BLOCK_SIZE)
        
        # Select the correct parameters
        params = vst.list_params(filter_midi_cc=True)
        active_params = [p for p in params if p != "Bypass"]
        vst.set_active_params(active_params)

        # Initialize CLAP
        clap = CLAPSimilarity(sample_rate=SAMPLE_RATE)

        # Initialize the fitness function
        text_target = ["percussive", "metallic", "sharp", "bright"]

        fitness = FitnessFunction(vst, clap, text_target=text_target)
        problem = evotorch.Problem(
            ["max"] * len(text_target),
            fitness.compute,
            solution_length=len(active_params),
            initial_bounds=(0, 1),
            bounds=(0, 1),
        )

        ga = GeneticAlgorithm(
            problem,
            popsize=128,
            operators=[
                TwoPointCrossOver(problem, tournament_size=4),
                PolynomialMutation(problem),
            ],
            re_evaluate=False,
        )

        _ = StdOutLogger(ga)  # Report the evolution's progress to standard output

        ga.run(10)

        audio_root = Path("browser/static/browser/audio")
        audio_root.mkdir(parents=True, exist_ok=True)

        try:
            synth = Synth.objects.get(name="synth1B1")
        except Synth.DoesNotExist:
            synth = Synth(name="synth1B1")
            synth.save()

        patches = []
        for i, solution in enumerate(ga.population):
            audio = vst.render_now(solution.values.unsqueeze(0), 58, 1.0, 1.0)[0][0]

            # Create a synth patch
            name = f"dexed-{i}"
            try:
                new_patch = SynthPatch.objects.get(name=name, synth=synth)
            except SynthPatch.DoesNotExist:
                new_patch = SynthPatch(name=name, synth=synth)

            # Save patch audio
            path = os.path.join(audio_root, f"{name}.wav")

            audio = audio / np.abs(audio).max()
            wavfile.write(path, SAMPLE_RATE, audio.transpose())

            new_patch.path = os.path.join(static("browser/audio"), f"{name}.wav")
            new_patch.pitch = 58
            new_patch.save()
            patches.append(new_patch)

            # Save text features
            try:
                text_features = TextFeatures.objects.get(patch=new_patch)
            except TextFeatures.DoesNotExist:
                text_features = TextFeatures(patch=new_patch)
            
            text_features.percussive = solution.evals[0]
            text_features.metallic = solution.evals[1]
            text_features.sharp = solution.evals[2]
            text_features.bright = solution.evals[3]
            text_features.save()

        # Check for Synth1B1 - make it if it doesn't exist
        # try:
        #     synth = Synth.objects.get(name="synth1B1")
        # except Synth.DoesNotExist:
        #     synth = Synth(name="synth1B1")
        #     synth.save()

        # for i in tqdm(range(batch_idx, batch_idx + num_batches)):
        #     output, params, is_train = voice(i)
        #     output = output.detach().cpu().numpy()
        #     midi_f0 = voice.keyboard.p("midi_f0").detach().cpu().numpy()

        #     for j, sample in enumerate(tqdm(output)):
        #         mfccs.append(librosa.feature.mfcc(sample, sr=sample_rate))
        #         spectral_features = self.extract_spectral_features(sample, sample_rate)
        #         spectral.append(spectral_features)

        #         # Create a synth patch
        #         name = f"synth1B1-{i}-{j}"
        #         try:
        #             new_patch = SynthPatch.objects.get(name=name, synth=synth)
        #         except SynthPatch.DoesNotExist:
        #             new_patch = SynthPatch(name=name, synth=synth)

        #         # Save patch audio
        #         path = os.path.join(audio_root, f"{name}.ogg")
        #         sf.write(path, sample, int(voice.sample_rate.item()))

        #         new_patch.path = os.path.join(static("browser/audio"), f"{name}.ogg")
        #         new_patch.pitch = midi_f0[j] / 127.0
        #         new_patch.save()
        #         patches.append(new_patch)

        # print("Preprocessing features")
        # features = np.array(mfccs)
        # features = np.concatenate([features.mean(axis=2), features.std(axis=2)], axis=1)
        # scaler = StandardScaler()
        # features_scaled = scaler.fit_transform(features)
        # spectral_scaled = scaler.fit_transform(spectral)

        # # Min/Max scale all the spectral features
        # spectral = np.array(spectral)
        # spectral = (spectral - spectral.min(axis=0)) / (spectral.max(axis=0) - spectral.min(axis=0))

        # print("Reducing MFCC dimensionality")
        # reducer = umap.UMAP()
        # reduced = reducer.fit_transform(features_scaled)

        # scaler = MinMaxScaler()
        # reduced_scaled = scaler.fit_transform(reduced)

        # print("Reducing Spectral dimensionality")
        # reduced = reducer.fit_transform(spectral_scaled)
        # reduced_spectral = scaler.fit_transform(reduced)

        # print("Saving Objects")
        # for i, patch in enumerate(patches):
        #     # Save the spectral features
        #     try:
        #         spectral_features = SpectralFeatures.objects.get(patch=patch)
        #     except SpectralFeatures.DoesNotExist:
        #         spectral_features = SpectralFeatures(patch=patch)

        #     spectral_features.rms = spectral[i][0]
        #     spectral_features.spectral_centroid = spectral[i][1]
        #     spectral_features.spectral_bandwidth = spectral[i][2]
        #     spectral_features.spectral_flatness = spectral[i][3]
        #     spectral_features.spectral_rolloff = spectral[i][4]
        #     spectral_features.zcr = spectral[i][5]
        #     spectral_features.save()

        #     # Save spectral UMAP
        #     try:
        #         spectral_umap = UmapSpectral.objects.get(patch=patch)
        #     except UmapSpectral.DoesNotExist:
        #         spectral_umap = UmapSpectral(patch=patch)

        #     spectral_umap.dim_1 = reduced_spectral[i][0]
        #     spectral_umap.dim_2 = reduced_spectral[i][1]
        #     spectral_umap.save()

        #     # Save the UMAP MFCCs
        #     try:
        #         reduced_features = UmapMFCC.objects.get(patch=patch)
        #     except UmapMFCC.DoesNotExist:
        #         reduced_features = UmapMFCC(patch=patch)

        #     reduced_features.dim_1 = reduced_scaled[i][0]
        #     reduced_features.dim_2 = reduced_scaled[i][1]
        #     reduced_features.save()
