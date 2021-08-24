#!/usr/bin/env python3
from setuptools import find_packages, setup

long_description = open("README.md", "r", encoding="utf-8").read()

setup(
    name="synthexplore",
    version="0.0.1",
    description="2D Synth Patch Exploration Interface",
    author="Jordie Shier",
    author_email="jordieshier@gmail.com",
    url="https://github.com/neuralaudio/hear-baseline",
    license="",
    long_description=long_description,
    long_description_content_type="text/markdown",
    project_urls={
    },
    packages=find_packages(exclude=("tests",)),
    python_requires=">=3.6",
    install_requires=[
        "django",
        "mysqlclient",
    ],
    extras_require={
        "test": [
            "pytest",
            "pytest-cov",
            "pytest-env",
        ],
        "dev": [
            "torch",
            "torchsynth",
            "librosa",
            "umap",
            "pre-commit",
            "black",  # Used in pre-commit hooks
            "pytest",
            "pytest-cov",
            "pytest-env",
        ],
    },
)
