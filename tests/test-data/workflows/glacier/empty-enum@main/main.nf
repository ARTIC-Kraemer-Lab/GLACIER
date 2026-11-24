#!/usr/bin/env nextflow
nextflow.enable.dsl=2

process ECHO {
  debug true

  script:
  """
  echo "model=${params.model ?: 'none'}"
  """
}

workflow {
  ECHO()
}
