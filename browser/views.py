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
        })
        filenames.append(patch.path)

    data = {
        'features': features,
        'filenames': filenames,
        'feature_names': {
            "pitch": "Keyboard Note",
            'mfcc_dim1': "MFCC-UMAP Dim 1",
            'mfcc_dim2': "MFCC-UMAP Dim 2",
            "spectral_dim1": "Spectral-UMAP Dim 1",
            "spectral_dim2": "Spectral-UMAP Dim 2",
        }
    }

    return JsonResponse(data)