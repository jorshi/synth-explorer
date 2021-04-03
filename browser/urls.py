from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('ajax/get_data.json', views.get_data, name='get_data')
]
