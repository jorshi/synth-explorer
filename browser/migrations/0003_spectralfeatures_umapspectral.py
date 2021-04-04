# Generated by Django 3.1.7 on 2021-04-04 02:04

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('browser', '0002_auto_20210401_0353'),
    ]

    operations = [
        migrations.CreateModel(
            name='SpectralFeatures',
            fields=[
                ('patch', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, serialize=False, to='browser.synthpatch')),
                ('rms', models.FloatField(blank=True, null=True)),
                ('spectral_centroid', models.FloatField(blank=True, null=True)),
                ('spectral_bandwidth', models.FloatField(blank=True, null=True)),
                ('spectral_flatness', models.FloatField(blank=True, null=True)),
                ('spectral_rolloff', models.FloatField(blank=True, null=True)),
                ('zcr', models.FloatField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='UmapSpectral',
            fields=[
                ('patch', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, serialize=False, to='browser.synthpatch')),
                ('dim_1', models.FloatField(blank=True, null=True)),
                ('dim_2', models.FloatField(blank=True, null=True)),
            ],
        ),
    ]