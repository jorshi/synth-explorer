"""
Script for loading samples contained in a folder
structure SamplePack/kit_xx/kick/sample.wav
into the database model
"""
import os
import json

from django.core.management.base import BaseCommand
from django.templatetags.static import static
from browser.models import Synth, SynthPatch, UmapMFCC, SpectralFeatures, UmapSpectral


class Command(BaseCommand):
    help = 'Load drum samples into database'

    def handle(self, *args, **options):

        patches = list(SynthPatch.objects.all())

        # Evaluate queries
        mfcc_umap = list(UmapMFCC.objects.filter(patch__in=patches))
        spectral_umap = list(UmapSpectral.objects.filter(patch__in=patches))
        spectral = list(SpectralFeatures.objects.filter(patch__in=patches))

        features = []
        filenames = []

        print(len(spectral_umap))

        for i, patch in enumerate(patches):
            features.append({
                'coordinates': [mfcc_umap[i].dim_1, mfcc_umap[i].dim_2],
                'pitch': patch.pitch,
                'mfcc_dim1': mfcc_umap[i].dim_1,
                'mfcc_dim2': mfcc_umap[i].dim_2,
                'spectral_dim1': spectral_umap[i].dim_1,
                'spectral_dim2': spectral_umap[i].dim_2,
                'rms': spectral[i].rms,
                'spectral_centroid': spectral[i].spectral_centroid,
                'spectral_bandwidth': spectral[i].spectral_bandwidth,
                'spectral_flatness': spectral[i].spectral_flatness,
                'spectral_rolloff': spectral[i].spectral_rolloff,
                'zcr': spectral[i].zcr
            })
            filenames.append(os.path.join("browser", patch.path[1:]))

        data = {
            'features': features,
            'filenames': filenames,
            'feature_names': {
                "pitch": "Keyboard Note",
                "rms": "RMS Amplitude",
                "spectral_centroid": "Spectral Centroid",
                'spectral_bandwidth': "Spectral Bandwidth",
                'spectral_flatness': "Spectral Flatness",
                'spectral_rolloff': "Spectral Rolloff",
                'zcr': "Zero Crossing Rate",
                'mfcc_dim1': "MFCC-UMAP Dim 1",
                'mfcc_dim2': "MFCC-UMAP Dim 2",
                "spectral_dim1": "Spectral-UMAP Dim 1",
                "spectral_dim2": "Spectral-UMAP Dim 2",
            },
            'feature_desc': {
                "pitch": "Note played on synthesizer",
                "rms": "Measurement of loudness",
                "spectral_centroid": "Brightness of a sound",
                'spectral_bandwidth': "How many different frequencies a sound is composed of",
                'spectral_flatness': "Higher values indicate a noisier sound",
                'spectral_rolloff': "Higher values indicate more high frequency present",
                'zcr': "The rate that a a sound crosses the zero point -- associated with the frequency of a sound",
                'mfcc_dim1': "First dimension of a composite embedding based on 13 mel frequency cepstral coefficients",
                'mfcc_dim2': "Second dimension of a composite embedding based on 13 mel frequency cepstral coefficients",
                "spectral_dim1": "First dimension of a composite embedding based on a set of spectral features",
                "spectral_dim2": "Second dimension of a composite embedding based on a set of spectral features2",
            }
        }

        json_str = json.dumps(data)
        js_file = f"const synth_data = {json_str}"
        output_file = "browser/static/browser/js/data.js"
        with open(output_file, "w") as fp:
            fp.write(js_file)
