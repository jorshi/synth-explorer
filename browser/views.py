from django.shortcuts import render
from django.http import JsonResponse
import json

from browser.models import SynthPatch, UmapMFCC, UmapSpectral, SpectralFeatures

def index(request):
    return render(request, 'browser/index.html', {})


def get_data(request):
    synth = request.GET.get('synth', '')
    num_samples = int(request.GET.get('num_samples', 0))

    patches = SynthPatch.objects.order_by('?')[:num_samples]
    patches = [p for p in patches]
    mfcc_umap = UmapMFCC.objects.filter(patch__in=patches)
    spectral_umap = UmapSpectral.objects.filter(patch__in=patches)
    print(len(spectral_umap))
    spectral = SpectralFeatures.objects.filter(patch__in=patches)
    features = []
    filenames = []

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
        filenames.append(patch.path)

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

    return JsonResponse(data)