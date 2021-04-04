from django.db import models


class Synth(models.Model):
    name = models.CharField(max_length=200)

    def __unicode__(self):
        return self.name


class SynthPatch(models.Model):
    name = models.CharField(max_length=200, unique=True)
    synth = models.ForeignKey('Synth', on_delete=models.CASCADE)
    path = models.FilePathField(max_length=200)


class SpectralFeatures(models.Model):
    patch = models.OneToOneField(SynthPatch, on_delete=models.CASCADE, primary_key=True)
    rms = models.FloatField(blank=True, null=True)
    spectral_centroid = models.FloatField(blank=True, null=True)
    spectral_bandwidth = models.FloatField(blank=True, null=True)
    spectral_flatness = models.FloatField(blank=True, null=True)
    spectral_rolloff = models.FloatField(blank=True, null=True)
    zcr = models.FloatField(blank=True, null=True)


class UmapSpectral(models.Model):
    patch = models.OneToOneField(SynthPatch, on_delete=models.CASCADE, primary_key=True)
    dim_1 = models.FloatField(blank=True, null=True)
    dim_2 = models.FloatField(blank=True, null=True)


class UmapMFCC(models.Model):
    patch = models.OneToOneField(SynthPatch, on_delete=models.CASCADE, primary_key=True)
    dim_1 = models.FloatField(blank=True, null=True)
    dim_2 = models.FloatField(blank=True, null=True)
