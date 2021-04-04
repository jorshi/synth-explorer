from django.shortcuts import render
from django.http import JsonResponse
import json

from browser.models import SynthPatch, UmapMFCC

def index(request):
    return render(request, 'browser/index.html', {})


def get_data(request):
    synth = request.GET.get('synth', '')
    num_samples = int(request.GET.get('num_samples', 0))
    features = UmapMFCC.objects.order_by('?')[:num_samples]
    coordinates = []
    filenames = []
    for feature in features:
        coordinates.append({'coordinates': [feature.dim_1, feature.dim_2]})
        filenames.append(feature.patch.path)

    data = {
        'features': coordinates,
        'filenames': filenames
    }

    return JsonResponse(data)