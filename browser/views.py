from django.shortcuts import render
from django.http import JsonResponse
import json

from browser.models import SynthPatch, UmapMFCC

def index(request):
    return render(request, 'browser/index.html', {})


def get_data(request):
    features = UmapMFCC.objects.order_by('?')[:100]
    coordinates = []
    filenames = []
    for feature in features:
        coordinates.append({'coordinates': [feature.dim_1, feature.dim_2]})
        filenames.append(feature.patch.path)

    data = {
        'umapwavenet22': coordinates,
        'filenames': filenames
    }

    return JsonResponse(data)