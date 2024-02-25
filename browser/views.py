from django.shortcuts import render
from django.http import JsonResponse
import json

from browser.models import SynthPatch, UmapMFCC, UmapSpectral, SpectralFeatures, TextFeatures

def index(request):
    return render(request, 'browser/index.html', {})


def get_data(request):    
    synth = request.GET.get('synth', '')
    num_samples = int(request.GET.get('num_samples', 0))

    patches = SynthPatch.objects.order_by('?')[:num_samples]
    patches = [p for p in patches]
    text = TextFeatures.objects.filter(patch__in=patches)
    features = []
    filenames = []

    for i, patch in enumerate(patches):
        features.append({
            'coordinates': [text[i].percussive, text[i].metallic],
            'pitch': patch.pitch,
            'percussive': text[i].percussive,
            'metallic': text[i].metallic,
            'sharp': text[i].sharp,
            'bright': text[i].bright,
        })
        filenames.append(patch.path)

    data = {
        'features': features,
        'filenames': filenames,
        'feature_names': {
            "pitch": "Keyboard Note",
            "percussive": "Percussive",
            "metallic": "Metallic",
            'sharp': "Sharp",
            'bright': "Bright"
        },
        'feature_desc': {
            "pitch": "Keyboard Note",
            "percussive": "Percussive",
            "metallic": "Metallic",
            'sharp': "Sharp",
            'bright': "Bright"
        }
    }

    return JsonResponse(data)