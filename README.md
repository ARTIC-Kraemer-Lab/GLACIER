# GLACIER

[![GLACIER](https://github.com/ARTIC-Kraemer-Lab/GLACIER/actions/workflows/GLACIER.yml/badge.svg)](https://github.com/ARTIC-Kraemer-Lab/GLACIER/actions/workflows/GLACIER.yml) [![Documentation Status](https://readthedocs.org/projects/glacier/badge/?version=latest)](https://glacier.readthedocs.io/en/latest/?badge=latest) [![DOI](https://zenodo.org/badge/1017435695.svg)](https://doi.org/10.5281/zenodo.21980095)

**G**raphical **L**aunchpad for **A**nalysis, **C**omputation, **I**nference and **E**xplication of **R**esults

GLACIER is an open-source graphical desktop application for discovering, installing, configuring, and running Nextflow workflows without requiring users to interact with the command line.

GLACIER aims to make reproducible bioinformatic workflows more accessible to researchers without dedicated bioinformatics expertise, while retaining the flexibility and compatibility of the underlying Nextflow workflows. It was developed as part of ARTIC Network activities supporting pathogen genomics capacity building.

📖 **Documentation:** [ReadTheDocs](https://glacier.readthedocs.io/en/latest)

## Download

Pre-built installers are available on the [Releases page](https://github.com/ARTIC-Kraemer-Lab/GLACIER/releases).

Please report bugs and other issues through the [GitHub issue tracker](https://github.com/ARTIC-Kraemer-Lab/GLACIER/issues).

## Usage

Within the application:

1. Click **Actions → Add a Catalogue** and enter a catalogue name, e.g. `artic-network`.
2. Select **Install** on a workflow card to install the workflow.
3. Select **Run** to configure and launch it.

For further information, see the [GLACIER documentation](https://glacier.readthedocs.io/en/latest).

## Citation

If you use GLACIER in your work, please cite the software using:

**Brittain, J.-S., Wilkinson, S. A. J., Loman, N., O'Toole, Á. N., Constantinides, B., Tsui, J., Rambaut, A., & Kraemer, M. (2026). _GLACIER: Graphical Launchpad for Analysis, Computation, Inference and Explication of Results_. https://doi.org/10.5281/zenodo.21980096.**

## Building from source

See [`dev/README.md`](dev/README.md) for build prerequisites, packaging, and testing instructions.

## License

GLACIER is distributed under the [GNU General Public License v3.0](LICENSE).
