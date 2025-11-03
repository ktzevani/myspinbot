import os
import time
import redis
from prometheus_client import start_http_server, Counter, Gauge

# simple startup metrics
jobs_processed = Counter("gpu_jobs_processed_total", "Number of GPU jobs processed")
gpu_busy = Gauge("gpu_busy", "Whether GPU is active (1=busy,0=idle)")


def main():
    redis_host = os.getenv("REDIS_HOST", "redis")
    r = redis.Redis(host=redis_host, port=6379, decode_responses=True)
    start_http_server(9080)
    print("✅ Worker ready. Listening for jobs...")
    while True:
        gpu_busy.set(0)
        time.sleep(5)
        gpu_busy.set(1)
        jobs_processed.inc()
        print("Simulated GPU job completed.")


if __name__ == "__main__":
    main()
