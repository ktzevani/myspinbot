"""
MySpinBot Worker
--------------------------------
GPU-enabled Python worker responsible for:
 • consuming Redis Streams jobs
 • executing training/generation tasks
 • publishing progress + status
 • exposing Prometheus metrics

This package is designed to be self-contained and production-ready.
"""

__version__ = "0.2.0"
