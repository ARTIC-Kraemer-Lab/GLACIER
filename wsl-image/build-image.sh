#!/bin/bash

NEXTFLOW_VER="25.10.3"

apt update && \
    apt upgrade -y && \
    apt install -y \
    openjdk-21-jre-headless \
    docker.io

useradd user
echo "user:user" | chpasswd
usermod -aG docker user

wget --directory-prefix /usr/local/bin/ https://github.com/nextflow-io/nextflow/releases/download/v${NEXTFLOW_VER}/nextflow

chmod 755 /usr/local/bin/nextflow

mkdir -p /home/user/.nextflow
chmod 755 /usr/local/bin/nextflow

nextflow info

chown -R user:user /home/user/.nextflow

usermod -aG docker user

cp wsl-image/wsl.conf /etc/wsl.conf
cp wsl-image/wsl-distribution.conf /etc/wsl-distribution.conf

echo "export PATH=/usr/local/bin:\$PATH" >> /home/user/.bashrc

sed -i 's/127.0.1.1.*/127.0.1.1 glacier/' /etc/hosts

systemctl enable docker
systemctl start docker