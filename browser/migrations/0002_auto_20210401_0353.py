# Generated by Django 3.1.7 on 2021-04-01 03:53

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('browser', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='umapmfcc',
            name='id',
        ),
        migrations.AlterField(
            model_name='synthpatch',
            name='name',
            field=models.CharField(max_length=200, unique=True),
        ),
        migrations.AlterField(
            model_name='umapmfcc',
            name='patch',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, serialize=False, to='browser.synthpatch'),
        ),
    ]
