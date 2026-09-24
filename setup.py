from setuptools import setup, find_packages

setup(
    name="oceanembed",
    version="2.2.0",
    description="Deep Learning Reconstruction of Subsurface Ocean Temperature from Satellite Surface Observations",
    author="OceanEmbed Team (MoES - INCOIS PS-26066)",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "numpy",
        "scipy",
        "torch",
        "fastapi",
        "uvicorn",
        "scikit-learn"
    ],
    entry_points={
        "console_scripts": [
            "oceanembed = src.cli:main"
        ]
    }
)
